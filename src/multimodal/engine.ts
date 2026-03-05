// ─── Multimodal Engine ───
// Unified interface for voice input, image analysis, and text-to-speech.

import { VoiceInput } from './voice.js';
import { VisionAnalyzer } from './vision.js';
import { TextToSpeech } from './tts.js';
import type { MultimodalConfig, TranscriptionResult, VisionAnalysisResult, SpeechResult } from './types.js';
import { DEFAULT_MULTIMODAL_CONFIG } from './types.js';

export class MultimodalEngine {
    private config: MultimodalConfig;
    private voice: VoiceInput;
    private vision: VisionAnalyzer;
    private tts: TextToSpeech;

    constructor(config?: Partial<MultimodalConfig>) {
        this.config = { ...DEFAULT_MULTIMODAL_CONFIG, ...config };
        const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY || '';

        this.voice = new VoiceInput(this.config.voice, apiKey);
        this.vision = new VisionAnalyzer(this.config.vision, apiKey);
        this.tts = new TextToSpeech(this.config.tts, apiKey);
    }

    get enabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Transcribe audio to text (speech-to-text).
     */
    async transcribe(audioPath: string): Promise<TranscriptionResult> {
        return this.voice.transcribe(audioPath);
    }

    /**
     * Analyze an image with a text prompt (vision).
     */
    async analyzeImage(imagePath: string, prompt?: string): Promise<VisionAnalysisResult> {
        return this.vision.analyze(imagePath, prompt);
    }

    /**
     * Analyze an image from a URL.
     */
    async analyzeImageUrl(url: string, prompt?: string): Promise<VisionAnalysisResult> {
        return this.vision.analyzeUrl(url, prompt);
    }

    /**
     * Convert text to speech.
     */
    async speak(text: string, outputDir?: string): Promise<SpeechResult> {
        return this.tts.speak(text, outputDir);
    }

    /**
     * Full pipeline: take a screenshot → analyze it → describe what's on screen.
     * (Requires desktop module integration)
     */
    async describeScreen(screenshotPath: string): Promise<VisionAnalysisResult> {
        return this.vision.analyze(screenshotPath, 'Describe what is shown on this screen in detail. Identify any UI elements, text, and interactive components.');
    }
}

// ─── Singleton ───
let multimodalInstance: MultimodalEngine | null = null;

export function getMultimodalEngine(): MultimodalEngine | null {
    return multimodalInstance;
}

export function initMultimodalEngine(config?: Partial<MultimodalConfig>): MultimodalEngine {
    multimodalInstance = new MultimodalEngine(config);
    return multimodalInstance;
}
