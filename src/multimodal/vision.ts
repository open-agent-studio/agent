// ─── Vision (Image Analysis) ───
// Uses OpenAI GPT-4V / GPT-4o for image understanding.

import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import type { VisionConfig, VisionAnalysisResult } from './types.js';

export class VisionAnalyzer {
    private config: VisionConfig;
    private apiKey: string;

    constructor(config: VisionConfig, apiKey: string) {
        this.config = config;
        this.apiKey = apiKey;
    }

    /**
     * Analyze an image with a prompt.
     */
    async analyze(imagePath: string, prompt: string = 'Describe this image in detail.'): Promise<VisionAnalysisResult> {
        // Read and base64-encode the image
        const imageBuffer = readFileSync(imagePath);
        const base64 = imageBuffer.toString('base64');
        const ext = extname(imagePath).slice(1) || 'png';
        const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        const dataUrl = `data:${mimeType};base64,${base64}`;

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                max_tokens: this.config.maxTokens,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: dataUrl,
                                    detail: this.config.detail,
                                },
                            },
                        ],
                    },
                ],
            }),
        });

        if (!res.ok) {
            const err = await res.json() as any;
            throw new Error(`Vision API Error: ${err.error?.message || JSON.stringify(err)}`);
        }

        const data = await res.json() as {
            choices: Array<{ message: { content: string } }>;
            usage: { total_tokens: number };
        };

        return {
            description: data.choices[0]?.message?.content || '',
            model: this.config.model,
            tokensUsed: data.usage?.total_tokens || 0,
        };
    }

    /**
     * Analyze an image from a URL.
     */
    async analyzeUrl(imageUrl: string, prompt: string = 'Describe this image.'): Promise<VisionAnalysisResult> {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                max_tokens: this.config.maxTokens,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            {
                                type: 'image_url',
                                image_url: { url: imageUrl, detail: this.config.detail },
                            },
                        ],
                    },
                ],
            }),
        });

        if (!res.ok) {
            const err = await res.json() as any;
            throw new Error(`Vision API Error: ${err.error?.message || JSON.stringify(err)}`);
        }

        const data = await res.json() as {
            choices: Array<{ message: { content: string } }>;
            usage: { total_tokens: number };
        };

        return {
            description: data.choices[0]?.message?.content || '',
            model: this.config.model,
            tokensUsed: data.usage?.total_tokens || 0,
        };
    }
}
