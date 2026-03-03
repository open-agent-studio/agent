import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { hostname } from 'node:os';
import { config as loadDotenv } from 'dotenv';

/**
 * Credential Store — Encrypted vault with interactive capture support
 *
 * Priority chain: vault.json → .env → process.env
 * Values are AES-256-GCM encrypted at rest using a machine-derived key.
 */
export class CredentialStore {
    private vaultPath: string;
    private envPath: string;
    private cache: Map<string, string> = new Map();
    private loaded = false;

    /** Callback for requesting credentials interactively */
    onCredentialRequired?: (key: string, reason: string) => Promise<string | null>;

    constructor(private workDir: string) {
        this.vaultPath = path.join(workDir, '.agent', 'vault.json');
        this.envPath = path.join(workDir, '.env');
    }

    /**
     * Load credentials from all sources
     */
    async load(): Promise<void> {
        if (this.loaded) return;

        // 1. Load .env file
        loadDotenv({ path: this.envPath });

        // 2. Load vault
        try {
            await access(this.vaultPath);
            const raw = await readFile(this.vaultPath, 'utf-8');
            const vault = JSON.parse(raw) as VaultFile;
            for (const [key, entry] of Object.entries(vault.credentials)) {
                try {
                    const decrypted = this.decrypt(entry.value, entry.iv, entry.tag);
                    this.cache.set(key, decrypted);
                } catch {
                    // Skip corrupt entries
                }
            }
        } catch {
            // Vault doesn't exist yet
        }

        this.loaded = true;
    }

    /**
     * Get a credential value.
     * Priority: cache (vault) → .env → process.env → interactive capture → null
     */
    async get(key: string, reason?: string): Promise<string | null> {
        await this.load();

        // 1. Check vault cache
        if (this.cache.has(key)) {
            return this.cache.get(key)!;
        }

        // 2. Check environment
        if (process.env[key]) {
            return process.env[key]!;
        }

        // 3. Interactive capture
        if (this.onCredentialRequired) {
            const value = await this.onCredentialRequired(key, reason || `Credential "${key}" is required`);
            if (value) {
                await this.set(key, value);
                return value;
            }
        }

        return null;
    }

    /**
     * Store a credential in the encrypted vault
     */
    async set(key: string, value: string): Promise<void> {
        await this.load();

        this.cache.set(key, value);
        await this.saveVault();
    }

    /**
     * List all known credential keys (from vault + env)
     */
    async list(): Promise<string[]> {
        await this.load();

        const keys = new Set<string>(this.cache.keys());

        // Add env vars that look like credentials
        for (const key of Object.keys(process.env)) {
            if (this.isCredentialKey(key)) {
                keys.add(key);
            }
        }

        return Array.from(keys).sort();
    }

    /**
     * Check if a credential exists
     */
    async has(key: string): Promise<boolean> {
        await this.load();
        return this.cache.has(key) || !!process.env[key];
    }

    /**
     * Delete a credential from the vault
     */
    async delete(key: string): Promise<void> {
        await this.load();
        this.cache.delete(key);
        await this.saveVault();
    }

    // ── Private ──

    private isCredentialKey(key: string): boolean {
        const patterns = [
            /TOKEN/i, /KEY/i, /SECRET/i, /PASSWORD/i, /PASS/i,
            /API/i, /AUTH/i, /CREDENTIAL/i, /SMTP/i,
        ];
        return patterns.some(p => p.test(key));
    }

    private async saveVault(): Promise<void> {
        const vault: VaultFile = { version: 1, credentials: {} };

        for (const [key, value] of this.cache) {
            const { encrypted, iv, tag } = this.encrypt(value);
            vault.credentials[key] = { value: encrypted, iv, tag, updatedAt: new Date().toISOString() };
        }

        await mkdir(path.dirname(this.vaultPath), { recursive: true });
        await writeFile(this.vaultPath, JSON.stringify(vault, null, 2), 'utf-8');
    }

    private getEncryptionKey(): Buffer {
        // Derive key from machine hostname + project path — deterministic per machine+project
        const seed = `agent-vault:${hostname()}:${this.workDir}`;
        return createHash('sha256').update(seed).digest();
    }

    private encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
        const key = this.getEncryptionKey();
        const iv = randomBytes(16);
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag().toString('hex');
        return { encrypted, iv: iv.toString('hex'), tag };
    }

    private decrypt(encrypted: string, ivHex: string, tagHex: string): string {
        const key = this.getEncryptionKey();
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
        decrypted += decipher.final('utf-8');
        return decrypted;
    }
}

// ── Types ──

interface VaultEntry {
    value: string;      // encrypted hex
    iv: string;         // init vector hex
    tag: string;        // auth tag hex
    updatedAt: string;
}

interface VaultFile {
    version: number;
    credentials: Record<string, VaultEntry>;
}
