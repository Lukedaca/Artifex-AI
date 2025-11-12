// TensorFlow.js based image processing service
// Provides AI-powered image editing running entirely in the browser

import * as tf from '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { fileToBase64, base64ToFile } from '../utils/imageProcessor';

// Cache for loaded models
let bodyPixModel: bodyPix.BodyPix | null = null;
let mobileNetModel: mobilenet.MobileNet | null = null;

/**
 * Load BodyPix model for segmentation
 */
async function loadBodyPixModel(): Promise<bodyPix.BodyPix> {
  if (!bodyPixModel) {
    console.log('Loading BodyPix model...');
    bodyPixModel = await bodyPix.load({
      architecture: 'MobileNetV1',
      outputStride: 16,
      multiplier: 0.75,
      quantBytes: 2,
    });
    console.log('BodyPix model loaded!');
  }
  return bodyPixModel;
}

/**
 * Load MobileNet model for image classification
 */
async function loadMobileNetModel(): Promise<mobilenet.MobileNet> {
  if (!mobileNetModel) {
    console.log('Loading MobileNet model...');
    mobileNetModel = await mobilenet.load({
      version: 2,
      alpha: 1.0,
    });
    console.log('MobileNet model loaded!');
  }
  return mobileNetModel;
}

/**
 * Convert File to ImageData
 */
async function fileToImageData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve(imageData);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Convert ImageData to File
 */
async function imageDataToFile(imageData: ImageData, filename: string): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create blob'));
        return;
      }
      resolve(new File([blob], filename, { type: 'image/png' }));
    }, 'image/png');
  });
}

/**
 * Applies automatic "autopilot" enhancements to an image using Canvas API
 */
export async function autopilotImage(file: File): Promise<{ file: File }> {
  const img = new Image();
  img.src = URL.createObjectURL(file);

  await new Promise((resolve) => {
    img.onload = resolve;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Draw original image
  ctx.drawImage(img, 0, 0);

  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Auto-enhance algorithm
  // 1. Calculate average brightness
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  const avgBrightness = totalBrightness / (data.length / 4);

  // 2. Adjust contrast and brightness
  const brightnessFactor = avgBrightness < 128 ? 1.2 : 0.9;
  const contrastFactor = 1.3;
  const saturationFactor = 1.2;

  for (let i = 0; i < data.length; i += 4) {
    // Brightness and contrast
    data[i] = ((data[i] - 128) * contrastFactor + 128) * brightnessFactor;
    data[i + 1] = ((data[i + 1] - 128) * contrastFactor + 128) * brightnessFactor;
    data[i + 2] = ((data[i + 2] - 128) * contrastFactor + 128) * brightnessFactor;

    // Saturation boost
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = gray + (data[i] - gray) * saturationFactor;
    data[i + 1] = gray + (data[i + 1] - gray) * saturationFactor;
    data[i + 2] = gray + (data[i + 2] - gray) * saturationFactor;

    // Clamp values
    data[i] = Math.max(0, Math.min(255, data[i]));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
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
}

/**
 * Removes background from an image using BodyPix segmentation
 */
export async function removeBackground(file: File): Promise<{ file: File }> {
  const model = await loadBodyPixModel();

  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise((resolve) => { img.onload = resolve; });

  // Perform segmentation
  const segmentation = await model.segmentPerson(img, {
    flipHorizontal: false,
    internalResolution: 'medium',
    segmentationThreshold: 0.7,
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Remove background (make transparent where no person detected)
  const mask = segmentation.data;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 0) {
      imageData.data[i * 4 + 3] = 0; // Set alpha to 0
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const result = await new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create blob'));
        return;
      }
      resolve(new File([blob], `nobg_${file.name}`, { type: 'image/png' }));
    }, 'image/png');
  });

  URL.revokeObjectURL(img.src);
  return { file: result };
}

/**
 * Replace background with a solid color or blur
 */
