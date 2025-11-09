/**
 * Advanced image processing utilities using client-side AI and libraries
 * This file implements image editing features without requiring external APIs
 */

import * as bodyPix from '@tensorflow-models/body-pix';
import * as tf from '@tensorflow/tfjs';

// Cache for loaded models
let bodyPixModel: bodyPix.BodyPix | null = null;

/**
 * Load Body-Pix model for segmentation (lazy loading)
 */
const loadBodyPixModel = async (): Promise<bodyPix.BodyPix> => {
  if (bodyPixModel) return bodyPixModel;

  console.log('Loading Body-Pix model...');
  bodyPixModel = await bodyPix.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 2,
  });
  console.log('Body-Pix model loaded successfully');
  return bodyPixModel;
};

/**
 * Apply automatic enhancements using canvas and filters
 */
export const applyAutoEnhancements = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Auto-enhance: slight contrast, brightness, and saturation boost
        for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];

          // Slight contrast boost
          const contrastFactor = 1.1;
          r = 128 + contrastFactor * (r - 128);
          g = 128 + contrastFactor * (g - 128);
          b = 128 + contrastFactor * (b - 128);

          // Slight brightness
          const brightness = 5;
          r += brightness;
          g += brightness;
          b += brightness;

          // Slight saturation boost
          const saturationFactor = 1.15;
          const gray = r * 0.3 + g * 0.59 + b * 0.11;
          r = gray * (1 - saturationFactor) + r * saturationFactor;
          g = gray * (1 - saturationFactor) + g * saturationFactor;
          b = gray * (1 - saturationFactor) + b * saturationFactor;

          // Clamp
          data[i] = Math.max(0, Math.min(255, r));
          data[i + 1] = Math.max(0, Math.min(255, g));
          data[i + 2] = Math.max(0, Math.min(255, b));
        }

        ctx.putImageData(imageData, 0, 0);

        // Apply subtle sharpening
        ctx.filter = 'contrast(1.05) brightness(1.02)';
        ctx.drawImage(canvas, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            const enhancedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(enhancedFile);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, file.type);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Smart crop image using edge detection
 */
