import { useState, useEffect, useRef, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Terminal as TerminalIcon, Send } from 'lucide-react';

export function Terminal() {
    const { id } = useParams<{ id: string }>();
    // We use type casting below because exact interface map tracking isn't critical for our string logs
    const [logs, setLogs] = useState<{ id: number, text: string, type: 'info' | 'error' | 'warn' | 'user' }[]>([]);
    const [input, setInput] = useState('');
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // In the future this will connect via Socket.io
        // For now we just mock an intro block connecting to the ID
        setLogs([
            { id: 1, text: `Connected to autonomous environment: ${id}`, type: 'info' },
            { id: 2, text: `Listening for system events...`, type: 'warn' },
        ]);
    }, [id]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        setLogs(prev => [...prev, { id: Date.now(), text: input, type: 'user' }]);
        setInput('');

        setTimeout(() => {
            setLogs(prev => [...prev, { id: Date.now() + 1, text: 'Processing system trajectory...', type: 'info' }]);
        }, 500);
    };

    return (
        <div className="flex flex-col h-full bg-black relative w-full">
            <div className="h-10 border-b border-white/5 bg-neutral-900/40 flex items-center px-4 shrink-0">
                <TerminalIcon size={14} className="text-neutral-500 mr-2" />
                <span className="text-xs font-mono text-neutral-400">Agent TTY</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm max-w-full">
                {logs.map((log) => (
                    <div key={log.id} className={`flex gap-3 leading-relaxed ${log.type === 'user' ? 'text-indigo-400' : log.type === 'error' ? 'text-red-400' : 'text-neutral-300'}`}>
                        <span className="shrink-0 text-neutral-600 select-none">
                            {log.type === 'user' ? '❯' : '·'}
                        </span>
                        <span className="break-words w-full whitespace-pre-wrap">{log.text}</span>
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-neutral-950/80 backdrop-blur shrink-0 relative flex items-center gap-3">
                <span className="text-indigo-500 font-mono">❯</span>
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Send a message or command to the agent..."
                    className="flex-1 bg-transparent text-sm font-mono text-neutral-200 outline-none placeholder-neutral-600 w-full"
                />
                <button type="submit" className="p-1.5 text-neutral-500 hover:text-white transition-colors bg-white/5 rounded-md border border-white/5 hover:bg-white/10">
                    <Send size={14} />
                </button>
            </form>
        </div>
    );
}
