import { useState, useEffect } from 'react';
import { KeyRound, X, Eye, EyeOff, AlertCircle, Clock } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface CredentialRequest {
    instanceId: string;
    key: string;
    reason: string;
    requestId: string;
}

let socket: Socket | null = null;

function getSocket(): Socket {
    if (!socket) {
        socket = io(window.location.origin);
    }
    return socket;
}

export default function CredentialCapture() {
    const [request, setRequest] = useState<CredentialRequest | null>(null);
    const [value, setValue] = useState('');
    const [showValue, setShowValue] = useState(false);
    const [sending, setSending] = useState(false);
    const [countdown, setCountdown] = useState(300); // 5 min

    useEffect(() => {
        const s = getSocket();

        s.on('credential:required', (data: CredentialRequest) => {
            setRequest(data);
            setValue('');
            setCountdown(300);
        });

        return () => {
            s.off('credential:required');
        };
    }, []);

    // Countdown timer
    useEffect(() => {
        if (!request) return;
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    setRequest(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [request]);

    const handleSubmit = () => {
        if (!request || !value) return;
        setSending(true);
        const s = getSocket();
        s.emit('credential:provide', {
            instanceId: request.instanceId,
            key: request.key,
            value,
            requestId: request.requestId,
        });
        setTimeout(() => {
            setRequest(null);
            setValue('');
            setSending(false);
        }, 500);
    };

    const handleDismiss = () => {
        setRequest(null);
        setValue('');
    };

    if (!request) return null;

    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: '#1a1a2e', border: '1px solid #f5a623',
                borderRadius: 16, padding: 32, width: 440,
                boxShadow: '0 20px 60px rgba(245,166,35,0.15)',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: '#f5a62320', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <KeyRound size={20} color="#f5a623" />
                        </div>
                        <div>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Credential Required</div>
                            <div style={{ color: '#888', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} /> {minutes}:{seconds.toString().padStart(2, '0')} remaining
                            </div>
                        </div>
                    </div>
                    <button onClick={handleDismiss} style={{
                        background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 4,
                    }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Reason */}
                <div style={{
                    background: '#0d0d1a', border: '1px solid #333', borderRadius: 10,
                    padding: 14, marginBottom: 20,
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <AlertCircle size={16} color="#f5a623" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div>
                            <div style={{ color: '#ccc', fontSize: 13, lineHeight: 1.5 }}>
                                The daemon needs <code style={{
                                    color: '#f5a623', background: '#f5a62315', padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                                }}>{request.key}</code> to continue.
                            </div>
                            <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{request.reason}</div>
                        </div>
                    </div>
                </div>

                {/* Input */}
                <div style={{ marginBottom: 20 }}>
                    <label style={{ color: '#aaa', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Enter value for {request.key}
                    </label>
                    <div style={{ position: 'relative', marginTop: 6 }}>
                        <input
                            type={showValue ? 'text' : 'password'}
                            placeholder="Paste your API key or token..."
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            style={{
                                width: '100%', padding: '12px 44px 12px 14px',
                                background: '#0d0d1a', border: '1px solid #f5a62350', borderRadius: 10,
                                color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                        <button
                            onClick={() => setShowValue(!showValue)}
                            style={{
                                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', color: '#888', cursor: 'pointer',
                            }}
                        >
                            {showValue ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleDismiss}
                        style={{
                            padding: '10px 20px', background: 'transparent', border: '1px solid #555',
                            borderRadius: 10, color: '#aaa', cursor: 'pointer', fontSize: 13,
                        }}
                    >Skip</button>
                    <button
                        onClick={handleSubmit}
                        disabled={!value || sending}
                        style={{
                            padding: '10px 24px', background: '#f5a623', border: 'none',
                            borderRadius: 10, color: '#000', cursor: 'pointer', fontSize: 13,
                            fontWeight: 700, opacity: (!value || sending) ? 0.5 : 1,
                        }}
                    >
                        {sending ? 'Storing...' : '🔒 Provide & Continue'}
                    </button>
                </div>

                {/* Footer */}
                <div style={{ marginTop: 16, color: '#555', fontSize: 11, textAlign: 'center' }}>
                    Value will be encrypted and stored in vault. Task will resume automatically.
                </div>
            </div>
        </div>
    );
}
