import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { KeyRound, Plus, Trash2, Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react';

const API = '';

export default function CredentialsManager() {
    const { id } = useParams();
    const [keys, setKeys] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [showValue, setShowValue] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const fetchKeys = async () => {
        try {
            const res = await fetch(`${API}/api/instances/${id}/credentials`);
            const data = await res.json();
            setKeys(data.keys || []);
        } catch (err) {
            console.error('Failed to fetch credentials', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchKeys(); }, [id]);

    const handleAdd = async () => {
        if (!newKey || !newValue) return;
        setSaving(true);
        try {
            await fetch(`${API}/api/instances/${id}/credentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: newKey.toUpperCase().replace(/\s+/g, '_'), value: newValue }),
            });
            setNewKey('');
            setNewValue('');
            setShowAdd(false);
            setShowValue(false);
            await fetchKeys();
        } catch (err) {
            console.error('Failed to add credential', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (key: string) => {
        try {
            await fetch(`${API}/api/instances/${id}/credentials/${key}`, { method: 'DELETE' });
            setDeleteConfirm(null);
            await fetchKeys();
        } catch (err) {
            console.error('Failed to delete credential', err);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: 32, color: '#aaa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <KeyRound size={20} />
                    Loading credentials...
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 32, maxWidth: 800 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ShieldCheck size={28} color="#f5a623" />
                        <h2 style={{ margin: 0, color: '#fff', fontSize: 22 }}>Credential Vault</h2>
                    </div>
                    <p style={{ color: '#888', margin: '6px 0 0 38px', fontSize: 13 }}>
                        Encrypted secrets available to the daemon. Stored in AES-256-GCM vault.
                    </p>
                </div>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', border: '1px solid #f5a623',
                        borderRadius: 8, background: showAdd ? '#f5a62320' : 'transparent',
                        color: '#f5a623', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    }}
                >
                    <Plus size={16} /> Add Secret
                </button>
            </div>

            {/* Add Form */}
            {showAdd && (
                <div style={{
                    background: '#1a1a2e', border: '1px solid #333', borderRadius: 12,
                    padding: 20, marginBottom: 20,
                }}>
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Key Name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. GITHUB_TOKEN"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 14px', marginTop: 6,
                                background: '#0d0d1a', border: '1px solid #444', borderRadius: 8,
                                color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Secret Value
                        </label>
                        <div style={{ position: 'relative', marginTop: 6 }}>
                            <input
                                type={showValue ? 'text' : 'password'}
                                placeholder="Paste your secret here..."
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                style={{
                                    width: '100%', padding: '10px 44px 10px 14px',
                                    background: '#0d0d1a', border: '1px solid #444', borderRadius: 8,
                                    color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                                }}
                            />
                            <button
                                onClick={() => setShowValue(!showValue)}
                                style={{
                                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: '#888', cursor: 'pointer',
                                }}
                            >
                                {showValue ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => { setShowAdd(false); setNewKey(''); setNewValue(''); }}
                            style={{
                                padding: '8px 16px', background: 'transparent', border: '1px solid #555',
                                borderRadius: 8, color: '#aaa', cursor: 'pointer', fontSize: 13,
                            }}
                        >Cancel</button>
                        <button
                            onClick={handleAdd}
                            disabled={!newKey || !newValue || saving}
                            style={{
                                padding: '8px 20px', background: '#f5a623', border: 'none',
                                borderRadius: 8, color: '#000', cursor: 'pointer', fontSize: 13,
                                fontWeight: 700, opacity: (!newKey || !newValue || saving) ? 0.5 : 1,
                            }}
                        >
                            {saving ? 'Encrypting...' : '🔒 Store Securely'}
                        </button>
                    </div>
                </div>
            )}

            {/* Credential List */}
            {keys.length === 0 ? (
                <div style={{
                    background: '#1a1a2e', border: '1px dashed #333', borderRadius: 12,
                    padding: 40, textAlign: 'center', color: '#666',
                }}>
                    <KeyRound size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <div style={{ fontSize: 15 }}>No credentials stored yet</div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                        Add API keys, tokens, and secrets that the daemon can use for tasks
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {keys.map((key) => (
                        <div
                            key={key}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '14px 18px', background: '#1a1a2e', border: '1px solid #2a2a40',
                                borderRadius: 10, transition: 'border-color 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#f5a62350')}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a40')}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <KeyRound size={16} color="#f5a623" />
                                <code style={{
                                    color: '#e0e0e0', fontSize: 14, fontFamily: 'monospace',
                                    background: '#0d0d1a', padding: '3px 10px', borderRadius: 6,
                                }}>
                                    {key}
                                </code>
                                <span style={{ color: '#555', fontSize: 12 }}>•••••••••</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {deleteConfirm === key ? (
                                    <>
                                        <span style={{ color: '#ff6b6b', fontSize: 12 }}>Delete?</span>
                                        <button
                                            onClick={() => handleDelete(key)}
                                            style={{
                                                padding: '4px 10px', background: '#ff6b6b20', border: '1px solid #ff6b6b',
                                                borderRadius: 6, color: '#ff6b6b', cursor: 'pointer', fontSize: 11,
                                            }}
                                        >Yes</button>
                                        <button
                                            onClick={() => setDeleteConfirm(null)}
                                            style={{
                                                padding: '4px 10px', background: 'transparent', border: '1px solid #555',
                                                borderRadius: 6, color: '#aaa', cursor: 'pointer', fontSize: 11,
                                            }}
                                        >No</button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setDeleteConfirm(key)}
                                        style={{
                                            background: 'none', border: 'none', color: '#555',
                                            cursor: 'pointer', padding: 4,
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Security Notice */}
            <div style={{
                marginTop: 24, padding: '12px 16px', background: '#1a1a0e',
                border: '1px solid #3a3a20', borderRadius: 8,
                display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
                <AlertTriangle size={16} color="#f5a623" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ color: '#999', fontSize: 12, lineHeight: 1.5 }}>
                    <strong style={{ color: '#ccc' }}>Encrypted at rest</strong> — Secrets are stored with AES-256-GCM encryption in <code style={{ color: '#f5a623' }}>.agent/vault.json</code>.
                    The daemon accesses them via <code style={{ color: '#f5a623' }}>secrets.get</code> tool. Credentials from <code style={{ color: '#f5a623' }}>.env</code> are also auto-detected.
                </div>
            </div>
        </div>
    );
}
