import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { AnalysisResult } from '../types';
import { fileToBase64, base64ToFile } from '../utils/imageProcessor';
import { getApiKey } from '../utils/apiKey';
import {
  applyAutoEnhancements,
  smartCrop,
  removeBackground,
  replaceBackgroundColor,
} from '../utils/imageAIProcessor';

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
 * Uses client-side AI to enhance brightness, contrast, saturation, and sharpness.
 */
export const autopilotImage = async (file: File): Promise<{ file: File }> => {
  try {
    const enhancedFile = await applyAutoEnhancements(file);
    return { file: enhancedFile };
  } catch (error) {
    console.error('Failed to apply auto enhancements:', error);
    throw new Error('Nepodařilo se automaticky vylepšit obrázek.');
  }
};

/**
 * Removes a user-specified object from an image.
 * Uses TensorFlow.js Body-Pix to remove background (person segmentation).
 * Note: Currently only supports removing background. Specific object removal requires more advanced models.
 */
export const removeObject = async (file: File, objectToRemove: string): Promise<{ file: File }> => {
  if (!objectToRemove) throw new Error("Prosím, specifikujte co chcete odstranit.");

  // For now, we only support background removal
  if (objectToRemove.toLowerCase().includes('background') || objectToRemove.toLowerCase().includes('pozadí')) {
    try {
      const resultFile = await removeBackground(file);
      return { file: resultFile };
    } catch (error) {
      console.error('Failed to remove background:', error);
      throw new Error('Nepodařilo se odstranit pozadí.');
    }
  }

  throw new Error('Odstranění konkrétních objektů vyžaduje pokročilejší AI. Zkuste "remove background" nebo "odstranit pozadí".');
};

/**
 * Automatically crops an image to improve composition.
 * Uses edge detection to find the main subject and crops accordingly.
 */
export const autoCrop = async (file: File): Promise<{ file: File }> => {
  try {
    const croppedFile = await smartCrop(file);
    return { file: croppedFile };
  } catch (error) {
    console.error('Failed to auto crop:', error);
    throw new Error('Nepodařilo se automaticky oříznout obrázek.');
  }
};

/**
 * Replaces the background of an image based on a text prompt.
 * Uses TensorFlow.js Body-Pix for segmentation and replaces background with solid color.
 * Note: Text-to-image background generation requires external API. Currently supports solid colors only.
 */
export const replaceBackground = async (file: File, newBackgroundPrompt: string): Promise<{ file: File }> => {
  if (!newBackgroundPrompt) throw new Error("Prosím, popište nové pozadí.");

  // Parse simple color names or hex codes from prompt
  let backgroundColor = '#ffffff'; // default white
  const lowerPrompt = newBackgroundPrompt.toLowerCase();

  if (lowerPrompt.includes('white') || lowerPrompt.includes('bílá')) backgroundColor = '#ffffff';
  else if (lowerPrompt.includes('black') || lowerPrompt.includes('černá')) backgroundColor = '#000000';
  else if (lowerPrompt.includes('red') || lowerPrompt.includes('červená')) backgroundColor = '#ff0000';
  else if (lowerPrompt.includes('blue') || lowerPrompt.includes('modrá')) backgroundColor = '#0000ff';
  else if (lowerPrompt.includes('green') || lowerPrompt.includes('zelená')) backgroundColor = '#00ff00';
  else if (lowerPrompt.includes('yellow') || lowerPrompt.includes('žlutá')) backgroundColor = '#ffff00';
  else if (lowerPrompt.includes('gray') || lowerPrompt.includes('grey') || lowerPrompt.includes('šedá')) backgroundColor = '#808080';
  else if (lowerPrompt.match(/#[0-9a-f]{6}/i)) {
    const match = lowerPrompt.match(/#[0-9a-f]{6}/i);
    if (match) backgroundColor = match[0];
  }

  try {
    const resultFile = await replaceBackgroundColor(file, backgroundColor);
    return { file: resultFile };
  } catch (error) {
    console.error('Failed to replace background:', error);
    throw new Error('Nepodařilo se nahradit pozadí.');
  }
};

/**
 * Applies the style of one image to another.
 * Note: Style transfer requires complex neural networks (like Neural Style Transfer).
 * This feature is not currently available in standalone mode.
 */
export const styleTransfer = async (originalFile: File, styleFile: File): Promise<{ file: File }> => {
  throw new Error('Style transfer vyžaduje pokročilé neuronové sítě a není momentálně dostupný v standalone režimu. Tato funkce bude přidána v budoucí verzi.');
};

/**
 * Generates a new image from a text prompt.
 * Note: Image generation requires Imagen API or similar service which is not available in standalone mode.
 * Consider using external services like Stable Diffusion, DALL-E, or Midjourney for this feature.
 */
export const generateImage = async (prompt: string): Promise<string> => {
  throw new Error('Generování obrázků není dostupné v standalone režimu. Tato funkce vyžaduje externí API službu (např. Stable Diffusion, DALL-E). Pro přidání této funkce kontaktujte vývojáře.');
};
