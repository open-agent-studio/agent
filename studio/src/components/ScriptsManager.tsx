import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileCode, Plus, Trash2, Play, X, ChevronRight, Terminal, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const API = 'http://localhost:3333/api';

// Map file extension to a display type + color
function getScriptType(entrypoint: string): { label: string; color: string; bg: string } {
    const ext = (entrypoint || '').split('.').pop()?.toLowerCase() || '';
    switch (ext) {
        case 'sh': case 'bash': return { label: 'Shell', color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30' };
        case 'py': return { label: 'Python', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' };
        case 'js': case 'mjs': return { label: 'JavaScript', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' };
        case 'ts': case 'mts': return { label: 'TypeScript', color: 'text-sky-400', bg: 'bg-sky-500/15 border-sky-500/30' };
        case 'rb': return { label: 'Ruby', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' };
        default: return { label: ext || 'Script', color: 'text-neutral-400', bg: 'bg-neutral-500/15 border-neutral-500/30' };
    }
}

interface RunResult {
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
}

export function ScriptsManager() {
    const { id } = useParams<{ id: string }>();
    const [scripts, setScripts] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', entrypoint: 'run.sh', content: '' });
    const [selectedScript, setSelectedScript] = useState<string | null>(null);
    const [scriptContent, setScriptContent] = useState<string>('');
    const [scriptMeta, setScriptMeta] = useState<any>(null);
    const [loadingContent, setLoadingContent] = useState(false);
    const [runningScript, setRunningScript] = useState<string | null>(null);
    const [runResult, setRunResult] = useState<RunResult | null>(null);

    const load = () => {
        fetch(`${API}/instances/${id}/scripts`).then(r => r.json()).then(d => setScripts(d.scripts || [])).catch(console.error);
    };

    useEffect(() => { load(); }, [id]);

    const openScript = async (name: string) => {
        setSelectedScript(name);
        setLoadingContent(true);
        setRunResult(null);
        try {
            const res = await fetch(`${API}/instances/${id}/scripts/${name}`);
            const data = await res.json();
            setScriptContent(data.content || '');
            setScriptMeta(data);
        } catch (err) {
            setScriptContent('// Failed to load script content');
        }
        setLoadingContent(false);
    };

    const runScript = async (name: string) => {
        setRunningScript(name);
        setRunResult(null);
        try {
            const res = await fetch(`${API}/instances/${id}/scripts/${name}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ args: {} }),
            });
            const result = await res.json();
            setRunResult(result);
        } catch (err) {
            setRunResult({ success: false, exitCode: 1, stdout: '', stderr: (err as Error).message, durationMs: 0 });
        }
        setRunningScript(null);
    };

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
        if (selectedScript === name) { setSelectedScript(null); setScriptContent(''); }
        load();
    };

    return (
        <div className="flex flex-col h-full bg-neutral-950 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <FileCode className="text-pink-400" size={22} /> Scripts
                    </h2>
                    <p className="text-neutral-500 text-sm mt-1">{scripts.length} script{scripts.length !== 1 ? 's' : ''} available</p>
                </div>
                <button onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-500/20 border border-pink-500/30 text-pink-300 text-sm font-medium hover:bg-pink-500/30 transition-colors">
                    <Plus size={16} /> New Script
                </button>
            </div>

            {/* Create form */}
            {showCreate && (
                <div className="border-b border-white/5 p-6 space-y-4 bg-white/[0.01]">
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

            {/* Two-panel layout: list + viewer */}
            <div className="flex flex-1 min-h-0">
                {/* Script list */}
                <div className={`${selectedScript ? 'w-80' : 'w-full'} border-r border-white/5 overflow-y-auto transition-all`}>
                    <div className={`${selectedScript ? '' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-1 p-4`}>
                        {scripts.map((s) => {
                            const type = getScriptType(s.manifest?.entrypoint || s.entrypoint || '');
                            const isSelected = selectedScript === s.manifest?.name;
                            return (
                                <div key={s.manifest?.name || s.name}
                                    onClick={() => openScript(s.manifest?.name || s.name)}
                                    className={`border rounded-xl p-4 flex flex-col cursor-pointer transition-all group ${isSelected
                                            ? 'border-pink-500/50 bg-pink-500/5'
                                            : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                                        }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${type.bg} ${type.color}`}>
                                                {type.label}
                                            </span>
                                            <span className="font-mono text-sm text-pink-200 truncate">
                                                {s.manifest?.name || s.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); runScript(s.manifest?.name || s.name); }}
                                                className="p-1.5 rounded hover:bg-green-500/20 text-green-400" title="Run script">
                                                {runningScript === (s.manifest?.name || s.name) ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); deleteScript(s.manifest?.name || s.name); }}
                                                className="p-1.5 rounded hover:bg-red-500/20 text-red-400" title="Delete script">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{s.manifest?.description || s.description || 'No description'}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] font-mono text-neutral-500">
                                            {s.manifest?.entrypoint || s.entrypoint || 'run.sh'}
                                        </span>
                                        {s.manifest?.tags?.length > 0 && (
                                            <span className="text-[10px] text-neutral-600">
                                                {s.manifest.tags.join(', ')}
                                            </span>
                                        )}
                                        {isSelected && <ChevronRight size={12} className="text-pink-400 ml-auto" />}
                                    </div>
                                </div>
                            );
                        })}
                        {scripts.length === 0 && (
                            <div className="text-center text-neutral-600 py-12 col-span-full">
                                <FileCode size={40} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No scripts yet</p>
                                <p className="text-xs mt-1">Create one or let the daemon auto-generate scripts</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Script viewer */}
                {selectedScript && (
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Viewer header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.01]">
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-sm text-pink-300">{selectedScript}</span>
                                {scriptMeta && (
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${getScriptType(scriptMeta.entrypoint).bg} ${getScriptType(scriptMeta.entrypoint).color}`}>
                                        {getScriptType(scriptMeta.entrypoint).label}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => runScript(selectedScript)}
                                    disabled={!!runningScript}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50">
                                    {runningScript === selectedScript ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                                    Run
                                </button>
                                <button onClick={() => { setSelectedScript(null); setRunResult(null); }}
                                    className="p-1.5 rounded hover:bg-white/10 text-neutral-400">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Script content */}
                        <div className="flex-1 overflow-y-auto">
                            {loadingContent ? (
                                <div className="flex items-center justify-center h-32 text-neutral-500">
                                    <Loader2 size={20} className="animate-spin mr-2" /> Loading...
                                </div>
                            ) : (
                                <pre className="p-5 text-sm font-mono text-neutral-300 leading-relaxed whitespace-pre-wrap">
                                    {scriptContent}
                                </pre>
                            )}
                        </div>

                        {/* Run result */}
                        {runResult && (
                            <div className="border-t border-white/10 bg-neutral-900/80">
                                <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/5">
                                    <Terminal size={14} className="text-neutral-400" />
                                    <span className="text-xs font-medium text-neutral-300">Output</span>
                                    {runResult.success ? (
                                        <span className="flex items-center gap-1 text-[10px] text-green-400">
                                            <CheckCircle size={10} /> Exit 0
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-[10px] text-red-400">
                                            <XCircle size={10} /> Exit {runResult.exitCode}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1 text-[10px] text-neutral-500 ml-auto">
                                        <Clock size={10} /> {(runResult.durationMs / 1000).toFixed(1)}s
                                    </span>
                                </div>
                                <pre className="p-4 text-xs font-mono max-h-48 overflow-y-auto text-neutral-400 whitespace-pre-wrap">
                                    {runResult.stdout || runResult.stderr || '(no output)'}
                                    {runResult.stdout && runResult.stderr && (
                                        <span className="text-red-400">{'\n--- stderr ---\n'}{runResult.stderr}</span>
                                    )}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
