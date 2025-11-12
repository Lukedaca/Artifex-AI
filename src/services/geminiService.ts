// Google Gemini AI service for premium image processing
// Uses Gemini 2.0 Flash for state-of-the-art AI capabilities

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AnalysisResult } from '../types';
import { getApiKey } from '../utils/apiKey';

/**
 * Get configured Gemini AI instance
 */
const getGenAI = async () => {
  const apiKey = await getApiKey();
  return new GoogleGenerativeAI(apiKey);
};

/**
 * List all available models for debugging
 */
export const listAvailableModels = async () => {
  try {
    const genAI = await getGenAI();
    const models = await genAI.listModels();
    console.log('🔍 Available Gemini models with your API key:');
    models.forEach(model => {
      console.log(`   - ${model.name} (supports: ${model.supportedGenerationMethods.join(', ')})`);
    });
    return models;
  } catch (error) {
    console.error('❌ Error listing models:', error);
    throw error;
  }
};

/**
 * Convert File to base64 for Gemini API
 */
async function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Analyzes an image using Gemini Vision AI
 * Provides detailed description, intelligent suggestions, and technical insights
 */
export const analyzeImage = async (file: File): Promise<AnalysisResult> => {
  try {
    // First, list available models for debugging
    console.log('🔍 Checking available models...');
    await listAvailableModels();

    const genAI = await getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const imagePart = await fileToGenerativePart(file);

    const prompt = `Analyze this photograph and provide a detailed analysis in Czech language.

You must respond in EXACTLY this format:

POPIS: [detailed description of what is in the photo - main objects, scene, atmosphere, colors, composition]
NÁVRHY:
- [specific actionable tip 1 for improvement - lighting, colors, composition, crop, etc.]
- [specific actionable tip 2 for improvement]
- [specific actionable tip 3 for improvement]
TECHNICKÉ:
- ISO: [estimate]
- Clona: [estimate]
- Závěrka: [estimate]

Important: Use Czech language for all content. Be specific and actionable in suggestions.`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const text = response.text();

    // Debug logging
    console.log('🤖 Gemini AI Analysis Response:', text);

    // Parse response
    const descMatch = text.match(/POPIS:([\s\S]*?)(?=NÁVRHY:|$)/i);
    const suggestionsMatch = text.match(/NÁVRHY:([\s\S]*?)(?=TECHNICKÉ:|$)/i);
    const technicalMatch = text.match(/TECHNICKÉ:([\s\S]*?)$/i);

    const description = descMatch ? descMatch[1].trim() : text.substring(0, 200);

    const suggestions: string[] = [];
    if (suggestionsMatch) {
      const suggestionText = suggestionsMatch[1].trim();
      const lines = suggestionText.split('\n').filter(l => l.trim().startsWith('-'));
      lines.forEach(line => {
        const cleaned = line.replace(/^-\s*/, '').trim();
        if (cleaned) suggestions.push(cleaned);
      });
    }

    const technicalInfo: Record<string, string> = {};
    if (technicalMatch) {
      const techText = technicalMatch[1].trim();
      const lines = techText.split('\n').filter(l => l.includes(':'));
      lines.forEach(line => {
        const [key, value] = line.split(':').map(s => s.trim());
        if (key && value) {
          const cleanKey = key.replace(/^-\s*/, '');
          technicalInfo[cleanKey] = value;
        }
      });
    }

    // Proactive suggestions
    const proactiveSuggestions = [
      {
        text: 'Použít AI Autopilot pro automatické vylepšení',
        action: 'autopilot'
      },
      {
        text: 'Inteligentní auto-crop pro lepší kompozici',
        action: 'auto-crop'
      }
    ];

    return {
      description,
      suggestions: suggestions.length > 0 ? suggestions : ['Použijte AI Autopilot pro vylepšení', 'Zkuste auto-crop', 'Experimentujte s manuálními úpravami'],
      technicalInfo: Object.keys(technicalInfo).length > 0 ? technicalInfo : { ISO: 'Neznámé', Aperture: 'Neznámé', ShutterSpeed: 'Neznámé' },
      proactiveSuggestions
    };
  } catch (error) {
    console.error('Error analyzing image with Gemini:', error);
    throw new Error(`Chyba při analýze obrázku: ${error instanceof Error ? error.message : 'Neznámá chyba'}. Zkontrolujte prosím váš API klíč.`);
  }
};

