import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, CheckCircle2, AlertTriangle, XCircle, Info, RefreshCw, Clock } from 'lucide-react';

const API = '';

interface Notification {
    timestamp: string;
    level: string;
    title: string;
    message: string;
}

const levelConfig: Record<string, { icon: typeof Bell; color: string; bg: string; border: string; label: string }> = {
    success: { icon: CheckCircle2, color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', label: 'SUCCESS' },
    error: { icon: XCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', label: 'ERROR' },
    warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'WARNING' },
    info: { icon: Info, color: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', label: 'INFO' },
};

function timeAgo(timestamp: string): string {
    const diff = Date.now() - new Date(timestamp).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

export default function NotificationsPanel() {
    const { id } = useParams();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');

    const load = useCallback(() => {
        setLoading(true);
        fetch(`${API}/api/instances/${id}/notifications`)
            .then(r => r.json())
            .then(d => setNotifications(d.notifications || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        load();
        const interval = setInterval(load, 10000);
        return () => clearInterval(interval);
    }, [load]);

    const filtered = filter === 'all' ? notifications : notifications.filter(n => n.level === filter);

    const counts = {
        all: notifications.length,
        success: notifications.filter(n => n.level === 'success').length,
        error: notifications.filter(n => n.level === 'error').length,
        warning: notifications.filter(n => n.level === 'warning').length,
        info: notifications.filter(n => n.level === 'info').length,
    };

    return (
        <div style={{ padding: 32, maxWidth: 900, overflowY: 'auto', height: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Bell size={28} color="#f59e0b" />
                    <h2 style={{ margin: 0, color: '#fff', fontSize: 22 }}>Notifications</h2>
                    <span style={{ color: '#555', fontSize: 13 }}>({notifications.length})</span>
                </div>
                <button
                    onClick={load}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', background: '#1a1a2e',
                        border: '1px solid #2a2a40', borderRadius: 8,
                        color: '#aaa', fontSize: 12, cursor: 'pointer',
                    }}
                >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
                {(['all', 'success', 'error', 'warning', 'info'] as const).map(f => {
                    const isActive = filter === f;
                    const cfg = f === 'all' ? null : levelConfig[f];
                    return (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '5px 14px', borderRadius: 20,
                                border: `1px solid ${isActive ? (cfg?.color || '#6366f1') : '#2a2a40'}`,
                                background: isActive ? (cfg?.bg || 'rgba(99,102,241,0.08)') : 'transparent',
                                color: isActive ? (cfg?.color || '#6366f1') : '#666',
                                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6,
                                transition: 'all 0.15s',
                            }}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                            {(counts as any)[f] > 0 && (
                                <span style={{
                                    background: isActive ? (cfg?.color || '#6366f1') : '#333',
                                    color: isActive ? '#fff' : '#888',
                                    padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                                }}>
                                    {(counts as any)[f]}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Notification List */}
            {filtered.length === 0 ? (
                <div style={{
                    color: '#555', fontSize: 13, padding: 40,
                    background: '#1a1a2e', borderRadius: 12, textAlign: 'center',
                }}>
                    <Bell size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <p style={{ margin: 0 }}>No notifications yet</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#444' }}>
                        Notifications appear when goals complete, fail, or tasks finish.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filtered.map((n, i) => {
                        const cfg = levelConfig[n.level] || levelConfig.info;
                        const Icon = cfg.icon;
                        return (
                            <div
                                key={i}
                                style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 12,
                                    padding: '12px 16px', background: cfg.bg,
                                    border: `1px solid ${cfg.border}`,
                                    borderRadius: 10, transition: 'all 0.15s',
                                }}
                            >
                                <Icon size={18} color={cfg.color} style={{ marginTop: 2, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                                            color: cfg.color, background: `${cfg.color}22`,
                                            padding: '1px 6px', borderRadius: 4,
                                        }}>
                                            {cfg.label}
                                        </span>
                                        <span style={{ fontWeight: 600, color: '#ddd', fontSize: 13 }}>
                                            {n.title}
                                        </span>
                                    </div>
                                    <div style={{ color: '#999', fontSize: 12, lineHeight: 1.5, wordBreak: 'break-word' }}>
                                        {n.message}
                                    </div>
                                </div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    color: '#555', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0,
                                }}>
                                    <Clock size={11} />
                                    {timeAgo(n.timestamp)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
