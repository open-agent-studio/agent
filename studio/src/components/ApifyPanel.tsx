import { useState, useEffect, useCallback } from 'react';

interface ActorInfo {
  id: string;
  name: string;
  title?: string;
  description?: string;
}

interface RunInfo {
  id: string;
  actId: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  defaultDatasetId?: string;
}

interface StoreResult {
  id: string;
  title: string;
  description?: string;
  totalRuns?: number;
  totalUsers?: number;
}

export default function ApifyPanel({ instanceId }: { instanceId: string }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [actors, setActors] = useState<ActorInfo[]>([]);
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [storeResults, setStoreResults] = useState<StoreResult[]>([]);

  // Run Actor form
  const [selectedActor, setSelectedActor] = useState('');
  const [actorInput, setActorInput] = useState('{}');
  const [syncMode, setSyncMode] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);
  const [running, setRunning] = useState(false);

  // Store search
  const [storeQuery, setStoreQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const [activeTab, setActiveTab] = useState<'actors' | 'run' | 'store' | 'runs'>('actors');

  const base = `/api/instances/${instanceId}/apify`;

  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch(`${base}/actors`);
      if (res.ok) {
        const data = await res.json();
        setConnected(true);
        setActors(data.actors || []);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  }, [base]);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`${base}/runs`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch { /* ignore */ }
  }, [base]);

  useEffect(() => {
    checkConnection();
    fetchRuns();
  }, [checkConnection, fetchRuns]);

  const runActor = async () => {
    if (!selectedActor) return;
    setRunning(true);
    setRunResult(null);
    try {
      let parsedInput: any;
      try { parsedInput = JSON.parse(actorInput); } catch { parsedInput = {}; }

      const res = await fetch(`${base}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: selectedActor, input: parsedInput, sync: syncMode }),
      });
      const data = await res.json();
      setRunResult(data);
      if (!syncMode) fetchRuns();
    } catch (e: any) {
      setRunResult({ error: e.message });
    } finally {
      setRunning(false);
    }
  };

  const searchStore = async () => {
    if (!storeQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${base}/store?q=${encodeURIComponent(storeQuery)}`);
      const data = await res.json();
      setStoreResults(data.actors || []);
    } catch { /* ignore */ }
    setSearching(false);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'SUCCEEDED': return 'text-emerald-400';
      case 'RUNNING': return 'text-blue-400';
      case 'FAILED': case 'ABORTED': return 'text-red-400';
      default: return 'text-zinc-400';
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <span>🕷️</span> Apify Hub
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Run web scrapers, manage datasets, and browse the Apify Store
        </p>
      </div>

      {/* Connection Status */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected === true ? 'bg-emerald-400' : connected === false ? 'bg-red-400' : 'bg-zinc-600'}`} />
        <span className="text-xs text-zinc-400">
          {connected === null ? 'Checking...' : connected ? 'Connected to Apify' : 'Not connected'}
        </span>
        {!connected && connected !== null && (
          <span className="text-xs text-zinc-600 ml-auto">
            Run: agent credentials set APIFY_API_TOKEN "your-token"
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {(['actors', 'run', 'store', 'runs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium capitalize transition-colors
              ${activeTab === tab ? 'text-zinc-100 border-b-2 border-blue-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {tab === 'actors' ? '📋 My Actors' : tab === 'run' ? '▶️ Run Actor' : tab === 'store' ? '🏪 Store' : '📊 Runs'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* My Actors Tab */}
        {activeTab === 'actors' && (
          <div className="space-y-2">
            {actors.length === 0 && connected && (
              <div className="text-center py-8 text-zinc-600 text-sm">No Actors found in your account.</div>
            )}
            {actors.map(actor => (
              <div
                key={actor.id}
                className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                onClick={() => { setSelectedActor(`${actor.name}`); setActiveTab('run'); }}
              >
                <div className="text-sm text-zinc-200 font-medium">{actor.title || actor.name}</div>
                {actor.description && <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{actor.description}</div>}
                <div className="text-xs text-zinc-600 mt-1 font-mono">{actor.name}</div>
              </div>
            ))}
          </div>
        )}

        {/* Run Actor Tab */}
        {activeTab === 'run' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Actor ID</label>
              <input
                type="text"
                value={selectedActor}
                onChange={e => setSelectedActor(e.target.value)}
                placeholder="e.g., apify/web-scraper"
                className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Input (JSON)</label>
              <textarea
                value={actorInput}
                onChange={e => setActorInput(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 text-xs font-mono bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={syncMode} onChange={e => setSyncMode(e.target.checked)} className="accent-blue-500" />
                Wait for results (sync mode)
              </label>
            </div>
            <button
              onClick={runActor}
              disabled={running || !selectedActor || !connected}
              className="w-full py-2 text-sm font-medium rounded-lg transition-colors
                bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {running ? '⏳ Running...' : '▶️ Run Actor'}
            </button>

            {runResult && (
              <div className="mt-4 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-auto max-h-80">
                <div className="text-xs text-zinc-400 mb-2 font-medium">Result</div>
                <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap">
                  {JSON.stringify(runResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Store Tab */}
        {activeTab === 'store' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={storeQuery}
                onChange={e => setStoreQuery(e.target.value)}
                placeholder="Search Actors (e.g., 'instagram scraper')"
                onKeyDown={e => e.key === 'Enter' && searchStore()}
                className="flex-1 px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={searchStore}
                disabled={searching}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors disabled:opacity-40"
              >
                {searching ? '...' : '🔍'}
              </button>
            </div>

            <div className="space-y-2">
              {storeResults.map(actor => (
                <div
                  key={actor.id}
                  className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  onClick={() => { setSelectedActor(actor.id); setActiveTab('run'); }}
                >
                  <div className="text-sm text-zinc-200 font-medium">{actor.title}</div>
                  {actor.description && <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{actor.description}</div>}
                  <div className="flex gap-4 mt-2 text-xs text-zinc-600">
                    <span className="font-mono">{actor.id}</span>
                    {actor.totalRuns && <span>🏃 {actor.totalRuns.toLocaleString()} runs</span>}
                    {actor.totalUsers && <span>👥 {actor.totalUsers.toLocaleString()} users</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Runs Tab */}
        {activeTab === 'runs' && (
          <div className="space-y-2">
            {runs.length === 0 && (
              <div className="text-center py-8 text-zinc-600 text-sm">No recent runs.</div>
            )}
            {runs.map(run => (
              <div key={run.id} className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-400">{run.id.slice(0, 12)}...</span>
                  <span className={`text-xs font-medium ${statusColor(run.status)}`}>{run.status}</span>
                </div>
                <div className="text-xs text-zinc-600 mt-1">
                  Started: {new Date(run.startedAt).toLocaleString()}
                  {run.finishedAt && <span> • Finished: {new Date(run.finishedAt).toLocaleString()}</span>}
                </div>
                {run.defaultDatasetId && (
                  <div className="text-xs text-zinc-600 mt-1 font-mono">Dataset: {run.defaultDatasetId}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CLI Guide */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
        <div className="text-xs text-zinc-600">
          <span className="text-zinc-500 font-medium">CLI: </span>
          <code className="text-zinc-500">agent apify run apify/web-scraper --sync</code>
          <span className="text-zinc-600"> • </span>
          <code className="text-zinc-500">agent apify store "google maps"</code>
        </div>
      </div>
    </div>
  );
}
