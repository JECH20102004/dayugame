import React, { useState, useEffect } from 'react';
import { AgentProfile, ModelType } from '../types';
import { generateText } from '../services/geminiService';

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAgent: AgentProfile;
  onSelectAgent: (agent: AgentProfile) => void;
}

const DEFAULT_AGENTS: AgentProfile[] = [
  {
    id: 'default',
    name: 'Dayugame',
    description: 'Your helpful desktop assistant.',
    systemInstruction: 'You are Dayugame, a helpful, clever, and efficient desktop assistant. You help the user with tasks, analysis, and creativity.',
    voiceName: 'Kore',
    icon: 'fa-bolt'
  },
  {
    id: 'coder',
    name: 'DevBot',
    description: 'Expert software engineer and troubleshooter.',
    systemInstruction: 'You are an expert software engineer. You write clean, efficient, and well-documented code. You prefer TypeScript and Python. You are concise and technical.',
    voiceName: 'Fenrir',
    icon: 'fa-code'
  },
  {
    id: 'creative',
    name: 'Muse',
    description: 'Creative writer and storyteller.',
    systemInstruction: 'You are Muse, a creative writing partner. You excel at storytelling, poetry, and brainstorming imaginative concepts. Your tone is inspiring and evocative.',
    voiceName: 'Puck',
    icon: 'fa-feather'
  },
  {
    id: 'teacher',
    name: 'Mentor',
    description: 'Patient tutor for complex topics.',
    systemInstruction: 'You are a patient and knowledgeable tutor. You explain complex topics simply and use analogies. You encourage the user to ask questions.',
    voiceName: 'Zephyr',
    icon: 'fa-graduation-cap'
  }
];

const ICON_OPTIONS = [
  { id: 'fa-bolt', label: 'Default' },
  { id: 'fa-robot', label: 'Robot' },
  { id: 'fa-brain', label: 'Intelligence' },
  { id: 'fa-wand-magic-sparkles', label: 'Magic' },
  { id: 'fa-code', label: 'Code' },
  { id: 'fa-feather', label: 'Writing' },
  { id: 'fa-graduation-cap', label: 'Education' },
  { id: 'fa-gamepad', label: 'Gaming' },
  { id: 'fa-music', label: 'Music' },
  { id: 'fa-video', label: 'Video' },
  { id: 'fa-palette', label: 'Art' },
  { id: 'fa-chart-line', label: 'Finance' },
  { id: 'fa-globe', label: 'World' },
  { id: 'fa-flask', label: 'Science' },
  { id: 'fa-stethoscope', label: 'Health' },
  { id: 'fa-gavel', label: 'Legal' },
  { id: 'fa-briefcase', label: 'Business' },
  { id: 'fa-user-secret', label: 'Secret' },
  { id: 'fa-bug', label: 'Debug' },
  { id: 'fa-chess-knight', label: 'Strategy' },
  { id: 'fa-terminal', label: 'Terminal' },
  { id: 'fa-comment-dots', label: 'Chat' },
  { id: 'fa-book-open', label: 'Reading' },
  { id: 'fa-lightbulb', label: 'Idea' },
  { id: 'fa-rocket', label: 'Launch' },
  { id: 'fa-ghost', label: 'Ghost' },
  { id: 'fa-dragon', label: 'Dragon' },
  { id: 'fa-cat', label: 'Pet' },
  { id: 'fa-eye', label: 'Vision' },
  { id: 'fa-fingerprint', label: 'Security' },
  { id: 'fa-heart-pulse', label: 'Wellness' }
];

