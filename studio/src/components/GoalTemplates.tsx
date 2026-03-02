import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, X, Zap, ChevronRight } from 'lucide-react';

const API = 'http://localhost:3333/api';

interface TemplateVariable {
    name: string;
    label: string;
    placeholder: string;
}

interface GoalTemplate {
    id: string;
    icon: string;
    title: string;
    description: string;
    goal: { title: string; description: string };
    variables?: TemplateVariable[];
    recurrence?: string;
    tags: string[];
}

export function GoalTemplates() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<GoalTemplate[]>([]);
    const [selected, setSelected] = useState<GoalTemplate | null>(null);
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetch(`${API}/goal-templates`)
            .then(r => r.json())
            .then(d => setTemplates(d.templates || []))
            .catch(console.error);
    }, []);

    const selectTemplate = (t: GoalTemplate) => {
        setSelected(t);
        setVariables({});
    };

    const resolveTemplate = (text: string): string => {
        let resolved = text;
        for (const [key, value] of Object.entries(variables)) {
            resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), value || `{${key}}`);
        }
        return resolved;
    };

    const createGoal = async () => {
        if (!selected) return;
        setCreating(true);
        try {
            const title = resolveTemplate(selected.goal.title);
            const description = resolveTemplate(selected.goal.description);

            await fetch(`${API}/instances/${id}/goals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description,
                    recurrence: selected.recurrence || undefined,
                }),
            });

            setSelected(null);
            navigate(`/instance/${id}/goals`);
        } catch (err) {
            console.error(err);
        }
        setCreating(false);
    };

    const tagColors: Record<string, string> = {
        devops: 'bg-green-500/15 text-green-400 border-green-500/30',
        monitoring: 'bg-green-500/15 text-green-400 border-green-500/30',
        content: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        writing: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
        scraping: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
        apify: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
        'code-quality': 'bg-sky-500/15 text-sky-400 border-sky-500/30',
        refactoring: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
        data: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
        automation: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
        reporting: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
        recurring: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    };

    return (
        <div className="flex flex-col h-full bg-neutral-950 overflow-y-auto p-8">
            <div className="flex items-center gap-3 mb-8">
                <Sparkles className="text-amber-400" size={24} />
                <div>
                    <h2 className="text-xl font-semibold">Goal Templates</h2>
                    <p className="text-neutral-500 text-sm mt-0.5">Pre-built workflows for common tasks</p>
                </div>
            </div>

            {/* Template grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(t => (
                    <div key={t.id}
                        onClick={() => selectTemplate(t)}
                        className={`border rounded-xl p-5 cursor-pointer transition-all group ${selected?.id === t.id
                                ? 'border-amber-500/50 bg-amber-500/5'
                                : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                            }`}>
                        <div className="flex items-start justify-between mb-3">
                            <span className="text-2xl">{t.icon}</span>
                            <ChevronRight size={16} className={`text-neutral-600 transition-transform ${selected?.id === t.id ? 'rotate-90 text-amber-400' : 'group-hover:text-neutral-400'}`} />
                        </div>
                        <h3 className="font-medium text-sm mb-1">{t.title}</h3>
                        <p className="text-xs text-neutral-500 mb-3">{t.description}</p>
                        <div className="flex flex-wrap gap-1.5">
                            {t.tags.map(tag => (
                                <span key={tag} className={`text-[10px] px-2 py-0.5 rounded border ${tagColors[tag] || 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30'}`}>
                                    {tag}
                                </span>
                            ))}
                            {t.recurrence && (
                                <span className="text-[10px] px-2 py-0.5 rounded border bg-pink-500/15 text-pink-400 border-pink-500/30">
                                    🔁 {t.recurrence}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Template configuration modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{selected.icon}</span>
                                <h3 className="font-semibold">{selected.title}</h3>
                            </div>
                            <button onClick={() => setSelected(null)} className="p-1.5 rounded hover:bg-white/10 text-neutral-400">
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-sm text-neutral-400">{selected.description}</p>

                        {/* Variable inputs */}
                        {selected.variables && selected.variables.length > 0 && (
                            <div className="space-y-3">
                                {selected.variables.map(v => (
                                    <div key={v.name}>
                                        <label className="text-xs font-medium text-neutral-400 mb-1.5 block">{v.label}</label>
                                        <input
                                            value={variables[v.name] || ''}
                                            onChange={e => setVariables({ ...variables, [v.name]: e.target.value })}
                                            placeholder={v.placeholder}
                                            className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-500/50"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Preview */}
                        <div className="bg-neutral-800/50 border border-white/5 rounded-lg p-4 space-y-2">
                            <p className="text-xs font-medium text-neutral-500">Preview</p>
                            <p className="text-sm font-medium text-amber-300">{resolveTemplate(selected.goal.title)}</p>
                            <p className="text-xs text-neutral-400">{resolveTemplate(selected.goal.description)}</p>
                            {selected.recurrence && (
                                <p className="text-xs text-pink-400">🔁 Recurring: {selected.recurrence}</p>
                            )}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setSelected(null)} className="text-sm text-neutral-500 hover:text-neutral-300">Cancel</button>
                            <button onClick={createGoal} disabled={creating}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50">
                                <Zap size={14} />
                                {creating ? 'Creating...' : 'Create Goal'}
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
