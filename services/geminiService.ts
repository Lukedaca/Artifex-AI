
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
        config: {
            responseModalities: [Modality.IMAGE],
        },
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
      Act as a world-class professional photo retoucher. Your task is to significantly enhance this image to professional standards while maintaining a natural look. 
      
      Please perform the following adjustments:
      1. **Global Lighting:** Optimize exposure, balance high-dynamic-range (HDR) by lifting crushed shadows and recovering blown-out highlights.
      2. **Color Correction:** Fix any color casts (white balance), ensuring neutral grays and natural skin tones.
      3. **Detail & Texture:** Intelligently sharpen fine details and textures while reducing digital noise.
      4. **Depth & Contrast:** Enhance global contrast and micro-contrast (clarity) to add depth.
      5. **Vibrance:** Subtly boost color vibrance to make the image pop, but avoid oversaturation.
      
      The final result should look like a high-end, edited photograph suitable for a portfolio.
  `;
  return editImageWithPrompt(file, prompt);
};

/**
 * Removes a user-specified object from an image.
 */
export const removeObject = async (file: File, objectToRemove: string): Promise<{ file: File }> => {
    if (!objectToRemove) throw new Error("Please specify what to remove.");
    return editImageWithPrompt(file, `Remove the following object from the image: ${objectToRemove}. Fill in the background seamlessly and naturally.`);
};

/**
 * Automatically crops an image to improve composition with support for specific aspect ratios and user instructions.
 */
export const autoCrop = async (file: File, aspectRatio: string = 'Original', instruction: string = ''): Promise<{ file: File }> => {
    const ratioInstruction = aspectRatio !== 'Original' 
        ? `The output image MUST STRICTLY follow the ${aspectRatio} aspect ratio.` 
        : 'Maintain the most aesthetically pleasing aspect ratio for the subject.';

    const customInstruction = instruction.trim() 
        ? `USER INSTRUCTION: "${instruction}". Priority: Highest. Crop specifically to fulfill this request.`
        : `Focus on Impact: Identify the primary subject or action.`;

    const prompt = `
        Act as a world-class photo editor. Your task is to CROP this image.

        Aspect Ratio Requirement: ${ratioInstruction}
        
        ${customInstruction}

        **EXECUTION GUIDELINES:**
        1. **Remove Distractions:** Aggressively crop out empty space (grass, sky, background) that does not contribute to the story or the user's instruction.
        2. **Sports/Action:** If this is a sports photo and no other instruction is given, ZOOM IN TIGHT on the players and the ball. The action should fill the frame. We want to see the intensity.
        3. **Portraits:** Ensure professional headroom and eye placement (Rule of Thirds).
        4. **No Distortion:** Do not stretch the image. Cut the pixels to fit the ratio.
        
        Return the cropped image.
    `;
    return editImageWithPrompt(file, prompt);
};

/**
 * Replaces the background of an image based on a text prompt.
 */
export const replaceBackground = async (file: File, newBackgroundPrompt: string): Promise<{ file: File }> => {
    if (!newBackgroundPrompt) throw new Error("Please describe the new background.");
    return editImageWithPrompt(file, `Replace the background of this image with the following scene: ${newBackgroundPrompt}. Ensure the foreground subject is integrated naturally with correct lighting and shadows.`);
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
                { text: "Apply the artistic style of the second image to the content of the first image. Maintain the structural integrity of the primary subject." },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
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
 * Generates a new image from a text prompt using Imagen.
 */
export const generateImage = async (prompt: string): Promise<string> => {
  const ai = getGenAI();
  const response = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt,
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio: '1:1',
    },
  });

  if (!response.generatedImages || response.generatedImages.length === 0) {
    throw new Error('Image generation failed, no images were returned.');
  }

  return response.generatedImages[0].image.imageBytes;
};