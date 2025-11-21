import React, { useState, useEffect, useRef } from 'react';
import { generateText, generateGroundedContent, generateSpeech } from '../services/geminiService';
import { ChatMessage, ModelType, AgentProfile } from '../types';

interface ChatConsoleProps {
  agent?: AgentProfile;
  onToggleLive?: () => void;
  isLiveActive?: boolean;
}

const pcmToWavBlob = (pcmData: ArrayBuffer, sampleRate: number = 24000) => {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.byteLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.byteLength, true);

  return new Blob([header, pcmData], { type: 'audio/wav' });
};

const SLASH_COMMANDS = [
  { command: '/image', description: 'Generate an image', action: 'PREFILL', value: 'Generate an image of ' },
  { command: '/reason', description: 'Switch to Reasoning (Pro)', action: 'MODE', value: 'REASON' },
  { command: '/search', description: 'Switch to Web Search', action: 'MODE', value: 'SEARCH' },
  { command: '/maps', description: 'Switch to Maps', action: 'MODE', value: 'MAPS' },
  { command: '/fast', description: 'Switch to Fast Mode', action: 'MODE', value: 'FAST' },
  { command: '/clear', description: 'Clear chat history', action: 'FUNCTION', value: 'CLEAR' },
];

const ChatConsole: React.FC<ChatConsoleProps> = ({ agent, onToggleLive, isLiveActive }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'FAST' | 'REASON' | 'SEARCH' | 'MAPS'>('FAST');
  const [showMenu, setShowMenu] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(SLASH_COMMANDS);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Audio State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(1.0);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Audio Effect
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioVolume;
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.error("Play failed", e);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, audioVolume, audioUrl]);

  // Handle Slash Commands
  useEffect(() => {
    if (input.startsWith('/')) {
      const searchTerm = input.toLowerCase();
      const matches = SLASH_COMMANDS.filter(cmd => cmd.command.startsWith(searchTerm));
      setFilteredCommands(matches);
      setSlashMenuOpen(matches.length > 0);
      setSelectedIndex(0); // Reset selection on new filter
    } else {
      setSlashMenuOpen(false);
    }
  }, [input]);

  const executeSlashCommand = (cmd: typeof SLASH_COMMANDS[0]) => {
    if (cmd.action === 'MODE') {
      setMode(cmd.value as any);
      setInput('');
    } else if (cmd.action === 'PREFILL') {
      setInput(cmd.value);
      inputRef.current?.focus();
    } else if (cmd.action === 'FUNCTION') {
      if (cmd.value === 'CLEAR') {
        setMessages([]);
        setAudioUrl(null);
      }
      setInput('');
    }
    setSlashMenuOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands.length > 0) {
           executeSlashCommand(filteredCommands[selectedIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenuOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;
    
    // Check for exact slash command match if user typed it out manually without selecting
    if (text.startsWith('/')) {
       const cmd = SLASH_COMMANDS.find(c => c.command === text.trim());
       if (cmd) {
         executeSlashCommand(cmd);
         return;
       }
    }

    const userMsg: ChatMessage = { role: 'user', text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setShowMenu(false);
    
    // Reset audio on new message
    setAudioUrl(null);
    setIsPlaying(false);

    try {
      let responseText = '';
      let grounding = null;

      if (mode === 'SEARCH' || mode === 'MAPS') {
        const res = await generateGroundedContent(text, mode === 'MAPS');
        responseText = res.text || "No results found.";
        grounding = res.candidates?.[0]?.groundingMetadata;
      } else {
        const useThinking = mode === 'REASON';
        const model = useThinking ? ModelType.PRO_REASONING : (mode === 'FAST' ? ModelType.FLASH_LITE : ModelType.FLASH);
        // Pass the selected agent's system instruction
        const res = await generateText(text, model, useThinking, agent?.systemInstruction);
        responseText = res.text || "I couldn't generate a response.";
      }

      const botMsg: ChatMessage = { 
        role: 'model', 
        text: responseText, 
        timestamp: Date.now(),
        groundingMetadata: grounding
      };
      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      setMessages(prev => [...prev, { role: 'system', text: "Error: " + error, timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeakLastMessage = async () => {
    const lastModelMsg = [...messages].reverse().find(m => m.role === 'model');
    if (!lastModelMsg) return;

    setShowMenu(false);
    if (audioUrl) {
      // Replay existing
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        setIsPlaying(true);
      }
      return;
    }

    setIsAudioLoading(true);
    try {
      const audioBuffer = await generateSpeech(lastModelMsg.text);
      if (audioBuffer) {
        const blob = pcmToWavBlob(audioBuffer);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setIsPlaying(true);
      }
    } catch (e) {
      console.error("TTS Failed", e);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const setModeAndHint = (newMode: typeof mode) => {
    setMode(newMode);
    setShowMenu(false);
  };

  const EmptyState = () => (
    <div className="h-full flex flex-col items-center justify-center pb-20">
       <div className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center text-3xl mb-6 shadow-lg shadow-white/10">
         <i className={`fas ${agent?.icon || 'fa-bolt'}`}></i>
       </div>
       <h2 className="text-2xl font-semibold text-white mb-2">Hi, I'm {agent?.name || 'Dayugame'}</h2>
       <p className="text-gray-400 mb-8 text-center max-w-md">{agent?.description || 'What can I help you with?'}</p>
       
       <div className="grid grid-cols-2 gap-4 max-w-2xl w-full px-8">
          <ActionCard 
            icon="fa-image" 
            text="Create image" 
            subtext="Generate a scene"
            onClick={() => { setInput("Generate an image of "); inputRef.current?.focus(); }} 
          />
          <ActionCard 
            icon="fa-brain" 
            text="Reasoning" 
            subtext="Solve complex logic"
            onClick={() => { setMode('REASON'); setInput("Solve this logic puzzle: "); inputRef.current?.focus(); }} 
          />
          <ActionCard 
            icon="fa-magnifying-glass" 
            text="Research" 
            subtext="Search the web"
            onClick={() => { setMode('SEARCH'); setInput("Find latest news on "); inputRef.current?.focus(); }} 
          />
          <ActionCard 
            icon="fa-map-location-dot" 
            text="Find places" 
            subtext="Google Maps data"
            onClick={() => { setMode('MAPS'); setInput("Find the best restaurant near "); inputRef.current?.focus(); }} 
          />
       </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full relative">
      {/* Hidden Audio Element */}
      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          onEnded={() => setIsPlaying(false)} 
          onError={() => setIsPlaying(false)}
        />
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
         {messages.length === 0 ? (
           <EmptyState />
         ) : (
           <div className="max-w-3xl mx-auto w-full pt-8 px-4 pb-40 space-y-8">
             {messages.map((msg, idx) => (
               <div key={idx} className="flex gap-4">
                  <div className={`w-8 h-8 rounded-sm flex-shrink-0 flex items-center justify-center font-bold text-xs ${msg.role === 'user' ? 'bg-surface-tertiary text-gray-300' : 'bg-green-500/10 text-green-400 border border-green-500/20 rounded-full'}`}>
                    {msg.role === 'user' ? 'You' : <i className={`fas ${agent?.icon || 'fa-bolt'}`}></i>}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="font-semibold text-sm text-gray-200">{msg.role === 'user' ? 'You' : agent?.name || 'Dayugame'}</div>
                    <div className="text-gray-300 leading-relaxed whitespace-pre-wrap text-[15px]">{msg.text}</div>
                    
                    {/* Grounding Sources */}
                    {msg.groundingMetadata?.groundingChunks && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {msg.groundingMetadata.groundingChunks.map((chunk: any, i: number) => (
                          (chunk.web?.uri || chunk.maps?.uri) && (
                            <a key={i} href={chunk.web?.uri || chunk.maps?.uri} target="_blank" rel="noreferrer" className="text-xs bg-surface-secondary border border-surface-tertiary hover:bg-surface-tertiary px-2 py-1 rounded text-accent-muted flex items-center gap-1 transition-colors">
                              <i className={`fas ${chunk.maps ? 'fa-map-pin' : 'fa-globe'}`}></i>
                              {chunk.web?.title || chunk.maps?.title || 'Source'}
                            </a>
                          )
                        ))}
                      </div>
                    )}
                  </div>
               </div>
             ))}
             {loading && (
               <div className="flex gap-4 animate-pulse opacity-50">
                 <div className="w-8 h-8 bg-surface-secondary rounded-full"></div>
                 <div className="h-4 bg-surface-secondary rounded w-1/3 mt-2"></div>
               </div>
             )}
           </div>
         )}
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-surface p-4">
        <div className="max-w-3xl mx-auto w-full relative">
          {/* Audio Player Bar */}
          {(audioUrl || isAudioLoading) && (
             <div className="absolute -top-16 right-0 left-0 bg-surface-secondary border border-surface-tertiary rounded-xl p-3 flex items-center gap-4 shadow-2xl animate-fade-in-up">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  {isAudioLoading ? <i className="fas fa-circle-notch fa-spin text-xs text-white"></i> : <i className="fas fa-volume-high text-xs text-white"></i>}
                </div>
                
                <div className="flex-1 flex items-center gap-3">
                   <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                     {isAudioLoading ? 'Generating Speech...' : `${agent?.name || 'Dayugame'} Voice`}
                   </span>
                   
                   {!isAudioLoading && (
                     <>
                       <div className="h-4 w-px bg-surface-tertiary mx-2"></div>
                       
                       <button onClick={() => setIsPlaying(!isPlaying)} className="text-gray-200 hover:text-white transition-colors w-6">
                          <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                       </button>
                       
                       <button onClick={() => { if(audioRef.current) audioRef.current.currentTime = 0; setIsPlaying(true); }} className="text-gray-400 hover:text-white transition-colors text-xs">
                          <i className="fas fa-rotate-left"></i> Replay
                       </button>

                       <div className="flex items-center gap-2 ml-auto">
                          <i className="fas fa-volume-low text-xs text-gray-500"></i>
                          <input 
                            type="range" 
                            min="0" max="1" step="0.1" 
                            value={audioVolume}
                            onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                            className="w-20 h-1 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-white"
                          />
                       </div>
                     </>
                   )}
                </div>
                
                <button onClick={() => { setAudioUrl(null); setIsPlaying(false); }} className="text-gray-500 hover:text-white ml-2">
                   <i className="fas fa-times"></i>
                </button>
             </div>
          )}

          {/* Mode Indicator pill if not default */}
          {mode !== 'FAST' && (
            <div className="absolute -top-8 left-0 bg-surface-secondary text-xs px-3 py-1 rounded-full text-accent-muted border border-surface-tertiary flex items-center gap-2">
              <i className={`fas ${mode === 'REASON' ? 'fa-brain text-purple-400' : mode === 'SEARCH' ? 'fa-globe text-blue-400' : 'fa-map-pin text-orange-400'}`}></i>
              Using {mode} Mode
              <button onClick={() => setMode('FAST')} className="hover:text-white ml-2"><i className="fas fa-times"></i></button>
            </div>
          )}

          {/* Slash Menu */}
          {slashMenuOpen && (
            <div className="absolute bottom-full mb-2 left-0 bg-surface-secondary border border-surface-tertiary rounded-lg shadow-2xl overflow-hidden w-64 z-50 animate-in fade-in slide-in-from-bottom-2">
               <div className="bg-surface-tertiary/50 px-3 py-1 text-xs font-bold text-gray-500 uppercase">Commands</div>
               {filteredCommands.map((cmd, i) => (
                 <button
                   key={i}
                   onClick={() => executeSlashCommand(cmd)}
                   onMouseEnter={() => setSelectedIndex(i)}
                   className={`w-full text-left px-4 py-2 flex items-center gap-2 text-sm text-gray-200 transition-colors ${i === selectedIndex ? 'bg-surface-tertiary' : 'hover:bg-surface-tertiary'}`}
                 >
                    <span className="font-mono text-accent-muted">{cmd.command}</span>
                    <span className="text-gray-500 text-xs truncate ml-auto">{cmd.description}</span>
                 </button>
               ))}
            </div>
          )}

          <div className="bg-surface-secondary border border-surface-tertiary rounded-2xl shadow-xl flex items-end p-2 relative">
             {/* Plus Menu */}
             <div className="relative">
               <button 
                 onClick={() => setShowMenu(!showMenu)}
                 className="w-8 h-8 rounded-full bg-surface-tertiary hover:bg-gray-600 text-gray-300 flex items-center justify-center mb-1 transition-colors"
               >
                 <i className="fas fa-plus text-sm"></i>
               </button>
               {showMenu && (
                 <div className="absolute bottom-12 left-0 w-60 bg-surface-secondary border border-surface-tertiary rounded-lg shadow-2xl py-1 z-50 flex flex-col animate-in fade-in zoom-in duration-200">
                   <MenuItem icon="fa-brain" label="Thinking (Reasoning)" onClick={() => setModeAndHint('REASON')} />
                   <MenuItem icon="fa-globe" label="Web Search" onClick={() => setModeAndHint('SEARCH')} />
                   <MenuItem icon="fa-map" label="Maps Search" onClick={() => setModeAndHint('MAPS')} />
                   <div className="h-px bg-surface-tertiary my-1"></div>
                   <MenuItem icon="fa-volume-high" label="Read Response Aloud" onClick={handleSpeakLastMessage} />
                   <div className="h-px bg-surface-tertiary my-1"></div>
                   <MenuItem icon="fa-image" label="Create Image" onClick={() => {setInput("/image "); setShowMenu(false);}} />
                 </div>
               )}
             </div>

             <textarea
                id="chat-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${agent?.name || 'Dayugame'}... (Type / for commands)`}
                className="flex-1 bg-transparent border-none focus:ring-0 text-gray-200 max-h-32 min-h-[44px] py-3 px-3 resize-none outline-none placeholder-gray-500"
                rows={1}
             />
             
             {/* Char Counter & Send Button */}
             <div className="flex items-center gap-3 mb-1">
               <span className="text-[10px] text-gray-600 font-mono">{input.length} chars</span>
               
               {/* Live Mode Toggle */}
               {onToggleLive && (
                  <button 
                    onClick={onToggleLive}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isLiveActive ? 'bg-red-500/20 text-red-400' : 'bg-surface-tertiary text-gray-500 hover:text-gray-300'}`}
                    title={isLiveActive ? "Live Active" : "Start Live Session"}
                  >
                    <i className={`fas ${isLiveActive ? 'fa-microphone-lines animate-pulse' : 'fa-microphone'}`}></i>
                  </button>
               )}

               <button 
                 onClick={() => handleSend()}
                 disabled={!input.trim() && !loading}
                 className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${input.trim() ? 'bg-white text-black' : 'bg-surface-tertiary text-gray-500'}`}
               >
                 {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-arrow-up"></i>}
               </button>
             </div>
          </div>
          <div className="text-center text-xs text-gray-600 mt-2">
            {agent?.name || 'Dayugame'} can make mistakes. Check important info.
          </div>
        </div>
      </div>
    </div>
  );
};

const ActionCard = ({ icon, text, subtext, onClick }: any) => (
  <button onClick={onClick} className="flex items-center gap-4 p-3 rounded-xl border border-surface-tertiary hover:bg-surface-secondary transition-colors text-left group">
     <i className={`fas ${icon} text-accent-muted group-hover:text-green-400 transition-colors`}></i>
     <div>
       <div className="text-sm font-medium text-gray-200">{text}</div>
       <div className="text-xs text-gray-500">{subtext}</div>
     </div>
  </button>
);

const MenuItem = ({ icon, label, onClick }: any) => (
  <button onClick={onClick} className="flex items-center gap-3 px-4 py-2 hover:bg-surface-tertiary text-sm text-gray-300 w-full text-left transition-colors">
    <i className={`fas ${icon} w-5 text-center text-gray-400`}></i> {label}
  </button>
);

export default ChatConsole;