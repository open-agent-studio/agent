import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Target, Trash2, CheckCircle, Clock, AlertTriangle, XCircle, Pause, ChevronDown, ChevronRight } from 'lucide-react';

const API = 'http://localhost:3333/api';

const statusColors: Record<string, string> = {
    active: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    completed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    failed: 'text-red-400 bg-red-500/10 border-red-500/20',
    paused: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    cancelled: 'text-neutral-400 bg-neutral-500/10 border-neutral-500/20',
    pending: 'text-neutral-400 bg-neutral-500/10 border-neutral-500/20',
    running: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    queued: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    blocked: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

const statusIcons: Record<string, typeof CheckCircle> = {
    active: Clock,
    completed: CheckCircle,
    failed: XCircle,
    paused: Pause,
    pending: Clock,
    running: Clock,
    blocked: AlertTriangle,
};

export function GoalsPanel() {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<any>(null);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', priority: 1 });

    const emptyData = { stats: { activeGoals: 0, completedGoals: 0, pendingTasks: 0 }, goals: [] };

    const load = async () => {
        try {
            const res = await fetch(`${API}/instances/${id}/goals`);
            if (!res.ok) { setData(emptyData); return; }
            const d = await res.json();
            setData(d ?? emptyData);
        } catch { setData(emptyData); }
    };

    useEffect(() => { load(); }, [id]);

    const toggleExpand = (goalId: number) => {
        const next = new Set(expanded);
        next.has(goalId) ? next.delete(goalId) : next.add(goalId);
        setExpanded(next);
    };

    const createGoal = async () => {
        if (!form.title.trim()) return;
        await fetch(`${API}/instances/${id}/goals`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        setForm({ title: '', description: '', priority: 1 });
        setShowCreate(false);
        load();
    };

    const deleteGoal = async (goalId: number) => {
        await fetch(`${API}/instances/${id}/goals/${goalId}`, { method: 'DELETE' });
        load();
    };

    const updateStatus = async (goalId: number, status: string) => {
        await fetch(`${API}/instances/${id}/goals/${goalId}/status`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        load();
    };

    if (!data) return <div className="p-8 text-neutral-500 animate-pulse">Loading goals...</div>;

    const stats = data.stats ?? { activeGoals: 0, completedGoals: 0, pendingTasks: 0 };

    return (
        <div className="flex flex-col h-full bg-neutral-950 overflow-y-auto p-8">
            {/* Stats Bar */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Target className="text-indigo-400" size={22} /> Goals & Tasks
                    </h2>
                    <p className="text-neutral-500 text-sm mt-1">
                        {stats.activeGoals} active · {stats.completedGoals} completed · {stats.pendingTasks} pending tasks
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/30 transition-colors"
                >
                    <Plus size={16} /> New Goal
                </button>
            </div>

            {/* Create Goal Form */}
            {showCreate && (
                <div className="border border-white/10 rounded-xl p-5 bg-white/[0.02] mb-6 space-y-4">
                    <input
                        value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                        placeholder="Goal title..."
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-indigo-500/50"
                    />
                    <textarea
                        value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder="Description (optional)..."
                        rows={3}
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                    />
                    <div className="flex items-center gap-4">
                        <label className="text-sm text-neutral-400">Priority:</label>
                        <select
                            value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) })}
                            className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
                        >
                            <option value={1}>1 — High</option>
                            <option value={2}>2 — Medium</option>
                            <option value={3}>3 — Low</option>
                        </select>
                        <div className="flex-1" />
                        <button onClick={() => setShowCreate(false)} className="text-sm text-neutral-500 hover:text-neutral-300">Cancel</button>
                        <button onClick={createGoal} className="px-4 py-1.5 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors">
                            Create Goal
                        </button>
                    </div>
                </div>
            )}

            {/* Goals List */}
            {data.goals.length === 0 ? (
                <div className="border border-white/10 border-dashed rounded-xl p-16 text-center">
                    <Target className="mx-auto mb-4 text-neutral-600" size={32} />
                    <p className="text-neutral-500">No goals yet. Create one to get started.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {data.goals.map((goal: any) => {
                        const isExpanded = expanded.has(goal.id);
                        const StatusIcon = statusIcons[goal.status] ?? Clock;
                        return (
                            <div key={goal.id} className="border border-white/10 rounded-xl bg-white/[0.02] overflow-hidden">
                                <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.03]" onClick={() => toggleExpand(goal.id)}>
                                    {isExpanded ? <ChevronDown size={16} className="text-neutral-500" /> : <ChevronRight size={16} className="text-neutral-500" />}
                                    <StatusIcon size={16} className={statusColors[goal.status]?.split(' ')[0] ?? 'text-neutral-400'} />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-neutral-200 truncate">{goal.title}</div>
                                        {goal.description && <div className="text-xs text-neutral-500 mt-0.5 truncate">{goal.description}</div>}
                                    </div>
                                    <span className={`text-xs px-2.5 py-1 rounded-full border ${statusColors[goal.status] ?? ''}`}>{goal.status}</span>
                                    <span className="text-xs text-neutral-600 font-mono">{goal.tasks?.length ?? 0} tasks</span>
                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                        {goal.status === 'active' && (
                                            <button onClick={() => updateStatus(goal.id, 'paused')} className="p-1.5 rounded hover:bg-white/10 text-amber-400" title="Pause">
                                                <Pause size={14} />
                                            </button>
                                        )}
                                        {goal.status === 'paused' && (
                                            <button onClick={() => updateStatus(goal.id, 'active')} className="p-1.5 rounded hover:bg-white/10 text-blue-400" title="Resume">
                                                <Clock size={14} />
                                            </button>
                                        )}
                                        <button onClick={() => deleteGoal(goal.id)} className="p-1.5 rounded hover:bg-white/10 text-red-400" title="Delete">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && goal.tasks?.length > 0 && (
                                    <div className="border-t border-white/5 bg-neutral-900/30">
                                        {goal.tasks.map((task: any) => (
                                            <div key={task.id} className="flex items-center gap-3 px-6 py-3 border-b border-white/5 last:border-0 text-sm">
                                                <div className={`h-2 w-2 rounded-full ${task.status === 'completed' ? 'bg-emerald-400' : task.status === 'failed' ? 'bg-red-400' : task.status === 'running' ? 'bg-blue-400 animate-pulse' : 'bg-neutral-600'}`} />
                                                <span className="text-neutral-300 flex-1 truncate">{task.title}</span>
                                                {task.skill && <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{task.skill}</span>}
                                                <span className={`text-xs px-2 py-0.5 rounded border ${statusColors[task.status] ?? ''}`}>{task.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
