import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { KeyRound, Check, Cpu, Zap, Settings, DollarSign, Database, Loader2 } from 'lucide-react';

const API = '';

interface ProvidersState {
    [key: string]: {
        configured: boolean;
        model: string;
    };
}

export default function ModelsManager() {
    const { id } = useParams();
    const [providers, setProviders] = useState<ProvidersState>({});
    const [defaultProvider, setDefaultProvider] = useState<string>('openai');
    const [loading, setLoading] = useState(true);
    
    // Form state for current selected provider
    const [activeTab, setActiveTab] = useState<string>('openai');
    const [editModel, setEditModel] = useState<string>('');
    const [editKey, setEditKey] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const fetchModels = async () => {
        try {
            const res = await fetch(`${API}/api/instances/${id}/settings/models`);
            const data = await res.json();
            setProviders(data.providers || {});
            setDefaultProvider(data.defaultProvider || 'openai');
            
            // Sync default form state
            const target = data.defaultProvider || 'openai';
            setActiveTab(target);
            setEditModel(data.providers?.[target]?.model || '');
            setEditKey('');
        } catch (err) {
            console.error('Failed to fetch model settings', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchModels(); }, [id]);

    const handleTabChange = (provider: string) => {
        setActiveTab(provider);
        setEditModel(providers[provider]?.model || '');
        setEditKey('');
        setSuccessMessage('');
    };

    const handleSave = async () => {
        setSaving(true);
        setSuccessMessage('');
        try {
            await fetch(`${API}/api/instances/${id}/settings/models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: activeTab,
                    model: editModel,
                    apiKey: editKey
                })
            });
            await fetchModels();
            setEditKey(''); // Clear out the API key field after save
            setSuccessMessage('Successfully updated model configuration!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            console.error('Failed to save model settings', err);
            setSuccessMessage('Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const handleSetGlobalDefault = async () => {
        setSaving(true);
        try {
            await fetch(`${API}/api/instances/${id}/settings/models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: activeTab,
                })
            });
            await fetchModels();
            setSuccessMessage(`${activeTab.toUpperCase()} is now the global default provider!`);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            console.error('Failed to set default', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: 32, color: '#aaa', display: 'flex', gap: 10, alignItems: 'center' }}>
                <Loader2 className="animate-spin" size={20} />
                Loading Provider Configurations...
            </div>
        );
    }

    const providerList = [
        { id: 'openai', name: 'OpenAI', icon: <Database size={16} />, defaultModel: 'gpt-4o' },
        { id: 'anthropic', name: 'Anthropic', icon: <Zap size={16} />, defaultModel: 'claude-3-5-sonnet-20241022' },
        { id: 'google', name: 'Google Gemini', icon: <Cpu size={16} />, defaultModel: 'gemini-1.5-pro' },
        { id: 'groq', name: 'Groq', icon: <Cpu size={16} />, defaultModel: 'llama3-70b-8192' },
        { id: 'ollama', name: 'Ollama (Local)', icon: <Database size={16} />, defaultModel: 'llama3.1' },
    ];

    return (
        <div style={{ padding: 32, maxWidth: 900, overflowY: 'auto', height: '100%' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Cpu size={28} color="#6366f1" />
                        <h2 style={{ margin: 0, color: '#fff', fontSize: 22 }}>LLM Providers & Models</h2>
                    </div>
                    <p style={{ color: '#888', margin: '6px 0 0 38px', fontSize: 13 }}>
                        Configure inference endpoints globally. Connect your keys to run tasks autonomously.
                    </p>
                </div>
                
                <Link to={`/instances/${id}/costs`} style={{ textDecoration: 'none' }}>
                    <button style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', border: '1px solid #22c55e',
                        borderRadius: 8, background: '#22c55e10',
                        color: '#22c55e', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    }}>
                        <DollarSign size={16} /> View Usage Costs
                    </button>
                </Link>
            </div>

            {/* Layout Grid container */}
            <div style={{ display: 'flex', gap: 24 }}>
                
                {/* Sidebar Navigation */}
                <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {providerList.map(p => {
                        const isSelected = activeTab === p.id;
                        const isConfigured = providers[p.id]?.configured;
                        const isDefault = defaultProvider === p.id;

                        return (
                            <div 
                                key={p.id}
                                onClick={() => handleTabChange(p.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                                    background: isSelected ? '#6366f120' : '#1a1a2e',
                                    border: `1px solid ${isSelected ? '#6366f1' : '#2a2a40'}`,
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isSelected ? '#fff' : '#aaa' }}>
                                    {p.icon}
                                    <span style={{ fontSize: 14, fontWeight: isSelected ? 600 : 400 }}>{p.name}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {isDefault && <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6366f1', marginTop: 5 }} title="Global Default" />}
                                    {isConfigured ? (
                                        <div title="Configured"><Check size={16} color="#22c55e" /></div>
                                    ) : (
                                        <div title="Needs API Key"><KeyRound size={16} color="#ed4337" style={{ opacity: 0.5 }} /></div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Main Configuration Panel */}
                <div style={{ flexGrow: 1, background: '#1a1a2e', border: '1px solid #2a2a40', borderRadius: 12, padding: 32 }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #333' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {providerList.find(p => p.id === activeTab)?.name} Settings
                            </h3>
                            <div style={{ color: '#aaa', fontSize: 13, marginTop: 4 }}>
                                Status: {providers[activeTab]?.configured ? <span style={{ color: '#22c55e' }}>Securely Configured</span> : <span style={{ color: '#ed4337' }}>Missing API Key</span>}
                            </div>
                        </div>

                        {defaultProvider !== activeTab && providers[activeTab]?.configured && (
                            <button 
                                onClick={handleSetGlobalDefault}
                                disabled={saving}
                                style={{
                                    padding: '6px 14px', background: '#6366f1', border: 'none',
                                    borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600
                                }}
                            >
                                Set as Global Default
                            </button>
                        )}
                        {defaultProvider === activeTab && (
                            <div style={{ fontSize: 12, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4, background: '#6366f120', padding: '6px 12px', borderRadius: 6, border: '1px solid #6366f150' }}>
                                <Check size={14} /> Active Global Default
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                            <label style={{ display: 'block', color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                                Target Model
                            </label>
                            <input
                                type="text"
                                value={editModel}
                                onChange={(e) => setEditModel(e.target.value)}
                                placeholder={`e.g. ${providerList.find(p => p.id === activeTab)?.defaultModel}`}
                                style={{
                                    width: '100%', padding: '12px 14px',
                                    background: '#0d0d1a', border: '1px solid #444', borderRadius: 8,
                                    color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                                    fontFamily: 'monospace'
                                }}
                            />
                            <p style={{ color: '#666', fontSize: 11, marginTop: 6 }}>
                                You can configure specific model variants representing this provider logic.
                            </p>
                        </div>

                        {activeTab !== 'ollama' && (
                            <div>
                                <label style={{ display: 'block', color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                                    API Key (Secure Vault)
                                </label>
                                <input
                                    type="password"
                                    value={editKey}
                                    onChange={(e) => setEditKey(e.target.value)}
                                    placeholder={providers[activeTab]?.configured ? "•••••••••••••••••••• (Leave blank to keep existing)" : "Paste your private API key here"}
                                    style={{
                                        width: '100%', padding: '12px 14px',
                                        background: '#0d0d1a', border: '1px solid #444', borderRadius: 8,
                                        color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                                        fontFamily: 'monospace'
                                    }}
                                />
                                <p style={{ color: '#666', fontSize: 11, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Settings size={12} /> Stored directly into `.agent/vault.json` using AES-256 encryption.
                                </p>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                            {successMessage ? (
                                <span style={{ color: '#22c55e', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Check size={16} /> {successMessage}</span>
                            ) : <span></span>}

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                style={{
                                    padding: '10px 24px', background: '#fff', border: 'none',
                                    borderRadius: 8, color: '#000', cursor: 'pointer', fontSize: 14,
                                    fontWeight: 700, opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8
                                }}
                            >
                                {saving ? <Loader2 className="animate-spin" size={16} /> : 'Save Configuration'}
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
