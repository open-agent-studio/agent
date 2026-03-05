import { useState } from 'react';

export default function MultimodalPanel() {
    const [activeTab, setActiveTab] = useState<'voice' | 'vision' | 'tts'>('voice');
    const [result, setResult] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [imagePrompt, setImagePrompt] = useState('Describe this image in detail.');

    const tabs = [
        { id: 'voice' as const, label: '🎤 Voice', desc: 'Speech-to-Text (Whisper)' },
        { id: 'vision' as const, label: '👁️ Vision', desc: 'Image Analysis (GPT-4o)' },
        { id: 'tts' as const, label: '🔊 TTS', desc: 'Text-to-Speech' },
    ];

    const handleVoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);
        setResult('');
        try {
            const formData = new FormData();
            formData.append('audio', file);
            const res = await fetch('/api/multimodal/transcribe', { method: 'POST', body: formData });
            const data = await res.json();
            setResult(data.text || JSON.stringify(data));
        } catch (err) {
            setResult(`Error: ${(err as Error).message}`);
        } finally { setLoading(false); }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);
        setResult('');
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('prompt', imagePrompt);
            const res = await fetch('/api/multimodal/analyze', { method: 'POST', body: formData });
            const data = await res.json();
            setResult(data.description || JSON.stringify(data));
        } catch (err) {
            setResult(`Error: ${(err as Error).message}`);
        } finally { setLoading(false); }
    };

    const [ttsText, setTtsText] = useState('');
    const [ttsVoice, setTtsVoice] = useState('alloy');

    const handleSpeak = async () => {
        if (!ttsText.trim()) return;
        setLoading(true);
        setResult('');
        try {
            const res = await fetch('/api/multimodal/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: ttsText, voice: ttsVoice }),
            });
            const data = await res.json();
            setResult(`Audio saved: ${data.audioPath} (${data.format})`);
        } catch (err) {
            setResult(`Error: ${(err as Error).message}`);
        } finally { setLoading(false); }
    };

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-full">
            <div>
                <h2 className="text-xl font-semibold mb-1">🌈 Multimodal Interfaces</h2>
                <p className="text-neutral-500 text-sm">Voice input, image analysis, and text-to-speech powered by OpenAI.</p>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-2">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => { setActiveTab(t.id); setResult(''); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${activeTab === t.id
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                : 'bg-neutral-900/40 text-neutral-400 border-white/10 hover:bg-white/5'
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Active Panel */}
            <div className="border border-white/10 rounded-xl bg-neutral-900/40 p-6">
                {activeTab === 'voice' && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">Upload Audio File</h3>
                        <p className="text-xs text-neutral-500">Supports WAV, MP3, WebM. Uses OpenAI Whisper for transcription.</p>
                        <input type="file" accept="audio/*" onChange={handleVoiceUpload}
                            className="text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-white/10 file:bg-neutral-800 file:text-neutral-300 file:text-sm hover:file:bg-neutral-700 file:cursor-pointer" />
                    </div>
                )}

                {activeTab === 'vision' && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">Upload Image for Analysis</h3>
                        <p className="text-xs text-neutral-500">Uses GPT-4o vision to understand image content.</p>
                        <input value={imagePrompt} onChange={e => setImagePrompt(e.target.value)}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="Analysis prompt..." />
                        <input type="file" accept="image/*" onChange={handleImageUpload}
                            className="text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-white/10 file:bg-neutral-800 file:text-neutral-300 file:text-sm hover:file:bg-neutral-700 file:cursor-pointer" />
                    </div>
                )}

                {activeTab === 'tts' && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">Text to Speech</h3>
                        <p className="text-xs text-neutral-500">Convert text to natural speech using OpenAI TTS.</p>
                        <textarea value={ttsText} onChange={e => setTtsText(e.target.value)} rows={3}
                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Enter text to speak..." />
                        <div className="flex items-center gap-3">
                            <select value={ttsVoice} onChange={e => setTtsVoice(e.target.value)}
                                className="bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm">
                                {['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map(v =>
                                    <option key={v} value={v}>{v}</option>
                                )}
                            </select>
                            <button onClick={handleSpeak}
                                className="px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-sm hover:bg-indigo-500/20 transition-colors">
                                Generate Speech
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Result Area */}
            {(loading || result) && (
                <div className="border border-white/10 rounded-xl bg-neutral-900/40 p-5">
                    <h3 className="text-sm font-medium mb-3">Result</h3>
                    {loading ? (
                        <div className="text-neutral-500 text-sm">Processing...</div>
                    ) : (
                        <div className="bg-black/30 rounded-lg p-4 text-sm text-neutral-300 whitespace-pre-wrap">
                            {result}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
