
import { GoogleGenAI, Type, Modality } from '@google/genai';
import type { AnalysisResult } from '../types';
import { fileToBase64, base64ToFile } from '../utils/imageProcessor';

// Helper to create a new GenAI instance for each request
// This ensures the most up-to-date API key is used, as per guidelines
const getGenAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

/**
 * Analyzes an image to provide a description, technical info, and improvement suggestions.
 */
export const analyzeImage = async (file: File): Promise<AnalysisResult> => {
  const ai = getGenAI();
  const base64Image = await fileToBase64(file);

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
        {
          text: 'Analyze this photograph. Provide a detailed description, suggest 3-5 specific improvements, and estimate the technical photo information (ISO, Aperture, Shutter Speed). Also provide 2 proactive suggestions for edits I could make, like "remove-object" or "auto-crop" based on the image content.',
        },
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
// Switched default back to gemini-2.5-flash-image for stability in edits
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
  // Use 2.5-flash-image for editing to avoid 3-pro's tendency to hallucinate faces
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
 * Automatically crops an image to improve composition with support for specific aspect ratios and user instructions.
 */
export const autoCrop = async (file: File, aspectRatio: string = 'Original', instruction: string = ''): Promise<{ file: File }> => {
    
    // Translate shorthand ratios to explicit geometric instructions
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
        model: 'gemini-2.5-flash-image', // Switched to Flash for safer structure preservation
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
 * Generates a new image from a text prompt using Gemini Pro Image Preview.
 * THIS REMAINS GEMINI-3-PRO-IMAGE-PREVIEW as requested.
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
