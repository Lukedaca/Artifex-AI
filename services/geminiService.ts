

import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { applyEditsToImage, base64ToFile } from '../utils/imageProcessor';
import type { AnalysisResult, CropCoordinates, ManualEdits } from '../types';

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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const base64Image = await fileToBase64(file);
    const systemPrompt = `You are a world-class AI photo editor and social media expert with a deep understanding of artistic composition. Your task is to perform an intelligent, non-destructive auto-crop on the provided image.

Your analysis must follow these critical principles:
1.  **Subject Integrity is Paramount:** CRITICAL: Do not crop through people's limbs (hands, feet, elbows, knees) or the primary subject's key features unless it's a deliberate artistic choice like a tight headshot. Preserving the subject's form is the highest priority.
2.  **Intelligent Aspect Ratio Selection:** Intelligently select the optimal aspect ratio based on the subject matter, considering common social media formats. For example: a vertical portrait might be best as 4:5 for an Instagram post, a landscape might be 16:9 for a banner, and a centered subject could be 1:1 (square). Do not be constrained by the original aspect ratio.
3.  **Apply Compositional Rules:** Use principles like the Rule of Thirds, leading lines, framing, and balancing negative space to determine the most compelling composition.
4.  **Minimal Cropping:** Crop as little as possible to achieve a better composition. The goal is to improve the existing photo, not to drastically change it. Avoid aggressive zooms.

Return a single JSON object representing the final crop coordinates. The coordinates must be normalized between 0 and 1.
The JSON object must have four keys: 'x', 'y', 'width', and 'height'.
Example: {"x": 0.1, "y": 0.15, "width": 0.8, "height": 0.7}.
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

export const removeObject = async (compositeImageBase64: string, fileType: string): Promise<File> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `You are a sophisticated inpainting AI specializing in seamless object removal. An image is provided with a semi-transparent magenta (#FF00FF) mask overlaying an object or area designated for removal.
Your precise task is to:
1. Analyze the area beneath the magenta mask.
2. Completely and cleanly remove both the underlying object(s) AND the magenta mask itself.
3. Reconstruct the cleared area by intelligently sampling and generating a background that perfectly and realistically matches the surrounding context. This includes matching textures, lighting, shadows, colors, and perspective.
**Crucially, do NOT introduce any new objects or subjects into the filled area.** The goal is a flawless removal, making it appear as if the object was never there. The output must be a single, clean photographic image.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { mimeType: fileType, data: compositeImageBase64 } },
                { text: prompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return await base64ToFile(part.inlineData.data, "inpainted_image.png", "image/png");
        }
    }

    throw new Error("AI did not return an edited image. Please try again.");
};