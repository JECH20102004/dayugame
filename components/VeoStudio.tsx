import React, { useState } from 'react';
import { generateVideo } from '../services/geminiService';

const VeoStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    setStatus('Initializing Veo generation pipeline...');
    try {
      setStatus('Rendering frames with Veo 3.1...');
      const url = await generateVideo(prompt, aspectRatio);
      if (url) {
        setVideoUrl(url);
        setStatus('Complete');
      } else {
        setStatus('Generation failed.');
      }
    } catch (error) {
      setStatus('Error: ' + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-surface">
      <div className="w-80 border-r border-surface-tertiary p-6 flex flex-col bg-surface-secondary/30">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">
           Video Settings
        </h2>
        
        <label className="text-xs font-bold text-gray-500 mb-2 block">Prompt</label>
        <textarea 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe a scene (e.g., A futuristic city with flying cars in 4K)"
          className="w-full bg-surface-tertiary/30 border border-surface-tertiary rounded-lg p-3 text-sm focus:border-gray-500 focus:outline-none text-gray-200 h-32 mb-6 resize-none"
        />
        
        <label className="text-xs font-bold text-gray-500 mb-2 block">Aspect Ratio</label>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button 
             onClick={() => setAspectRatio('16:9')}
             className={`py-3 rounded-lg border text-sm flex flex-col items-center justify-center gap-2 ${aspectRatio === '16:9' ? 'bg-surface-secondary border-gray-400 text-white' : 'border-surface-tertiary text-gray-500 hover:bg-surface-tertiary'}`}
          >
             <div className="w-8 h-5 border-2 border-current rounded-sm"></div>
             16:9
          </button>
          <button 
             onClick={() => setAspectRatio('9:16')}
             className={`py-3 rounded-lg border text-sm flex flex-col items-center justify-center gap-2 ${aspectRatio === '9:16' ? 'bg-surface-secondary border-gray-400 text-white' : 'border-surface-tertiary text-gray-500 hover:bg-surface-tertiary'}`}
          >
             <div className="w-5 h-8 border-2 border-current rounded-sm"></div>
             9:16
          </button>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3 mt-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg transition-all"
        >
          {loading ? 'Generating...' : 'Generate Video'}
        </button>
      </div>

      <div className="flex-1 bg-black flex flex-col items-center justify-center relative overflow-hidden">
        {/* Loading Overlay */}
        {loading && (
           <div className="absolute inset-0 bg-black/90 z-20 flex flex-col items-center justify-center">
              <div className="w-16 h-16 border-4 border-surface-tertiary border-t-purple-500 rounded-full animate-spin mb-4"></div>
              <p className="text-purple-400 font-mono text-sm animate-pulse">{status}</p>
           </div>
        )}
        
        {videoUrl ? (
          <div className="relative w-full h-full flex items-center justify-center p-10">
             <video src={videoUrl} controls autoPlay loop className="max-h-full max-w-full rounded shadow-2xl border border-surface-tertiary" />
          </div>
        ) : (
          <div className="text-gray-600 text-center">
            <i className="fas fa-clapperboard text-7xl mb-4 opacity-20"></i>
            <p>Preview Area</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VeoStudio;