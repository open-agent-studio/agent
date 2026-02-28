import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Wrench, Plus, Trash2, Save, X, Edit3 } from 'lucide-react';

const API = 'http://localhost:3333/api';

export function SkillsManager() {
    const { id } = useParams<{ id: string }>();
    const [skills, setSkills] = useState<any[]>([]);
    const [editing, setEditing] = useState<string | null>(null);
    const [editPrompt, setEditPrompt] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', prompt: '', tools: '' });

    const load = () => {
        fetch(`${API}/instances/${id}/skills`).then(r => r.json()).then(d => setSkills(d.skills || [])).catch(console.error);
    };

    useEffect(() => { load(); }, [id]);

    const createSkill = async () => {
        if (!form.name.trim()) return;
        await fetch(`${API}/instances/${id}/skills`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: form.name, description: form.description, prompt: form.prompt,
                tools: form.tools ? form.tools.split(',').map(s => s.trim()) : [],
            }),
        });
        setForm({ name: '', description: '', prompt: '', tools: '' });
        setShowCreate(false);
        load();
    };

    const saveEdit = async (name: string) => {
        await fetch(`${API}/instances/${id}/skills/${name}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: editPrompt }),
        });
        setEditing(null);
        load();
    };

    const deleteSkill = async (name: string) => {
        if (!confirm(`Delete skill "${name}"?`)) return;
        await fetch(`${API}/instances/${id}/skills/${name}`, { method: 'DELETE' });
        load();
    };

    return (
        <div className="flex flex-col h-full bg-neutral-950 overflow-y-auto p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Wrench className="text-emerald-400" size={22} /> Skills Manager
                    </h2>
                    <p className="text-neutral-500 text-sm mt-1">{skills.length} skill{skills.length !== 1 ? 's' : ''} loaded</p>
                </div>
                <button onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors">
                    <Plus size={16} /> Create Skill
                </button>
            </div>

            {showCreate && (
                <div className="border border-white/10 rounded-xl p-5 bg-white/[0.02] mb-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Skill name..."
                            className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-emerald-500/50" />
                        <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description..."
                            className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-emerald-500/50" />
                    </div>
                    <input value={form.tools} onChange={e => setForm({ ...form, tools: e.target.value })} placeholder="Tools (comma-separated, e.g. fs.read, fs.write)..."
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-emerald-500/50" />
                    <textarea value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })} placeholder="Prompt content (markdown)..."
                        rows={6} className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-emerald-500/50 resize-none font-mono" />
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setShowCreate(false)} className="text-sm text-neutral-500 hover:text-neutral-300">Cancel</button>
                        <button onClick={createSkill} className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors">Create</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {skills.map((s) => (
                    <div key={s.name} className="border border-white/10 rounded-xl bg-white/[0.02] p-5 flex flex-col">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="font-medium text-neutral-200">{s.name}</div>
                                <div className="text-xs text-neutral-500 mt-1">{s.description}</div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => { setEditing(s.name); setEditPrompt(s.promptContent || ''); }} className="p-1.5 rounded hover:bg-white/10 text-blue-400" title="Edit">
                                    <Edit3 size={14} />
                                </button>
                                <button onClick={() => deleteSkill(s.name)} className="p-1.5 rounded hover:bg-white/10 text-red-400" title="Delete">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-auto">
                            {s.tools?.map((t: string) => (
                                <span key={t} className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{t}</span>
                            ))}
                            <span className="text-[10px] font-mono text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded">v{s.version}</span>
                        </div>

                        {editing === s.name && (
                            <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
                                <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)}
                                    rows={8} className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-emerald-500/50 resize-none" />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditing(null)} className="p-1.5 rounded hover:bg-white/10 text-neutral-400"><X size={16} /></button>
                                    <button onClick={() => saveEdit(s.name)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium"><Save size={14} /> Save</button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
