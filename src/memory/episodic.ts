import Database from 'better-sqlite3';
import path from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import hnswlib from 'hnswlib-node';

export interface Episode {
    id: number;
    intent: string;
    execution_history: string;
    created_at: string;
}

export interface EpisodeSearchResult {
    episode: Episode;
    distance: number;
}

/**
 * Episodic Memory — Long-term vector storage for agent experiences
 */
export class EpisodicMemory {
    private db: Database.Database;
    private index: hnswlib.HierarchicalNSW;
    private indexPath: string;
    private dim: number = 1536; // Default to OpenAI embedding size
    private maxElements: number = 10000;

    // Store instances by path to handle different environments/tests
    private static instances: Map<string, EpisodicMemory> = new Map();

    private constructor(dbPath: string) {
        const dir = path.dirname(dbPath);
        mkdirSync(dir, { recursive: true });

        this.db = new Database(dbPath);
        this.indexPath = path.join(dir, 'episodic_vectors.dat');

        // Execute sqlite migrations
        this.migrate();

        // Initialize HNSW index
        this.index = new hnswlib.HierarchicalNSW('l2', this.dim);

        if (existsSync(this.indexPath)) {
            // Load existing index if it exists
            this.index.readIndexSync(this.indexPath);
        } else {
            // Create new index
            this.index.initIndex(this.maxElements);
        }
    }

    public static open(workDir: string): EpisodicMemory {
        const absoluteWorkDir = path.resolve(workDir);
        const dbPath = path.join(absoluteWorkDir, '.agent', 'episodic.db');

        if (!this.instances.has(dbPath)) {
            this.instances.set(dbPath, new EpisodicMemory(dbPath));
        }

        return this.instances.get(dbPath)!;
    }

    private migrate() {
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                intent TEXT NOT NULL,
                execution_history TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    /**
     * Save a completed episode to long-term memory
     */
    public saveEpisode(intent: string, executionHistory: string, vector: number[]): Episode {
        // 1. Insert into SQLite to get the incremental ID
        const stmt = this.db.prepare(`
            INSERT INTO episodes (intent, execution_history)
            VALUES (?, ?)
        `);

        const result = stmt.run(intent, executionHistory);
        const eId = result.lastInsertRowid as number;

        // 2. Insert vector into HNSW index with the SQLite ID
        this.index.addPoint(vector, eId);

        // 3. Persist the index to disk
        this.index.writeIndexSync(this.indexPath);

        return this.getEpisode(eId)!;
    }

    public getEpisode(id: number): Episode | null {
        const stmt = this.db.prepare('SELECT * FROM episodes WHERE id = ?');
        const episode = stmt.get(id) as Episode;
        return episode || null;
    }

    /**
     * Search episodes by vector similarity
     */
    public searchSimilar(vector: number[], limit = 5): EpisodeSearchResult[] {
        // Ensure index has elements, otherwise hnswlib throws
        if (this.index.getCurrentCount() === 0) return [];

        // HNSW search returns { neighbors: number[], distances: number[] }
        const result = this.index.searchKnn(vector, Math.min(limit, this.index.getCurrentCount()));

        const searchResults: EpisodeSearchResult[] = [];

        for (let i = 0; i < result.neighbors.length; i++) {
            const id = result.neighbors[i];
            const distance = result.distances[i];

            const episode = this.getEpisode(id);
            if (episode) {
                searchResults.push({
                    episode,
                    distance
                });
            }
        }

        return searchResults;
    }

    public listEpisodes(limit = 10): Episode[] {
        const stmt = this.db.prepare(`
            SELECT * FROM episodes 
            ORDER BY created_at DESC 
            LIMIT ?
        `);
        return stmt.all(limit) as Episode[];
    }

    public close() {
        this.db.close();
    }
}
