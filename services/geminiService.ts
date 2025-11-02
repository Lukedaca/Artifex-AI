
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { AnalysisResult, CropCoordinates } from '../types';
import { getApiKey } from '../utils/apiKey';

const getAiInstance = () => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("API klíč není k dispozici. Zadejte ho prosím kliknutím na ikonu klíče v záhlaví, nebo ho nastavte pomocí proměnné prostředí API_KEY.");
    }
    return new GoogleGenAI({ apiKey });
};

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
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
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export const analyzeImage = async (file: File): Promise<AnalysisResult> => {
    const ai = getAiInstance();
    const imagePart = await fileToGenerativePart(file);
    
    const prompt = 'Analyzuj tuto fotografii. Poskytni podrobný popis, tři konkrétní návrhy na vylepšení (jako je kompozice, osvětlení nebo post-processing) a klíčové technické informace (odhadované ISO, clona, rychlost závěrky). Odpověď naformátuj jako JSON.';

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [imagePart, { text: prompt }] }],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING, description: "Podrobný popis fotografie." },
                    suggestions: {
                        type: Type.ARRAY,
                        description: "Tři konkrétní návrhy na vylepšení.",
                        items: { type: Type.STRING }
                    },
                    technicalInfo: {
                        type: Type.OBJECT,
                        description: "Klíčové technické informace.",
                        properties: {
                            ISO: { type: Type.STRING, description: "Odhadovaná hodnota ISO." },
                            Aperture: { type: Type.STRING, description: "Odhadovaná hodnota clony (např. f/2.8)." },
                            ShutterSpeed: { type: Type.STRING, description: "Odhadovaná rychlost závěrky (např. 1/125s)." }
                        },
                        required: ["ISO", "Aperture", "ShutterSpeed"]
                    }
                },
                required: ['description', 'suggestions', 'technicalInfo']
            }
        }
    });

    const text = response.text.trim();
    try {
        const result = JSON.parse(text);
        return result as AnalysisResult;
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", text, e);
        throw new Error("Failed to get a valid analysis from the AI. The response was not valid JSON.");
    }
};

export const autopilotImage = async (file: File): Promise<string> => {
    const ai = getAiInstance();
    const imagePart = await fileToGenerativePart(file);
    const prompt = 'Enhance this photograph automatically. Adjust brightness, contrast, and color balance to make it look professionally edited. Return only the edited image.';

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }

    throw new Error("AI did not return an image.");
};

export const autoCropImage = async (file: File): Promise<CropCoordinates> => {
    const ai = getAiInstance();
    const imagePart = await fileToGenerativePart(file);
    
    const prompt = "Analyzuj kompozici této fotografie. Identifikuj hlavní objekt, vodicí linie a uplatni principy jako pravidlo třetin. Urči optimální ořez pro zvýšení vizuálního dopadu a kompozice fotografie. Vrať souřadnice ořezu jako JSON objekt se čtyřmi klíči: 'x', 'y', 'width' a 'height'. Každá hodnota by měla být číslo mezi 0 a 1, představující levý horní roh (x, y) a rozměry (šířka, výška) jako procento původní velikosti obrázku.";

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [imagePart, { text: prompt }] }],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    x: { type: Type.NUMBER, description: "X-ová souřadnice levého horního rohu ořezového boxu, jako procento (0-1) šířky obrázku." },
                    y: { type: Type.NUMBER, description: "Y-ová souřadnice levého horního rohu ořezového boxu, jako procento (0-1) výšky obrázku." },
                    width: { type: Type.NUMBER, description: "Šířka ořezového boxu, jako procento (0-1) šířky obrázku." },
                    height: { type: Type.NUMBER, description: "Výška ořezového boxu, jako procento (0-1) výšky obrázku." }
                },
                required: ["x", "y", "width", "height"]
            }
        }
    });

    const text = response.text.trim();
    try {
        const result = JSON.parse(text);
        if (
            typeof result.x === 'number' && result.x >= 0 && result.x <= 1 &&
            typeof result.y === 'number' && result.y >= 0 && result.y <= 1 &&
            typeof result.width === 'number' && result.width > 0 && result.width <= 1 &&
            typeof result.height === 'number' && result.height > 0 && result.height <= 1 &&
            (result.x + result.width) <= 1.0001 &&
            (result.y + result.height) <= 1.0001
        ) {
            return result as CropCoordinates;
        }
        throw new Error("Invalid or out-of-bounds crop coordinates received from AI.");
    } catch (e) {
        console.error("Failed to parse Gemini response for auto-crop:", text, e);
        throw new Error("Failed to get valid crop data from the AI.");
    }
};

export const generateImage = async (prompt: string): Promise<string> => {
    const ai = getAiInstance();

    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '1:1',
        },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
        return response.generatedImages[0].image.imageBytes;
    }
    
    throw new Error("AI did not return an image.");
};
