import { useState, useEffect } from 'react';

interface SandboxStatus {
    enabled: boolean;
    running: boolean;
    image: string;
    containerId?: string;
    uptime?: number;
}

export default function SandboxPanel() {
    const [status, setStatus] = useState<SandboxStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/sandbox/status');
            const data = await res.json();
            setStatus(data);
        } catch {
            setStatus(null);
        } finally {
            setLoading(false);
        }
    };

    const handleStart = async () => {
        await fetch('/api/sandbox/start', { method: 'POST' });
        fetchStatus();
    };

    const handleStop = async () => {
        await fetch('/api/sandbox/stop', { method: 'POST' });
        fetchStatus();
    };

    const formatUptime = (ms: number) => {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        return h > 0 ? `${h}h ${m % 60}m` : `${m}m ${s % 60}s`;
    };

    if (loading) {
        return <div className="p-6 text-neutral-500">Loading sandbox status...</div>;
    }

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-full">
            <div>
                <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                    🐳 Sandboxed Execution
                </h2>
                <p className="text-neutral-500 text-sm">
                    Run commands inside isolated Docker containers for safe execution.
                </p>
            </div>

            {/* Status Card */}
            <div className="border border-white/10 rounded-xl bg-neutral-900/40 p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Status</div>
                        <div className={`text-sm font-medium ${status?.running ? 'text-emerald-400' : 'text-neutral-400'}`}>
                            {status?.running ? '● Running' : '○ Stopped'}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Image</div>
                        <div className="text-sm font-mono text-cyan-400">{status?.image || 'node:20-slim'}</div>
                    </div>
                    {status?.containerId && (
                        <div>
                            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Container</div>
                            <div className="text-sm font-mono text-neutral-300">{status.containerId.slice(0, 12)}</div>
                        </div>
                    )}
                    {status?.uptime && (
                        <div>
                            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Uptime</div>
                            <div className="text-sm text-neutral-300">{formatUptime(status.uptime)}</div>
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    {!status?.running ? (
                        <button
                            onClick={handleStart}
                            className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors"
                        >
                            Start Sandbox
                        </button>
                    ) : (
                        <button
                            onClick={handleStop}
                            className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors"
                        >
                            Stop Sandbox
                        </button>
                    )}
                </div>
            </div>

            {/* Info */}
            <div className="border border-white/5 rounded-xl bg-neutral-900/20 p-5 text-sm text-neutral-400 space-y-2">
                <p>When the sandbox is <strong className="text-neutral-200">active</strong>, all <code className="bg-neutral-800 px-1 rounded text-xs">cmd.run</code> commands execute inside the Docker container instead of your host machine.</p>
                <p>Configure in <code className="bg-neutral-800 px-1 rounded text-xs">agent.yaml</code>: image, network mode, volume mounts, and timeouts.</p>
            </div>
        </div>
    );
}
