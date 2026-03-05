// ─── Text-to-Speech ───
// Uses OpenAI TTS API to generate spoken audio.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TTSConfig, SpeechResult } from './types.js';

export class TextToSpeech {
    private config: TTSConfig;
    private apiKey: string;

    constructor(config: TTSConfig, apiKey: string) {
        this.config = config;
        this.apiKey = apiKey;
    }

    /**
     * Convert text to speech and save as an audio file.
     */
    async speak(text: string, outputDir: string = '/tmp/agent-tts'): Promise<SpeechResult> {
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                input: text,
                voice: this.config.voice,
                response_format: this.config.format,
                speed: this.config.speed,
            }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(`TTS API Error: ${err.error?.message || JSON.stringify(err)}`);
        }

        const audioBuffer = Buffer.from(await res.arrayBuffer());
        const filename = `speech-${Date.now()}.${this.config.format}`;
        const outputPath = join(outputDir, filename);

        // Ensure output dir exists
        const { mkdirSync } = require('node:fs');
        mkdirSync(outputDir, { recursive: true });

        writeFileSync(outputPath, audioBuffer);

        return {
            audioPath: outputPath,
            format: this.config.format,
            text: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
        };
    }
}
