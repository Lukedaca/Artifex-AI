import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
// FIX: Corrected import path for imageProcessor to be a relative path.
import { applyEditsToImage, base64ToFile, resizeImageForAnalysis } from '../utils/imageProcessor';
import type { AnalysisResult, CropCoordinates, ManualEdits, UserProfile, AutopilotTendencies } from '../types';
import { getUserProfile } from "./userProfileService";

const blobToBase64 = (blob: Blob): Promise<string> => {
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
    reader.readAsDataURL(blob);
  });
};

const parseJsonResponse = <T,>(responseText: string, context: string): T => {
    try {
        const cleanedText = responseText.replace(/^```(json)?|```$/g, '').trim();
        return JSON.parse(cleanedText) as T;
    } catch (e) {
        console.error(`Failed to parse Gemini response for ${context}:`, responseText, e);
        throw new Error(`Failed to get a valid ${context} from the AI. The response was not valid JSON.`);
    }
}

const buildPreferenceString = (tendencies: AutopilotTendencies): string => {
    const descriptions: string[] = [];
    const THRESHOLD = 0.3; // How strong a tendency must be to be mentioned

    const tendencyMap: Record<keyof AutopilotTendencies, string[]> = {
        brightness: ['lower brightness', 'higher brightness'],
        contrast: ['lower contrast', 'higher contrast'],
        saturation: ['less saturated, more muted colors', 'more saturated, vibrant colors'],
        vibrance: ['less vibrance', 'more vibrance'],
        shadows: ['darker, deeper shadows', 'brighter, more open shadows'],
        highlights: ['more preserved, darker highlights', 'brighter, more pronounced highlights'],
        clarity: ['a softer, less sharp look', 'a sharper, more detailed look'],
    };

    for (const key in tendencies) {
        const typedKey = key as keyof AutopilotTendencies;
        const value = tendencies[typedKey];
        if (value < -THRESHOLD) {
            descriptions.push(tendencyMap[typedKey][0]);
        } else if (value > THRESHOLD) {
            descriptions.push(tendencyMap[typedKey][1]);
        }
    }

    if (descriptions.length === 0) {
        return "The user has no strong stylistic preferences yet.";
    }

    return `This user has a distinct style and generally prefers ${descriptions.join(', ')}. Please tailor your edits to match this style.`;
};


export const analyzeImage = async (file: File): Promise<AnalysisResult> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Resize the image to a manageable size before sending to the API.
    // This improves performance and prevents browser crashes with large files.
    const resizedImageBlob = await resizeImageForAnalysis(file, 1024);
    const base64Image = await blobToBase64(resizedImageBlob);
    const mimeType = 'image/jpeg'; // The resized image is a JPEG

    const systemPrompt = `You are an expert photo analyst. Your task is to analyze the provided image and return a JSON object. All string values for 'description', 'suggestions', and 'proactiveSuggestions.text' MUST be in Czech. The technical information should remain as is.

Additionally, identify potential improvements that can be done with specific tools. If you identify a distracting object, add a "proactiveSuggestion" for "remove-object". If you think the composition can be significantly improved by cropping, add a suggestion for "auto-crop".

The JSON object must follow this exact structure, with Czech text where specified:
{
  "description": "Popis obrázku v češtině.",
  "suggestions": ["První návrh v češtině.", "Druhý návrh v češtině.", "Třetí návrh v češtině."],
  "technicalInfo": { "ISO": "string", "Aperture": "string", "ShutterSpeed": "string" },
  "proactiveSuggestions": [
    {"text": "Text proaktivního návrhu v češtině.", "action": "remove-object"},
    {"text": "Další text proaktivního návrhu v češtině.", "action": "auto-crop"}
  ]
}
The "proactiveSuggestions" array is optional. Only include it if relevant suggestions are found. Only use "remove-object" and "auto-crop" for the action key.
Only output the raw JSON object.`;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { mimeType: mimeType, data: base64Image } },
                { text: 'Analyzuj tuto fotografii a vrať výsledek v JSON formátu podle systémové instrukce.' }
            ]
        },
        config: {
            systemInstruction: systemPrompt
        }
    });

    return parseJsonResponse<AnalysisResult>(response.text, "analysis");
};

export const autopilotImage = async (file: File): Promise<{ file: File; edits: Omit<ManualEdits, 'crop'> }> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const base64Image = await blobToBase64(file);
    const userProfile = getUserProfile();
    const preferenceString = buildPreferenceString(userProfile.autopilotTendencies);

    const systemPrompt = `You are a professional photo editor AI. Your task is to analyze the provided image and determine the optimal settings for a professional-looking enhancement.
${preferenceString}
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
        // FIX: Using gemini-flash-latest for autopilot as it's a basic text task.
        model: 'gemini-flash-latest',
        contents: {
            parts: [
                { inlineData: { mimeType: file.type, data: base64Image } },
                { text: 'Provide optimal editing parameters for this photo in the specified JSON format, considering my personal style.' }
            ]
        },
        config: {
            systemInstruction: systemPrompt
        }
    });
    
    const edits = parseJsonResponse<Omit<ManualEdits, 'crop'>>(response.text, "autopilot edits");
    const editedFileBlob = await applyEditsToImage(file, edits);
    const newFileName = file.name.replace(/\.[^/.]+$/, "") + "_autopilot.png";
    const editedFile = new File([editedFileBlob], newFileName, { type: 'image/png' });
    return { file: editedFile, edits };
};

export const autoCropImage = async (file: File): Promise<CropCoordinates> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const base64Image = await blobToBase64(file);
    // Note: Implementing learning for crop is more complex than for sliders.
    // For now, we will use the improved, but not yet personalized prompt.
    // A future improvement could analyze user's manual crop adjustments (e.g., preference for rule-of-thirds).
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

export const styleTransferImage = async (contentFile: File, styleFile: File): Promise<File> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const contentBase64 = await blobToBase64(contentFile);
    const styleBase64 = await blobToBase64(styleFile);

    const prompt = `You are an AI Style Transfer expert. The first image provided is the content image, and the second image is the style reference. Your task is to apply the artistic style (including color palette, textures, lighting, and overall mood) of the style reference image to the content image. It is crucial that you preserve the recognizable content, objects, and composition of the original content image. The output must be a single, high-quality photographic image.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { mimeType: contentFile.type, data: contentBase64 } },
                { inlineData: { mimeType: styleFile.type, data: styleBase64 } },
                { text: prompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return await base64ToFile(part.inlineData.data, "styled_image.png", "image/png");
        }
    }

    throw new Error("AI did not return a styled image. Please try again.");
};

export const replaceBackgroundImage = async (compositeImageBase64: string, fileType: string, backgroundPrompt: string): Promise<File> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `You are a sophisticated inpainting and background replacement AI. An image is provided with a semi-transparent magenta (#FF00FF) mask overlaying an area designated for replacement.
Your precise task is to:
1.  Completely and cleanly remove both the underlying area AND the magenta mask itself.
2.  Reconstruct the cleared area by generating a new background based on the user's prompt: "${backgroundPrompt}".
3.  The generated background must be photorealistic and seamlessly match the unmasked foreground elements in terms of lighting, shadows, perspective, and focus.
The output must be a single, clean photographic image.`;

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
            return await base64ToFile(part.inlineData.data, "background_replaced.png", "image/png");
        }
    }

    throw new Error("AI did not return an edited image. Please try again.");
};