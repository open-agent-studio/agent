import { useState, useEffect } from 'react';
import {
  Terminal, Activity, Workflow, Server
} from 'lucide-react';

export default function App() {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInstances();
    // Poll every 5s
    const interval = setInterval(fetchInstances, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchInstances = async () => {
    try {
      const res = await fetch('http://localhost:3333/api/instances');
      const data = await res.json();
      setInstances(data);
    } catch (err) {
      console.error("Failed to fetch instances", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col font-sans">

      {/* Top Navbar */}
      <header className="h-14 border-b border-white/10 flex items-center px-6 shrink-0 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 text-indigo-400">
            <Workflow size={18} />
          </div>
          <h1 className="font-semibold text-lg tracking-tight">Agent Studio</h1>
        </div>
        <div className="ml-auto flex items-center gap-4 text-sm text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            {instances.length} Active System{instances.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-1">Local Instances</h2>
            <p className="text-neutral-500 text-sm">Monitor and control your active autonomous agent environments.</p>
          </div>
          <button className="bg-white text-black px-4 py-2 rounded-md font-medium text-sm hover:bg-neutral-200 transition-colors shadow-sm">
            Spawn New Agent
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-20 text-neutral-500">
            <Activity className="animate-spin mr-3" size={20} /> Loading nodes...
          </div>
        ) : instances.length === 0 ? (
          <div className="border border-white/10 border-dashed rounded-xl p-16 text-center bg-neutral-900/20">
            <Terminal className="mx-auto mb-4 text-neutral-600" size={32} />
            <h3 className="text-lg font-medium mb-2">No Active Agents</h3>
            <p className="text-neutral-500 max-w-sm mx-auto mb-6 text-sm">
              Start an agent in any project directory using <code className="bg-neutral-800 px-1 py-0.5 rounded text-neutral-300">agent</code> or <code className="bg-neutral-800 px-1 py-0.5 rounded text-neutral-300">agent daemon start</code>, and it will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instances.map((instance) => (
              <InstanceCard key={instance.id} instance={instance} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function InstanceCard({ instance }: { instance: any }) {
  const isDaemon = instance.id.startsWith('daemon');

  return (
    <div className="group border border-white/10 bg-neutral-900/40 rounded-xl p-5 hover:bg-neutral-900/80 hover:border-white/20 transition-all cursor-pointer relative overflow-hidden flex flex-col">
      {/* Glass gradient effect */}
      <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border flex-shrink-0 ${isDaemon ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
            {isDaemon ? <Server size={18} /> : <Terminal size={18} />}
          </div>
          <div>
            <h3 className="font-medium text-neutral-100 leading-tight">
              {instance.project || 'Agent Workspace'}
            </h3>
            <span className="text-xs font-mono text-neutral-500 break-all line-clamp-1 mt-0.5">
              PID: {instance.pid}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Active
        </div>
      </div>

      <div className="mt-auto space-y-3 relative z-10">
        <div className="flex items-center text-neutral-400 bg-black/20 p-2.5 rounded-md font-mono text-xs overflow-hidden text-ellipsis whitespace-nowrap border border-white/5">
          {instance.cwd}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button className="text-xs font-medium py-1.5 border border-white/10 rounded-md bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors">
            View Console
          </button>
          <button className="text-xs font-medium py-1.5 border border-white/10 rounded-md bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors">
            Capabilities
          </button>
        </div>
      </div>
    </div>
  );
}
