import { useState } from 'react';

export default function DesktopPanel() {
    const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
    const [x, setX] = useState('');
    const [y, setY] = useState('');
    const [text, setText] = useState('');
    const [hotkey, setHotkey] = useState('');
    const [log, setLog] = useState<string[]>([]);

    const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));

    const takeScreenshot = async () => {
        try {
            const res = await fetch('/api/desktop/screenshot', { method: 'POST' });
            const data = await res.json();
            addLog(`Screenshot saved: ${data.path}`);
            setScreenshotUrl(data.path);
        } catch (err) {
            addLog(`Error: ${(err as Error).message}`);
        }
    };

    const doClick = async () => {
        try {
            await fetch('/api/desktop/click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: parseInt(x), y: parseInt(y) }),
            });
            addLog(`Clicked at (${x}, ${y})`);
        } catch (err) {
            addLog(`Error: ${(err as Error).message}`);
        }
    };

    const doType = async () => {
        try {
            await fetch('/api/desktop/type', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });
            addLog(`Typed: "${text}"`);
            setText('');
        } catch (err) {
            addLog(`Error: ${(err as Error).message}`);
        }
    };

    const doHotkey = async () => {
        try {
            await fetch('/api/desktop/hotkey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ combo: hotkey }),
            });
            addLog(`Hotkey: ${hotkey}`);
            setHotkey('');
        } catch (err) {
            addLog(`Error: ${(err as Error).message}`);
        }
    };

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-full">
            <div>
                <h2 className="text-xl font-semibold mb-1">🖥️ Desktop Automation</h2>
                <p className="text-neutral-500 text-sm">Control the desktop with screenshots, mouse clicks, keyboard input, and hotkeys.</p>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Screenshot */}
                <div className="border border-white/10 rounded-xl bg-neutral-900/40 p-5">
                    <h3 className="text-sm font-medium mb-3">📸 Screenshot</h3>
                    <button onClick={takeScreenshot} className="px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-sm hover:bg-indigo-500/20 transition-colors">
                        Capture Screen
                    </button>
                </div>

                {/* Click */}
                <div className="border border-white/10 rounded-xl bg-neutral-900/40 p-5">
                    <h3 className="text-sm font-medium mb-3">🖱️ Click</h3>
                    <div className="flex gap-2">
                        <input value={x} onChange={e => setX(e.target.value)} placeholder="X" className="w-20 bg-neutral-800 border border-white/10 rounded px-2 py-1.5 text-xs" />
                        <input value={y} onChange={e => setY(e.target.value)} placeholder="Y" className="w-20 bg-neutral-800 border border-white/10 rounded px-2 py-1.5 text-xs" />
                        <button onClick={doClick} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs hover:bg-emerald-500/20 transition-colors">Click</button>
                    </div>
                </div>

                {/* Type */}
                <div className="border border-white/10 rounded-xl bg-neutral-900/40 p-5">
                    <h3 className="text-sm font-medium mb-3">⌨️ Type</h3>
                    <div className="flex gap-2">
                        <input value={text} onChange={e => setText(e.target.value)} placeholder="Text to type..." className="flex-1 bg-neutral-800 border border-white/10 rounded px-2 py-1.5 text-xs" />
                        <button onClick={doType} className="px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs hover:bg-amber-500/20 transition-colors">Type</button>
                    </div>
                </div>

                {/* Hotkey */}
                <div className="border border-white/10 rounded-xl bg-neutral-900/40 p-5">
                    <h3 className="text-sm font-medium mb-3">🔥 Hotkey</h3>
                    <div className="flex gap-2">
                        <input value={hotkey} onChange={e => setHotkey(e.target.value)} placeholder="ctrl+s" className="flex-1 bg-neutral-800 border border-white/10 rounded px-2 py-1.5 text-xs" />
                        <button onClick={doHotkey} className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs hover:bg-red-500/20 transition-colors">Send</button>
                    </div>
                </div>
            </div>

            {/* Action Log */}
            <div className="border border-white/10 rounded-xl bg-neutral-900/40 p-5">
                <h3 className="text-sm font-medium mb-3">📋 Action Log</h3>
                <div className="bg-black/30 rounded-lg p-3 h-40 overflow-y-auto font-mono text-xs text-neutral-400 space-y-1">
                    {log.length === 0 ? <p className="text-neutral-600">No actions yet...</p> : log.map((l, i) => <p key={i}>{l}</p>)}
                </div>
            </div>
        </div>
    );
}
