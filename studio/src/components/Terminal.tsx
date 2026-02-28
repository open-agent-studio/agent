import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Terminal as TerminalIcon, Send, Copy, Check } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

export function Terminal() {
    const { id } = useParams<{ id: string }>();
    const [logs, setLogs] = useState<{ id: string, text: string, type: 'info' | 'error' | 'warn' | 'user' | 'system' | 'result' }[]>([]);
    const [input, setInput] = useState('');
    const [socket, setSocket] = useState<Socket | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        // Initialize Socket.io connection to the local Agent Studio server
        const newSocket = io('http://localhost:3333');
        setSocket(newSocket);

        setLogs([
            { id: 'init-1', text: `Connected to autonomous environment: ${id}`, type: 'info' },
            { id: 'init-2', text: `Listening for system events...`, type: 'warn' },
        ]);

        newSocket.on('connect', () => {
            // We can emit a join room event if we implement multi-tenancy later
            newSocket.emit('subscribe', id);
        });

        // Listen for log streams from the backend
        newSocket.on('agent:log', (data: { instanceId: string, text: string, type: any }) => {
            if (data.instanceId === id || data.instanceId === 'all') {
                setLogs(prev => [...prev, { id: Math.random().toString(), text: data.text, type: data.type || 'system' }]);
            }
        });

        return () => {
            newSocket.disconnect();
        };
    }, [id]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !socket) return;

        const cmdId = Math.random().toString();
        setLogs(prev => [...prev, { id: cmdId, text: input, type: 'user' }]);

        // Emit the command via socket to the backend which writes to the repl/daemon stdin
        socket.emit('agent:command', { instanceId: id, command: input });

        setInput('');
    };

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] relative w-full font-mono">
            {/* Header */}
            <div className="h-12 border-b border-white/10 bg-neutral-900/60 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
                <div className="flex items-center">
                    <div className="p-1.5 bg-blue-500/10 rounded-md border border-blue-500/20 mr-3">
                        <TerminalIcon size={14} className="text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-neutral-200 tracking-wide">Agent TTY</span>
                    <span className="mx-3 text-neutral-600">|</span>
                    <span className="text-xs text-neutral-500">{id}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs text-emerald-500 font-medium">Live</span>
                </div>
            </div>

            {/* Log Output Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm max-w-full custom-scrollbar pb-24">
                {logs.map((log) => (
                    <div
                        key={log.id}
                        className={`group relative flex gap-3 leading-relaxed p-2 rounded-lg transition-colors
                            ${log.type === 'user' ? 'bg-indigo-500/5 border border-indigo-500/10' : 'hover:bg-white/[0.02]'}
                        `}
                    >
                        {/* Status Icon Indicator */}
                        <span className="shrink-0 mt-0.5 select-none w-5 text-center">
                            {log.type === 'user' && <span className="text-indigo-400">❯</span>}
                            {log.type === 'info' && <span className="text-blue-400 opacity-70">ℹ</span>}
                            {log.type === 'warn' && <span className="text-amber-400 opacity-70">⚠</span>}
                            {log.type === 'error' && <span className="text-red-400">✖</span>}
                            {log.type === 'result' && <span className="text-emerald-400">✔</span>}
                            {log.type === 'system' && <span className="text-neutral-500">·</span>}
                        </span>

                        {/* Text Content */}
                        <div className={`break-words w-full whitespace-pre-wrap flex-1
                            ${log.type === 'user' ? 'text-indigo-200' :
                                log.type === 'error' ? 'text-red-300' :
                                    log.type === 'warn' ? 'text-amber-200' :
                                        log.type === 'result' ? 'text-emerald-200 font-medium' :
                                            'text-neutral-300'}
                        `}>
                            {log.text}
                        </div>

                        {/* Hover Actions (Copy) */}
                        <button
                            onClick={() => handleCopy(log.text, log.id)}
                            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-white/10 text-neutral-500 hover:text-neutral-300"
                            title="Copy output"
                        >
                            {copied === log.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            {/* Input Form */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-4xl">
                <form
                    onSubmit={handleSubmit}
                    className="p-1 px-4 border border-white/10 bg-neutral-900/90 backdrop-blur-xl shadow-2xl rounded-xl flex items-center gap-3 ring-1 ring-black/5 hover:border-white/20 transition-colors focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20"
                >
                    <span className="text-indigo-500 font-bold select-none">❯</span>
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Send a natural language command..."
                        autoFocus
                        className="flex-1 bg-transparent py-3 text-sm text-neutral-200 outline-none placeholder-neutral-500 w-full"
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-500 font-sans tracking-wide uppercase px-2 hidden sm:inline-block border-r border-white/10 mr-1">Enter</span>
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="p-2 text-white transition-all bg-indigo-500 rounded-lg hover:bg-indigo-400 disabled:opacity-50 disabled:bg-white/5 disabled:text-neutral-500 hover:shadow-lg hover:shadow-indigo-500/20"
                        >
                            <Send size={15} className={input.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
