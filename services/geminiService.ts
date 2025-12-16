
import { GoogleGenAI, Type, Modality } from '@google/genai';
import type { AnalysisResult, Language, SocialMediaContent } from '../types';
import { fileToBase64, base64ToFile } from '../utils/imageProcessor';
import { getStoredApiKey } from '../utils/apiKey';

// Helper to create a new GenAI instance for each request
const getGenAI = () => {
    const apiKey = process.env.API_KEY || getStoredApiKey();
    if (!apiKey) {
        throw new Error("API Key is missing. Please set it in the settings.");
    }
    return new GoogleGenAI({ apiKey });
};

/**
 * Analyzes an image to provide a description, technical info, and improvement suggestions.
 * Respects the selected language for the text output.
 */
export const analyzeImage = async (file: File, language: Language = 'cs'): Promise<AnalysisResult> => {
  const ai = getGenAI();
  const base64Image = await fileToBase64(file);

  const langInstruction = language === 'cs' 
    ? "Respond strictly in Czech language." 
    : "Respond strictly in English language.";

  const prompt = `Analyze this photograph. Provide a detailed description, suggest 3-5 specific improvements, and estimate the technical photo information (ISO, Aperture, Shutter Speed). Also provide 2 proactive suggestions for edits I could make, like "remove-object" or "auto-crop" based on the image content. ${langInstruction}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64Image,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          technicalInfo: {
            type: Type.OBJECT,
            properties: {
              ISO: { type: Type.STRING },
              Aperture: { type: Type.STRING },
              ShutterSpeed: { type: Type.STRING },
            },
          },
          proactiveSuggestions: {
             type: Type.ARRAY,
             items: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING },
                    action: { type: Type.STRING }
                }
             }
          }
        },
      },
    },
  });

  const jsonString = response.text;
  const result = JSON.parse(jsonString);
  return result as AnalysisResult;
};

// Generic function for image-in, image-out editing tasks
const editImageWithPrompt = async (file: File, prompt: string, model = 'gemini-2.5-flash-image'): Promise<{ file: File }> => {
    const ai = getGenAI();
    const base64Image = await fileToBase64(file);

    const response = await ai.models.generateContent({
        model,
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType: file.type } },
                { text: prompt },
            ],
        },
        // CRITICAL: Low temperature reduces creativity/hallucinations and forces the model to adhere strictly to the image structure.
        config: {
            temperature: 0.1,
            topP: 0.95,
            topK: 64,
        }
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
    if (!imagePart || !imagePart.inlineData) {
        throw new Error('No edited image was returned from the API.');
    }
    
    const newBase64 = imagePart.inlineData.data;
    const newMimeType = imagePart.inlineData.mimeType;
    const newFile = await base64ToFile(newBase64, `edited_${file.name}`, newMimeType);
    return { file: newFile };
};


/**
 * Applies automatic "autopilot" enhancements to an image.
 */
export const autopilotImage = async (file: File): Promise<{ file: File }> => {
  const prompt = `
      Role: Expert Image Processing AI.
      Task: Apply global photographic enhancements to lighting and color.
      
      **STRICT CONSTRAINTS (DO NOT VIOLATE):**
      1.  **STRUCTURAL FIDELITY:** Do NOT change the shape, position, or geometry of ANY object. Do NOT warp faces. Do NOT move pixels.
      2.  **NO GENERATION:** Do NOT add details (hair, skin texture, objects) that are not present in the source.
      3.  **IDENTITY PRESERVATION:** Facial features must remain exactly as they are pixel-for-pixel, only lighting/color should change.
      4.  **NO SMOOTHING:** Do not apply "beautification" filters that blur skin texture. Keep natural grain.

      **REQUIRED ADJUSTMENTS:**
      - **Exposure:** Balance the histogram. Recover details in highlights and lift crushed shadows slightly.
      - **White Balance:** Neutralize color casts.
      - **Contrast:** Increase perceptual depth (micro-contrast) without over-saturating.
      - **Color:** Ensure skin tones are natural and vibrant, not orange or plastic.

      Output: The exact same image content, but with professional color grading.
  `;
  return editImageWithPrompt(file, prompt, 'gemini-2.5-flash-image');
};

/**
 * Removes a user-specified object from an image.
 */
export const removeObject = async (file: File, objectToRemove: string): Promise<{ file: File }> => {
    if (!objectToRemove) throw new Error("Please specify what to remove.");
    return editImageWithPrompt(file, `Remove the following object from the image: ${objectToRemove}. Fill in the background seamlessly and naturally matching the surrounding texture, lighting, and noise profile. Do not distort the rest of the image.`);
};

/**
 * Automatically crops an image to improve composition.
 */
export const autoCrop = async (file: File, aspectRatio: string = 'Original', instruction: string = ''): Promise<{ file: File }> => {
    
    const ratioMap: Record<string, string> = {
        '1:1': 'SQUARE aspect ratio (1:1). Width MUST EQUAL Height.',
        '16:9': 'LANDSCAPE aspect ratio (16:9). Width must be ~1.77x the Height.',
        '4:3': 'STANDARD aspect ratio (4:3). Width must be ~1.33x the Height.',
        '9:16': 'PORTRAIT/STORY aspect ratio (9:16). Height must be ~1.77x the Width.',
        '5:4': 'PORTRAIT aspect ratio (5:4). Height must be ~1.25x the Width.',
        'Original': 'ORIGINAL aspect ratio, but ZOOMED IN.'
    };

    const ratioDescription = ratioMap[aspectRatio] || aspectRatio;

    const prompt = `
        ROLE: Professional Photo Editor.
        TASK: CROP this image.

        TARGET FORMAT: ${aspectRatio} (${ratioDescription})

        MANDATORY EXECUTION RULES:
        1. **DELETE PIXELS**: You must physically remove pixels from the edges. The output image resolution MUST be smaller than the input.
        2. **NO BORDERS**: Do NOT add black bars (letterboxing). Fill the entire canvas with the image subject.
        3. **STRICT RATIO**: The output image dimensions must mathematically match the ${aspectRatio} ratio.
        4. **ZOOM**: Locate the main subject (person, object, action). CROP IN TIGHTLY on them. Remove distracting background edges.
        
        ${instruction ? `USER INSTRUCTION: "${instruction}"` : 'If no specific subject is clear, crop 20% from the edges to center the attention.'}

        ${aspectRatio === 'Original' ? 'Even if the ratio is "Original", you MUST perform a crop. Remove at least 15% of the image area from the edges to tighten the composition.' : ''}
        
        OUTPUT: The cropped image only.
    `;
    return editImageWithPrompt(file, prompt);
};

/**
 * Replaces the background of an image based on a text prompt.
 */
export const replaceBackground = async (file: File, newBackgroundPrompt: string): Promise<{ file: File }> => {
    if (!newBackgroundPrompt) throw new Error("Please describe the new background.");
    return editImageWithPrompt(file, `Replace the background of this image with the following scene: ${newBackgroundPrompt}. Ensure the foreground subject is integrated naturally with correct lighting match, shadow casting, and color grading. Maintain the integrity of the foreground subject perfectly.`);
};

/**
 * Applies the style of one image to another.
 */
export const styleTransfer = async (originalFile: File, styleFile: File): Promise<{ file: File }> => {
    const ai = getGenAI();
    const [originalBase64, styleBase64] = await Promise.all([
        fileToBase64(originalFile),
        fileToBase64(styleFile)
    ]);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: {
            parts: [
                { inlineData: { data: originalBase64, mimeType: originalFile.type } },
                { inlineData: { data: styleBase64, mimeType: styleFile.type } },
                { text: "Apply the artistic style, color palette, and lighting of the second image to the content of the first image. Maintain the structural integrity of the primary subject in the first image. Do not distort faces." },
            ],
        },
        config: {
            temperature: 0.1
        }
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
    if (!imagePart || !imagePart.inlineData) {
        throw new Error('No edited image was returned from the API.');
    }

    const newBase64 = imagePart.inlineData.data;
    const newMimeType = imagePart.inlineData.mimeType;
    const newFile = await base64ToFile(newBase64, `styled_${originalFile.name}`, newMimeType);
    return { file: newFile };
};

/**
 * Generates a new image from a text prompt.
 */
export const generateImage = async (prompt: string): Promise<string> => {
  const ai = getGenAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: prompt,
    config: {
       // No mimeType or schema for image generation models
    },
  });

  const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
  if (!imagePart || !imagePart.inlineData) {
    throw new Error('No image was generated.');
  }

  return imagePart.inlineData.data;
};

/**
 * Generates social media content (Captions, Hashtags) for an image.
 */
export const generateSocialContent = async (file: File, language: Language = 'cs'): Promise<SocialMediaContent> => {
    const ai = getGenAI();
    const base64Image = await fileToBase64(file);
    
    const langInstruction = language === 'cs' ? "in Czech" : "in English";
    
    const prompt = `
        You are a professional social media manager. Analyze this image and create content for Instagram.
        Provide 3 different captions with distinct tones (Professional, Funny, Inspirational).
        Also provide 10 trending hashtags relevant to the image.
        Output strictly in JSON ${langInstruction}.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType: file.type } },
                { text: prompt }
            ]
        },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    captions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                tone: { type: Type.STRING },
                                text: { type: Type.STRING }
                            }
                        }
                    },
                    hashtags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                }
            }
        }
    });
    
    return JSON.parse(response.text) as SocialMediaContent;
};

/**
 * Generates a video from an image using the Veo model.
 */
export const generateVideoFromImage = async (file: File, prompt: string): Promise<string> => {
    const ai = getGenAI();
    const base64Image = await fileToBase64(file);
    const apiKey = process.env.API_KEY || getStoredApiKey(); // Need raw key for download link

    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        image: {
            imageBytes: base64Image,
            mimeType: file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png' // Veo prefers basic types
        },
        prompt: prompt || "Cinematic camera movement, natural motion",
        config: {
            numberOfVideos: 1,
            aspectRatio: '16:9', // Veo restriction
            resolution: '720p'
        }
    });

    // Poll for completion
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
        operation = await ai.operations.getVideosOperation({operation: operation});
    }

    if (operation.error) {
        throw new Error(operation.error.message || "Video generation failed");
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("No video URI returned.");
    
    // Fetch the MP4 bytes using the API key
    const res = await fetch(`${downloadLink}&key=${apiKey}`);
    if (!res.ok) throw new Error("Failed to download generated video.");
    
    const blob = await res.blob();
    return URL.createObjectURL(blob);
};
