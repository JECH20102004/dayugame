import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ModelType } from "../types";

// Helper to get API Key from Local Storage or Env
const getApiKey = (): string | undefined => {
  return localStorage.getItem('gemini_api_key') || process.env.API_KEY;
};

// Helper to handle mandatory API key selection for premium/preview models
const ensureApiKey = async () => {
  // If we have a custom key saved, we don't need the AI Studio popup
  if (localStorage.getItem('gemini_api_key')) {
    return;
  }

  const aistudio = (window as any).aistudio;
  if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
    const hasKey = await aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await aistudio.openSelectKey();
    }
  }
};

const getClient = () => new GoogleGenAI({ apiKey: getApiKey() });

/**
 * Text Chat & Reasoning
 */
export const generateText = async (
  prompt: string, 
  model: string = ModelType.FLASH,
  useThinking: boolean = false,
  systemInstruction?: string
): Promise<GenerateContentResponse> => {
  
  // Gemini 3 Pro often requires a selected key in preview environments
  if (model === ModelType.PRO_REASONING) {
    await ensureApiKey();
  }

  const ai = getClient();
  
  const config: any = {
    systemInstruction
  };

  if (useThinking && model === ModelType.PRO_REASONING) {
    config.thinkingConfig = { thinkingBudget: 32768 };
  }

  return await ai.models.generateContent({
    model,
    contents: prompt,
    config
  });
};

/**
 * Search & Maps Grounding
 */
export const generateGroundedContent = async (
  prompt: string,
  useMaps: boolean = false
): Promise<GenerateContentResponse> => {
  const ai = getClient();
  const tools = useMaps ? [{ googleMaps: {} }] : [{ googleSearch: {} }];
  
  const config: any = { tools };
  
  if (useMaps && navigator.geolocation) {
     config.toolConfig = {
        retrievalConfig: {
           latLng: { latitude: 37.7749, longitude: -122.4194 } // Default SF
        }
     }
  }

  return await ai.models.generateContent({
    model: ModelType.FLASH,
    contents: prompt,
    config
  });
};

/**
 * Image Analysis (Video/Image)
 */
export const analyzeVisual = async (
  prompt: string,
  base64Data: string,
  mimeType: string
): Promise<string> => {
  // Gemini 3 Pro is used for analysis
  await ensureApiKey();

  const ai = getClient();
  const response = await ai.models.generateContent({
    model: ModelType.PRO_REASONING, // Using Pro for deep analysis
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: prompt }
      ]
    }
  });
  return response.text || "No analysis generated.";
};

/**
 * Image Generation
 */
export const generateImage = async (
  prompt: string,
  aspectRatio: string = "1:1",
  size: string = "1K"
): Promise<string[]> => {
  // Mandatory check for Pro Image model
  await ensureApiKey();

  const ai = getClient();
  
  const response = await ai.models.generateContent({
    model: ModelType.PRO_IMAGE,
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: size as any
      }
    }
  });

  const images: string[] = [];
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        images.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    }
  }
  return images;
};

/**
 * Image Editing
 */
export const editImage = async (
  prompt: string,
  base64Image: string,
  mimeType: string
): Promise<string | null> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: ModelType.FLASH_IMAGE, // Using Flash Image for editing/inpainting tasks
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Image } },
        { text: prompt }
      ]
    }
  });

  // Find image part
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  return null;
};

/**
 * Veo Video Generation
 */
export const generateVideo = async (
  prompt: string,
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string | null> => {
  // Mandatory check for Veo
  await ensureApiKey();
  
  const ai = getClient();

  let operation = await ai.models.generateVideos({
    model: ModelType.VEO_FAST,
    prompt,
    config: {
      numberOfVideos: 1,
      aspectRatio,
      resolution: '720p'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) return null;

  // Fetch the actual bytes using the key.
  const separator = videoUri.includes('?') ? '&' : '?';
  const response = await fetch(`${videoUri}${separator}key=${getApiKey()}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Text to Speech
 */
export const generateSpeech = async (text: string): Promise<ArrayBuffer | null> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: ModelType.TTS,
    contents: { parts: [{ text }] },
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
     const binaryString = atob(base64Audio);
     const len = binaryString.length;
     const bytes = new Uint8Array(len);
     for (let i = 0; i < len; i++) {
       bytes[i] = binaryString.charCodeAt(i);
     }
     return bytes.buffer;
  }
  return null;
};