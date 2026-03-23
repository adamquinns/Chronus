import React, { useState, useEffect } from 'react';
import { GameStatus, TurnData, HistoryEntry } from './types';
import { initializeGame } from './services/geminiService';
import { ScenarioSelector } from './components/ScenarioSelector';
import { GameInterface } from './components/GameInterface';
import { ApiKeyGateway } from './components/ApiKeyGateway';
import { RefreshCw, Zap, AlertTriangle, PlayCircle } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [initialTurnData, setInitialTurnData] = useState<TurnData | null>(null);
  const [initialHistoryData, setInitialHistoryData] = useState<HistoryEntry[] | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [hasKey, setHasKey] = useState(() => {
    const isDev = (import.meta as any).env?.DEV;
    const localEnvKey = isDev ? (import.meta as any).env?.VITE_GEMINI_API_KEY : null;
    return !!localStorage.getItem('chronus_api_key') || !!localEnvKey;
  });

  useEffect(() => {
    if (localStorage.getItem('chronus_game_state')) {
      setHasSave(true);
    }
  }, []);

  const handleResumeGame = () => {
    try {
      const saved = localStorage.getItem('chronus_game_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.history && parsed.currentTurnData) {
          setInitialHistoryData(parsed.history);
          setInitialTurnData(parsed.currentTurnData);
          setStatus(GameStatus.PLAYING);
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }
    setHasSave(false);
    localStorage.removeItem('chronus_game_state');
  };

  const handleStartGame = async (context: string) => {
    setStatus(GameStatus.LOADING);
    setLoadingError(null);
    try {
      const data = await initializeGame(context);
      setInitialTurnData(data);
      setStatus(GameStatus.PLAYING);
    } catch (error: any) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Unknown error occurred";
      setLoadingError(`CRITICAL FAILURE: ${msg}`);
      setStatus(GameStatus.MENU);
    }
  };

  const handleRestart = () => {
    setStatus(GameStatus.MENU);
    setInitialTurnData(null);
    setInitialHistoryData(null);
    localStorage.removeItem('chronus_game_state');
    setHasSave(false);
  };

  if (!hasKey) {
    return <ApiKeyGateway onUnlock={(key) => {
      setHasKey(true);
    }}/>;
  }

  return (
    <div className="min-h-screen bg-gray-950 font-sans text-gray-100 flex flex-col">
      {status === GameStatus.MENU && (
        <div className="flex-grow flex flex-col items-center justify-center p-4">
           {loadingError && (
             <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200 max-w-2xl w-full text-center flex flex-col items-center gap-2 animate-fade-in shadow-xl break-words">
               <AlertTriangle className="text-red-500 w-8 h-8" />
               <span className="font-mono text-sm">{loadingError}</span>
               <p className="text-xs text-red-400 mt-2">Check your API key quota or connection and try again.</p>
             </div>
           )}
           {hasSave && (
             <div className="mb-8 w-full max-w-2xl bg-gray-900 border border-emerald-900/50 rounded-lg p-6 flex items-center justify-between shadow-lg">
               <div>
                 <h3 className="text-xl font-bold font-mono text-emerald-400">SESSION DETECTED</h3>
                 <p className="text-sm text-gray-400">An active timeline simulation was found in your local records.</p>
               </div>
               <button 
                 onClick={handleResumeGame}
                 className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
               >
                 <PlayCircle size={20} /> Resume
               </button>
             </div>
           )}
           <ScenarioSelector onSelect={handleStartGame} />
        </div>
      )}

      {status === GameStatus.LOADING && (
        <div className="flex-grow flex flex-col items-center justify-center p-4 space-y-6 animate-pulse">
           <Zap size={64} className="text-emerald-400" />
           <h2 className="text-3xl font-mono font-bold text-emerald-500 tracking-widest">BUILDING WORLD STATE</h2>
           <p className="text-gray-500 font-mono">Calculating historical trajectories...</p>
           <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
             <div className="h-full bg-emerald-500 animate-[width_2s_ease-in-out_infinite]" style={{ width: '50%' }}></div>
           </div>
        </div>
      )}

      {status === GameStatus.PLAYING && initialTurnData && (
        <GameInterface 
           initialTurn={initialTurnData} 
           initialHistory={initialHistoryData || undefined}
           onRestart={handleRestart} 
        />
      )}
    </div>
  );
};

export default App;
