import { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import {
  Terminal, Activity, Workflow, Server, ArrowLeft, Zap, Target,
  Wrench, Code, FileCode, Package, Brain, Sparkles, KeyRound, DollarSign, Bell,
  Container, Users, Monitor, Mic, Cpu, Share2
} from 'lucide-react';
import { Terminal as TerminalComponent } from './components/Terminal';
import { Capabilities } from './components/Capabilities';
import { GoalsPanel } from './components/GoalsPanel';
import { SkillsManager } from './components/SkillsManager';
import { CommandsManager } from './components/CommandsManager';
import { ScriptsManager } from './components/ScriptsManager';
import { PluginsManager } from './components/PluginsManager';
import { DaemonPanel } from './components/DaemonPanel';
import { MemoryExplorer } from './components/MemoryExplorer';
import { GoalTemplates } from './components/GoalTemplates';
import CredentialsManager from './components/CredentialsManager';
import TaskStreaming from './components/TaskStreaming';
import CredentialCapture from './components/CredentialCapture';
import CostDashboard from './components/CostDashboard';
import NotificationsPanel from './components/NotificationsPanel';
import SandboxPanel from './components/SandboxPanel';
import SwarmPanel from './components/SwarmPanel';
import DesktopPanel from './components/DesktopPanel';
import MultimodalPanel from './components/MultimodalPanel';
import ModelsManager from './components/ModelsManager';
import SocialPanel from './components/SocialPanel';
import ApifyPanel from './components/ApifyPanel';

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col font-sans">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/instance/:id/*" element={<InstanceView />} />
      </Routes>
    </div>
  );
}

function Dashboard() {
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchInstances();
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
    <>
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
            {instances.map((instance) => {
              const isDaemon = instance.id.startsWith('daemon');
              return (
                <div key={instance.id} className="group border border-white/10 bg-neutral-900/40 rounded-xl p-5 hover:bg-neutral-900/80 hover:border-white/20 transition-all cursor-pointer relative overflow-hidden flex flex-col">
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
                      <button
                        onClick={() => navigate(`/instance/${instance.id}/console`)}
                        className="text-xs font-medium py-1.5 border border-white/10 rounded-md bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors"
                      >
                        View Console
                      </button>
                      <button
                        onClick={() => navigate(`/instance/${instance.id}/capabilities`)}
                        className="text-xs font-medium py-1.5 border border-white/10 rounded-md bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors"
                      >
                        Capabilities
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

const sidebarGroups = [
  {
    title: 'Core Activity',
    items: [
      { icon: Terminal, label: 'Console', path: 'console' },
      { icon: Target, label: 'Goals & Tasks', path: 'goals' },
      { icon: Activity, label: 'Live Stream', path: 'stream' },
      { icon: Brain, label: 'Memory', path: 'memory' },
    ]
  },
  {
    title: 'Configuration',
    items: [
      { icon: Cpu, label: 'Models', path: 'models' },
      { icon: KeyRound, label: 'Credentials', path: 'credentials' },
      { icon: Server, label: 'Daemon', path: 'daemon' },
      { icon: Zap, label: 'Capabilities', path: 'capabilities' },
    ]
  },
  {
    title: 'Ecosystem',
    items: [
      { icon: Wrench, label: 'Skills', path: 'skills' },
      { icon: Package, label: 'Plugins', path: 'plugins' },
      { icon: Share2, label: 'Social Media', path: 'social' },
      { icon: Zap, label: 'Apify', path: 'apify' },
      { icon: Code, label: 'Commands', path: 'commands' },
      { icon: FileCode, label: 'Scripts', path: 'scripts' },
    ]
  },
  {
    title: 'Advanced Execution',
    items: [
      { icon: Monitor, label: 'Desktop Automation', path: 'desktop' },
      { icon: Users, label: 'Swarm Orchestration', path: 'swarm' },
      { icon: Container, label: 'Sandbox Isolation', path: 'sandbox' },
      { icon: Mic, label: 'Multimodal Vision', path: 'multimodal' },
      { icon: Sparkles, label: 'Templates', path: 'templates' },
    ]
  },
  {
    title: 'Monitoring',
    items: [
      { icon: DollarSign, label: 'Cost Analytics', path: 'costs' },
      { icon: Bell, label: 'Notifications', path: 'notifications' },
    ]
  }
];

function InstanceView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const currentTab = window.location.pathname.split('/').pop() || 'console';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 border-r border-white/10 bg-neutral-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/10 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="hover:bg-white/10 p-1.5 rounded-md text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="font-medium truncate text-sm">Instance Control</div>
        </div>

        <nav className="p-2 mt-1 flex-1 overflow-y-auto space-y-6">
          {sidebarGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              <div className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase px-3 mb-1.5">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map(({ icon: Icon, label, path }) => (
                  <Link
                    key={path}
                    to={`/instance/${id}/${path}`}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${currentTab === path
                      ? 'bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20'
                      : 'text-neutral-400 font-medium hover:bg-white/5 hover:text-neutral-200'
                      }`}
                  >
                    <Icon size={15} /> {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main View Area */}
      <div className="flex-1 bg-neutral-950 flex flex-col overflow-hidden relative">
        <Routes>
          <Route path="console" element={<TerminalComponent />} />
          <Route path="capabilities" element={<Capabilities />} />
          <Route path="goals" element={<GoalsPanel />} />
          <Route path="templates" element={<GoalTemplates />} />
          <Route path="credentials" element={<CredentialsManager />} />
          <Route path="models" element={<ModelsManager />} />
          <Route path="stream" element={<TaskStreaming />} />
          <Route path="skills" element={<SkillsManager />} />
          <Route path="commands" element={<CommandsManager />} />
          <Route path="scripts" element={<ScriptsManager />} />
          <Route path="plugins" element={<PluginsManager />} />
          <Route path="daemon" element={<DaemonPanel />} />
          <Route path="costs" element={<CostDashboard />} />
          <Route path="notifications" element={<NotificationsPanel />} />
          <Route path="memory" element={<MemoryExplorer />} />
          <Route path="sandbox" element={<SandboxPanel />} />
          <Route path="swarm" element={<SwarmPanel />} />
          <Route path="desktop" element={<DesktopPanel />} />
          <Route path="multimodal" element={<MultimodalPanel />} />
          <Route path="social" element={<SocialPanel />} />
          <Route path="apify" element={<ApifyPanel instanceId={id || ''} />} />
        </Routes>
        {/* Global credential capture modal */}
        <CredentialCapture />
      </div>
    </div>
  );
}
