import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) setApiKey(storedKey);
  }, [isOpen]);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleClear = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-secondary w-[500px] rounded-2xl shadow-2xl border border-surface-tertiary overflow-hidden">
        <div className="p-6 border-b border-surface-tertiary flex justify-between items-center">
           <h2 className="text-lg font-bold text-white">Settings</h2>
           <button onClick={onClose} className="text-gray-500 hover:text-white"><i className="fas fa-times"></i></button>
        </div>
        
        <div className="p-6 space-y-6">
           <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Google AI Studio API Key</label>
              <div className="text-xs text-gray-500 mb-2">
                 Required for Veo Video, Gemini 3 Pro Image, and Bridge. <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 hover:underline">Get Key</a>
              </div>
              <div className="relative">
                 <input 
                   type="password" 
                   value={apiKey}
                   onChange={(e) => setApiKey(e.target.value)}
                   placeholder="AIzaSy..."
                   className="w-full bg-surface-tertiary/30 border border-surface-tertiary rounded-lg px-4 py-3 text-sm text-white focus:border-blue-500 outline-none font-mono"
                 />
                 {apiKey && (
                    <button onClick={handleClear} className="absolute right-3 top-3 text-gray-500 hover:text-red-400">
                       <i className="fas fa-trash"></i>
                    </button>
                 )}
              </div>
           </div>
        </div>

        <div className="p-6 border-t border-surface-tertiary bg-surface-tertiary/10 flex justify-end gap-3">
           <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Close</button>
           <button 
             onClick={handleSave}
             className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
           >
              {saved ? <><i className="fas fa-check mr-2"></i>Saved</> : 'Save Changes'}
           </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;