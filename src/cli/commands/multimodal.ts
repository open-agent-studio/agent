import { Command } from 'commander';
import chalk from 'chalk';
import { initMultimodalEngine } from '../../multimodal/engine.js';

export function createMultimodalCommand(): Command {
    const cmd = new Command('multimodal')
        .description('Multimodal AI interfaces (voice, vision, speech)');

    // ─── multimodal transcribe ───
    cmd.command('transcribe')
        .description('Transcribe an audio file to text (Whisper)')
        .argument('<file>', 'Path to audio file')
        .option('-l, --language <lang>', 'Language code (e.g., en, es)')
        .action(async (file, opts) => {
            console.log(chalk.cyan('🎤 Transcribing audio...'));
            try {
                const engine = initMultimodalEngine({
                    enabled: true,
                    voice: { model: 'whisper-1', format: 'wav', language: opts.language },
                });
                const result = await engine.transcribe(file);
                console.log(chalk.green('✓ Transcription complete'));
                console.log('');
                console.log(result.text);
                if (result.language) console.log(chalk.dim(`  Language: ${result.language}`));
                if (result.duration) console.log(chalk.dim(`  Duration: ${result.duration}s`));
            } catch (err) {
                console.error(chalk.red(`✗ ${(err as Error).message}`));
            }
        });

    // ─── multimodal analyze ───
    cmd.command('analyze')
        .description('Analyze an image with AI vision (GPT-4o)')
        .argument('<image>', 'Path to image file or URL')
        .option('-p, --prompt <prompt>', 'Analysis prompt', 'Describe this image in detail.')
        .action(async (image, opts) => {
            console.log(chalk.cyan('👁️ Analyzing image...'));
            try {
                const engine = initMultimodalEngine({ enabled: true });
                const isUrl = image.startsWith('http://') || image.startsWith('https://');
                const result = isUrl
                    ? await engine.analyzeImageUrl(image, opts.prompt)
                    : await engine.analyzeImage(image, opts.prompt);

                console.log(chalk.green('✓ Analysis complete'));
                console.log('');
                console.log(result.description);
                console.log(chalk.dim(`  Model: ${result.model} | Tokens: ${result.tokensUsed}`));
            } catch (err) {
                console.error(chalk.red(`✗ ${(err as Error).message}`));
            }
        });

    // ─── multimodal speak ───
    cmd.command('speak')
        .description('Convert text to speech (TTS)')
        .argument('<text>', 'Text to speak')
        .option('-v, --voice <voice>', 'Voice: alloy, echo, fable, onyx, nova, shimmer', 'alloy')
        .option('-f, --format <format>', 'Audio format: mp3, opus, aac, flac', 'mp3')
        .action(async (text, opts) => {
            console.log(chalk.cyan('🔊 Generating speech...'));
            try {
                const engine = initMultimodalEngine({
                    enabled: true,
                    tts: { model: 'tts-1', voice: opts.voice, format: opts.format, speed: 1.0 },
                });
                const result = await engine.speak(text);
                console.log(chalk.green('✓ Audio generated'));
                console.log(chalk.dim(`  File: ${result.audioPath}`));
                console.log(chalk.dim(`  Format: ${result.format}`));
            } catch (err) {
                console.error(chalk.red(`✗ ${(err as Error).message}`));
            }
        });

    return cmd;
}