const AgentModal: React.FC<AgentModalProps> = ({ isOpen, onClose, currentAgent, onSelectAgent }) => {
  const [agents, setAgents] = useState<AgentProfile[]>(DEFAULT_AGENTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AgentProfile | null>(null);
  
  // Icon Picker State
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState('');

  // Test Agent State
  const [testInput, setTestInput] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // Load from local storage if available (mock for now)
  useEffect(() => {
    const saved = localStorage.getItem('nexus_agents');
    if (saved) {
      setAgents(JSON.parse(saved));
    }
  }, []);

  const saveAgents = (newAgents: AgentProfile[]) => {
    setAgents(newAgents);
    localStorage.setItem('nexus_agents', JSON.stringify(newAgents));
  };

  const handleStartEdit = (agent: AgentProfile) => {
    setEditingId(agent.id);
    setEditForm({ ...agent });
    setShowIconPicker(false);
    setIconSearch('');
    setTestInput('');
    setTestResponse('');
    setIsTesting(false);
  };

  const handleCreateNew = () => {
    const newAgent: AgentProfile = {
      id: Date.now().toString(),
      name: 'New Agent',
      description: 'Description here',
      systemInstruction: 'You are a helpful assistant.',
      voiceName: 'Kore',
      icon: 'fa-robot'
    };
    setAgents([...agents, newAgent]);
    handleStartEdit(newAgent);
  };

  const handleSaveEdit = () => {
    if (!editForm) return;
    const newAgents = agents.map(a => a.id === editForm.id ? editForm : a);
    saveAgents(newAgents);
    if (currentAgent.id === editForm.id) {
      onSelectAgent(editForm);
    }
    setEditingId(null);
    setEditForm(null);
  };

  const handleDelete = (id: string) => {
    if (id === 'default') return; // Prevent deleting default
    const newAgents = agents.filter(a => a.id !== id);
    saveAgents(newAgents);
    if (currentAgent.id === id) {
      onSelectAgent(newAgents[0]);
    }
    if (editingId === id) {
      setEditingId(null);
    }
  };

  const handleTestAgent = async () => {
    if (!testInput || !editForm) return;
    setIsTesting(true);
    try {
      const res = await generateText(
        testInput,
        ModelType.FLASH, // Use flash for quick testing
        false,
        editForm.systemInstruction
      );
      setTestResponse(res.text || 'No response.');
    } catch (e) {
      setTestResponse('Error: ' + (e as any).message);
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface w-[900px] h-[700px] rounded-2xl shadow-2xl border border-surface-tertiary flex overflow-hidden">
        
        {/* Sidebar List */}
        <div className="w-1/3 bg-surface-secondary border-r border-surface-tertiary flex flex-col">
          <div className="p-4 border-b border-surface-tertiary flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">AI Agents</h2>
            <button onClick={handleCreateNew} className="text-xs bg-white text-black px-2 py-1 rounded hover:bg-gray-200 transition">
              <i className="fas fa-plus"></i> New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {agents.map(agent => (
              <div 
                key={agent.id}
                onClick={() => {
                  if (!editingId) onSelectAgent(agent);
                }}
                className={`p-3 rounded-lg cursor-pointer transition-all border ${currentAgent.id === agent.id ? 'bg-surface-tertiary border-gray-500' : 'border-transparent hover:bg-surface-tertiary/50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${currentAgent.id === agent.id ? 'from-blue-500 to-purple-500 text-white' : 'from-gray-700 to-gray-800 text-gray-400'}`}>
                    <i className={`fas ${agent.icon}`}></i>
                  </div>
                  <div>
                    <div className={`font-medium text-sm ${currentAgent.id === agent.id ? 'text-white' : 'text-gray-300'}`}>{agent.name}</div>
                    <div className="text-xs text-gray-500 line-clamp-1">{agent.description}</div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleStartEdit(agent); }}
                    className="ml-auto text-gray-500 hover:text-white px-2"
                  >
                    <i className="fas fa-cog"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-surface flex flex-col relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
            <i className="fas fa-times text-xl"></i>
          </button>

          {editingId && editForm ? (
            <div className="p-8 flex flex-col h-full overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 rounded bg-surface-tertiary flex items-center justify-center text-xl">
                    <i className={`fas ${editForm.icon}`}></i>
                 </div>
                 <h2 className="text-xl font-bold text-white">Edit Profile: {editForm.name}</h2>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Name</label>
                    <input 
                      value={editForm.name} 
                      onChange={e => setEditForm({...editForm, name: e.target.value})}
                      className="w-full bg-surface-secondary border border-surface-tertiary rounded p-2 text-sm focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Icon</label>
                    <button 
                      onClick={() => setShowIconPicker(!showIconPicker)}
                      className="w-full bg-surface-secondary border border-surface-tertiary rounded p-2 text-sm flex items-center gap-3 hover:border-gray-500 transition-colors text-left"
                    >
                      <div className="w-6 h-6 rounded bg-surface-tertiary flex items-center justify-center text-gray-200">
                         <i className={`fas ${editForm.icon}`}></i>
                      </div>
                      <span className="text-gray-300 flex-1">{ICON_OPTIONS.find(o => o.id === editForm.icon)?.label || editForm.icon}</span>
                      <i className="fas fa-chevron-down text-xs text-gray-500"></i>
                    </button>
                    
                    {showIconPicker && (
                      <>
                        <div className="fixed inset-0 z-0" onClick={() => setShowIconPicker(false)}></div>
                        <div className="absolute top-full left-0 w-full mt-2 bg-surface-secondary border border-surface-tertiary rounded-lg shadow-xl z-10 p-3 animate-in fade-in zoom-in-95 duration-100">
                           <input 
                             type="text" 
                             placeholder="Search icons..." 
                             value={iconSearch}
                             onChange={e => setIconSearch(e.target.value)}
                             className="w-full bg-surface-tertiary rounded p-2 text-xs mb-3 text-gray-200 focus:outline-none border border-transparent focus:border-gray-600"
                             autoFocus
                           />
                           <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                             {ICON_OPTIONS.filter(i => i.id.includes(iconSearch.toLowerCase()) || i.label.toLowerCase().includes(iconSearch.toLowerCase())).map(opt => (
                                <button
                                  key={opt.id}
                                  onClick={() => { setEditForm({...editForm, icon: opt.id}); setShowIconPicker(false); }}
                                  className={`aspect-square rounded flex items-center justify-center text-lg hover:bg-blue-600 hover:text-white transition-colors ${editForm.icon === opt.id ? 'bg-blue-600 text-white' : 'bg-surface-tertiary text-gray-400'}`}
                                  title={opt.label}
                                >
                                   <i className={`fas ${opt.id}`}></i>
                                </button>
                             ))}
                           </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Description</label>
                    <input 
                      value={editForm.description} 
                      onChange={e => setEditForm({...editForm, description: e.target.value})}
                      className="w-full bg-surface-secondary border border-surface-tertiary rounded p-2 text-sm focus:border-blue-500 outline-none"
                    />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Voice Model</label>
                  <div className="grid grid-cols-5 gap-2">
                    {['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].map(voice => (
                      <button
                        key={voice}
                        onClick={() => setEditForm({...editForm, voiceName: voice as any})}
                        className={`p-2 rounded text-xs border ${editForm.voiceName === voice ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-surface-secondary border-surface-tertiary text-gray-400 hover:bg-surface-tertiary'}`}
                      >
                        <i className="fas fa-microphone-lines mb-1 block"></i>
                        {voice}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1">System Instructions</label>
                    <textarea 
                      value={editForm.systemInstruction} 
                      onChange={e => setEditForm({...editForm, systemInstruction: e.target.value})}
                      className="w-full bg-surface-secondary border border-surface-tertiary rounded p-3 text-sm focus:border-blue-500 outline-none h-40 font-mono text-gray-300"
                      placeholder="Define how the AI should behave..."
                    />
                </div>

                {/* Test Section */}
                <div className="mt-6 border-t border-surface-tertiary pt-6">
                   <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                     <i className="fas fa-vial"></i> Test Agent
                   </h3>
                   <div className="bg-black/20 border border-surface-tertiary rounded-lg p-4">
                      {testResponse && (
                        <div className="mb-4 p-3 bg-surface-secondary rounded border border-surface-tertiary animate-in fade-in slide-in-from-bottom-2">
                          <div className="text-xs text-blue-400 font-bold mb-1 flex items-center gap-2">
                             <i className={`fas ${editForm.icon}`}></i> {editForm.name}
                          </div>
                          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{testResponse}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input 
                           value={testInput}
                           onChange={(e) => setTestInput(e.target.value)}
                           placeholder={`Say something to ${editForm.name}...`}
                           className="flex-1 bg-surface-secondary border border-surface-tertiary rounded px-3 py-2 text-sm focus:border-blue-500 outline-none text-gray-200"
                           onKeyDown={(e) => e.key === 'Enter' && handleTestAgent()}
                        />
                        <button 
                           onClick={handleTestAgent}
                           disabled={!testInput || isTesting}
                           className="px-4 py-2 bg-surface-tertiary hover:bg-gray-600 text-white rounded text-sm font-medium disabled:opacity-50 min-w-[80px]"
                        >
                           {isTesting ? <i className="fas fa-circle-notch fa-spin"></i> : 'Send'}
                        </button>
                      </div>
                      <div className="text-[10px] text-gray-600 mt-2 text-center">
                        Tests use gemini-2.5-flash for speed.
                      </div>
                   </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3 border-t border-surface-tertiary pt-6">
                {editingId !== 'default' && (
                  <button onClick={() => handleDelete(editingId)} className="px-4 py-2 text-red-400 hover:text-red-300 text-sm">Delete</button>
                )}
                <button onClick={() => setEditingId(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
                <button onClick={handleSaveEdit} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-bold shadow-lg">Save Changes</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
               <div className="w-20 h-20 rounded-full bg-surface-secondary flex items-center justify-center mb-6 border border-surface-tertiary shadow-xl">
                  <i className={`fas ${currentAgent.icon} text-4xl text-gray-200`}></i>
               </div>
               <h2 className="text-2xl font-bold text-white mb-2">{currentAgent.name}</h2>
               <p className="text-gray-400 max-w-md mb-8">{currentAgent.description}</p>
               
               <div className="grid grid-cols-2 gap-4 w-full max-w-lg text-left">
                 <div className="bg-surface-secondary p-4 rounded-lg border border-surface-tertiary">
                    <div className="text-xs text-gray-500 uppercase font-bold mb-1">Voice</div>
                    <div className="text-blue-400"><i className="fas fa-wave-square mr-2"></i>{currentAgent.voiceName}</div>
                 </div>
                 <div className="bg-surface-secondary p-4 rounded-lg border border-surface-tertiary">
                    <div className="text-xs text-gray-500 uppercase font-bold mb-1">Instructions</div>
                    <div className="text-gray-300 text-sm line-clamp-2">{currentAgent.systemInstruction}</div>
                 </div>
               </div>

               <div className="mt-8 text-sm text-gray-600">
                 Select "Edit" on the sidebar to modify this profile.
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentModal;