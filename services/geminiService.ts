
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
      Role: Professional Photo Retoucher.
      Task: Enhance this image's lighting, color, and clarity.

      **CRITICAL RULES (VIOLATION = FAILURE):**
      1.  **PRESERVE FACIAL INTEGRITY:** Do NOT change facial features, eyes, nose, or mouth shape. Do NOT warp the face.
      2.  **NO HALLUCINATIONS:** Do NOT add or remove objects.
      3.  **NATURAL LOOK:** Do not make it look like a cartoon. Keep skin texture.

      **Adjustments to Apply:**
      1.  **Lighting:** Balance exposure. Gently lift shadows and recover highlights.
      2.  **Color:** Correct white balance. Improve skin tones to be natural and healthy.
      3.  **Contrast:** Add depth (micro-contrast) without crushing blacks.
      4.  **Clarity:** Sharpen details slightly.

      Output: The exact same photo, but better developed.
  `;
  // Use 2.5-flash-image for editing to avoid 3-pro's tendency to hallucinate faces
  return editImageWithPrompt(file, prompt, 'gemini-2.5-flash-image');
};

/**
 * Removes a user-specified object from an image.
 */
export const removeObject = async (file: File, objectToRemove: string): Promise<{ file: File }> => {
    if (!objectToRemove) throw new Error("Please specify what to remove.");
    return editImageWithPrompt(file, `Remove the following object from the image: ${objectToRemove}. Fill in the background seamlessly and naturally matching the surrounding texture, lighting, and noise profile.`);
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
        1. **Zoom on Action (Sports/Active):** If this is a sports or action shot, ZOOM IN AGGRESSIVELY. Remove dead space around the players. We want to see the emotion and the immediate action.
        2. **Remove Distractions:** Cut out empty sky, grass, or irrelevant background elements that do not add to the story.
        3. **Fill the Frame:** Do not leave black bars. The image content must fill the requested aspect ratio.
        4. **No Distortion:** Do not stretch the image. Resample/Crop pixels to fit.
        
        Return the cropped image.
    `;
    return editImageWithPrompt(file, prompt);
};

/**
 * Replaces the background of an image based on a text prompt.
 */
export const replaceBackground = async (file: File, newBackgroundPrompt: string): Promise<{ file: File }> => {
    if (!newBackgroundPrompt) throw new Error("Please describe the new background.");
    return editImageWithPrompt(file, `Replace the background of this image with the following scene: ${newBackgroundPrompt}. Ensure the foreground subject is integrated naturally with correct lighting match, shadow casting, and color grading.`);
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
                { text: "Apply the artistic style, color palette, and lighting of the second image to the content of the first image. Maintain the structural integrity of the primary subject in the first image." },
            ],
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
 * Generates a new image from a text prompt using Gemini Pro Image Preview.
 * THIS REMAINS GEMINI-3-PRO-IMAGE-PREVIEW as requested.
 */
export const generateImage = async (prompt: string): Promise<string> => {
  const ai = getGenAI();
  
  // Enhanced prompt to ensure the model interprets it as a generation task and not a text completion task
  const enhancedPrompt = `Generate a high-quality, photorealistic image matching this description: ${prompt}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
        parts: [
            { text: enhancedPrompt }
        ]
    },
    config: {
      imageConfig: {
          aspectRatio: '1:1',
          imageSize: '1K', // Standard 1K resolution
      }
    },
  });

  const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
  
  if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
    // Check if the model refused and returned text
    const textPart = response.candidates?.[0]?.content?.parts?.find(part => part.text);
    if (textPart?.text) {
         throw new Error(`Generování se nezdařilo: ${textPart.text}`);
    }
    throw new Error('Generování obrázku selhalo, nebyla vrácena žádná data.');
  }

  return imagePart.inlineData.data;
};
