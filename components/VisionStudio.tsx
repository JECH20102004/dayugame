import React, { useState, useRef } from 'react';
import { generateImage, editImage, analyzeVisual } from '../services/geminiService';

const VisionStudio: React.FC = () => {
  const [mode, setMode] = useState<'GENERATE' | 'EDIT' | 'ANALYZE'>('GENERATE');
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null); // Base64
  const [output, setOutput] = useState<string | null>(null); // Base64 or Text
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const execute = async () => {
    if (!prompt) return;
    setLoading(true);
    setOutput(null);
    
    try {
      if (mode === 'GENERATE') {
        const imgs = await generateImage(prompt, "1:1", "1K");
        if (imgs.length > 0) setOutput(imgs[0]);
      } else if (mode === 'EDIT') {
        if (!image) return;
        const base64 = image.split(',')[1];
        const mime = image.split(';')[0].split(':')[1];
        const result = await editImage(prompt, base64, mime);
        if (result) setOutput(result);
      } else if (mode === 'ANALYZE') {
        if (!image) return;
        const base64 = image.split(',')[1];
        const mime = image.split(';')[0].split(':')[1];
        const text = await analyzeVisual(prompt, base64, mime);
        setOutput(text);
      }
    } catch (e) {
      alert("Operation failed: " + (e as any).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-surface">
      {/* Config Panel */}
      <div className="w-72 border-r border-surface-tertiary p-5 flex flex-col gap-6 overflow-y-auto bg-surface-secondary/30">
        <div>
          <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Operation</h3>
          <div className="space-y-1">
            {['GENERATE', 'EDIT', 'ANALYZE'].map(m => (
              <button 
                key={m}
                onClick={() => { setMode(m as any); setOutput(null); }}
                className={`w-full p-2 text-left rounded-md text-sm font-medium transition-all flex items-center justify-between ${mode === m ? 'bg-white text-black shadow-md' : 'text-gray-400 hover:bg-surface-tertiary hover:text-gray-200'}`}
              >
                {m} <i className={`fas ${m === 'GENERATE' ? 'fa-magic' : m === 'EDIT' ? 'fa-wand-magic-sparkles' : 'fa-eye'}`}></i>
              </button>
            ))}
          </div>
        </div>

        {(mode === 'EDIT' || mode === 'ANALYZE') && (
          <div 
             className="aspect-square border-2 border-dashed border-surface-tertiary rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-surface-tertiary/50 transition-colors relative overflow-hidden"
             onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
            {image ? (
              <img src={image} alt="Input" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
               <>
                 <i className="fas fa-cloud-arrow-up text-2xl text-gray-500 mb-2"></i>
                 <span className="text-xs text-gray-500">Upload Source</span>
               </>
            )}
          </div>
        )}

        <div className="flex-1">
           <label className="text-xs font-bold text-gray-500 mb-2 block">Prompt</label>
           <textarea 
             value={prompt}
             onChange={e => setPrompt(e.target.value)}
             className="w-full bg-surface-tertiary/30 border border-surface-tertiary rounded-lg p-3 text-sm h-40 focus:border-gray-500 focus:outline-none text-gray-200 resize-none"
             placeholder={mode === 'ANALYZE' ? "Ask about the image..." : "Describe your vision..."}
           />
        </div>

        <button 
          onClick={execute}
          disabled={loading}
          className="w-full py-3 bg-white text-black font-bold rounded-lg shadow hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {loading ? <i className="fas fa-circle-notch fa-spin"></i> : 'Execute'}
        </button>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 p-8 flex items-center justify-center bg-surface relative">
         <div className="absolute inset-0 opacity-5 pointer-events-none" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px'}}></div>
         
         {output ? (
           mode === 'ANALYZE' ? (
             <div className="bg-surface-secondary p-6 rounded-xl border border-surface-tertiary max-w-2xl overflow-auto max-h-full text-gray-300 shadow-2xl">
               <div className="flex items-center gap-2 mb-4 text-sm font-bold text-gray-500 uppercase border-b border-surface-tertiary pb-2">
                 <i className="fas fa-align-left"></i> Analysis
               </div>
               <p className="whitespace-pre-wrap leading-relaxed">{output}</p>
             </div>
           ) : (
             <div className="relative group max-w-full max-h-full flex justify-center">
               <img src={output} alt="Result" className="max-h-[80vh] rounded-lg shadow-2xl border border-surface-tertiary" />
               <a href={output} download="nexus-gen.png" className="absolute bottom-4 right-4 bg-black/80 text-white p-3 rounded-full hover:bg-white hover:text-black transition-colors shadow-lg backdrop-blur">
                 <i className="fas fa-download"></i>
               </a>
             </div>
           )
         ) : (
           <div className="text-center opacity-20">
              <i className="fas fa-image text-6xl mb-4 text-gray-500"></i>
              <p className="text-lg font-medium text-gray-500">Studio Ready</p>
           </div>
         )}
      </div>
    </div>
  );
};

export default VisionStudio;