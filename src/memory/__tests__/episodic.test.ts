import { EpisodicMemory } from '../episodic.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('EpisodicMemory with hnswsqlite', () => {
    let memory: EpisodicMemory;
    let workDir: string;

    beforeAll(() => {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-episodic-test-'));
        memory = EpisodicMemory.open(workDir);
    });

    afterAll(() => {
        memory.close();
        fs.rmSync(workDir, { recursive: true, force: true });
    });

    it('should initialize without errors and create tables', () => {
        expect(memory).toBeDefined();
        // Since sqlite throws if tables don't exist, simply listing episodes is a valid test
        const episodes = memory.listEpisodes();
        expect(Array.isArray(episodes)).toBe(true);
        expect(episodes.length).toBe(0);
    });

    it('should insert an episode into sqlite and the vector index', () => {
        // Mock a 1536-dimensional vector (what OpenAI Ada-002 / text-embedding-3 outputs)
        const mockVector = Array.from({ length: 1536 }, () => Math.random());

        const episode = memory.saveEpisode(
            'Create a react component',
            'Tool create_file called...',
            mockVector
        );

        expect(episode).toBeDefined();
        expect(episode.id).toBeGreaterThan(0);
        expect(episode.intent).toBe('Create a react component');
        expect(episode.execution_history).toBe('Tool create_file called...');
    });

    it('should retrieve episodes using KNN similarity search', () => {
        // 1. Target vector we want to match
        const targetVector = Array.from({ length: 1536 }, (_, i) => i % 2 === 0 ? 0.5 : -0.5);

        // 2. Insert target episode
        memory.saveEpisode(
            'Target Memory',
            'This is the memory we want to find',
            targetVector
        );

        // 3. Insert noise episode with very different vector
        const noiseVector = Array.from({ length: 1536 }, (_, i) => i % 2 === 0 ? -0.9 : 0.9);
        memory.saveEpisode(
            'Noise Memory',
            'This should rank lower or be further away',
            noiseVector
        );

        // 4. Search using a vector very close to targetVector
        const searchVector = Array.from({ length: 1536 }, (_, i) => i % 2 === 0 ? 0.45 : -0.45);
        const results = memory.searchSimilar(searchVector, 3); // Request 3 to get target, noise, and the mock from prev test

        expect(results.length).toBeGreaterThan(0);

        // Target memory should be the closest (index 0)
        expect(results[0].episode.intent).toBe('Target Memory');

        // Find the noise memory somewhere in the results and ensure it has a higher distance
        const noiseResult = results.find(r => r.episode.intent === 'Noise Memory');
        if (noiseResult) {
            expect(noiseResult.distance).toBeGreaterThan(results[0].distance);
        }
    });
});
