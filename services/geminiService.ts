
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { AnalysisResult } from '../types';
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
