import React, { useState } from 'react';
import { Lock, Key, AlertTriangle, Terminal, CheckCircle, FlaskConical } from 'lucide-react';

interface ApiKeyGatewayProps {
  onUnlock: (key: string) => void;
  onDemo?: () => void;
}

export const ApiKeyGateway: React.FC<ApiKeyGatewayProps> = ({ onUnlock, onDemo }) => {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleUnlock = () => {
    if (!apiKey.trim().startsWith('sk-or-v1-') || apiKey.trim().length < 50) {
      setError('Please provide a valid OpenRouter API key beginning with sk-or-v1-.');
      return;
    }
    // Save to local storage
    localStorage.setItem('chronus_openrouter_key', apiKey.trim());
    onUnlock(apiKey.trim());
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden animate-fade-in relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Terminal size={120} />
        </div>
        
        <div className="p-6 bg-black/50 border-b border-gray-800 flex items-center gap-3">
          <Lock size={24} className="text-red-500" />
          <h1 className="text-xl font-mono font-bold tracking-widest text-red-500">
            SECURITY CLEARANCE REQUIRED
          </h1>
        </div>
        
        <div className="p-8 space-y-6 relative z-10">
          <p className="font-mono text-sm text-gray-300 leading-relaxed">
            Chronus uses several independent models through <strong className="text-emerald-400">OpenRouter</strong>
            to compile, challenge, adjudicate, and narrate each turn. Your key stays in this browser profile.
          </p>

          <div className="bg-gray-950 border border-gray-800 p-4 rounded-lg space-y-3">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
              <Key size={14} /> How to gain access:
            </h3>
            <ol className="list-decimal list-inside text-sm text-gray-400 space-y-2">
              <li>Open your OpenRouter account.</li>
              <li>Create a key with a conservative credit limit.</li>
              <li>Paste it below. Never commit it to the repository.</li>
            </ol>
            <div className="mt-4 p-3 bg-emerald-900/10 border border-emerald-900/50 rounded flex items-start gap-3">
              <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-400/90 leading-relaxed">
                <strong>Cost-controlled BYOK.</strong><br/>
                Chronus enforces per-turn request and token limits. OpenRouter billing and account-level limits remain authoritative.
              </p>
            </div>
            <a 
              href="https://openrouter.ai/settings/keys"
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors inline-block"
            >
              &gt; Manage OpenRouter API keys
            </a>
          </div>

          <div className="space-y-2">
             <label className="text-xs font-mono text-gray-500 uppercase tracking-widest">
               Enter OpenRouter API Key
             </label>
             <input 
               type="password"
               value={apiKey}
               onChange={(e) => { setApiKey(e.target.value); setError(''); }}
               className="w-full bg-black border border-gray-700 rounded p-3 text-sm text-gray-200 font-mono focus:border-emerald-500 focus:outline-none transition-colors"
               placeholder="sk-or-v1-..."
               onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
             />
             {error && <p className="text-xs text-red-500 font-bold animate-pulse mt-1 flex items-center gap-1"><AlertTriangle size={12}/> {error}</p>}
          </div>
        </div>

        <div className="p-6 bg-black/30 border-t border-gray-800">
           <button 
             onClick={handleUnlock}
             className="w-full py-3 bg-gray-800 hover:bg-emerald-600 text-gray-300 hover:text-white font-bold font-mono tracking-widest rounded transition-all border border-gray-700 hover:border-emerald-500 flex justify-center items-center gap-2"
           >
             <Key size={18} /> INITIATE UPLINK
           </button>
           {onDemo && (
             <button
               onClick={onDemo}
               className="w-full mt-3 py-2 text-xs text-gray-500 hover:text-gray-300 font-mono flex justify-center items-center gap-2"
             >
               <FlaskConical size={14} /> Run deterministic demo without model calls
             </button>
           )}
        </div>
      </div>
    </div>
  );
};