export const smartCrop = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Get image data to find content bounds
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Find bounding box of content (non-uniform areas)
        let minX = canvas.width, minY = canvas.height;
        let maxX = 0, maxY = 0;

        // Calculate edge strength for each pixel
        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            const i = (y * canvas.width + x) * 4;

            // Simple edge detection (Sobel-like)
            const gx = Math.abs(
              -data[i - 4] + data[i + 4] +
              -2 * data[(y * canvas.width + x - 1) * 4] + 2 * data[(y * canvas.width + x + 1) * 4] +
              -data[((y + 1) * canvas.width + x - 1) * 4] + data[((y + 1) * canvas.width + x + 1) * 4]
            );

            const gy = Math.abs(
              -data[((y - 1) * canvas.width + x - 1) * 4] - 2 * data[((y - 1) * canvas.width + x) * 4] - data[((y - 1) * canvas.width + x + 1) * 4] +
              data[((y + 1) * canvas.width + x - 1) * 4] + 2 * data[((y + 1) * canvas.width + x) * 4] + data[((y + 1) * canvas.width + x + 1) * 4]
            );

            const edge = gx + gy;

            // If edge is strong enough, update bounds
            if (edge > 30) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }

        // Add padding (10% of crop size)
        const padding = Math.min(
          (maxX - minX) * 0.1,
          (maxY - minY) * 0.1
        );

        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(canvas.width, maxX + padding);
        maxY = Math.min(canvas.height, maxY + padding);

        // If no significant edges found, use rule of thirds crop
        if (maxX - minX < canvas.width * 0.3 || maxY - minY < canvas.height * 0.3) {
          const cropRatio = 0.85;
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const cropWidth = canvas.width * cropRatio;
          const cropHeight = canvas.height * cropRatio;

          minX = centerX - cropWidth / 2;
          minY = centerY - cropHeight / 2;
          maxX = centerX + cropWidth / 2;
          maxY = centerY + cropHeight / 2;
        }

        // Create cropped canvas
        const croppedWidth = maxX - minX;
        const croppedHeight = maxY - minY;
        const croppedCanvas = document.createElement('canvas');
        const croppedCtx = croppedCanvas.getContext('2d');

        if (!croppedCtx) {
          reject(new Error('Could not get cropped canvas context'));
          return;
        }

        croppedCanvas.width = croppedWidth;
        croppedCanvas.height = croppedHeight;
        croppedCtx.drawImage(
          canvas,
          minX, minY, croppedWidth, croppedHeight,
          0, 0, croppedWidth, croppedHeight
        );

        croppedCanvas.toBlob((blob) => {
          if (blob) {
            const croppedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(croppedFile);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, file.type);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Remove background using Body-Pix segmentation
 */
export const removeBackground = async (file: File): Promise<File> => {
  return new Promise(async (resolve, reject) => {
    try {
      const model = await loadBodyPixModel();

      const img = new Image();
      const reader = new FileReader();

      reader.onload = async (e) => {
        img.onload = async () => {
          try {
            // Perform segmentation
            const segmentation = await model.segmentPerson(img, {
              flipHorizontal: false,
              internalResolution: 'medium',
              segmentationThreshold: 0.7,
            });

            // Create canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              reject(new Error('Could not get canvas context'));
              return;
            }

            canvas.width = img.width;
            canvas.height = img.height;

            // Draw original image
            ctx.drawImage(img, 0, 0);

            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Apply mask (make background transparent)
            for (let i = 0; i < segmentation.data.length; i++) {
              const shouldKeep = segmentation.data[i];
              if (!shouldKeep) {
                // Make this pixel transparent
                data[i * 4 + 3] = 0;
              }
            }

            ctx.putImageData(imageData, 0, 0);

            // Export as PNG to preserve transparency
            canvas.toBlob((blob) => {
              if (blob) {
                const newFileName = file.name.replace(/\.[^/.]+$/, '.png');
                const resultFile = new File([blob], newFileName, {
                  type: 'image/png',
                  lastModified: Date.now(),
                });
                resolve(resultFile);
              } else {
                reject(new Error('Failed to create blob'));
              }
            }, 'image/png');
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Replace background with a solid color or blur
 */
export const replaceBackgroundColor = async (
  file: File,
  backgroundColor: string = '#ffffff'
): Promise<File> => {
  return new Promise(async (resolve, reject) => {
    try {
      const model = await loadBodyPixModel();

      const img = new Image();
      const reader = new FileReader();

      reader.onload = async (e) => {
        img.onload = async () => {
          try {
            // Perform segmentation
            const segmentation = await model.segmentPerson(img, {
              flipHorizontal: false,
              internalResolution: 'medium',
              segmentationThreshold: 0.7,
            });

            // Create canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              reject(new Error('Could not get canvas context'));
              return;
            }

            canvas.width = img.width;
            canvas.height = img.height;

            // Fill with background color
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Create temporary canvas for foreground
            const fgCanvas = document.createElement('canvas');
            const fgCtx = fgCanvas.getContext('2d');

            if (!fgCtx) {
              reject(new Error('Could not get foreground canvas context'));
              return;
            }

            fgCanvas.width = img.width;
            fgCanvas.height = img.height;
            fgCtx.drawImage(img, 0, 0);

            const fgImageData = fgCtx.getImageData(0, 0, canvas.width, canvas.height);
            const fgData = fgImageData.data;

            // Apply mask to foreground
            for (let i = 0; i < segmentation.data.length; i++) {
              const shouldKeep = segmentation.data[i];
              if (!shouldKeep) {
                fgData[i * 4 + 3] = 0;
              }
            }

            fgCtx.putImageData(fgImageData, 0, 0);

            // Composite foreground over background
            ctx.drawImage(fgCanvas, 0, 0);

            canvas.toBlob((blob) => {
              if (blob) {
                const resultFile = new File([blob], file.name, {
                  type: file.type,
                  lastModified: Date.now(),
                });
                resolve(resultFile);
              } else {
                reject(new Error('Failed to create blob'));
              }
            }, file.type);
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    } catch (error) {
      reject(error);
    }
  });
};
