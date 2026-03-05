// ─── Multimodal Types ───

export interface MultimodalConfig {
    /** Enable multimodal features */
    enabled: boolean;
    /** OpenAI API key (for Whisper, TTS, Vision) */
    apiKey?: string;
    /** Voice input settings */
    voice: VoiceConfig;
    /** Vision/image analysis settings */
    vision: VisionConfig;
    /** Text-to-speech settings */
    tts: TTSConfig;
}

export interface VoiceConfig {
    /** Whisper model to use */
    model: string;
    /** Language code (auto-detect if omitted) */
    language?: string;
    /** Audio format for recording */
    format: 'wav' | 'mp3' | 'webm';
}

export interface VisionConfig {
    /** Model for image analysis */
    model: string;
    /** Max tokens for vision response */
    maxTokens: number;
    /** Detail level: low, high, auto */
    detail: 'low' | 'high' | 'auto';
}

export interface TTSConfig {
    /** TTS model */
    model: string;
    /** Voice: alloy, echo, fable, onyx, nova, shimmer */
    voice: string;
    /** Output format */
    format: 'mp3' | 'opus' | 'aac' | 'flac';
    /** Speed multiplier (0.25 - 4.0) */
    speed: number;
}

export const DEFAULT_MULTIMODAL_CONFIG: MultimodalConfig = {
    enabled: false,
    voice: {
        model: 'whisper-1',
        format: 'wav',
    },
    vision: {
        model: 'gpt-4o',
        maxTokens: 1024,
        detail: 'auto',
    },
    tts: {
        model: 'tts-1',
        voice: 'alloy',
        format: 'mp3',
        speed: 1.0,
    },
};

export interface TranscriptionResult {
    text: string;
    language?: string;
    duration?: number;
}

export interface VisionAnalysisResult {
    description: string;
    model: string;
    tokensUsed: number;
}

export interface SpeechResult {
    audioPath: string;
    format: string;
    text: string;
}
