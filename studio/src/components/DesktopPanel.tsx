import { useState } from 'react';

export default function DesktopPanel() {
    const [x, setX] = useState('');
    const [y, setY] = useState('');
    const [text, setText] = useState('');
    const [hotkey, setHotkey] = useState('');
    const [log, setLog] = useState<string[]>([]);
    const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

    const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));

    const takeScreenshot = async () => {
        try {
            addLog('Taking screenshot...');
            const res = await fetch('/api/desktop/screenshot', { method: 'POST' });
            const data = await res.json();
            if (data.error) {
                if (data.error.includes('scrot') || data.error.includes('ENOENT') || data.error.includes('not found')) {
                    addLog('❌ Screenshot tool not found. Install: sudo apt install scrot');
                } else {
                    addLog(`Error: ${data.error}`);
                }
            } else {
                addLog(`✅ Screenshot saved: ${data.path}`);
                if (data.base64) {
                    setScreenshotUrl(`data:image/png;base64,${data.base64}`);
                }
            }
        } catch (err) {
            addLog(`❌ Error: ${(err as Error).message}. Make sure scrot is installed: sudo apt install scrot`);
        }
    };

    const doClick = async () => {
        try {
            const res = await fetch('/api/desktop/click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: parseInt(x), y: parseInt(y) }),
            });
            const data = await res.json();
            if (data.error) {
                if (data.error.includes('xdotool') || data.error.includes('ENOENT')) {
                    addLog('❌ xdotool not found. Install: sudo apt install xdotool');
                } else {
                    addLog(`Error: ${data.error}`);
                }
            } else {
                addLog(`✅ Clicked at (${x}, ${y})`);
            }
        } catch (err) {
            addLog(`❌ Error: ${(err as Error).message}`);
        }
    };

    const doType = async () => {
        try {
            const res = await fetch('/api/desktop/type', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });
            const data = await res.json();
            if (data.error) {
                if (data.error.includes('xdotool') || data.error.includes('ENOENT')) {
                    addLog('❌ xdotool not found. Install: sudo apt install xdotool');
                } else {
                    addLog(`Error: ${data.error}`);
                }
            } else {
                addLog(`✅ Typed: "${text}"`);
                setText('');
            }
        } catch (err) {
            addLog(`❌ Error: ${(err as Error).message}`);
        }
    };

    const doHotkey = async () => {
        try {
            const res = await fetch('/api/desktop/hotkey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ combo: hotkey }),
            });
            const data = await res.json();
            if (data.error) {
                if (data.error.includes('xdotool') || data.error.includes('ENOENT')) {
                    addLog('❌ xdotool not found. Install: sudo apt install xdotool');
                } else {
                    addLog(`Error: ${data.error}`);
                }
            } else {
                addLog(`✅ Hotkey: ${hotkey}`);
                setHotkey('');
            }
        } catch (err) {
            addLog(`❌ Error: ${(err as Error).message}`);
        }
    };

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-full">
            <div>
                <h2 className="text-xl font-semibold mb-1">🖥️ Desktop Automation</h2>
                <p className="text-neutral-500 text-sm">Control the desktop with screenshots, mouse clicks, keyboard input, and hotkeys.</p>
            </div>

            {/* System Requirements */}
            <div className="border border-white/5 rounded-xl bg-neutral-900/20 p-4 text-xs text-neutral-500 space-y-1">
                <p><strong className="text-neutral-400">Requires:</strong> <code className="bg-neutral-800 px-1 rounded">scrot</code> (screenshots) and <code className="bg-neutral-800 px-1 rounded">xdotool</code> (mouse/keyboard)</p>
                <p>Install: <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400">sudo apt install scrot xdotool</code></p>
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

            {/* Screenshot Preview */}
            {screenshotUrl && (
                <div className="border border-white/10 rounded-xl bg-neutral-900/40 p-5">
                    <h3 className="text-sm font-medium mb-3">📷 Latest Screenshot</h3>
                    <img src={screenshotUrl} alt="Desktop Screenshot" className="rounded-lg border border-white/10 max-h-96 w-full object-contain" />
                </div>
            )}

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
