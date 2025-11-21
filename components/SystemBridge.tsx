import React, { useState, useEffect } from 'react';

const BASE_PYTHON_CODE = `import time
import json
import base64
import threading
import pyautogui
import requests
import speech_recognition as sr
from mss import mss
from pynput.mouse import Controller as MouseController
from pynput.keyboard import Controller as KeyboardController, Key
import subprocess
import keyboard

# -------------------------
# CONFIGURACIÓN
# -------------------------
API_URL = "https://tu-endpoint-de-opal.com/agent"  # Endpoint de tu agente
API_KEY = "TU_API_KEY"  # API Key de Gemini/Opal

CAPTURE_INTERVAL = 3  # Segundos entre capturas automáticas
TRIGGER_KEY = "F12"   # Tecla para captura inmediata

mouse = MouseController()
keyboard_ctrl = KeyboardController()
recognizer = sr.Recognizer()
mic = sr.Microphone()
sct = mss()

# -------------------------
# FUNCIONES
# -------------------------

def capture_fullscreen():
    """Captura toda la pantalla y devuelve en base64"""
    screenshot = sct.grab(sct.monitors[0])
    import PIL.Image
    import io
    img = PIL.Image.frombytes("RGB", (screenshot.width, screenshot.height), screenshot.rgb)
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")

def listen_voice(timeout=3):
    """Convierte voz a texto usando micrófono"""
    with mic as source:
        recognizer.adjust_for_ambient_noise(source)
        try:
            audio = recognizer.listen(source, timeout=timeout)
            text = recognizer.recognize_google(audio, language="es-MX")
            if text.strip():
                print(f"[Voz] {text}")
            return text
        except:
            return ""

def send_to_agent(screen_base64="", voice_text="", user_text=""):
    """Envía datos al agente y recibe respuesta"""
    payload = {
        "screen_image_base64": screen_base64,
        "user_voice_text": voice_text,
        "user_text": user_text
    }
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    try:
        response = requests.post(API_URL, headers=headers, data=json.dumps(payload))
        return response.json()
    except Exception as e:
        print("Error enviando al agente:", e)
        return {}

def execute_actions(agent_response):
    """Ejecuta acciones locales según respuesta del agente"""
    if not agent_response or "actions" not in agent_response:
        return
    for act in agent_response["actions"]:
        tipo = act.get("type")
        params = act.get("params", {})
        try:
            if tipo == "click":
                x, y = params.get("x"), params.get("y")
                mouse.position = (x, y)
                mouse.click(pyautogui.LEFT)
            elif tipo == "keyboard_input":
                text = params.get("text")
                keyboard_ctrl.type(text)
            elif tipo == "press_key":
                key = params.get("key")
                keyboard_ctrl.press(getattr(Key, key))
                keyboard_ctrl.release(getattr(Key, key))
            elif tipo == "open_app":
                path = params.get("path")
                subprocess.Popen(path)
            elif tipo == "run_command":
                command = params.get("command")
                subprocess.Popen(command, shell=True)
        except Exception as e:
            print(f"Error ejecutando acción {tipo}: {e}")

# -------------------------
# HILOS PARA CAPTURA AUTOMÁTICA Y TECLA
# -------------------------
def periodic_capture():
    while True:
        screen_base64 = capture_fullscreen()
        voice_text = listen_voice(timeout=1)
        agent_resp = send_to_agent(screen_base64=screen_base64, voice_text=voice_text)
        execute_actions(agent_resp)
        time.sleep(CAPTURE_INTERVAL)

def trigger_capture():
    while True:
        keyboard.wait(TRIGGER_KEY)
        print("Captura bajo demanda...")
        screen_base64 = capture_fullscreen()
        voice_text = listen_voice(timeout=5)
        agent_resp = send_to_agent(screen_base64=screen_base64, voice_text=voice_text)
        execute_actions(agent_resp)

# -------------------------
# INICIO DEL CLIENTE
# -------------------------
if __name__ == "__main__":
    t1 = threading.Thread(target=periodic_capture, daemon=True)
    t2 = threading.Thread(target=trigger_capture, daemon=True)
    t1.start()
    t2.start()
    print("Cliente Vision + Voice + Actions iniciado. Presiona F12 para captura inmediata.")
    while True:
        time.sleep(1)`;

