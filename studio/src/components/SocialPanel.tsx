import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface PlatformStatus {
    name: string;
    displayName: string;
    authenticated: boolean;
    username?: string;
    expiresAt?: string;
    capabilities: string[];
}

const platformMeta: Record<string, { emoji: string; color: string; bgColor: string; borderColor: string }> = {
    linkedin: { emoji: '💼', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
    twitter: { emoji: '𝕏', color: 'text-neutral-200', bgColor: 'bg-neutral-500/10', borderColor: 'border-neutral-500/20' },
    facebook: { emoji: '📘', color: 'text-indigo-400', bgColor: 'bg-indigo-500/10', borderColor: 'border-indigo-500/20' },
    instagram: { emoji: '📸', color: 'text-pink-400', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/20' },
};

export default function SocialPanel() {
    const { id } = useParams();
    const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [postText, setPostText] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
    const [posting, setPosting] = useState(false);
    const [postResult, setPostResult] = useState<any>(null);

    useEffect(() => {
        fetchPlatforms();
        const interval = setInterval(fetchPlatforms, 10000);
        return () => clearInterval(interval);
    }, [id]);

    const fetchPlatforms = async () => {
        try {
            const res = await fetch(`/api/instances/${id}/social/platforms`);
            if (!res.ok) { setLoading(false); return; }
            const data = await res.json();
            setPlatforms(data.platforms || []);
        } catch {
            setPlatforms([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (platform: string) => {
        try {
            const res = await fetch(`/api/instances/${id}/social/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform }),
            });
            if (res.ok) {
                setTimeout(fetchPlatforms, 2000);
            }
        } catch (err) {
            console.error('Auth failed:', err);
        }
    };

    const handlePost = async () => {
        if (!postText.trim() || selectedPlatforms.length === 0) return;
        setPosting(true);
        setPostResult(null);
        try {
            const res = await fetch(`/api/instances/${id}/social/post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platforms: selectedPlatforms, text: postText }),
            });
            const data = await res.json();
            setPostResult(data);
            if (data.success) setPostText('');
        } catch (err) {
            setPostResult({ success: false, error: (err as Error).message });
        } finally {
            setPosting(false);
        }
    };

    const togglePlatform = (name: string) => {
        setSelectedPlatforms(prev =>
            prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
        );
    };

    if (loading) return <div className="p-6 text-neutral-500">Loading social integrations...</div>;

    const authenticatedPlatforms = platforms.filter(p => p.authenticated);
    const unauthenticatedPlatforms = platforms.filter(p => !p.authenticated);

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-full">
            <div>
                <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                    📱 Social Media Hub
                </h2>
                <p className="text-neutral-500 text-sm">
                    Connect and post to social media platforms from your agent.
                </p>
            </div>

            {/* Connected Platforms */}
            {authenticatedPlatforms.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
                        Connected Accounts ({authenticatedPlatforms.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {authenticatedPlatforms.map(p => {
                            const meta = platformMeta[p.name] || { emoji: '🔗', color: 'text-neutral-400', bgColor: 'bg-neutral-500/10', borderColor: 'border-neutral-500/20' };
                            return (
                                <div key={p.name} className={`border ${meta.borderColor} ${meta.bgColor} rounded-xl p-4 flex items-center gap-3`}>
                                    <div className="text-2xl">{meta.emoji}</div>
                                    <div className="flex-1">
                                        <div className={`text-sm font-medium ${meta.color}`}>{p.displayName}</div>
                                        <div className="text-xs text-neutral-500 mt-0.5">
                                            {p.username || 'Connected'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                        Active
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Available Platforms */}
            {unauthenticatedPlatforms.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
                        Available Platforms
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {unauthenticatedPlatforms.map(p => {
                            const meta = platformMeta[p.name] || { emoji: '🔗', color: 'text-neutral-400', bgColor: 'bg-neutral-500/10', borderColor: 'border-neutral-500/20' };
                            return (
                                <div key={p.name} className="border border-white/10 bg-neutral-900/40 rounded-xl p-4 flex items-center gap-3">
                                    <div className="text-2xl opacity-50">{meta.emoji}</div>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-neutral-300">{p.displayName}</div>
                                        <div className="text-xs text-neutral-600 mt-0.5">
                                            {p.capabilities.join(', ')}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAuth(p.name)}
                                        className="px-3 py-1.5 text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-colors"
                                    >
                                        Connect
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Quick Post */}
            <div className="border border-white/10 rounded-xl bg-neutral-900/40 p-5">
                <h3 className="text-sm font-medium mb-3">✍️ Quick Post</h3>

                {/* Platform Selector */}
                <div className="flex flex-wrap gap-2 mb-3">
                    {authenticatedPlatforms.map(p => {
                        const meta = platformMeta[p.name] || { emoji: '🔗', color: 'text-neutral-400', bgColor: 'bg-neutral-500/10', borderColor: 'border-neutral-500/20' };
                        const selected = selectedPlatforms.includes(p.name);
                        return (
                            <button
                                key={p.name}
                                onClick={() => togglePlatform(p.name)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selected
                                    ? `${meta.bgColor} ${meta.color} ${meta.borderColor}`
                                    : 'bg-neutral-800 text-neutral-500 border-white/5 hover:border-white/10'
                                    }`}
                            >
                                {meta.emoji} {p.displayName}
                            </button>
                        );
                    })}
                    {authenticatedPlatforms.length === 0 && (
                        <p className="text-xs text-neutral-600">Connect a platform above to start posting.</p>
                    )}
                </div>

                {/* Text Input */}
                <textarea
                    value={postText}
                    onChange={e => setPostText(e.target.value)}
                    placeholder="What would you like to share?"
                    rows={4}
                    className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-3 text-sm placeholder-neutral-600 focus:border-indigo-500/40 focus:outline-none transition-colors resize-none"
                />

                <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-neutral-600">
                        {postText.length} characters · {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? 's' : ''} selected
                    </span>
                    <button
                        onClick={handlePost}
                        disabled={posting || !postText.trim() || selectedPlatforms.length === 0}
                        className="px-5 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-sm font-medium hover:bg-indigo-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {posting ? 'Posting...' : 'Publish'}
                    </button>
                </div>

                {/* Result */}
                {postResult && (
                    <div className={`mt-3 p-3 rounded-lg border text-xs ${postResult.success
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                        : 'border-red-500/20 bg-red-500/5 text-red-400'}`}>
                        {postResult.success
                            ? `✅ Posted to ${postResult.data?.posted} platform(s) successfully!`
                            : `❌ ${postResult.error || 'Post failed'}`}
                        {postResult.data?.results?.map((r: any, i: number) => (
                            <div key={i} className="mt-1">
                                {r.success ? '✓' : '✗'} {r.platform}: {r.success ? (r.postUrl || 'Published') : r.error}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* CLI Help */}
            <div className="border border-white/5 rounded-xl bg-neutral-900/20 p-5 text-sm text-neutral-400 space-y-2">
                <p className="font-medium text-neutral-300">CLI Usage</p>
                <p><code className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300 text-xs">agent social auth linkedin</code> — Authenticate with LinkedIn</p>
                <p><code className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300 text-xs">agent social post -p linkedin,twitter -t "Hello!"</code> — Post to multiple platforms</p>
                <p><code className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300 text-xs">agent "post a summary to LinkedIn"</code> — Natural language posting</p>
            </div>
        </div>
    );
}