export async function replaceBackground(file: File, backgroundColor: string = '#ffffff'): Promise<{ file: File }> {
  const model = await loadBodyPixModel();

  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise((resolve) => { img.onload = resolve; });

  const segmentation = await model.segmentPerson(img);

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw only the person (foreground)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const foregroundData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const mask = segmentation.data;
  for (let i = 0; i < mask.length; i++) {
    const idx = i * 4;
    if (mask[i] === 1) {
      imageData.data[idx] = foregroundData.data[idx];
      imageData.data[idx + 1] = foregroundData.data[idx + 1];
      imageData.data[idx + 2] = foregroundData.data[idx + 2];
      imageData.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const result = await new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create blob'));
        return;
      }
      resolve(new File([blob], `newbg_${file.name}`, { type: 'image/png' }));
    }, 'image/png');
  });

  URL.revokeObjectURL(img.src);
  return { file: result };
}

/**
 * Auto crop to focus on main subject
 */
export async function autoCrop(file: File): Promise<{ file: File }> {
  const model = await loadBodyPixModel();

  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise((resolve) => { img.onload = resolve; });

  const segmentation = await model.segmentPerson(img);
  const mask = segmentation.data;
  const width = img.width;
  const height = img.height;

  // Find bounding box of person
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 1) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Add padding (10%)
  const padding = 0.1;
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  minX = Math.max(0, minX - boxWidth * padding);
  minY = Math.max(0, minY - boxHeight * padding);
  maxX = Math.min(width, maxX + boxWidth * padding);
  maxY = Math.min(height, maxY + boxHeight * padding);

  // Crop
  const canvas = document.createElement('canvas');
  canvas.width = maxX - minX;
  canvas.height = maxY - minY;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(img, minX, minY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

  const result = await new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create blob'));
        return;
      }
      resolve(new File([blob], `cropped_${file.name}`, { type: 'image/png' }));
    }, 'image/png');
  });

  URL.revokeObjectURL(img.src);
  return { file: result };
}

/**
 * Simple style transfer using color transfer
 */
export async function styleTransfer(originalFile: File, styleFile: File): Promise<{ file: File }> {
  const [origImg, styleImg] = await Promise.all([
    new Promise<HTMLImageElement>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = URL.createObjectURL(originalFile);
    }),
    new Promise<HTMLImageElement>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = URL.createObjectURL(styleFile);
    }),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = origImg.width;
  canvas.height = origImg.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Get style colors
  const styleCanvas = document.createElement('canvas');
  styleCanvas.width = styleImg.width;
  styleCanvas.height = styleImg.height;
  const styleCtx = styleCanvas.getContext('2d');
  if (!styleCtx) throw new Error('Could not get canvas context');
  styleCtx.drawImage(styleImg, 0, 0);
  const styleData = styleCtx.getImageData(0, 0, styleImg.width, styleImg.height);

  // Calculate average color of style image
  let avgR = 0, avgG = 0, avgB = 0;
  for (let i = 0; i < styleData.data.length; i += 4) {
    avgR += styleData.data[i];
    avgG += styleData.data[i + 1];
    avgB += styleData.data[i + 2];
  }
  const pixelCount = styleData.data.length / 4;
  avgR /= pixelCount;
  avgG /= pixelCount;
  avgB /= pixelCount;

  // Apply color tint to original
  ctx.drawImage(origImg, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = (data[i] * 0.7) + (avgR * 0.3);
    data[i + 1] = (data[i + 1] * 0.7) + (avgG * 0.3);
    data[i + 2] = (data[i + 2] * 0.7) + (avgB * 0.3);
  }

  ctx.putImageData(imageData, 0, 0);

  const result = await new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create blob'));
        return;
      }
      resolve(new File([blob], `styled_${originalFile.name}`, { type: 'image/png' }));
    }, 'image/png');
  });

  URL.revokeObjectURL(origImg.src);
  URL.revokeObjectURL(styleImg.src);
  return { file: result };
}
