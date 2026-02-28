import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Brain, Search, Plus, Trash2 } from 'lucide-react';

const API = 'http://localhost:3333/api';

const categoryColors: Record<string, string> = {
    project: 'text-blue-400 bg-blue-500/10',
    preference: 'text-purple-400 bg-purple-500/10',
    fact: 'text-emerald-400 bg-emerald-500/10',
    learned: 'text-amber-400 bg-amber-500/10',
    general: 'text-neutral-400 bg-neutral-500/10',
};

export function MemoryExplorer() {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[] | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ content: '', category: 'general', tags: '' });

    const emptyData = { stats: { total: 0, byCategory: {}, bySource: {} }, memories: [] };

    const load = async () => {
        try {
            const res = await fetch(`${API}/instances/${id}/memory`);
            if (!res.ok) { setData(emptyData); return; }
            const d = await res.json();
            setData(d ?? emptyData);
        } catch { setData(emptyData); }
    };

    useEffect(() => { load(); }, [id]);

    const search = async () => {
        if (!searchQuery.trim()) { setSearchResults(null); return; }
        try {
            const res = await fetch(`${API}/instances/${id}/memory/search?q=${encodeURIComponent(searchQuery)}`);
            if (!res.ok) { setSearchResults([]); return; }
            const d = await res.json();
            setSearchResults(d.results || []);
        } catch { setSearchResults([]); }
    };

    const addMemory = async () => {
        if (!form.content.trim()) return;
        await fetch(`${API}/instances/${id}/memory`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: form.content, category: form.category,
                tags: form.tags ? form.tags.split(',').map(s => s.trim()) : [],
            }),
        });
        setForm({ content: '', category: 'general', tags: '' });
        setShowAdd(false);
        load();
    };

    const deleteMemory = async (memoryId: number) => {
        await fetch(`${API}/instances/${id}/memory/${memoryId}`, { method: 'DELETE' });
        load();
    };

    if (!data) return <div className="p-8 text-neutral-500 animate-pulse">Loading memories...</div>;

    const stats = data.stats ?? { total: 0, byCategory: {}, bySource: {} };
    const memories = searchResults ?? data.memories ?? [];

    return (
        <div className="flex flex-col h-full bg-neutral-950 overflow-y-auto p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Brain className="text-violet-400" size={22} /> Memory Explorer
                    </h2>
                    <p className="text-neutral-500 text-sm mt-1">{stats.total} memories stored</p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-500/30 transition-colors">
                    <Plus size={16} /> Add Memory
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-3 mb-6">
                {Object.entries(stats.byCategory || {}).map(([cat, count]) => (
                    <div key={cat} className="border border-white/10 rounded-lg p-3 bg-white/[0.02] text-center">
                        <div className={`text-xs font-medium uppercase tracking-wider ${categoryColors[cat]?.split(' ')[0] ?? 'text-neutral-400'}`}>{cat}</div>
                        <div className="text-lg font-semibold text-neutral-200 mt-1">{count as number}</div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="flex gap-3 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && search()}
                        placeholder="Search memories..."
                        className="w-full bg-neutral-900 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-violet-500/50" />
                </div>
                <button onClick={search} className="px-4 py-2.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-500/30 transition-colors">Search</button>
                {searchResults && (
                    <button onClick={() => { setSearchResults(null); setSearchQuery(''); }} className="px-3 text-sm text-neutral-500 hover:text-neutral-300">Clear</button>
                )}
            </div>

            {/* Add Memory Form */}
            {showAdd && (
                <div className="border border-white/10 rounded-xl p-5 bg-white/[0.02] mb-6 space-y-4">
                    <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Memory content..."
                        rows={3} className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-violet-500/50 resize-none" />
                    <div className="flex gap-4">
                        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                            className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm">
                            <option value="general">General</option>
                            <option value="fact">Fact</option>
                            <option value="project">Project</option>
                            <option value="preference">Preference</option>
                            <option value="learned">Learned</option>
                        </select>
                        <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="Tags (comma-separated)..."
                            className="flex-1 bg-neutral-900 border border-white/10 rounded-lg px-4 py-2 text-sm placeholder-neutral-600 focus:outline-none focus:border-violet-500/50" />
                        <button onClick={addMemory} className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-colors">Save</button>
                    </div>
                </div>
            )}

            {/* Memory List */}
            <div className="space-y-2">
                {memories.map((m: any) => (
                    <div key={m.id} className="border border-white/10 rounded-lg bg-white/[0.02] p-4 flex items-start gap-3 hover:border-white/20 transition-all">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded mt-0.5 ${categoryColors[m.category] ?? categoryColors.general}`}>{m.category}</span>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-neutral-300 leading-relaxed">{m.content}</div>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] text-neutral-600">{m.source}</span>
                                <span className="text-[10px] text-neutral-600">{new Date(m.created_at).toLocaleString()}</span>
                                {m.tags?.length > 0 && m.tags.map((t: string) => (
                                    <span key={t} className="text-[10px] text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">{t}</span>
                                ))}
                            </div>
                        </div>
                        <button onClick={() => deleteMemory(m.id)} className="p-1.5 rounded hover:bg-white/10 text-red-400 shrink-0"><Trash2 size={14} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
}
