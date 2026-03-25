import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DollarSign, TrendingUp, Zap, Clock, BarChart3, ArrowUp, ArrowDown } from 'lucide-react';

const API = '';

interface CostSummary {
    totalCostUsd: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    entryCount: number;
    byModel: Record<string, { cost: number; tokens: number; calls: number }>;
    byDay: Record<string, { cost: number; tokens: number; calls: number }>;
    last7Days: number;
    last30Days: number;
}

interface CostEntry {
    timestamp: string;
    taskId?: number;
    goalId?: number;
    model: string;
    provider: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    costUsd: number;
    label: string;
}

function formatCost(usd: number): string {
    if (usd === 0) return '$0.00';
    if (usd < 0.01) return `$${usd.toFixed(6)}`;
    if (usd < 1) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
}

function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
}

export default function CostDashboard() {
    const { id } = useParams();
    const [summary, setSummary] = useState<CostSummary | null>(null);
    const [recent, setRecent] = useState<CostEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch(`${API}/api/instances/${id}/costs/summary`).then(r => r.ok ? r.json() : null),
            fetch(`${API}/api/instances/${id}/costs/recent?limit=30`).then(r => r.ok ? r.json() : null),
        ]).then(([sum, rec]) => {
            if (sum) setSummary(sum);
            setRecent(rec?.entries || []);
        }).catch(console.error).finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div style={{ padding: 32, color: '#aaa' }}>Loading cost data...</div>;

    const s = summary || { totalCostUsd: 0, totalTokens: 0, totalPromptTokens: 0, totalCompletionTokens: 0, entryCount: 0, byModel: {}, byDay: {}, last7Days: 0, last30Days: 0 };

    return (
        <div style={{ padding: 32, maxWidth: 900, overflowY: 'auto', height: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <DollarSign size={28} color="#22c55e" />
                <h2 style={{ margin: 0, color: '#fff', fontSize: 22 }}>Cost Tracker</h2>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                <StatCard icon={<DollarSign size={18} />} label="Total Spend" value={formatCost(s.totalCostUsd)} color="#22c55e" />
                <StatCard icon={<Zap size={18} />} label="Total Tokens" value={formatTokens(s.totalTokens)} color="#6366f1" />
                <StatCard icon={<TrendingUp size={18} />} label="Last 7 Days" value={formatCost(s.last7Days)} color="#f5a623" />
                <StatCard icon={<BarChart3 size={18} />} label="API Calls" value={s.entryCount.toString()} color="#ec4899" />
            </div>

            {/* Model Breakdown */}
            <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: '#ddd', fontSize: 15, marginBottom: 12 }}>By Model</h3>
                {Object.keys(s.byModel).length === 0 ? (
                    <div style={{ color: '#555', fontSize: 13, padding: 16, background: '#1a1a2e', borderRadius: 10, textAlign: 'center' }}>
                        No usage recorded yet. Costs appear after daemon processes tasks.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {Object.entries(s.byModel).sort((a, b) => b[1].cost - a[1].cost).map(([model, data]) => (
                            <div key={model} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 16px', background: '#1a1a2e', border: '1px solid #2a2a40',
                                borderRadius: 8,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <code style={{ color: '#ddd', fontSize: 13, fontFamily: 'monospace' }}>{model}</code>
                                    <span style={{ color: '#666', fontSize: 11 }}>{data.calls} calls</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <span style={{ color: '#888', fontSize: 12 }}>{formatTokens(data.tokens)} tokens</span>
                                    <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 700, minWidth: 80, textAlign: 'right' }}>
                                        {formatCost(data.cost)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Recent Calls */}
            <div>
                <h3 style={{ color: '#ddd', fontSize: 15, marginBottom: 12 }}>Recent API Calls</h3>
                {recent.length === 0 ? (
                    <div style={{ color: '#555', fontSize: 13, padding: 16, background: '#1a1a2e', borderRadius: 10, textAlign: 'center' }}>
                        No recent calls. Usage will appear here as the daemon processes tasks.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {recent.slice().reverse().map((entry, i) => (
                            <div key={i} style={{
                                display: 'grid', gridTemplateColumns: '120px 1fr auto auto',
                                alignItems: 'center', gap: 12,
                                padding: '8px 14px', background: '#1a1a2e', borderRadius: 6,
                                fontSize: 12,
                            }}>
                                <span style={{ color: '#666' }}>
                                    <Clock size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                </span>
                                <span style={{ color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {entry.label}
                                </span>
                                <span style={{ color: '#888' }}>
                                    <ArrowUp size={10} color="#6366f1" style={{ verticalAlign: 'middle' }} /> {formatTokens(entry.usage.promptTokens)}
                                    {' '}
                                    <ArrowDown size={10} color="#22c55e" style={{ verticalAlign: 'middle' }} /> {formatTokens(entry.usage.completionTokens)}
                                </span>
                                <span style={{ color: '#22c55e', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                                    {formatCost(entry.costUsd)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Token Split */}
            <div style={{
                marginTop: 24, padding: '12px 16px', background: '#1a1a2e',
                border: '1px solid #2a2a40', borderRadius: 8,
                display: 'flex', justifyContent: 'space-between',
            }}>
                <div style={{ color: '#888', fontSize: 12 }}>
                    <ArrowUp size={12} color="#6366f1" style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Prompt: <strong style={{ color: '#ccc' }}>{formatTokens(s.totalPromptTokens)}</strong>
                </div>
                <div style={{ color: '#888', fontSize: 12 }}>
                    <ArrowDown size={12} color="#22c55e" style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Completion: <strong style={{ color: '#ccc' }}>{formatTokens(s.totalCompletionTokens)}</strong>
                </div>
                <div style={{ color: '#888', fontSize: 12 }}>
                    Last 30d: <strong style={{ color: '#f5a623' }}>{formatCost(s.last30Days)}</strong>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    return (
        <div style={{
            padding: '16px 18px', background: '#1a1a2e', border: '1px solid #2a2a40',
            borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ color }}>{icon}</div>
                <span style={{ color: '#888', fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>{label}</span>
            </div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}>{value}</div>
        </div>
    );
}
