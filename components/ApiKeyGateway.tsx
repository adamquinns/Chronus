import React, { useState } from 'react';
import { Lock, Key, AlertTriangle, Terminal, CheckCircle } from 'lucide-react';

interface ApiKeyGatewayProps {
  onUnlock: (key: string) => void;
}

export const ApiKeyGateway: React.FC<ApiKeyGatewayProps> = ({ onUnlock }) => {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleUnlock = () => {
    if (!apiKey.trim() || apiKey.trim().length < 30) {
      setError('Invalid sequence length detected. Please provide a valid Gemini API Key.');
      return;
    }
    // Save to local storage
    localStorage.setItem('chronus_api_key', apiKey.trim());
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
            Welcome to the <strong className="text-emerald-400">Chronus Divergence Engine</strong>. 
            To prevent unauthorized resource consumption, this simulation requires a personal 
            uplink key.
          </p>

          <div className="bg-gray-950 border border-gray-800 p-4 rounded-lg space-y-3">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
              <Key size={14} /> How to gain access:
            </h3>
            <ol className="list-decimal list-inside text-sm text-gray-400 space-y-2">
              <li>Click the link below to visit Google AI Studio.</li>
              <li>Sign into any standard Google account.</li>
              <li>Click <strong className="text-gray-200">"Create API Key"</strong>.</li>
            </ol>
            <div className="mt-4 p-3 bg-emerald-900/10 border border-emerald-900/50 rounded flex items-start gap-3">
              <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-400/90 leading-relaxed">
                <strong>Zero Cost. No Credit Card Needed.</strong><br/>
                Google's Gemini API has a permanently free tier for developers. By generating your own free key, you can run this simulation endlessly without anyone paying a cent. Your key is stored strictly on your local device.
              </p>
            </div>
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors inline-block"
            >
              &gt; Get your free Gemini API Key here
            </a>
          </div>

          <div className="space-y-2">
             <label className="text-xs font-mono text-gray-500 uppercase tracking-widest">
               Enter Gemini API Key
             </label>
             <input 
               type="password"
               value={apiKey}
               onChange={(e) => { setApiKey(e.target.value); setError(''); }}
               className="w-full bg-black border border-gray-700 rounded p-3 text-sm text-gray-200 font-mono focus:border-emerald-500 focus:outline-none transition-colors"
               placeholder="AIzaSy..."
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
        </div>
      </div>
    </div>
  );
};
