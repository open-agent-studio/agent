import { useState, useEffect } from 'react';

interface SwarmStatus {
    swarmId: string;
    status: string;
    goal?: string;
    agents: Array<{ id: string; role: string; status: string; task?: string }>;
    tasks: Array<{ id: string; role: string; status: string; assignedTo?: string }>;
    uptime?: number;
}

const roleColors: Record<string, string> = {
    planner: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    coder: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    reviewer: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    researcher: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    tester: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

const statusIcons: Record<string, string> = {
    idle: '💤', busy: '⚡', done: '✅', error: '❌',
    pending: '⏳', running: '🔄', completed: '✅', failed: '❌',
};

export default function SwarmPanel() {
    const [status, setStatus] = useState<SwarmStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [goalInput, setGoalInput] = useState('');
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/swarm/status');
            if (!res.ok) { setStatus(null); return; }
            const data = await res.json();
            if (data && data.swarmId) {
                setStatus(data);
            } else {
                setStatus(null);
            }
        } catch {
            setStatus(null);
        } finally {
            setLoading(false);
        }
    };

    const handleStart = async () => {
        if (!goalInput.trim()) return;
        setStarting(true);
        try {
            const res = await fetch('/api/swarm/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal: goalInput.trim() }),
            });
            const data = await res.json();
            setStatus(data);
            setGoalInput('');
        } catch (err) {
            console.error('Failed to start swarm:', err);
        } finally {
            setStarting(false);
        }
    };

    const handleStop = async () => {
        await fetch('/api/swarm/stop', { method: 'POST' });
        fetchStatus();
    };

    if (loading) return <div className="p-6 text-neutral-500">Loading swarm status...</div>;

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-full">
            <div>
                <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                    🐝 Multi-Agent Swarm
                </h2>
                <p className="text-neutral-500 text-sm">
                    Coordinate multiple specialized agents on complex goals.
                </p>
            </div>

            {!status || status.status === 'idle' ? (
                <div className="space-y-4">
                    <div className="border border-white/10 rounded-xl bg-neutral-900/40 p-6">
                        <h3 className="text-sm font-medium mb-3">Start a Swarm Session</h3>
                        <p className="text-xs text-neutral-500 mb-4">
                            Describe a complex goal and the swarm will decompose it into tasks,
                            spawn specialized agents (planner, coder, reviewer), and coordinate execution.
                        </p>
                        <div className="flex gap-3">
                            <input
                                value={goalInput}
                                onChange={e => setGoalInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleStart()}
                                placeholder="e.g. Review src/ for security vulnerabilities"
                                className="flex-1 bg-neutral-800 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:border-indigo-500/40 focus:outline-none transition-colors"
                            />
                            <button
                                onClick={handleStart}
                                disabled={starting || !goalInput.trim()}
                                className="px-5 py-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-sm font-medium hover:bg-indigo-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {starting ? 'Starting...' : 'Start Swarm'}
                            </button>
                        </div>
                    </div>
                    <div className="border border-white/5 rounded-xl bg-neutral-900/20 p-5 text-sm text-neutral-400">
                        <p>Or start via CLI: <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300 text-xs">agent swarm start "your goal"</code></p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Session Overview */}
                    <div className="border border-white/10 rounded-xl bg-neutral-900/40 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="text-xs text-neutral-500 uppercase tracking-wider">Session</div>
                                <div className="text-sm font-mono text-neutral-300 mt-0.5">{status.swarmId.slice(0, 12)}</div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-medium border ${status.status === 'running' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                status.status === 'completed' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                                    'text-neutral-400 bg-neutral-800 border-neutral-700'
                                }`}>
                                {status.status}
                            </div>
                        </div>
                        {status.goal && (
                            <div className="text-sm text-neutral-300 bg-neutral-800/50 p-3 rounded-lg border border-white/5">
                                {status.goal}
                            </div>
                        )}
                    </div>

                    {/* Agents */}
                    {status.agents.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-neutral-400 mb-3 uppercase tracking-wider">
                                Agents ({status.agents.length})
                            </h3>
                            <div className="space-y-2">
                                {status.agents.map(a => (
                                    <div key={a.id} className="border border-white/10 rounded-lg bg-neutral-900/30 p-3 flex items-center gap-3">
                                        <span className="text-base">{statusIcons[a.status] || '◻️'}</span>
                                        <div className={`text-xs px-2 py-0.5 rounded border ${roleColors[a.role] || 'text-neutral-400'}`}>
                                            {a.role}
                                        </div>
                                        <span className="text-xs font-mono text-neutral-500 flex-1">{a.id.slice(0, 20)}</span>
                                        <span className="text-xs text-neutral-500">{a.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tasks */}
                    {status.tasks.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-neutral-400 mb-3 uppercase tracking-wider">
                                Tasks ({status.tasks.length})
                            </h3>
                            <div className="space-y-2">
                                {status.tasks.map(t => (
                                    <div key={t.id} className="border border-white/10 rounded-lg bg-neutral-900/30 p-3 flex items-center gap-3">
                                        <span className="text-base">{statusIcons[t.status] || '◻️'}</span>
                                        <div className={`text-xs px-2 py-0.5 rounded border ${roleColors[t.role] || 'text-neutral-400'}`}>
                                            {t.role}
                                        </div>
                                        <span className="text-xs font-mono text-neutral-500 flex-1">{t.id}</span>
                                        <span className="text-xs text-neutral-500">{t.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {status.status === 'running' && (
                        <button
                            onClick={handleStop}
                            className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors"
                        >
                            Stop Swarm
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
