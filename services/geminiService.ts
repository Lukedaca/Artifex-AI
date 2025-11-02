import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { applyEditsToImage } from '../utils/imageProcessor';
import type { AnalysisResult, CropCoordinates, ManualEdits } from '../types';

// Lazily initialize the Google GenAI client to avoid errors on app load if API key is missing.
const getClient = () => {
  // Guard against 'process' not being defined in a browser environment
  const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : null;
  if (!apiKey) {
    // This error will be caught by the UI and displayed to the user.
    throw new Error('API key is not available. Please set it up.');
  }
  return new GoogleGenAI({
    apiKey,
  });
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        if (reader.result) {
            resolve((reader.result as string).split(',')[1]);
        } else {
            reject(new Error("Failed to read file"));
        }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const parseJsonResponse = <T,>(responseText: string, context: string): T => {
    try {
        // Gemini often wraps JSON in ```json ... ``` or just ```...```
        const cleanedText = responseText.replace(/^```(json)?|```$/g, '').trim();
        return JSON.parse(cleanedText) as T;
    } catch (e) {
        console.error(`Failed to parse Gemini response for ${context}:`, responseText, e);
        throw new Error(`Failed to get a valid ${context} from the AI. The response was not valid JSON.`);
    }
}

export const analyzeImage = async (file: File): Promise<AnalysisResult> => {
    const ai = getClient();
    const base64Image = await fileToBase64(file);
    const systemPrompt = `You are an expert photo analyst. Your task is to analyze the provided image and return a JSON object with a detailed description, three specific suggestions for improvement, and key technical information (estimated ISO, Aperture, and Shutter Speed).
The JSON object must follow this exact structure:
{
  "description": "string",
  "suggestions": ["string", "string", "string"],
  "technicalInfo": {
    "ISO": "string",
    "Aperture": "string",
    "ShutterSpeed": "string"
  }
}
Only output the raw JSON object. Do not include any other text or explanations.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { mimeType: file.type, data: base64Image } },
                { text: 'Analyzuj tuto fotografii a vrať výsledek v JSON formátu podle systémové instrukce.' }
            ]
        },
        config: {
            systemInstruction: systemPrompt
        }
    });

    return parseJsonResponse<AnalysisResult>(response.text, "analysis");
};

export const autopilotImage = async (file: File): Promise<File> => {
    const ai = getClient();
    const base64Image = await fileToBase64(file);
    const systemPrompt = `You are a professional photo editor AI. Your task is to analyze the provided image and determine the optimal settings for a professional-looking enhancement.
Return a single JSON object with the following keys and value ranges:
- "brightness": number between -100 and 100
- "contrast": number between -100 and 100
- "saturation": number between -100 and 100
- "vibrance": number between -100 and 100
- "shadows": number between -100 and 100
- "highlights": number between -100 and 100
- "clarity": number between 0 and 100
Choose values that will subtly improve the image, making it more vibrant and balanced without looking over-processed. Only output the raw JSON object.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { mimeType: file.type, data: base64Image } },
                { text: 'Provide optimal editing parameters for this photo in the specified JSON format.' }
            ]
        },
        config: {
            systemInstruction: systemPrompt
        }
    });
    
    const edits = parseJsonResponse<Omit<ManualEdits, 'crop'>>(response.text, "autopilot edits");
    const editedFile = await applyEditsToImage(file, edits);
    const newFileName = file.name.replace(/\.[^/.]+$/, "") + "_autopilot.png";
    return new File([editedFile], newFileName, { type: 'image/png' });
};

export const autoCropImage = async (file: File): Promise<CropCoordinates> => {
    const ai = getClient();
    const base64Image = await fileToBase64(file);
    const systemPrompt = `You are an expert in photo composition. Your task is to analyze the composition of the provided image, identify the main subject, and determine the optimal crop to enhance its visual impact according to principles like the rule of thirds.
Return a single JSON object representing the crop coordinates with four keys: 'x', 'y', 'width', and 'height'.
Each value must be a number between 0 and 1, representing the top-left corner (x, y) and dimensions (width, height) as a percentage of the original image size.
The JSON object must look like this: {"x": 0.1, "y": 0.1, "width": 0.8, "height": 0.8}.
Only output the raw JSON object.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { mimeType: file.type, data: base64Image } },
                { text: 'Determine the optimal crop for this image and return coordinates in the specified JSON format.' }
            ]
        },
        config: {
            systemInstruction: systemPrompt
        }
    });

    const result = parseJsonResponse<CropCoordinates>(response.text, "crop data");
    if (
        typeof result.x === 'number' && result.x >= 0 && result.x <= 1 &&
        typeof result.y === 'number' && result.y >= 0 && result.y <= 1 &&
        typeof result.width === 'number' && result.width > 0 && result.width <= 1 &&
        typeof result.height === 'number' && result.height > 0 && result.height <= 1 &&
        (result.x + result.width) <= 1.0001 &&
        (result.y + result.height) <= 1.0001
    ) {
        return result;
    }
    throw new Error("Invalid or out-of-bounds crop coordinates received from AI.");
};

export const generateImage = async (prompt: string): Promise<string> => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: prompt }],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }

    throw new Error("AI did not return an image. Please try a different prompt.");
};