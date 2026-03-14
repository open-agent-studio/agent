#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const mongoUrl = process.env.MONGO_DATABASE_URL;
const pgUrl = process.env.POSTGRESQL_DATABASE_URL;
const outFile = process.env.OPERATOR_CONTEXT_OUT || '.agent/context/business-context.md';

async function main() {
  const sections = [];
  sections.push('# Business Context Snapshot');
  sections.push(`Generated: ${new Date().toISOString()}`);
  sections.push('');
  sections.push('This file contains schema/metadata and aggregate signals only.');
  sections.push('No row-level PII should be copied into this artifact.');
  sections.push('');

  if (!mongoUrl) {
    sections.push('## MongoDB');
    sections.push('- Skipped: `MONGO_DATABASE_URL` not set.');
    sections.push('');
  } else {
    sections.push(await collectMongoContext(mongoUrl));
  }

  if (!pgUrl) {
    sections.push('## PostgreSQL');
    sections.push('- Skipped: `POSTGRESQL_DATABASE_URL` not set.');
    sections.push('');
  } else {
    sections.push(await collectPostgresContext(pgUrl));
  }

  sections.push('## Operator Notes');
  sections.push('- Use this file as pinned context for business-aware planning.');
  sections.push('- If critical metrics are missing, ask clarifying questions before recommendations.');
  sections.push('');

  const absOut = path.resolve(process.cwd(), outFile);
  await mkdir(path.dirname(absOut), { recursive: true });
  await writeFile(absOut, sections.join('\n'), 'utf-8');

  console.log(`Context written to ${outFile}`);
}

async function collectMongoContext(url) {
  let MongoClient;
  try {
    ({ MongoClient } = await import('mongodb'));
  } catch {
    return [
      '## MongoDB',
      '- Failed: `mongodb` package is not installed.',
      '- Install with: `npm install mongodb`',
      '',
    ].join('\n');
  }

  const client = new MongoClient(url, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  });

  try {
    await client.connect();
    const dbName = inferMongoDbName(url);
    const db = client.db(dbName);
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const names = collections.map((c) => c.name).slice(0, 15);

    const lines = [];
    lines.push('## MongoDB');
    lines.push(`- Database: \`${db.databaseName}\``);
    lines.push(`- Collections detected: ${collections.length}`);
    lines.push('');

    for (const name of names) {
      const coll = db.collection(name);
      let estimatedCount = null;
      try {
        estimatedCount = await coll.estimatedDocumentCount();
      } catch {
        estimatedCount = null;
      }

      let sampleKeys = [];
      try {
        const sample = await coll.findOne({}, { projection: { _id: 0 } });
        if (sample && typeof sample === 'object') {
          sampleKeys = Object.keys(sample).slice(0, 12);
        }
      } catch {
        sampleKeys = [];
      }

      lines.push(`### Collection: \`${name}\``);
      lines.push(`- Estimated documents: ${estimatedCount ?? 'n/a'}`);
      lines.push(`- Sample top-level fields: ${sampleKeys.length > 0 ? sampleKeys.join(', ') : 'n/a'}`);
      lines.push('');
    }

    return lines.join('\n');
  } catch (err) {
    return [
      '## MongoDB',
      `- Connection failed: ${err.message}`,
      '',
    ].join('\n');
  } finally {
    await client.close().catch(() => {});
  }
}

async function collectPostgresContext(url) {
  let Client;
  try {
    ({ Client } = await import('pg'));
  } catch {
    return [
      '## PostgreSQL',
      '- Failed: `pg` package is not installed.',
      '- Install with: `npm install pg`',
      '',
    ].join('\n');
  }

  const client = new Client({
    connectionString: url,
    statement_timeout: 8000,
    query_timeout: 8000,
    ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    const tablesRes = await client.query(
      `select table_schema, table_name
       from information_schema.tables
       where table_schema not in ('pg_catalog', 'information_schema')
         and table_type = 'BASE TABLE'
       order by table_schema, table_name
       limit 20`
    );

    const lines = [];
    lines.push('## PostgreSQL');
    lines.push(`- Tables detected (sample): ${tablesRes.rowCount}`);
    lines.push('');

    for (const t of tablesRes.rows) {
      const schema = t.table_schema;
      const table = t.table_name;

      const columnRes = await client.query(
        `select column_name, data_type
         from information_schema.columns
         where table_schema = $1 and table_name = $2
         order by ordinal_position
         limit 12`,
        [schema, table]
      );

      let estimate = null;
      try {
        const est = await client.query(
          `select c.reltuples::bigint as estimate
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = $1 and c.relname = $2`,
          [schema, table]
        );
        estimate = est.rows?.[0]?.estimate ?? null;
      } catch {
        estimate = null;
      }

      lines.push(`### Table: \`${schema}.${table}\``);
      lines.push(`- Estimated rows: ${estimate ?? 'n/a'}`);
      if (columnRes.rowCount > 0) {
        lines.push('- Columns:');
        for (const c of columnRes.rows) {
          lines.push(`  - ${c.column_name} (${c.data_type})`);
        }
      } else {
        lines.push('- Columns: n/a');
      }
      lines.push('');
    }

    return lines.join('\n');
  } catch (err) {
    return [
      '## PostgreSQL',
      `- Connection failed: ${err.message}`,
      '',
    ].join('\n');
  } finally {
    await client.end().catch(() => {});
  }
}

function inferMongoDbName(url) {
  try {
    const u = new URL(url);
    const name = u.pathname.replace(/^\/+/, '');
    return name || 'test';
  } catch {
    return 'test';
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
