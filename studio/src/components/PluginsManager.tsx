import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Package, Trash2, AlertCircle } from 'lucide-react';

const API = 'http://localhost:3333/api';

export function PluginsManager() {
    const { id } = useParams<{ id: string }>();
    const [plugins, setPlugins] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        setError(null);
        fetch(`${API}/instances/${id}/plugins`)
            .then(r => r.json())
            .then(d => setPlugins(d.plugins || []))
            .catch(err => setError(err.message));
    };

    useEffect(() => { load(); }, [id]);

    const deletePlugin = async (name: string) => {
        if (!confirm(`Remove plugin "${name}"?`)) return;
        await fetch(`${API}/instances/${id}/plugins/${name}`, { method: 'DELETE' });
        load();
    };

    return (
        <div className="flex flex-col h-full bg-neutral-950 overflow-y-auto p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Package className="text-indigo-400" size={22} /> Plugins
                    </h2>
                    <p className="text-neutral-500 text-sm mt-1">{plugins.length} plugin{plugins.length !== 1 ? 's' : ''} installed</p>
                </div>
            </div>

            {error && (
                <div className="border border-red-500/20 rounded-xl bg-red-500/5 p-4 mb-6 flex items-center gap-3">
                    <AlertCircle className="text-red-400 shrink-0" size={18} />
                    <p className="text-sm text-red-400">Failed to load plugins: {error}</p>
                </div>
            )}

            {plugins.length === 0 ? (
                <div className="border border-white/10 border-dashed rounded-xl p-16 text-center">
                    <Package className="mx-auto mb-4 text-neutral-600" size={32} />
                    <p className="text-neutral-500">No plugins installed.</p>
                    <p className="text-neutral-600 text-sm mt-2">Install plugins via CLI: <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400">agent plugins install github</code></p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {plugins.map((p, idx) => {
                        const pluginName = p.name || `plugin-${idx + 1}`;
                        const pluginDesc = p.description || 'No description available';
                        return (
                            <div key={pluginName} className="border border-white/10 rounded-xl bg-white/[0.02] p-5 flex flex-col hover:border-white/20 transition-all">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="font-medium text-neutral-200">{pluginName}</div>
                                    <button onClick={() => deletePlugin(pluginName)} className="p-1.5 rounded hover:bg-white/10 text-red-400"><Trash2 size={14} /></button>
                                </div>
                                <p className="text-sm text-neutral-400 mt-1 flex-1">{pluginDesc}</p>
                                {p.category && (
                                    <span className="text-[10px] text-neutral-500 mt-2">{p.category}</span>
                                )}
                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">v{p.version || '1.0.0'}</span>
                                    {p.exports?.skills?.length > 0 && <span className="text-[10px] text-neutral-500">{p.exports.skills.length} skill(s)</span>}
                                    {p.exports?.tools?.length > 0 && <span className="text-[10px] text-neutral-500">{p.exports.tools.length} tool(s)</span>}
                                    {p.skills?.length > 0 && <span className="text-[10px] text-neutral-500">{p.skills.length} skill(s)</span>}
                                    {p.commands?.length > 0 && <span className="text-[10px] text-neutral-500">{p.commands.length} cmd(s)</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
