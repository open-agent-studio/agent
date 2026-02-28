import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Code, Wrench, Package, FileCode } from 'lucide-react';

export function Capabilities() {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<{ skills: any[], commands: any[], plugins: any[], scripts: any[] } | null>(null);

    useEffect(() => {
        fetch(`http://localhost:3333/api/instances/${id}/capabilities`)
            .then(r => r.json())
            .then(setData)
            .catch((e) => console.error("Error loading capabilities", e));
    }, [id]);

    if (!data) return <div className="p-8 text-neutral-500 animate-pulse">Scanning capabilities...</div>;

    return (
        <div className="flex flex-col h-full bg-neutral-950 overflow-y-auto p-8 space-y-12">
            <div>
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Package className="text-indigo-400" size={20} /> Installed Plugins ({data.plugins?.length || 0})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.plugins?.map((p, i) => (
                        <div key={i} className="border border-white/10 p-5 rounded-xl bg-white/[0.02]">
                            <div className="font-medium text-neutral-200">{p.name || 'Unknown Plugin'}</div>
                            <div className="text-xs text-neutral-500 mt-2 line-clamp-2 leading-relaxed">{p.description}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Wrench className="text-emerald-400" size={20} /> Active Skills ({data.skills?.length || 0})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.skills?.map((s, i) => (
                        <div key={i} className="border border-white/10 p-5 rounded-xl bg-white/[0.02] flex flex-col hover:border-white/20 transition-all">
                            <div className="font-medium text-neutral-200 mb-2">{s.name}</div>
                            <div className="text-[10px] text-emerald-400/80 font-mono mb-3 p-1.5 bg-emerald-500/10 rounded inline-flex w-max tracking-wide uppercase">{s.mcpId || 'Local Core Provider'}</div>
                            <div className="text-sm text-neutral-400 mt-auto leading-relaxed">{s.description}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Code className="text-amber-400" size={20} /> Registered Commands ({data.commands?.length || 0})
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {data.commands?.map((c, i) => (
                        <div key={i} className="border border-white/10 p-4 rounded-xl flex items-center gap-3 bg-white/[0.01]">
                            <span className="font-mono text-sm text-amber-200 bg-amber-500/10 px-2 py-0.5 rounded">/{c.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <FileCode className="text-pink-400" size={20} /> Scripts ({data.scripts?.length || 0})
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {data.scripts?.map((s, i) => (
                        <div key={i} className="border border-white/10 p-4 rounded-xl flex items-center gap-3 bg-white/[0.01]">
                            <span className="font-mono text-sm text-pink-200">{s.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
