/**
 * API Authentication Module
 * 
 * Provides API key generation, validation, and Express middleware
 * for securing the Agent Studio REST API endpoints.
 */

import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Request, Response, NextFunction } from 'express';

// ─── Types ───

export interface ApiKey {
    id: string;
    hash: string;
    label: string;
    createdAt: number;
}

interface ApiKeysStore {
    keys: ApiKey[];
}

// ─── Key Storage ───

function getKeysPath(): string {
    return join(process.cwd(), '.agent', 'api-keys.json');
}

async function loadKeys(): Promise<ApiKeysStore> {
    try {
        const raw = await readFile(getKeysPath(), 'utf-8');
        return JSON.parse(raw);
    } catch {
        return { keys: [] };
    }
}

async function saveKeys(store: ApiKeysStore): Promise<void> {
    const dir = join(process.cwd(), '.agent');
    await mkdir(dir, { recursive: true });
    await writeFile(getKeysPath(), JSON.stringify(store, null, 2), 'utf-8');
}

// ─── Key Operations ───

function hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a new API key. Returns the raw key (shown only once) and the stored metadata.
 */
export async function generateApiKey(label = 'default'): Promise<{ rawKey: string; entry: ApiKey }> {
    const rawKey = `oas_${randomBytes(24).toString('hex')}`;
    const entry: ApiKey = {
        id: randomBytes(8).toString('hex'),
        hash: hashKey(rawKey),
        label,
        createdAt: Date.now(),
    };

    const store = await loadKeys();
    store.keys.push(entry);
    await saveKeys(store);

    return { rawKey, entry };
}

/**
 * List all stored API keys (hashes only, never the raw key).
 */
export async function listApiKeys(): Promise<ApiKey[]> {
    const store = await loadKeys();
    return store.keys;
}

/**
 * Revoke an API key by its ID.
 */
export async function revokeApiKey(id: string): Promise<boolean> {
    const store = await loadKeys();
    const before = store.keys.length;
    store.keys = store.keys.filter(k => k.id !== id);
    if (store.keys.length === before) return false;
    await saveKeys(store);
    return true;
}

/**
 * Validate a raw API key against stored hashes using constant-time comparison.
 */
export async function validateApiKey(rawKey: string): Promise<boolean> {
    const store = await loadKeys();
    const incoming = hashKey(rawKey);
    const incomingBuf = Buffer.from(incoming, 'hex');

    for (const entry of store.keys) {
        const storedBuf = Buffer.from(entry.hash, 'hex');
        if (incomingBuf.length === storedBuf.length && timingSafeEqual(incomingBuf, storedBuf)) {
            return true;
        }
    }
    return false;
}

/**
 * Ensure at least one API key exists. If none, generate a default key and return it.
 */
export async function ensureDefaultKey(): Promise<string | null> {
    const store = await loadKeys();
    if (store.keys.length > 0) return null;

    const { rawKey } = await generateApiKey('auto-generated');
    return rawKey;
}

// ─── Express Middleware ───

/**
 * Express middleware that validates API key from:
 *  1. Authorization: Bearer <key>
 *  2. ?token=<key> query parameter
 * 
 * Skips auth for GET /api/health and static file serving.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Skip auth for health check and non-API routes
    if (req.path === '/api/health' || !req.path.startsWith('/api/')) {
        next();
        return;
    }

    // Skip auth for read-only instance listing (needed for Studio UI)
    if (req.path === '/api/instances' && req.method === 'GET') {
        next();
        return;
    }

    // Skip auth for localhost / same-origin requests (Studio UI served locally)
    const host = req.hostname || req.headers.host || '';
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('localhost:') || host.startsWith('127.0.0.1:')) {
        next();
        return;
    }

    // Extract key from Authorization header or query param
    let key: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        key = authHeader.slice(7);
    } else if (typeof req.query.token === 'string') {
        key = req.query.token;
    }

    if (!key) {
        res.status(401).json({ error: 'Authentication required. Provide Authorization: Bearer <key> header or ?token=<key> query parameter.' });
        return;
    }

    validateApiKey(key).then(valid => {
        if (valid) {
            next();
        } else {
            res.status(403).json({ error: 'Invalid API key.' });
        }
    }).catch(() => {
        res.status(500).json({ error: 'Authentication check failed.' });
    });
}
