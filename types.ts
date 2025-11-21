export enum ViewType {
  CHAT = 'CHAT',
  VISION = 'VISION',
  VEO = 'VEO',
  SYSTEM = 'SYSTEM',
  LIBRARY = 'LIBRARY'
}

export enum ModelType {
  // Text/Chat
  FLASH = 'gemini-2.5-flash',
  FLASH_LITE = 'gemini-2.5-flash-lite-latest',
  PRO_REASONING = 'gemini-3-pro-preview',
  
  // Vision/Image
  FLASH_IMAGE = 'gemini-2.5-flash-image',
  PRO_IMAGE = 'gemini-3-pro-image-preview',
  
  // Video
  VEO_FAST = 'veo-3.1-fast-generate-preview',
  VEO_GENERATE = 'veo-3.1-generate-preview',
  
  // Audio
  TTS = 'gemini-2.5-flash-preview-tts',
  LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025'
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
  image?: string; // base64
  timestamp: number;
  isThinking?: boolean;
  groundingMetadata?: any;
}

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  icon: string;
}