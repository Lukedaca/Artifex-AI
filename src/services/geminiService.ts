import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { AnalysisResult } from '../types';
import { fileToBase64 } from '../utils/imageProcessor';
import { getApiKey } from '../utils/apiKey';
import * as tfImageService from './tfImageService';

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
 * Uses Google Gemini AI for intelligent image analysis.
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

Provide 3-5 specific improvements suggestions and 2 proactive edit suggestions like "remove-background" or "auto-crop" based on the image content. Return ONLY the JSON, no additional text.`;

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
 * Uses TensorFlow.js running in the browser for offline processing.
 */
export const autopilotImage = async (file: File): Promise<{ file: File }> => {
  return tfImageService.autopilotImage(file);
};

/**
 * Removes background from an image using TensorFlow.js BodyPix model.
 * This function removes the background and makes it transparent.
 */
export const removeObject = async (file: File, objectToRemove: string): Promise<{ file: File }> => {
  // For now, we use background removal as a proxy for object removal
  // In future, could implement more sophisticated inpainting
  if (objectToRemove && objectToRemove.toLowerCase().includes('background')) {
    return tfImageService.removeBackground(file);
  }
  // Fallback to background removal for other objects
  return tfImageService.removeBackground(file);
};

/**
 * Automatically crops an image to improve composition.
 * Uses TensorFlow.js to detect the main subject and crop accordingly.
 */
export const autoCrop = async (file: File): Promise<{ file: File }> => {
  return tfImageService.autoCrop(file);
};

/**
 * Replaces the background of an image.
 * Uses TensorFlow.js for segmentation and background replacement.
 */
export const replaceBackground = async (file: File, newBackgroundPrompt: string): Promise<{ file: File }> => {
  if (!newBackgroundPrompt) throw new Error("Please describe the new background.");

  // Parse color from prompt (simple implementation)
  let backgroundColor = '#ffffff'; // default white
  if (newBackgroundPrompt.toLowerCase().includes('black')) backgroundColor = '#000000';
  else if (newBackgroundPrompt.toLowerCase().includes('red')) backgroundColor = '#ff0000';
  else if (newBackgroundPrompt.toLowerCase().includes('blue')) backgroundColor = '#0000ff';
  else if (newBackgroundPrompt.toLowerCase().includes('green')) backgroundColor = '#00ff00';
  else if (newBackgroundPrompt.toLowerCase().includes('yellow')) backgroundColor = '#ffff00';

  return tfImageService.replaceBackground(file, backgroundColor);
};

/**
 * Applies the style of one image to another.
 * Uses TensorFlow.js for color-based style transfer.
 */
export const styleTransfer = async (originalFile: File, styleFile: File): Promise<{ file: File }> => {
  return tfImageService.styleTransfer(originalFile, styleFile);
};

/**
 * Generates a new image from a text prompt.
 * Note: This feature is not available in standalone mode.
 */
export const generateImage = async (prompt: string): Promise<string> => {
  throw new Error('Generování obrázků není dostupné v offline režimu. Tato funkce vyžaduje externí API.');
};
