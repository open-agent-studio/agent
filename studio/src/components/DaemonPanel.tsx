import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Server, Play, Square, RefreshCw } from 'lucide-react';

const API = 'http://localhost:3333/api';

export function DaemonPanel() {
    const { id } = useParams<{ id: string }>();
    const [status, setStatus] = useState<any>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const loadStatus = () => {
        fetch(`${API}/instances/${id}/daemon/status`).then(r => r.json()).then(setStatus).catch(console.error);
    };

    const loadLogs = () => {
        fetch(`${API}/instances/${id}/daemon/logs`).then(r => r.json()).then(d => setLogs(d.logs || [])).catch(console.error);
    };

    useEffect(() => { loadStatus(); loadLogs(); const iv = setInterval(() => { loadStatus(); loadLogs(); }, 5000); return () => clearInterval(iv); }, [id]);

    const start = async () => {
        setLoading(true);
        await fetch(`${API}/instances/${id}/daemon/start`, { method: 'POST' });
        setTimeout(() => { loadStatus(); loadLogs(); setLoading(false); }, 1500);
    };

    const stop = async () => {
        setLoading(true);
        await fetch(`${API}/instances/${id}/daemon/stop`, { method: 'POST' });
        setTimeout(() => { loadStatus(); loadLogs(); setLoading(false); }, 1000);
    };

    return (
        <div className="flex flex-col h-full bg-neutral-950 overflow-y-auto p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Server className="text-amber-400" size={22} /> Daemon Control
                    </h2>
                    <p className="text-neutral-500 text-sm mt-1">Background autonomous worker</p>
                </div>
                <button onClick={() => { loadStatus(); loadLogs(); }} className="p-2 rounded hover:bg-white/10 text-neutral-400"><RefreshCw size={16} /></button>
            </div>

            {/* Status Card */}
            <div className="border border-white/10 rounded-xl bg-white/[0.02] p-6 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`h-4 w-4 rounded-full ${status?.running ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
                        <div>
                            <div className="font-medium text-neutral-200 text-lg">{status?.running ? 'Running' : 'Stopped'}</div>
                            {status?.pid && <div className="text-xs text-neutral-500 font-mono mt-0.5">PID: {status.pid}</div>}
                            {status?.uptime && <div className="text-xs text-neutral-500 mt-0.5">Uptime: {status.uptime}</div>}
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {status?.running ? (
                            <button onClick={stop} disabled={loading}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50">
                                <Square size={16} /> Stop Daemon
                            </button>
                        ) : (
                            <button onClick={start} disabled={loading}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
                                <Play size={16} /> Start Daemon
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Logs */}
            <div className="flex-1 min-h-0">
                <h3 className="text-sm font-medium text-neutral-400 mb-3">Recent Logs</h3>
                <div className="border border-white/10 rounded-xl bg-neutral-900 p-4 h-full max-h-[500px] overflow-y-auto font-mono text-xs">
                    {logs.length === 0 ? (
                        <div className="text-neutral-600">No daemon logs available.</div>
                    ) : (
                        logs.map((line, i) => (
                            <div key={i} className={`py-0.5 ${line.includes('ERROR') || line.includes('error') ? 'text-red-400' : line.includes('WARN') ? 'text-amber-400' : 'text-neutral-400'}`}>
                                {line}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
