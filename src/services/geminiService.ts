// Fully offline AI image processing service
// All processing runs in the browser using TensorFlow.js

import type { AnalysisResult } from '../types';
import * as tfImageService from './tfImageService';
import * as mobilenet from '@tensorflow-models/mobilenet';

let mobileNetModel: mobilenet.MobileNet | null = null;

/**
 * Load MobileNet model for image classification
 */
async function loadMobileNetModel(): Promise<mobilenet.MobileNet> {
  if (!mobileNetModel) {
    console.log('Loading MobileNet model for image analysis...');
    mobileNetModel = await mobilenet.load({
      version: 2,
      alpha: 1.0,
    });
    console.log('MobileNet model loaded!');
  }
  return mobileNetModel;
}

/**
 * Analyzes an image using TensorFlow.js MobileNet model
 * Provides object detection and intelligent suggestions - fully offline!
 */
export const analyzeImage = async (file: File): Promise<AnalysisResult> => {
  const model = await loadMobileNetModel();

  // Load image
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise((resolve) => { img.onload = resolve; });

  // Classify image
  const predictions = await model.classify(img);
  URL.revokeObjectURL(img.src);

  // Build description from top predictions
  const topPredictions = predictions.slice(0, 3);
  const detectedObjects = topPredictions.map(p => p.className.toLowerCase()).join(', ');

  const description = `Fotografie obsahuje: ${detectedObjects}. ` +
    `Hlavní objekt: ${predictions[0].className} (${(predictions[0].probability * 100).toFixed(1)}% jistota).`;

  // Analyze image properties
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Calculate average brightness
  let totalBrightness = 0;
  let totalSaturation = 0;
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    totalBrightness += brightness;

    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    const saturation = max === 0 ? 0 : ((max - min) / max) * 100;
    totalSaturation += saturation;
  }
  const avgBrightness = totalBrightness / (data.length / 4);
  const avgSaturation = totalSaturation / (data.length / 4);

  // Generate intelligent suggestions based on analysis
  const suggestions: string[] = [];

  if (avgBrightness < 100) {
    suggestions.push('Zvýšit jas - fotografie je poměrně tmavá');
  } else if (avgBrightness > 180) {
    suggestions.push('Snížit expozici - fotografie je přeexponovaná');
  }

  if (avgSaturation < 20) {
    suggestions.push('Zvýšit saturaci barev pro živější vzhled');
  } else if (avgSaturation > 70) {
    suggestions.push('Mírně snížit saturaci pro přirozenější barvy');
  }

  suggestions.push('Použít AI Autopilot pro automatické vylepšení');
  suggestions.push('Experimentovat s odstraněním pozadí pro čistší kompozici');

  // Add suggestions based on detected content
  if (detectedObjects.includes('person') || detectedObjects.includes('face')) {
    suggestions.push('Zkuste odstranit pozadí pro profesionální portrét');
  }

  // Estimate technical info (simplified without EXIF)
  const technicalInfo = {
    ISO: avgBrightness < 128 ? 'Odhad: 800-1600' : 'Odhad: 100-400',
    Aperture: 'Odhad: f/2.8-f/5.6',
    ShutterSpeed: avgBrightness < 128 ? 'Odhad: 1/60s' : 'Odhad: 1/250s'
  };

  // Proactive suggestions
  const proactiveSuggestions = [
    {
      text: 'Automatické vylepšení osvětlení a barev',
      action: 'autopilot'
    },
    {
      text: 'Odstranit pozadí pro čistší vzhled',
      action: 'remove-background'
    }
  ];

  return {
    description,
    suggestions,
    technicalInfo,
    proactiveSuggestions
  };
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
 * Note: This feature is not available in offline mode.
 */
export const generateImage = async (prompt: string): Promise<string> => {
  throw new Error('Generování obrázků není dostupné v offline režimu. Použijte AI Autopilot pro vylepšení existujících fotek.');
};
