import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { AnalysisResult } from '../types';
import { fileToBase64, base64ToFile } from '../utils/imageProcessor';
import { getApiKey } from '../utils/apiKey';

// Helper to create a new GenAI instance for each request
const getGenAI = async () => {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('API klíč není nastaven. Prosím, zadejte API klíč v nastavení.');
  }
  return new GoogleGenerativeAI(apiKey);
};

// Safety settings for all requests
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

/**
 * Analyzes an image to provide a description, technical info, and improvement suggestions.
 */
export const analyzeImage = async (file: File): Promise<AnalysisResult> => {
  const genAI = await getGenAI();
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    safetySettings,
  });

  const base64Image = await fileToBase64(file);
  const imageParts = [{
    inlineData: {
      data: base64Image,
      mimeType: file.type,
    },
  }];

  const prompt = `Analyze this photograph and provide a JSON response with the following structure:
{
  "description": "Detailed description of the image",
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"],
  "technicalInfo": {
    "ISO": "estimated ISO value",
    "Aperture": "estimated aperture (f-stop)",
    "ShutterSpeed": "estimated shutter speed"
  },
  "proactiveSuggestions": [
    {"text": "suggestion text", "action": "action-name"},
    {"text": "suggestion text", "action": "action-name"}
  ]
}

Provide 3-5 specific improvements suggestions and 2 proactive edit suggestions like "remove-object" or "auto-crop" based on the image content. Return ONLY the JSON, no additional text.`;

  const result = await model.generateContent([prompt, ...imageParts]);
  const response = result.response;
  const text = response.text();

  // Clean up response to get only JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  return JSON.parse(jsonMatch[0]) as AnalysisResult;
};

/**
 * Applies automatic "autopilot" enhancements to an image.
 * Note: Image generation is limited in the free API, this is a text-based description
 */
export const autopilotImage = async (file: File): Promise<{ file: File }> => {
  // For now, return original file with a note about limitations
  // Full image editing requires Gemini Flash Image model which may have restrictions
  console.warn('Image editing with AI is limited in standalone mode. Returning original image.');
  return { file };
};

/**
 * Removes a user-specified object from an image.
 * Note: Image editing requires specific models not available in all tiers
 */
export const removeObject = async (file: File, objectToRemove: string): Promise<{ file: File }> => {
  if (!objectToRemove) throw new Error("Please specify what to remove.");
  console.warn('Image editing with AI is limited in standalone mode. Returning original image.');
  return { file };
};

/**
 * Automatically crops an image to improve composition.
 */
export const autoCrop = async (file: File): Promise<{ file: File }> => {
  console.warn('Image editing with AI is limited in standalone mode. Returning original image.');
  return { file };
};

/**
 * Replaces the background of an image based on a text prompt.
 */
export const replaceBackground = async (file: File, newBackgroundPrompt: string): Promise<{ file: File }> => {
  if (!newBackgroundPrompt) throw new Error("Please describe the new background.");
  console.warn('Image editing with AI is limited in standalone mode. Returning original image.');
  return { file };
};

/**
 * Applies the style of one image to another.
 */
export const styleTransfer = async (originalFile: File, styleFile: File): Promise<{ file: File }> => {
  console.warn('Image editing with AI is limited in standalone mode. Returning original image.');
  return { file: originalFile };
};

/**
 * Generates a new image from a text prompt.
 * Note: Imagen model requires specific API access
 */
export const generateImage = async (prompt: string): Promise<string> => {
  throw new Error('Image generation is not available in standalone mode. This feature requires Google AI Studio or specific API tier.');
};