/**
 * Applies AI-guided automatic enhancements to an image
 * Uses Gemini to analyze the image and determine optimal adjustments
 */
export const autopilotImage = async (file: File): Promise<{ file: File }> => {
  try {
    const genAI = await getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const imagePart = await fileToGenerativePart(file);

    const prompt = `You are an image enhancement AI. Analyze this photograph and suggest specific numerical adjustment values.

Output format (STRICT - no additional text):
BRIGHTNESS: <number>
CONTRAST: <number>
SATURATION: <number>
WARMTH: <number>

Rules:
- Numbers must be between -100 and 100
- Negative = decrease, Positive = increase, 0 = no change
- Be reasonable with adjustments (typically -50 to +50 range)

Example output:
BRIGHTNESS: 15
CONTRAST: 10
SATURATION: 8
WARMTH: -5

Analyze the image and provide adjustments:`;

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();

    // Debug logging
    console.log('🤖 Gemini Autopilot Response:', text);

    // Parse adjustment values with fallback
    const brightness = parseFloat(text.match(/BRIGHTNESS:\s*([-\d.]+)/i)?.[1] || '0');
    const contrast = parseFloat(text.match(/CONTRAST:\s*([-\d.]+)/i)?.[1] || '0');
    const saturation = parseFloat(text.match(/SATURATION:\s*([-\d.]+)/i)?.[1] || '0');
    const warmth = parseFloat(text.match(/WARMTH:\s*([-\d.]+)/i)?.[1] || '0');

    // Debug parsed values
    console.log('📊 Parsed adjustment values:', { brightness, contrast, saturation, warmth });

    // Validate that we got at least some non-zero values
    if (brightness === 0 && contrast === 0 && saturation === 0 && warmth === 0) {
      console.warn('⚠️ All adjustment values are 0 - Gemini response format might be incorrect');
      throw new Error('Gemini AI nevrátil platné hodnoty úprav. Odpověď AI byla v neočekávaném formátu. Zkuste to prosím znovu.');
    }

    // Apply adjustments using Canvas API
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((resolve) => { img.onload = resolve; });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Apply adjustments
    const brightnessFactor = 1 + (brightness / 100);
    const contrastFactor = 1 + (contrast / 100);
    const saturationFactor = 1 + (saturation / 100);
    const warmthFactor = warmth / 100;

    for (let i = 0; i < data.length; i += 4) {
      // Apply contrast (around midpoint 128)
      let r = ((data[i] - 128) * contrastFactor + 128) * brightnessFactor;
      let g = ((data[i + 1] - 128) * contrastFactor + 128) * brightnessFactor;
      let b = ((data[i + 2] - 128) * contrastFactor + 128) * brightnessFactor;

      // Apply saturation
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * saturationFactor;
      g = gray + (g - gray) * saturationFactor;
      b = gray + (b - gray) * saturationFactor;

      // Apply warmth (more red/yellow for warm, more blue for cool)
      r += warmthFactor * 20;
      b -= warmthFactor * 20;

      // Clamp values
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imageData, 0, 0);

    const enhancedFile = await new Promise<File>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        resolve(new File([blob], `enhanced_${file.name}`, { type: 'image/png' }));
      }, 'image/png');
    });

    URL.revokeObjectURL(img.src);
    return { file: enhancedFile };
  } catch (error) {
    console.error('Error in autopilot:', error);
    throw new Error(`Chyba při automatickém vylepšení: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
  }
};

/**
 * Automatically crops an image to improve composition
 * Uses Gemini to analyze composition and suggest optimal crop
 */
export const autoCrop = async (file: File): Promise<{ file: File }> => {
  try {
    const genAI = await getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const imagePart = await fileToGenerativePart(file);

    const prompt = `You are an image composition AI. Analyze this photograph and suggest optimal crop for better composition using rule of thirds and subject positioning.

Output format (STRICT - no additional text):
CROP: <left> <top> <width> <height>

Where:
- left = left edge in percentage (0-100)
- top = top edge in percentage (0-100)
- width = width in percentage (1-100)
- height = height in percentage (1-100)

Example output:
CROP: 10 5 80 90

This means: crop starting at 10% from left, 5% from top, with 80% width and 90% height.

Analyze the image and provide optimal crop values:`;

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();

    // Debug logging
    console.log('🤖 Gemini Auto Crop Response:', text);

    // Parse crop values
    const match = text.match(/CROP:\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);

    let left = 10, top = 10, width = 80, height = 80; // defaults

    console.log('📊 Crop match result:', match);
    if (match) {
      left = Math.max(0, Math.min(100, parseFloat(match[1])));
      top = Math.max(0, Math.min(100, parseFloat(match[2])));
      width = Math.max(1, Math.min(100 - left, parseFloat(match[3])));
      height = Math.max(1, Math.min(100 - top, parseFloat(match[4])));
    }

    // Apply crop
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((resolve) => { img.onload = resolve; });

    const cropX = (left / 100) * img.width;
    const cropY = (top / 100) * img.height;
    const cropWidth = (width / 100) * img.width;
    const cropHeight = (height / 100) * img.height;

    const canvas = document.createElement('canvas');
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    const croppedFile = await new Promise<File>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        resolve(new File([blob], `cropped_${file.name}`, { type: 'image/png' }));
      }, 'image/png');
    });

    URL.revokeObjectURL(img.src);
    return { file: croppedFile };
  } catch (error) {
    console.error('Error in auto crop:', error);
    throw new Error(`Chyba při automatickém ořezu: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
  }
};

