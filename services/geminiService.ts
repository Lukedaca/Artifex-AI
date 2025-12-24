
import { GoogleGenAI } from '@google/genai';
import type { AnalysisResult, Language, QualityAssessment } from '../types';
import { fileToBase64, base64ToFile } from '../utils/imageProcessor';

/**
 * Initializes and returns a GoogleGenAI instance.
 * 
 * SECURITY NOTE:
 * In this implementation, we are using a single API key (process.env.API_KEY) for the entire app.
 * Access control is handled by the "Credit System" in the UI layer (App.tsx).
 * 
 * If the user has 0 credits, the UI blocks the call to these functions, ensuring
 * the API is not called unnecessarily.
 * 
 * For maximum security, this logic should eventually move to a backend proxy
 * where the key is never exposed to the client bundle.
 */
const getGenAI = () => {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
        console.error("API Key is missing in environment variables.");
        throw new Error("API_KEY_MISSING");
    }

    return new GoogleGenAI({ apiKey });
};

/**
 * STANDALONE YouTube Thumbnail generator.
 */
export const generateYouTubeThumbnail = async (
    topic: string, 
    textOverlay: string, 
    options: { resolution: '1K' | '2K' | '4K', format: 'jpeg' | 'png' | 'webp' }
): Promise<{ file: File }> => {
    const ai = getGenAI();
    
    const prompt = `Create a ultra-high quality, viral YouTube Thumbnail from scratch. 
    Subject: ${topic}. 
    MANDATORY Text Overlay: "${textOverlay}". 
    Composition: High-contrast, vibrant saturated colors, cinematic rim lighting, 
    optimized for maximum Click-Through Rate (CTR). Typography should be huge, bold, and 3D. 
    Ensure a professional creator aesthetic.`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: { 
            imageConfig: { 
                aspectRatio: "16:9", 
                imageSize: options.resolution 
            } 
        }
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
    if (!imagePart || !imagePart.inlineData) {
        throw new Error('AI Engine failed to render the thumbnail. Please try a different prompt.');
    }
    
    let mimeType = 'image/jpeg';
    let extension = 'jpg';
    if (options.format === 'png') { mimeType = 'image/png'; extension = 'png'; }
    else if (options.format === 'webp') { mimeType = 'image/webp'; extension = 'webp'; }

    return { 
        file: await base64ToFile(
            imagePart.inlineData.data, 
            `yt_thumb_${Date.now()}.${extension}`, 
            mimeType
        ) 
    };
};

export const analyzeImage = async (file: File, language: Language = 'cs'): Promise<AnalysisResult> => {
  const ai = getGenAI();
  const base64Image = await fileToBase64(file);
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: file.type, data: base64Image } },
        { text: `Analyze this photograph. Provide description, suggestions, technical info. Respond in ${language === 'cs' ? 'Czech' : 'English'}.` },
      ],
    },
    config: { responseMimeType: 'application/json' }
  });
  return JSON.parse(response.text) as AnalysisResult;
};

export const autopilotImage = async (file: File): Promise<{ file: File }> => {
    const ai = getGenAI();
    const base64Image = await fileToBase64(file);
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType: file.type } },
                { text: "Enhance this photo professionally focusing on color and dynamic range." },
            ],
        }
    });
    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
    if (!imagePart || !imagePart.inlineData) throw new Error('Autopilot failed.');
    return { file: await base64ToFile(imagePart.inlineData.data, `auto_${file.name}`, imagePart.inlineData.mimeType) };
};

export const generateImage = async (prompt: string): Promise<string> => {
  const ai = getGenAI();
  const response = await ai.models.generateContent({ 
      model: 'gemini-3-pro-image-preview', 
      contents: { parts: [{ text: prompt }] } 
  });
  const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
  if (!imagePart || !imagePart.inlineData) throw new Error('Generation failed.');
  return imagePart.inlineData.data;
};

export const assessQuality = async (file: File): Promise<QualityAssessment> => {
    const ai = getGenAI();
    const base64Image = await fileToBase64(file);
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType: file.type } },
                { text: "Rate photo technical quality 0-100 and give flags like Blurry, Sharp, Noise etc." }
            ]
        },
        config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text) as QualityAssessment;
};