const SystemBridge: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [userKey, setUserKey] = useState('');
  const [generatedCode, setGeneratedCode] = useState(BASE_PYTHON_CODE);

  useEffect(() => {
    // Auto-load key if available
    const stored = localStorage.getItem('gemini_api_key');
    if (stored) setUserKey(stored);
  }, []);

  useEffect(() => {
    if (userKey.trim()) {
      setGeneratedCode(BASE_PYTHON_CODE.replace('API_KEY = "TU_API_KEY"', `API_KEY = "${userKey}"`));
    } else {
      setGeneratedCode(BASE_PYTHON_CODE);
    }
  }, [userKey]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserKey(val);
    if (val) localStorage.setItem('gemini_api_key', val);
  };

  return (
    <div className="h-full bg-surface flex flex-col overflow-hidden">
      <div className="p-8 pb-0">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-surface-secondary rounded-xl flex items-center justify-center border border-surface-tertiary shadow-lg">
            <i className="fas fa-network-wired text-green-400 text-xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Dayugame Native Bridge</h1>
            <p className="text-gray-400">Connect your web OS to your physical computer automation.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 grid grid-cols-[1fr_350px] gap-8">
        {/* Left: Setup Guide & Code */}
        <div className="space-y-6">
          <div className="bg-surface-secondary border border-surface-tertiary rounded-xl p-6">
             <div className="flex justify-between items-start mb-4">
               <h2 className="text-lg font-bold text-white flex items-center gap-2">
                 <i className="fas fa-terminal text-gray-400"></i> Python Client Script
               </h2>
               <div className="w-1/3">
                 <input 
                   type="password" 
                   placeholder="Paste API Key here to update code..." 
                   value={userKey}
                   onChange={handleSaveKey}
                   className="w-full bg-black/30 border border-surface-tertiary rounded px-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                 />
               </div>
             </div>

             <p className="text-sm text-gray-300 mb-4 leading-relaxed">
               Since web browsers cannot directly control your mouse, keyboard, or execute shell commands for security reasons, 
               Dayugame uses a local Python bridge. Run this script on your machine to enable 
               <span className="text-blue-400 font-mono mx-1">Vision + Voice + Actions</span>.
             </p>
             
             <div className="relative bg-black/50 border border-surface-tertiary rounded-lg overflow-hidden">
                <div className="flex justify-between items-center px-4 py-2 bg-surface-tertiary/30 border-b border-surface-tertiary">
                   <span className="text-xs font-mono text-gray-400">agent.py</span>
                   <button 
                     onClick={handleCopy}
                     className="text-xs flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                   >
                     <i className={`fas ${copied ? 'fa-check text-green-400' : 'fa-copy'}`}></i>
                     {copied ? 'Copied' : 'Copy Code'}
                   </button>
                </div>
                <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto h-96 custom-scrollbar">
                  <code>{generatedCode}</code>
                </pre>
             </div>
          </div>

          <div className="bg-surface-secondary border border-surface-tertiary rounded-xl p-6">
            <h3 className="text-md font-bold text-white mb-3">Installation Requirements</h3>
            <div className="bg-black/30 rounded p-3 font-mono text-xs text-green-400 border border-surface-tertiary">
               pip install pyautogui mss speech_recognition pynput keyboard requests
            </div>
          </div>
        </div>

        {/* Right: Status & Info */}
        <div className="flex flex-col gap-6">
           <div className="bg-surface-secondary border border-surface-tertiary rounded-xl p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-surface-tertiary/30 flex items-center justify-center mb-4 relative">
                 <i className="fas fa-link text-2xl text-gray-500"></i>
                 <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-surface-secondary"></div>
              </div>
              <h3 className="text-white font-bold mb-1">Bridge Status</h3>
              <p className="text-gray-500 text-sm mb-4">Disconnected</p>
              <button className="w-full py-2 bg-surface-tertiary hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors">
                Check Connection
              </button>
           </div>

           <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-6">
             <h3 className="text-blue-400 font-bold mb-2 text-sm"><i className="fas fa-info-circle mr-2"></i> How it works</h3>
             <ul className="text-xs text-gray-300 space-y-3">
               <li className="flex gap-2">
                 <span className="font-bold">1.</span>
                 <span>The Python script captures your screen every 3 seconds.</span>
               </li>
               <li className="flex gap-2">
                 <span className="font-bold">2.</span>
                 <span>It listens to your microphone locally using SpeechRecognition.</span>
               </li>
               <li className="flex gap-2">
                 <span className="font-bold">3.</span>
                 <span>It sends data to the Agent Endpoint (which this web app would provide).</span>
               </li>
               <li className="flex gap-2">
                 <span className="font-bold">4.</span>
                 <span>If the Agent replies with actions (click, type), the script executes them via PyAutoGUI.</span>
               </li>
             </ul>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SystemBridge;