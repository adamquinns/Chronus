
import React, { useState } from 'react';
import { Scenario } from '../types';
import { Play, PenTool, Settings, X, Save, Terminal, FileText } from 'lucide-react';

interface ScenarioSelectorProps {
  onSelect: (scenarioContext: string) => void;
}

import { PRESET_SCENARIOS } from '../data/scenarios';

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({ onSelect }) => {
  const [customInput, setCustomInput] = useState('');
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [editedContext, setEditedContext] = useState('');

  const handleCustomStart = () => {
    if (customInput.trim()) {
      onSelect(`CUSTOM SCENARIO CREATED BY PLAYER. CONTEXT: ${customInput}. INSTRUCTIONS: Flesh out this world with specific factions, military assets, and hidden tensions similar to a grand strategy game setup.`);
    }
  };

  const openEditor = (scenario: Scenario) => {
    setEditingScenario(scenario);
    setEditedContext(scenario.promptContext.trim());
  };

  const closeEditor = () => {
    setEditingScenario(null);
    setEditedContext('');
  };

  const launchEditedScenario = () => {
    if (editedContext.trim()) {
      onSelect(editedContext);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 animate-fade-in relative">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-4 font-mono">
          CHRONUS
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          The divergence engine is ready. Select a pivot point in history to begin your timeline simulation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {PRESET_SCENARIOS.filter(s => s.id === 'american_twilight').map((scenario) => (
          <div 
            key={scenario.id}
            className="group bg-gray-900 border border-gray-700 rounded-xl overflow-hidden hover:border-blue-500 transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/20 flex flex-col relative"
          >
            <div className="h-40 overflow-hidden relative">
               <img src={scenario.imageUrl} alt={scenario.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-60 group-hover:opacity-100" />
               <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs font-mono text-emerald-400">
                 {scenario.startingYear}
               </div>
            </div>
            <div className="p-5 flex flex-col flex-grow">
              <h3 className="text-xl font-bold text-white mb-2">{scenario.title}</h3>
              <p className="text-gray-400 text-sm mb-6 flex-grow">{scenario.description}</p>
              
              <div className="grid grid-cols-4 gap-2 mt-auto">
                <button 
                  onClick={() => openEditor(scenario)}
                  className="col-span-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-bold transition-colors flex items-center justify-center border border-gray-700 hover:border-gray-500"
                  title="Edit Parameters"
                >
                  <Settings size={18} />
                </button>
                <button 
                  onClick={() => onSelect(scenario.promptContext)}
                  className="col-span-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Play size={16} /> Initialize
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4 text-emerald-400">
          <PenTool size={20} />
          <h2 className="text-lg font-bold uppercase tracking-wider">Custom Divergence</h2>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Describe any historical event, era, or "what if" scenario. The AI will generate the world state.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <input 
            type="text" 
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="e.g., Napoleon wins Waterloo, or The Internet was never invented..."
            className="flex-grow bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-gray-600"
            onKeyDown={(e) => e.key === 'Enter' && handleCustomStart()}
          />
          <button 
            onClick={handleCustomStart}
            disabled={!customInput.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-lg shadow-emerald-900/20"
          >
            Generate
          </button>
        </div>
      </div>

      {/* Editor Modal */}
      {editingScenario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-900 border border-gray-600 rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-950">
              <div className="flex items-center gap-3">
                <Terminal className="text-emerald-500" />
                <div>
                  <h3 className="text-lg font-bold text-white font-mono">SIMULATION CONFIGURATION</h3>
                  <p className="text-xs text-gray-500 uppercase tracking-widest">Editing: {editingScenario.title}</p>
                </div>
              </div>
              <button 
                onClick={closeEditor}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
              
              {/* Info Column */}
              <div className="hidden md:block w-1/3 bg-gray-900 border-r border-gray-700 p-6 overflow-y-auto">
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-blue-400 uppercase mb-2 flex items-center gap-2"><FileText size={14}/> Instructions</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    You are editing the raw context seed that the AI uses to build the simulation universe.
                  </p>
                  <ul className="list-disc list-inside text-xs text-gray-500 mt-2 space-y-1">
                    <li>Define key assets (Armies, Economies)</li>
                    <li>Set the starting year</li>
                    <li>Establish the initial crisis</li>
                  </ul>
                </div>

                <div className="p-4 bg-gray-950 rounded border border-gray-800">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Original Premise</h4>
                  <p className="text-xs text-gray-400 italic">
                    "{editingScenario.description}"
                  </p>
                </div>
              </div>

              {/* Editor Column */}
              <div className="flex-grow flex flex-col bg-[#1e1e1e]">
                <div className="flex items-center justify-between px-4 py-2 bg-[#252526] text-gray-400 text-xs border-b border-black">
                  <span className="font-mono">prompt_context.txt</span>
                  <span className="bg-emerald-900/30 text-emerald-500 px-2 rounded">UTF-8</span>
                </div>
                <textarea 
                  value={editedContext}
                  onChange={(e) => setEditedContext(e.target.value)}
                  className="flex-grow w-full bg-[#1e1e1e] text-gray-300 font-mono p-4 text-sm focus:outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-950 border-t border-gray-700 flex justify-end gap-3">
              <button 
                onClick={closeEditor}
                className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={launchEditedScenario}
                disabled={!editedContext.trim()}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold shadow-lg shadow-emerald-900/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} /> Initialize Divergence
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
