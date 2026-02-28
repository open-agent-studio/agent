import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Code, Plus, Trash2 } from 'lucide-react';

const API = 'http://localhost:3333/api';

export function CommandsManager() {
    const { id } = useParams<{ id: string }>();
    const [commands, setCommands] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', tools: '', body: '' });

    const load = () => {
        fetch(`${API}/instances/${id}/commands`).then(r => r.json()).then(d => setCommands(d.commands || [])).catch(console.error);
    };

    useEffect(() => { load(); }, [id]);

    const createCommand = async () => {
        if (!form.name.trim()) return;
        await fetch(`${API}/instances/${id}/commands`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: form.name, description: form.description,
                tools: form.tools ? form.tools.split(',').map(s => s.trim()) : [],
                body: form.body,
            }),
        });
        setForm({ name: '', description: '', tools: '', body: '' });
        setShowCreate(false);
        load();
    };

    const deleteCommand = async (name: string) => {
        if (!confirm(`Delete command "${name}"?`)) return;
        await fetch(`${API}/instances/${id}/commands/${name}`, { method: 'DELETE' });
        load();
    };

    return (
        <div className="flex flex-col h-full bg-neutral-950 overflow-y-auto p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Code className="text-amber-400" size={22} /> Commands
                    </h2>
                    <p className="text-neutral-500 text-sm mt-1">{commands.length} command{commands.length !== 1 ? 's' : ''} loaded</p>
                </div>
                <button onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors">
                    <Plus size={16} /> New Command
                </button>
            </div>

            {showCreate && (
                <div className="border border-white/10 rounded-xl p-5 bg-white/[0.02] mb-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Command name..."
                            className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-500/50" />
                        <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description..."
                            className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <input value={form.tools} onChange={e => setForm({ ...form, tools: e.target.value })} placeholder="Allowed tools (comma-separated)..."
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-500/50" />
                    <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Command body (markdown prompt)..."
                        rows={6} className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-500/50 resize-none font-mono" />
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setShowCreate(false)} className="text-sm text-neutral-500 hover:text-neutral-300">Cancel</button>
                        <button onClick={createCommand} className="px-4 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors">Create</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {commands.map((c) => (
                    <div key={c.name} className="border border-white/10 rounded-xl bg-white/[0.02] p-5 flex flex-col hover:border-white/20 transition-all">
                        <div className="flex items-start justify-between mb-2">
                            <span className="font-mono text-sm text-amber-200 bg-amber-500/10 px-2.5 py-1 rounded">/{c.name}</span>
                            <button onClick={() => deleteCommand(c.name)} className="p-1.5 rounded hover:bg-white/10 text-red-400"><Trash2 size={14} /></button>
                        </div>
                        <p className="text-sm text-neutral-400 mt-2 flex-1">{c.description}</p>
                        {c.tools?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {c.tools.map((t: string) => (
                                    <span key={t} className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">{t}</span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
