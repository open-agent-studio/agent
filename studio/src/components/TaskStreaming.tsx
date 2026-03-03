import { useState, useEffect, useRef } from 'react';
import { Activity, CheckCircle2, XCircle, Loader2, Play, Clock } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface TaskEvent {
    id: string;
    type: 'start' | 'complete' | 'failed' | 'progress';
    taskId: number;
    title: string;
    goalId?: number;
    output?: string;
    error?: string;
    timestamp: Date;
}

let socket: Socket | null = null;

function getSocket(): Socket {
    if (!socket) {
        socket = io(window.location.origin);
    }
    return socket;
}

export default function TaskStreaming() {
    const [events, setEvents] = useState<TaskEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const s = getSocket();

        const addEvent = (type: TaskEvent['type'], data: any) => {
            setEvents(prev => [...prev.slice(-100), {
                id: `${type}-${data.taskId}-${Date.now()}`,
                type,
                taskId: data.taskId,
                title: data.title,
                goalId: data.goalId,
                output: data.output,
                error: data.error,
                timestamp: new Date(),
            }]);
        };

        s.on('connect', () => setConnected(true));
        s.on('disconnect', () => setConnected(false));
        s.on('task:start', (d: any) => addEvent('start', d));
        s.on('task:complete', (d: any) => addEvent('complete', d));
        s.on('task:failed', (d: any) => addEvent('failed', d));
        s.on('task:progress', (d: any) => addEvent('progress', d));

        setConnected(s.connected);

        return () => {
            s.off('task:start');
            s.off('task:complete');
            s.off('task:failed');
            s.off('task:progress');
        };
    }, []);

    // Auto-scroll
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [events]);

    const getIcon = (type: TaskEvent['type']) => {
        switch (type) {
            case 'start': return <Play size={14} color="#6366f1" />;
            case 'complete': return <CheckCircle2 size={14} color="#22c55e" />;
            case 'failed': return <XCircle size={14} color="#ef4444" />;
            case 'progress': return <Loader2 size={14} color="#f5a623" className="animate-spin" />;
        }
    };

    const getBorderColor = (type: TaskEvent['type']) => {
        switch (type) {
            case 'start': return '#6366f130';
            case 'complete': return '#22c55e30';
            case 'failed': return '#ef444430';
            case 'progress': return '#f5a62330';
        }
    };

    const getLabel = (type: TaskEvent['type']) => {
        switch (type) {
            case 'start': return 'STARTED';
            case 'complete': return 'COMPLETED';
            case 'failed': return 'FAILED';
            case 'progress': return 'PROGRESS';
        }
    };

    return (
        <div style={{ padding: 32, maxWidth: 900, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Activity size={24} color="#6366f1" />
                    <h2 style={{ margin: 0, color: '#fff', fontSize: 22 }}>Live Task Stream</h2>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: connected ? '#22c55e' : '#ef4444',
                        boxShadow: connected ? '0 0 8px #22c55e' : '0 0 8px #ef4444',
                    }} />
                    <span style={{ color: '#888', fontSize: 12 }}>{connected ? 'Connected' : 'Disconnected'}</span>
                </div>
                {events.length > 0 && (
                    <button
                        onClick={() => setEvents([])}
                        style={{
                            padding: '6px 14px', background: 'transparent', border: '1px solid #555',
                            borderRadius: 8, color: '#aaa', cursor: 'pointer', fontSize: 12,
                        }}
                    >Clear</button>
                )}
            </div>

            {/* Stream */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8,
                    paddingRight: 8,
                }}
            >
                {events.length === 0 ? (
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column', gap: 12, color: '#555',
                    }}>
                        <Activity size={40} style={{ opacity: 0.3 }} />
                        <div style={{ fontSize: 14 }}>Waiting for task events...</div>
                        <div style={{ fontSize: 12, color: '#444' }}>
                            Events will appear here as the daemon processes tasks
                        </div>
                    </div>
                ) : events.map((event) => (
                    <div
                        key={event.id}
                        style={{
                            padding: '12px 16px', background: '#1a1a2e',
                            border: `1px solid ${getBorderColor(event.type)}`,
                            borderRadius: 10, animation: 'fadeIn 0.3s ease-in',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: event.output || event.error ? 8 : 0 }}>
                            {getIcon(event.type)}
                            <span style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: 1,
                                color: event.type === 'complete' ? '#22c55e' :
                                    event.type === 'failed' ? '#ef4444' :
                                        event.type === 'start' ? '#6366f1' : '#f5a623',
                            }}>
                                {getLabel(event.type)}
                            </span>
                            <span style={{ color: '#ddd', fontSize: 13, fontWeight: 600, flex: 1 }}>
                                Task #{event.taskId}: {event.title}
                            </span>
                            <span style={{ color: '#555', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={10} />
                                {event.timestamp.toLocaleTimeString()}
                            </span>
                        </div>
                        {event.output && (
                            <pre style={{
                                margin: 0, padding: '8px 12px', background: '#0d0d1a', borderRadius: 8,
                                color: '#aaa', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                                maxHeight: 120, overflow: 'auto',
                            }}>
                                {event.output}
                            </pre>
                        )}
                        {event.error && (
                            <pre style={{
                                margin: 0, padding: '8px 12px', background: '#1a0d0d', borderRadius: 8,
                                color: '#ef4444', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                                maxHeight: 120, overflow: 'auto',
                            }}>
                                {event.error}
                            </pre>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
