import React, { useEffect, useMemo, useState } from 'react';
import { ApiKeyGateway } from './components/ApiKeyGateway';
import { CausalGameInterface } from './components/CausalGameInterface';
import { Campaign } from './engine/domain';
import { createCubanCampaign } from './engine/scenarios';
import { loadMostRecentCampaign, saveCampaign } from './engine/persistence';
import { OpenRouterGateway } from './engine/model';
import { Clock3, PlayCircle, RotateCcw, ShieldCheck } from 'lucide-react';

type Screen = 'GATEWAY' | 'MENU' | 'PLAYING';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('chronus_openrouter_key') ?? '');
  const [demoMode, setDemoMode] = useState(false);
  const [screen, setScreen] = useState<Screen>(() => localStorage.getItem('chronus_openrouter_key') ? 'MENU' : 'GATEWAY');
  const [campaign, setCampaign] = useState<Campaign>();
  const [resume, setResume] = useState<Campaign>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMostRecentCampaign().then(setResume).catch(console.error).finally(() => setLoading(false));
  }, []);

  const gateway = useMemo(() => apiKey && !demoMode ? new OpenRouterGateway(apiKey, undefined, {
    maxUsd: 2.5,
    maxRequests: 14,
    maxInputTokens: 90_000,
    maxOutputTokens: 30_000,
  }) : undefined, [apiKey, demoMode, campaign?.state.turn]);

  const begin = async () => {
    const next = createCubanCampaign();
    await saveCampaign(next);
    setCampaign(next);
    setScreen('PLAYING');
  };

  if (screen === 'GATEWAY') return <ApiKeyGateway onUnlock={(key) => { setApiKey(key); setDemoMode(false); setScreen('MENU'); }} onDemo={() => { setDemoMode(true); setScreen('MENU'); }}/>;

  if (screen === 'PLAYING' && campaign) return <CausalGameInterface initialCampaign={campaign} gateway={gateway} onCampaignChange={setCampaign} onExit={() => setScreen('MENU')}/>;

  return <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
    <div className="w-full max-w-5xl">
      <div className="text-center mb-10">
        <div className="inline-flex p-3 rounded-full bg-emerald-950 border border-emerald-900 mb-4"><Clock3 className="text-emerald-400" size={34}/></div>
        <h1 className="text-5xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">CHRONUS</h1>
        <p className="text-gray-400 mt-3">A constrained causal counterfactual strategy simulator.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <div className="text-xs font-mono text-red-400 uppercase tracking-widest mb-2">Golden vertical slice</div>
          <h2 className="text-2xl font-bold">Midnight in Havana</h2>
          <p className="text-gray-400 mt-2">October 27, 1962. A U-2 pilot is dead, the Joint Chiefs demand action, and hidden nuclear capabilities make every assumption dangerous.</p>
          <button onClick={begin} className="mt-6 w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded font-bold flex items-center justify-center gap-2"><PlayCircle size={19}/> Begin new timeline</button>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <div className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-2">Persistent campaign</div>
          {loading ? <p className="text-gray-500">Checking IndexedDB…</p> : resume ? <>
            <h2 className="text-2xl font-bold">{resume.state.manifest.title}</h2>
            <p className="text-gray-400 mt-2">Turn {resume.state.turn} · {resume.state.dateLabel}</p>
            <button onClick={() => { setCampaign(resume); setScreen('PLAYING'); }} className="mt-6 w-full py-3 bg-blue-700 hover:bg-blue-600 rounded font-bold flex items-center justify-center gap-2"><RotateCcw size={18}/> Resume campaign</button>
          </> : <p className="text-gray-500">No saved campaign found on this device.</p>}
        </div>
      </div>
      <div className="mt-6 flex items-start gap-3 bg-black/30 border border-gray-800 rounded p-4 text-sm text-gray-500"><ShieldCheck className="text-emerald-500 shrink-0" size={18}/> Models interpret and challenge. Only the deterministic state engine can commit reality. Every mechanical change retains an attributable cause.</div>
      <button onClick={() => setScreen('GATEWAY')} className="block mx-auto mt-5 text-xs text-gray-600 hover:text-gray-400">Change API access mode</button>
    </div>
  </div>;
};

export default App;
