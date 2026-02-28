import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileCode, Plus, Trash2 } from 'lucide-react';

const API = 'http://localhost:3333/api';

export function ScriptsManager() {
    const { id } = useParams<{ id: string }>();
    const [scripts, setScripts] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', entrypoint: 'run.sh', content: '' });

    const load = () => {
        fetch(`${API}/instances/${id}/scripts`).then(r => r.json()).then(d => setScripts(d.scripts || [])).catch(console.error);
    };

    useEffect(() => { load(); }, [id]);

    const createScript = async () => {
        if (!form.name.trim()) return;
        await fetch(`${API}/instances/${id}/scripts`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        setForm({ name: '', description: '', entrypoint: 'run.sh', content: '' });
        setShowCreate(false);
        load();
    };

    const deleteScript = async (name: string) => {
        if (!confirm(`Delete script "${name}"?`)) return;
        await fetch(`${API}/instances/${id}/scripts/${name}`, { method: 'DELETE' });
        load();
    };

    return (
        <div className="flex flex-col h-full bg-neutral-950 overflow-y-auto p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <FileCode className="text-pink-400" size={22} /> Scripts
                    </h2>
                    <p className="text-neutral-500 text-sm mt-1">{scripts.length} script{scripts.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-500/20 border border-pink-500/30 text-pink-300 text-sm font-medium hover:bg-pink-500/30 transition-colors">
                    <Plus size={16} /> New Script
                </button>
            </div>

            {showCreate && (
                <div className="border border-white/10 rounded-xl p-5 bg-white/[0.02] mb-6 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Script name..."
                            className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-pink-500/50" />
                        <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description..."
                            className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-pink-500/50" />
                        <select value={form.entrypoint} onChange={e => setForm({ ...form, entrypoint: e.target.value })}
                            className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm">
                            <option value="run.sh">Shell (run.sh)</option>
                            <option value="run.ts">TypeScript (run.ts)</option>
                            <option value="run.py">Python (run.py)</option>
                            <option value="run.js">JavaScript (run.js)</option>
                        </select>
                    </div>
                    <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Script content..."
                        rows={6} className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-pink-500/50 resize-none font-mono" />
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setShowCreate(false)} className="text-sm text-neutral-500 hover:text-neutral-300">Cancel</button>
                        <button onClick={createScript} className="px-4 py-1.5 rounded-lg bg-pink-500 text-white text-sm font-medium hover:bg-pink-600 transition-colors">Create</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scripts.map((s) => (
                    <div key={s.name} className="border border-white/10 rounded-xl bg-white/[0.02] p-5 flex flex-col hover:border-white/20 transition-all">
                        <div className="flex items-start justify-between mb-2">
                            <span className="font-mono text-sm text-pink-200">{s.name}</span>
                            <button onClick={() => deleteScript(s.name)} className="p-1.5 rounded hover:bg-white/10 text-red-400"><Trash2 size={14} /></button>
                        </div>
                        <p className="text-sm text-neutral-400 mt-1 flex-1">{s.description}</p>
                        <div className="flex items-center gap-2 mt-3">
                            <span className="text-[10px] font-mono text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded">{s.entrypoint || 'run.sh'}</span>
                            {s.args && Object.keys(s.args).length > 0 && (
                                <span className="text-[10px] text-neutral-500">{Object.keys(s.args).length} arg(s)</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
