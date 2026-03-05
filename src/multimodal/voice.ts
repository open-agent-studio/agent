// ─── Voice Input (Speech-to-Text) ───
// Uses OpenAI Whisper API for transcription.

import { readFileSync } from 'node:fs';
import type { VoiceConfig, TranscriptionResult } from './types.js';

export class VoiceInput {
    private config: VoiceConfig;
    private apiKey: string;

    constructor(config: VoiceConfig, apiKey: string) {
        this.config = config;
        this.apiKey = apiKey;
    }

    /**
     * Transcribe an audio file using Whisper.
     */
    async transcribe(audioPath: string): Promise<TranscriptionResult> {
        const audioData = readFileSync(audioPath);
        const blob = new Blob([audioData]);

        const formData = new FormData();
        formData.append('file', blob, `audio.${this.config.format}`);
        formData.append('model', this.config.model);
        if (this.config.language) {
            formData.append('language', this.config.language);
        }
        formData.append('response_format', 'verbose_json');

        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Whisper API Error: ${err.error?.message || JSON.stringify(err)}`);
        }

        const data = await res.json() as { text: string; language?: string; duration?: number };

        return {
            text: data.text,
            language: data.language,
            duration: data.duration,
        };
    }
}
