import React, { useEffect, useMemo, useState } from 'react';
import { ApiKeyGateway } from './components/ApiKeyGateway';
import { CausalGameInterface } from './components/CausalGameInterface';
import { Campaign } from './engine/domain';
import { createCampaign } from './engine/scenarios';
import { loadMostRecentCampaign, saveCampaign } from './engine/persistence';
import { OpenRouterGateway } from './engine/model';
import { Clock3, PlayCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import { generateCustomScenario } from './engine/authoring';

type Screen = 'GATEWAY' | 'MENU' | 'PLAYING';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('chronus_openrouter_key') ?? '');
  const [demoMode, setDemoMode] = useState(false);
  const [screen, setScreen] = useState<Screen>(() => localStorage.getItem('chronus_openrouter_key') ? 'MENU' : 'GATEWAY');
  const [campaign, setCampaign] = useState<Campaign>();
  const [resume, setResume] = useState<Campaign>();
  const [loading, setLoading] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatingScenario, setGeneratingScenario] = useState(false);
  const [customError, setCustomError] = useState<string>();

  useEffect(() => {
    loadMostRecentCampaign().then(setResume).catch(console.error).finally(() => setLoading(false));
  }, []);

  const gateway = useMemo(() => apiKey && !demoMode ? new OpenRouterGateway(apiKey, undefined, {
    maxUsd: 2.5,
    maxRequests: 14,
    maxInputTokens: 90_000,
    maxOutputTokens: 30_000,
  }) : undefined, [apiKey, demoMode, campaign?.state.turn]);

  const begin = async (scenarioId: string) => {
    const next = createCampaign(scenarioId);
    await saveCampaign(next);
    setCampaign(next);
    setScreen('PLAYING');
  };

  const beginCustom = async () => {
    if (!gateway || !customPrompt.trim() || generatingScenario) return;
    setGeneratingScenario(true);
    setCustomError(undefined);
    try {
      const next = await generateCustomScenario(customPrompt, gateway);
      await saveCampaign(next);
      setCampaign(next);
      setScreen('PLAYING');
    } catch (error) {
      setCustomError(error instanceof Error ? error.message : 'Custom scenario generation failed.');
    } finally {
      setGeneratingScenario(false);
    }
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
      <div className="grid md:grid-cols-3 gap-5">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <div className="text-xs font-mono text-red-400 uppercase tracking-widest mb-2">Golden vertical slice</div>
          <h2 className="text-2xl font-bold">Midnight in Havana</h2>
          <p className="text-gray-400 mt-2">October 27, 1962. A U-2 pilot is dead, the Joint Chiefs demand action, and hidden nuclear capabilities make every assumption dangerous.</p>
          <button onClick={() => begin('cuban_missile_crisis_black_saturday')} className="mt-6 w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded font-bold flex items-center justify-center gap-2"><PlayCircle size={19}/> Begin timeline</button>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <div className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-2">Political coalition</div>
          <h2 className="text-2xl font-bold">The Governors’ Compact</h2>
          <p className="text-gray-400 mt-2">Build legal, labor, business, and state resistance without authority to order any of them—or exposing the alliance too soon.</p>
          <button onClick={() => begin('governors_compact_1975')} className="mt-6 w-full py-3 bg-amber-700 hover:bg-amber-600 rounded font-bold flex items-center justify-center gap-2"><PlayCircle size={19}/> Begin timeline</button>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <div className="text-xs font-mono text-red-400 uppercase tracking-widest mb-2">Military campaign</div>
          <h2 className="text-2xl font-bold">Operation Lantern</h2>
          <p className="text-gray-400 mt-2">Command a mountain corps through logistics, hidden enemy reserves, civilian constraints, and a narrowing operational window.</p>
          <button onClick={() => begin('operation_lantern')} className="mt-6 w-full py-3 bg-red-800 hover:bg-red-700 rounded font-bold flex items-center justify-center gap-2"><PlayCircle size={19}/> Begin timeline</button>
        </div>
      </div>
      <div className="grid mt-5">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <div className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-2">Persistent campaign</div>
          {loading ? <p className="text-gray-500">Checking IndexedDB…</p> : resume ? <>
            <h2 className="text-2xl font-bold">{resume.state.manifest.title}</h2>
            <p className="text-gray-400 mt-2">Turn {resume.state.turn} · {resume.state.dateLabel}</p>
            <button onClick={() => { setCampaign(resume); setScreen('PLAYING'); }} className="mt-6 w-full py-3 bg-blue-700 hover:bg-blue-600 rounded font-bold flex items-center justify-center gap-2"><RotateCcw size={18}/> Resume campaign</button>
          </> : <p className="text-gray-500">No saved campaign found on this device.</p>}
        </div>
      </div>
      <div className="mt-5 bg-gray-900 border border-purple-900/50 rounded-xl p-6">
        <div className="text-xs font-mono text-purple-400 uppercase tracking-widest mb-2">Validated custom scenario</div>
        <h2 className="text-2xl font-bold">Create another divergence</h2>
        <p className="text-gray-400 mt-2">Describe a historical or fictional starting point, the role you want to occupy, and the central problem. AI proposes the package; Chronus validates it before play.</p>
        <textarea value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} rows={3} placeholder="What if Napoleon won at Waterloo? Put me in the role of…" className="mt-4 w-full bg-black border border-gray-700 rounded p-3 text-sm focus:border-purple-500 focus:outline-none"/>
        {customError && <p className="mt-2 text-sm text-red-400">{customError}</p>}
        <button onClick={beginCustom} disabled={!gateway || !customPrompt.trim() || generatingScenario} className="mt-3 w-full py-3 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 rounded font-bold">
          {generatingScenario ? 'Researching and validating scenario…' : 'Generate validated scenario'}
        </button>
        {!gateway && <p className="mt-2 text-xs text-amber-500">Custom scenario generation requires OpenRouter access.</p>}
      </div>
      <div className="mt-6 flex items-start gap-3 bg-black/30 border border-gray-800 rounded p-4 text-sm text-gray-500"><ShieldCheck className="text-emerald-500 shrink-0" size={18}/> Models interpret and challenge. Only the deterministic state engine can commit reality. Every mechanical change retains an attributable cause.</div>
      <button onClick={() => setScreen('GATEWAY')} className="block mx-auto mt-5 text-xs text-gray-600 hover:text-gray-400">Change API access mode</button>
    </div>
  </div>;
};

export default App;
