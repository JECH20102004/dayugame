import React, { useState } from 'react';
import { ViewType, AgentProfile } from '../types';
import VisionStudio from './VisionStudio';
import VeoStudio from './VeoStudio';
import ChatConsole from './ChatConsole';
import LiveAssistant from './LiveAssistant';
import AgentModal from './AgentModal';
import SystemBridge from './SystemBridge';
import SettingsModal from './SettingsModal';

const DEFAULT_AGENT: AgentProfile = {
  id: 'default',
  name: 'Dayugame',
  description: 'Your helpful desktop assistant.',
  systemInstruction: 'You are Dayugame, a helpful, clever, and efficient desktop assistant. You help the user with tasks, analysis, and creativity.',
  voiceName: 'Kore',
  icon: 'fa-bolt'
};

const Desktop: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>(ViewType.CHAT);
  const [liveActive, setLiveActive] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(0); // Used to reset chat
  
  // Agent State
  const [currentAgent, setCurrentAgent] = useState<AgentProfile>(DEFAULT_AGENT);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const handleVoiceCommand = (command: string, args: any) => {
    console.log(`Voice Command Received: ${command}`, args);
    
    if (command === 'change_view') {
      const v = (args.view || '').toLowerCase();
      if (v.includes('chat')) setCurrentView(ViewType.CHAT);
      else if (v.includes('vision')) setCurrentView(ViewType.VISION);
      else if (v.includes('veo') || v.includes('video')) setCurrentView(ViewType.VEO);
      else if (v.includes('system') || v.includes('bridge')) setCurrentView(ViewType.SYSTEM);
    } else if (command === 'system_action') {
      const action = (args.action || '').toLowerCase();
      if (action === 'new_chat') setChatSessionId(prev => prev + 1);
      if (action === 'toggle_sidebar') setSidebarCollapsed(prev => !prev);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case ViewType.CHAT:
        return <ChatConsole key={chatSessionId} agent={currentAgent} onToggleLive={() => setLiveActive(!liveActive)} isLiveActive={liveActive} />;
      case ViewType.VISION:
        return <VisionStudio />;
      case ViewType.VEO:
        return <VeoStudio />;
      case ViewType.SYSTEM:
        return <SystemBridge />;
      default:
        return <ChatConsole key={chatSessionId} agent={currentAgent} onToggleLive={() => setLiveActive(!liveActive)} isLiveActive={liveActive} />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-surface overflow-hidden font-sans text-slate-200">
      {/* Left Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-surface-secondary border-r border-surface-tertiary flex flex-col transition-all duration-300 z-20 flex-shrink-0 relative`}>
        
        {/* App Header */}
        <div className="h-14 flex items-center px-4 border-b border-surface-tertiary flex-shrink-0">
           <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
             <i className="fas fa-layer-group"></i>
           </div>
           {!sidebarCollapsed && <span className="ml-3 font-bold text-lg tracking-tight text-white">Dayugame OS</span>}
           <button 
             onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
             className={`ml-auto text-gray-500 hover:text-white transition-colors ${sidebarCollapsed ? 'absolute left-1/2 -translate-x-1/2 top-16' : ''}`}
           >
             <i className={`fas ${sidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
           </button>
        </div>

        {/* Main Nav */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-2 custom-scrollbar">
          
          {/* New Chat Button (Gemini Style) */}
          <button 
             onClick={() => setChatSessionId(prev => prev + 1)}
             className={`w-full flex items-center gap-3 bg-surface-tertiary hover:bg-surface-tertiary/80 text-gray-200 px-4 py-3 rounded-full transition-all mb-6 shadow-md ${sidebarCollapsed ? 'justify-center px-0 w-10 h-10 mx-auto' : ''}`}
          >
             <i className="fas fa-plus text-blue-400"></i>
             {!sidebarCollapsed && <span className="font-medium text-sm">New Chat</span>}
          </button>

          <div className="text-xs font-bold text-gray-500 px-2 uppercase tracking-wider mb-2 opacity-70 hidden lg:block">
            {!sidebarCollapsed && 'Tools & Gems'}
          </div>

          <NavItem 
             active={currentView === ViewType.CHAT} 
             icon="fa-message" 
             label="Chat Console" 
             collapsed={sidebarCollapsed}
             onClick={() => setCurrentView(ViewType.CHAT)} 
          />
          
          <NavItem 
             active={currentView === ViewType.VISION} 
             icon="fa-eye" 
             label="Vision Studio" 
             collapsed={sidebarCollapsed}
             onClick={() => setCurrentView(ViewType.VISION)} 
          />
          <NavItem 
             active={currentView === ViewType.VEO} 
             icon="fa-film" 
             label="Veo Director" 
             collapsed={sidebarCollapsed}
             onClick={() => setCurrentView(ViewType.VEO)} 
          />
          
          <NavItem 
             active={currentView === ViewType.SYSTEM} 
             icon="fa-network-wired" 
             label="Native Bridge" 
             collapsed={sidebarCollapsed}
             onClick={() => setCurrentView(ViewType.SYSTEM)} 
          />

          {/* Live Assistant Toggle in Sidebar */}
          <div className="mt-4">
            <button
              onClick={() => setLiveActive(!liveActive)}
              className={`relative group w-full rounded-xl flex items-center transition-all duration-300 p-3 border ${liveActive ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-surface-tertiary/30 border-transparent text-gray-400 hover:bg-surface-tertiary hover:text-white'}`}
            >
              <div className={`w-8 h-8 flex items-center justify-center rounded-full ${liveActive ? 'bg-red-500 text-white animate-pulse' : 'bg-surface-secondary'}`}>
                 <i className="fas fa-microphone-lines"></i>
              </div>
              {!sidebarCollapsed && (
                 <div className="ml-3 text-left">
                   <div className="text-xs font-bold uppercase tracking-wider">Voice • Live</div>
                   <div className="text-[10px] opacity-70">Vision • Action</div>
                 </div>
              )}
            </button>
          </div>
          
          {/* Recent History Mock */}
          {!sidebarCollapsed && (
             <div className="mt-8 px-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recent</div>
                <div className="space-y-1">
                   <div className="text-sm text-gray-400 hover:bg-surface-tertiary/50 p-2 rounded cursor-pointer truncate"><i className="fas fa-message text-xs mr-2 opacity-50"></i>Project Planning</div>
                   <div className="text-sm text-gray-400 hover:bg-surface-tertiary/50 p-2 rounded cursor-pointer truncate"><i className="fas fa-image text-xs mr-2 opacity-50"></i>Logo Design Ideas</div>
                   <div className="text-sm text-gray-400 hover:bg-surface-tertiary/50 p-2 rounded cursor-pointer truncate"><i className="fas fa-film text-xs mr-2 opacity-50"></i>Cyberpunk City Video</div>
                </div>
             </div>
          )}

        </div>

        {/* Bottom Footer */}
        <div className="p-3 border-t border-surface-tertiary bg-surface-secondary/50 flex flex-col gap-2">
          {/* Settings & Location */}
          <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-4' : 'justify-between px-2'}`}>
             <button 
               onClick={() => setIsSettingsModalOpen(true)}
               className="text-gray-500 hover:text-white transition-colors text-lg" 
               title="Settings"
             >
               <i className="fas fa-cog"></i>
             </button>
             {!sidebarCollapsed && (
               <div className="flex items-center gap-2 text-[10px] text-gray-600">
                  <i className="fas fa-map-marker-alt"></i> San Francisco, CA
               </div>
             )}
             <button className="text-gray-500 hover:text-white transition-colors text-sm" title="Help">
               <i className="fas fa-question-circle"></i>
             </button>
          </div>

          {/* Active Agent Profile */}
          <button 
             onClick={() => setIsAgentModalOpen(true)}
             className={`flex items-center gap-3 w-full text-left hover:bg-surface-tertiary rounded-lg p-2 transition-colors mt-2 ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center border border-gray-500 text-white shadow-md relative">
                <i className={`fas ${currentAgent.icon} text-xs`}></i>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-surface-secondary rounded-full"></div>
             </div>
             {!sidebarCollapsed && (
               <div className="flex-1 overflow-hidden">
                 <div className="text-xs font-bold text-white truncate">{currentAgent.name}</div>
                 <div className="text-[10px] text-gray-500 truncate">Standard • {currentAgent.voiceName}</div>
               </div>
             )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {renderContent()}
        
        {/* Floating Live Assistant (Persistent Overlay) */}
        <LiveAssistant 
           active={liveActive} 
           agent={currentAgent}
           onToggle={() => setLiveActive(!liveActive)} 
           onCommand={handleVoiceCommand}
        />
      </div>

      <AgentModal 
        isOpen={isAgentModalOpen} 
        onClose={() => setIsAgentModalOpen(false)}
        currentAgent={currentAgent}
        onSelectAgent={setCurrentAgent}
      />
      
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
};

const NavItem = ({ active, icon, label, collapsed, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-3 py-2 rounded-lg transition-all duration-200 group relative ${
      active 
        ? 'bg-surface-tertiary/60 text-blue-400 shadow-sm font-medium' 
        : 'text-gray-400 hover:bg-surface-tertiary/30 hover:text-gray-200'
    } ${collapsed ? 'justify-center' : ''}`}
  >
    <i className={`fas ${icon} text-sm transition-transform group-hover:scale-110`}></i>
    {!collapsed && <span className="text-sm">{label}</span>}
    
    {collapsed && (
       <div className="absolute left-full ml-4 bg-surface-secondary border border-surface-tertiary px-3 py-1.5 rounded text-xs whitespace-nowrap text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg pointer-events-none">
         {label}
       </div>
    )}
  </button>
);

export default Desktop;