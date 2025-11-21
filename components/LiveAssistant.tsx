import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../services/audioUtils';
import { ModelType, AgentProfile } from '../types';

interface LiveAssistantProps {
  active: boolean;
  agent?: AgentProfile;
  onToggle: () => void;
  onCommand: (command: string, args: any) => void;
}

const LiveAssistant: React.FC<LiveAssistantProps> = ({ active, agent, onToggle, onCommand }) => {
  const [connected, setConnected] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [showDashboard, setShowDashboard] = useState(false);
  
  // Device Controls
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);
  const [inputGain, setInputGain] = useState(1.0);
  const [screenSharing, setScreenSharing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputGainNodeRef = useRef<GainNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  
  // Refs for interval closure access
  const cameraMutedRef = useRef(cameraMuted);
  const screenSharingRef = useRef(screenSharing);
  
  // Keep a ref to the latest command handler and agent to avoid stale closures
  const onCommandRef = useRef(onCommand);
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  
  // We track the current agent config to see if we need to reconnect
  const agentRef = useRef(agent);
  useEffect(() => { agentRef.current = agent; }, [agent]);

  // Sync mute/share refs for the interval loop
  useEffect(() => { cameraMutedRef.current = cameraMuted; }, [cameraMuted]);
  useEffect(() => { screenSharingRef.current = screenSharing; }, [screenSharing]);

  // Sync Audio Gain
  useEffect(() => {
    if (inputGainNodeRef.current) {
      // If muted, gain is 0. Otherwise, use the slider value.
      const targetGain = micMuted ? 0 : inputGain;
      // Smooth transition to avoid clicks
      inputGainNodeRef.current.gain.setTargetAtTime(targetGain, audioContextRef.current?.currentTime || 0, 0.1);
    }
  }, [inputGain, micMuted]);

  useEffect(() => {
    let animId: number;
    const animate = () => {
      if (speaking) {
        setVolume(Math.random() * 100);
      } else {
        setVolume(v => Math.max(0, v - 5));
      }
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [speaking]);

  const startSession = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      
      // Ensure context is running (browser autoplay policy)
      if (inputCtx.state === 'suspended') inputCtx.resume();
      if (outputCtx.state === 'suspended') outputCtx.resume();

      // Define tools for Voice Control
      const controlTools = [{
        functionDeclarations: [
          {
            name: "change_view",
            description: "Navigate to a different application view or studio.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                view: {
                  type: Type.STRING,
                  description: "The target view name. Options: 'chat', 'vision', 'veo', 'system'."
                }
              },
              required: ["view"]
            }
          },
          {
            name: "system_action",
            description: "Perform a general system action.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                action: {
                  type: Type.STRING,
                  description: "The action to perform. Options: 'new_chat', 'toggle_sidebar'."
                }
              },
              required: ["action"]
            }
          }
        ]
      }];

      const selectedAgent = agentRef.current;
      const voiceName = selectedAgent?.voiceName || 'Kore';
      const instructions = selectedAgent?.systemInstruction 
          ? `${selectedAgent.systemInstruction}\nYou are part of the Dayugame Desktop environment. You can control the UI via tools.` 
          : "You are Dayugame, a desktop assistant. You can control this app. Use the `change_view` tool when the user wants to switch to Chat, Vision Studio, or Veo Director. Use `system_action` for new chats or UI toggles. Be concise.";

      const sessionPromise = ai.live.connect({
        model: ModelType.LIVE,
        callbacks: {
          onopen: () => {
            setConnected(true);
            // Audio Streaming
            const source = inputCtx.createMediaStreamSource(stream);
            const gainNode = inputCtx.createGain();
            gainNode.gain.value = inputGain; // Set initial gain
            inputGainNodeRef.current = gainNode;

            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              // If gain is 0 (muted), sending silence is fine, or we could just return.
              // The gain node handles the muting effectively, so we just process whatever comes out of it.
              const inputData = e.inputBuffer.getChannelData(0);
              const blob = createPcmBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: blob }));
            };
            
            source.connect(gainNode);
            gainNode.connect(processor);
            processor.connect(inputCtx.destination);

            // Video Streaming (approx 1 FPS)
            setInterval(async () => {
               // If camera is muted AND we are not sharing screen, don't send frames.
               // If we are sharing screen, we send frames even if "Camera Mute" is on (because srcObject is now the screen).
               if (cameraMutedRef.current && !screenSharingRef.current) return; 
               
               let sourceVideo: HTMLVideoElement | null = videoRef.current;
               
               if (canvasRef.current && sourceVideo) {
                 const ctx = canvasRef.current.getContext('2d');
                 canvasRef.current.width = sourceVideo.videoWidth / 4;
                 canvasRef.current.height = sourceVideo.videoHeight / 4;
                 ctx?.drawImage(sourceVideo, 0, 0, canvasRef.current.width, canvasRef.current.height);
                 
                 const base64 = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
                 sessionPromise.then(session => session.sendRealtimeInput({ 
                    media: { mimeType: 'image/jpeg', data: base64 } 
                 }));
               }
            }, 1000);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Function Calls (Voice Control)
            if (msg.toolCall) {
              const functionResponses = [];
              for (const fc of msg.toolCall.functionCalls) {
                console.log(`Executing voice command: ${fc.name}`, fc.args);
                // Execute the command via the latest prop ref
                onCommandRef.current(fc.name, fc.args);
                
                functionResponses.push({
                  id: fc.id,
                  name: fc.name,
                  response: { result: "Command executed successfully." }
                });
              }
              // Send response back to model
              sessionPromise.then(session => 
                session.sendToolResponse({ functionResponses })
              );
            }

            // Handle Audio Response
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setSpeaking(true);
              const ctx = audioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const buffer = await decodeAudioData(base64ToUint8Array(audioData), ctx);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => {
                 sourcesRef.current.delete(source);
                 if (sourcesRef.current.size === 0) setSpeaking(false);
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setSpeaking(false);
            }
          },
          onclose: () => {
            setConnected(false);
            setSpeaking(false);
          },
          onerror: (err) => { console.error(err); setConnected(false); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: controlTools,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
          systemInstruction: instructions
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (e) {
      console.error("Failed to start Live session", e);
    }
  };

  const stopSession = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    setConnected(false);
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      // Stop screen share, revert to camera
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      setScreenSharing(false);
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play();
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        setScreenSharing(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        // Detect when user stops sharing via browser UI
        stream.getVideoTracks()[0].onended = () => {
          toggleScreenShare(); // Revert
        };
      } catch (e) {
        console.error("Screen share cancelled", e);
      }
    }
  };

  useEffect(() => {
    if (active && !connected) startSession();
    else if (!active && connected) stopSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Reconnect if agent changes while active
  useEffect(() => {
     if (active && connected && agent?.id !== agentRef.current?.id) {
         console.log("Agent changed, reconnecting...");
         stopSession();
         setTimeout(() => startSession(), 500);
     }
  }, [agent]);

  if (!active) return null;

  return (
    <div className="absolute bottom-6 right-6 z-50 flex flex-col items-end">
       <video ref={videoRef} className="hidden" muted playsInline />
       <canvas ref={canvasRef} className="hidden" />

       <div className={`bg-surface-secondary border border-surface-tertiary rounded-2xl shadow-2xl p-4 flex flex-col items-center animate-fade-in-up transition-all duration-300 ${showDashboard ? 'w-[400px]' : 'w-72'}`}>
         <div className="flex justify-between w-full mb-4 items-center">
            <span className="text-xs font-bold text-red-400 flex items-center gap-2 uppercase tracking-wider">
               <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Dayugame Omni • Live
            </span>
            <div className="flex gap-2">
               <button onClick={() => setShowDashboard(!showDashboard)} className={`text-gray-400 hover:text-white transition-colors ${showDashboard ? 'text-blue-400' : ''}`}>
                  <i className="fas fa-layer-group"></i>
               </button>
               <button onClick={onToggle} className="text-gray-500 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
         </div>
         
         {/* Visualizer */}
         <div className="w-24 h-24 rounded-full bg-surface-tertiary flex items-center justify-center mb-4 relative overflow-hidden shadow-inner shadow-black/50">
            <div className={`absolute inset-0 bg-gradient-to-tr from-blue-500 to-purple-500 transition-opacity duration-100 rounded-full blur-xl ${speaking ? 'opacity-60' : 'opacity-10'}`} 
                 style={{ transform: `scale(${1 + volume/150})` }}></div>
            <i className={`fas ${agent?.icon || 'fa-microphone'} text-3xl z-10 relative transition-all duration-300 ${speaking ? 'text-white scale-110' : 'text-gray-500'}`}></i>
            
            {/* Screen Share Indicator */}
            {screenSharing && (
               <div className="absolute bottom-2 right-2 bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded border border-black z-20 font-bold tracking-wide">
                 SCREEN
               </div>
            )}
         </div>

         <p className="text-center text-sm text-gray-300 mb-4 font-mono">
           {connected ? (speaking ? "Speaking..." : "Listening...") : "Connecting..."}
         </p>

         {/* Main Controls */}
         <div className="w-full grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center bg-surface-tertiary/30 p-2 rounded-xl border border-surface-tertiary mb-2">
            <button 
              onClick={() => setMicMuted(!micMuted)}
              className={`relative group w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${micMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-surface-secondary hover:bg-gray-600 text-gray-300 border border-surface-tertiary'}`}
            >
               <i className={`fas ${micMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
               <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black border border-surface-tertiary text-xs text-gray-200 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  {micMuted ? "Unmute Mic" : "Mute Mic"}
               </div>
            </button>

            <div className="flex flex-col justify-center px-2">
              <input 
                 type="range" 
                 min="0" max="3" step="0.1"
                 value={inputGain}
                 onChange={(e) => setInputGain(parseFloat(e.target.value))}
                 disabled={micMuted}
                 className="w-full h-1 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
              />
            </div>

            <button 
              onClick={toggleScreenShare}
              className={`relative group w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${screenSharing ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-surface-secondary hover:bg-gray-600 text-gray-300 border border-surface-tertiary'}`}
            >
               <i className="fas fa-desktop"></i>
               <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black border border-surface-tertiary text-xs text-gray-200 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  {screenSharing ? "Stop Sharing" : "Share Screen"}
               </div>
            </button>

            <button 
              onClick={() => setCameraMuted(!cameraMuted)}
              className={`relative group w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${cameraMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-surface-secondary hover:bg-gray-600 text-gray-300 border border-surface-tertiary'}`}
            >
               <i className={`fas ${cameraMuted ? 'fa-video-slash' : 'fa-video'}`}></i>
               <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black border border-surface-tertiary text-xs text-gray-200 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                  {cameraMuted ? "Enable Camera" : "Disable Camera"}
               </div>
            </button>
         </div>

         {/* Capabilities Dashboard */}
         {showDashboard && (
            <div className="w-full mt-2 animate-in fade-in zoom-in-95 duration-200 border-t border-surface-tertiary pt-3">
               <div className="text-[10px] font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <i className="fas fa-microchip"></i> Active Capabilities
               </div>
               <div className="grid grid-cols-2 gap-2">
                  
                  {/* SENSES */}
                  <div className="bg-surface-tertiary/20 rounded-lg p-2 border border-surface-tertiary">
                     <div className="text-[10px] text-blue-400 font-bold mb-1 flex items-center gap-1"><i className="fas fa-eye"></i> Senses (Input)</div>
                     <div className="flex gap-1 flex-wrap">
                        <CapabilityBadge icon="fa-microphone" label="Audio" active={!micMuted} />
                        <CapabilityBadge icon="fa-video" label="Vision" active={!cameraMuted} />
                        <CapabilityBadge icon="fa-desktop" label="Screen" active={screenSharing} />
                     </div>
                  </div>

                  {/* INTELLIGENCE */}
                  <div className="bg-surface-tertiary/20 rounded-lg p-2 border border-surface-tertiary">
                     <div className="text-[10px] text-purple-400 font-bold mb-1 flex items-center gap-1"><i className="fas fa-brain"></i> Brain</div>
                     <div className="flex gap-1 flex-wrap">
                        <CapabilityBadge icon="fa-bolt" label="Gemini 2.5" active={true} />
                        <CapabilityBadge icon="fa-lightbulb" label="Thinking" active={false} />
                     </div>
                  </div>

                  {/* OUTPUT */}
                  <div className="bg-surface-tertiary/20 rounded-lg p-2 border border-surface-tertiary">
                     <div className="text-[10px] text-green-400 font-bold mb-1 flex items-center gap-1"><i className="fas fa-wand-magic-sparkles"></i> Creation</div>
                     <div className="flex gap-1 flex-wrap">
                        <CapabilityBadge icon="fa-image" label="Imagen 3" active={true} />
                        <CapabilityBadge icon="fa-film" label="Veo" active={true} />
                        <CapabilityBadge icon="fa-comments" label="TTS" active={true} />
                     </div>
                  </div>

                  {/* TOOLS */}
                  <div className="bg-surface-tertiary/20 rounded-lg p-2 border border-surface-tertiary">
                     <div className="text-[10px] text-orange-400 font-bold mb-1 flex items-center gap-1"><i className="fas fa-toolbox"></i> Action</div>
                     <div className="flex gap-1 flex-wrap">
                        <CapabilityBadge icon="fa-globe" label="Search" active={true} />
                        <CapabilityBadge icon="fa-map-pin" label="Maps" active={true} />
                        <CapabilityBadge icon="fa-terminal" label="System" active={false} />
                     </div>
                  </div>
               </div>
            </div>
         )}

       </div>
    </div>
  );
};

const CapabilityBadge = ({ icon, label, active }: any) => (
  <div className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${active ? 'bg-surface-secondary border-gray-600 text-gray-200' : 'bg-transparent border-surface-tertiary text-gray-600'}`}>
     <i className={`fas ${icon} ${active ? '' : 'opacity-50'}`}></i> {label}
  </div>
);

export default LiveAssistant;