/**
 * Removes an object from the image
 * Note: Gemini doesn't support true inpainting yet, this provides guidance
 */
export const removeObject = async (file: File, objectToRemove: string): Promise<{ file: File }> => {
  try {
    const genAI = await getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const imagePart = await fileToGenerativePart(file);

    const prompt = `Na této fotografii chci odstranit: "${objectToRemove}"

Identifikuj přesnou pozici tohoto objektu a navrhni jak by se dal odstranit.

Odpověz v tomto formátu:
POZICE: [left%] [top%] [width%] [height%]
METODA: [návod jak vyplnit oblast]`;

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();

    console.log('Gemini response for object removal:', text);

    // Note: True inpainting requires specialized models
    // For now, we return the original with a helpful message
    throw new Error('Odstranění objektů vyžaduje specializovaný AI model. Tato funkce bude brzy dostupná. Zatím můžete použít manuální úpravy nebo externí nástroje.');
  } catch (error) {
    throw error;
  }
};

/**
 * Replaces the background of an image
 * Note: Requires advanced segmentation - providing guidance for now
 */
export const replaceBackground = async (file: File, newBackgroundPrompt: string): Promise<{ file: File }> => {
  try {
    if (!newBackgroundPrompt) {
      throw new Error('Prosím popište nové pozadí');
    }

    // Simple color-based background replacement
    const genAI = await getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const imagePart = await fileToGenerativePart(file);

    const prompt = `Uživatel chce nahradit pozadí: "${newBackgroundPrompt}"

Navrhni nejlepší barvu pozadí (RGB hodnoty).

Odpověz POUZE:
COLOR: R G B

Například: COLOR: 255 255 255`;

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();

    const match = text.match(/COLOR:\s*(\d+)\s+(\d+)\s+(\d+)/i);
    let bgColor = '#ffffff';
    if (match) {
      const r = Math.min(255, parseInt(match[1]));
      const g = Math.min(255, parseInt(match[2]));
      const b = Math.min(255, parseInt(match[3]));
      bgColor = `rgb(${r},${g},${b})`;
    }

    throw new Error(`Výměna pozadí vyžaduje pokročilou segmentaci. Navrhovaná barva: ${bgColor}. Tato funkce bude brzy dostupná s lepšími AI modely.`);
  } catch (error) {
    throw error;
  }
};

/**
 * Applies the style of one image to another
 * Note: True neural style transfer requires specialized models
 */
export const styleTransfer = async (originalFile: File, styleFile: File): Promise<{ file: File }> => {
  try {
    throw new Error('Neural style transfer vyžaduje specializovaný AI model. Tato funkce bude brzy dostupná. Zkuste zatím manuální úpravy barev a filtrů.');
  } catch (error) {
    throw error;
  }
};

/**
 * Generates a new image from a text prompt
 * Note: Gemini 2.0 Flash doesn't support image generation yet
 */
export const generateImage = async (prompt: string): Promise<string> => {
  try {
    throw new Error('Generování obrázků bude brzy dostupné s Google Imagen API. Zatím můžete použít AI Autopilot a další nástroje pro úpravu existujících fotografií.');
  } catch (error) {
    throw error;
  }
};
