/**
 * Converts a File object to a base64 encoded string, without the data URL prefix.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // result is "data:mime/type;base64,..." - we only want the part after the comma
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to read file as base64 string.'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * Converts a base64 encoded string to a File object.
 */
export const base64ToFile = async (base64: string, filename: string, mimeType: string): Promise<File> => {
  const res = await fetch(`data:${mimeType};base64,${base64}`);
  const blob = await res.blob();
  return new File([blob], filename, { type: mimeType });
};

/**
 * Normalizes an image file: ensures it's a JPEG and resizes it if it's too large.
 * This helps with performance and meets API constraints.
 */
export const normalizeImageFile = (
    file: File,
    maxSize = 2048,
    quality = 0.9
): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }

                // Calculate new dimensions
                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const newFileName = file.name.replace(/\.[^/.]+$/, '.jpeg');
                            const normalizedFile = new File([blob], newFileName, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(normalizedFile);
                        } else {
                            reject(new Error('Canvas toBlob failed.'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = (error) => reject(error);
            if (event.target?.result) {
                img.src = event.target.result as string;
            } else {
                reject(new Error("File could not be read."));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

import type { ManualEdits } from '../types';

/**
 * Applies all manual edits to an image and returns a blob for export.
 * This replaces simple CSS filters with real pixel-level manipulation for professional results.
 */
export const applyEditsAndExport = (
  imageUrl: string,
  edits: ManualEdits,
  options: { format: string; quality: number; scale: number }
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }

      const width = img.width * options.scale;
      const height = img.height * options.scale;
      canvas.width = width;
      canvas.height = height;
      
      // Draw initial image
      ctx.drawImage(img, 0, 0, width, height);

      // Get pixel data to apply real edits
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Prepare edit factors
      const brightness = edits.brightness * 2.55; // scale to -255 to 255
      const contrastFactor = (100 + edits.contrast) / 100;
      const saturationFactor = (100 + edits.saturation) / 100;
      const vibranceFactor = edits.vibrance / 100;
      const shadowsFactor = edits.shadows / 100;
      const highlightsFactor = edits.highlights / 100;

      // Loop through every pixel and apply color/tone adjustments
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        
        // --- Tonal Adjustments ---
        // Brightness
        if (brightness !== 0) {
            r += brightness;
            g += brightness;
            b += brightness;
        }
        
        // Contrast
        if (contrastFactor !== 1) {
            r = 128 + contrastFactor * (r - 128);
            g = 128 + contrastFactor * (g - 128);
            b = 128 + contrastFactor * (b - 128);
        }

        // Shadows & Highlights
        const luminance = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]; // Use original luminance
        if (highlightsFactor !== 0) {
            const highlightAmount = highlightsFactor * (luminance / 255);
            r += highlightAmount * (255 - r);
            g += highlightAmount * (255 - g);
            b += highlightAmount * (255 - b);
        }
        if (shadowsFactor !== 0) {
            const shadowAmount = shadowsFactor * (1 - (luminance / 255));
            r += shadowAmount * r;
            g += shadowAmount * g;
            b += shadowAmount * b;
        }

        // --- Color Adjustments ---
        // Vibrance
        if (vibranceFactor !== 0) {
            const max = Math.max(r, g, b);
            const avg = (r + g + b) / 3;
            const sat = (max - avg) / 128; // Approx saturation 0-2
            const boost = vibranceFactor * (1 - sat);
            if (boost > 0) {
                r += (max - r) * boost;
                g += (max - g) * boost;
                b += (max - b) * boost;
            }
        }
        
        // Saturation
        if (saturationFactor !== 1) {
            const gray = r * 0.3 + g * 0.59 + b * 0.11;
            r = gray * (1 - saturationFactor) + r * saturationFactor;
            g = gray * (1 - saturationFactor) + g * saturationFactor;
            b = gray * (1 - saturationFactor) + b * saturationFactor;
        }

        // Clamp values to 0-255 range
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
      }

      ctx.putImageData(imageData, 0, 0);

      // --- Clarity, Sharpness, Noise Reduction ---
      // Apply these after color/tone. Noise reduction first, then sharpening/clarity.

      // Noise Reduction (as a blur)
      if (edits.noiseReduction > 0) {
          ctx.filter = `blur(${edits.noiseReduction / 50}px)`; // subtle blur
          ctx.drawImage(canvas, 0, 0, width, height);
          ctx.filter = 'none'; // reset for next operations
      }

      // Sharpening & Clarity
      if (edits.sharpness > 0 || edits.clarity > 0) {
        // Clarity is a form of local contrast, we'll simulate it with a sharpening pass
        // that has a wider reach, combined with the dedicated sharpness.
        const totalSharpenStrength = (edits.sharpness / 100) + (edits.clarity / 150);

        if (totalSharpenStrength > 0) {
            const sharpData = ctx.getImageData(0, 0, width, height);
            const pixels = sharpData.data;
            const tempPixels = new Uint8ClampedArray(pixels);
            
            const kernel = [ [0, -1, 0], [-1, 5, -1], [0, -1, 0] ];
            
            for (let i = 0; i < pixels.length; i++) {
              if ((i + 1) % 4 === 0) continue; // Skip alpha
              const y = Math.floor(i / (width * 4));
              const x = (i / 4) % width;
              let r = 0, g = 0, b = 0;

              for (let ky = -1; ky <= 1; ky++) {
                  for (let kx = -1; kx <= 1; kx++) {
                      const px = x + kx;
                      const py = y + ky;
                      if (px >= 0 && px < width && py >= 0 && py < height) {
                          const index = (py * width + px) * 4;
                          const weight = kernel[ky + 1][kx + 1];
                          r += tempPixels[index] * weight;
                          g += tempPixels[index + 1] * weight;
                          b += tempPixels[index + 2] * weight;
                      }
                  }
              }
              const originalIndex = (y * width + x) * 4;
              pixels[originalIndex] = tempPixels[originalIndex] * (1 - totalSharpenStrength) + r * totalSharpenStrength;
              pixels[originalIndex + 1] = tempPixels[originalIndex + 1] * (1 - totalSharpenStrength) + g * totalSharpenStrength;
              pixels[originalIndex + 2] = tempPixels[originalIndex + 2] * (1 - totalSharpenStrength) + b * totalSharpenStrength;
            }
            ctx.putImageData(sharpData, 0, 0);
        }
      }

      // --- Export to Blob ---
      const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const quality = options.format === 'jpeg' ? options.quality / 100 : undefined;
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob failed.'));
          }
        },
        mimeType,
        quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image for editing.'));
    img.src = imageUrl;
  });
};
