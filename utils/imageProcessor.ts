
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
 * Normalizes an image file: ensures it's a JPEG and resizes it only if absolutely necessary
 * to prevent browser crashes, but keeps HIGH resolution (6K+).
 */
export const normalizeImageFile = (
    file: File,
    maxSize = 6000, // Increased to 6000 to support full resolution of most cameras (24MP)
    quality = 0.98 // Increased quality to prevent artifacts
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

                // Only resize if image is truly massive (saving memory/token limits)
                // otherwise keep original as much as possible.
                if (width > maxSize || height > maxSize) {
                     if (width > height) {
                        height = Math.round((height * maxSize) / width);
                        width = maxSize;
                    } else {
                        width = Math.round((width * maxSize) / height);
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                
                // Use high quality smoothing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
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
 * Uses enhanced algorithms for professional results:
 * - Luminance-based Contrast (prevents saturation shifts)
 * - Photographic Exposure (instead of linear brightness)
 * - Luma-weighted Saturation (protects darks/lights)
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
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }

      // --- 1. Calculate Dimensions based on Crop ---
      let srcX = 0;
      let srcY = 0;
      let srcW = img.width;
      let srcH = img.height;

      // Priority 1: Manual Rectangle Crop
      if (edits.cropRect) {
          srcX = Math.max(0, edits.cropRect.x);
          srcY = Math.max(0, edits.cropRect.y);
          srcW = Math.min(img.width - srcX, edits.cropRect.width);
          srcH = Math.min(img.height - srcY, edits.cropRect.height);
      } 
      // Priority 2: Aspect Ratio Center Crop
      else if (edits.aspectRatio) {
          const imageRatio = img.width / img.height;
          const targetRatio = edits.aspectRatio;

          if (imageRatio > targetRatio) {
              srcW = img.height * targetRatio;
              srcX = (img.width - srcW) / 2;
          } else {
              srcH = img.width / targetRatio;
              srcY = (img.height - srcH) / 2;
          }
      }

      // --- 2. Set Canvas Size ---
      // Ensure we are exporting at high resolution based on options
      const finalWidth = Math.floor(srcW * options.scale);
      const finalHeight = Math.floor(srcH * options.scale);
      
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, finalWidth, finalHeight);

      // Check if any pixel edits are actually required
      const hasPixelEdits = 
          edits.brightness !== 0 || edits.contrast !== 0 || 
          edits.saturation !== 0 || edits.vibrance !== 0 || 
          edits.shadows !== 0 || edits.highlights !== 0 ||
          edits.noiseReduction > 0 || edits.sharpness > 0 || edits.clarity > 0;

      if (hasPixelEdits) {
          const imageData = ctx.getImageData(0, 0, finalWidth, finalHeight);
          const data = imageData.data;

          // Pre-calculate static values outside loop for performance
          const exposureMultiplier = Math.pow(2, edits.brightness / 100); 
          const contrastFactor = (1.015 * (edits.contrast + 100)) / (100 * (1.015 - edits.contrast / 100));
          const saturationScale = 1 + (edits.saturation / 100);
          const vibranceScale = 1 + (edits.vibrance / 100);
          const shadowLift = edits.shadows * 0.8;
          const highlightRec = -(edits.highlights * 0.8);

          for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // --- 1. Exposure (Brightness) ---
            if (edits.brightness !== 0) {
                r *= exposureMultiplier;
                g *= exposureMultiplier;
                b *= exposureMultiplier;
            }

            // Calculate Luminance (Rec. 709)
            let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            // --- 2. Contrast (Luminance Only) ---
            if (edits.contrast !== 0) {
                let newLum = 128 + contrastFactor * (lum - 128);
                newLum = Math.max(0, Math.min(255, newLum)); // Clamp
                
                if (lum > 1) { // Avoid divide by zero
                    const ratio = newLum / lum;
                    r *= ratio;
                    g *= ratio;
                    b *= ratio;
                    lum = newLum;
                }
            }

            // --- 3. Shadows & Highlights (Luminance Masking) ---
            if (edits.shadows !== 0 || edits.highlights !== 0) {
                const normLum = lum / 255;
                
                if (edits.shadows !== 0) {
                    // Darker areas get more effect
                    const shadowMask = (1.0 - normLum) * (1.0 - normLum);
                    const lift = shadowLift * shadowMask;
                    r += lift; g += lift; b += lift;
                }

                if (edits.highlights !== 0) {
                    // Brighter areas get more effect
                    const highlightMask = normLum * normLum;
                    const recovery = highlightRec * highlightMask;
                    r += recovery; g += recovery; b += recovery;
                }
            }

            // --- 4. Saturation & Vibrance ---
            if (edits.saturation !== 0 || edits.vibrance !== 0) {
                // Recalc lum for accurate color mixing
                lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                
                let max = Math.max(r, g, b);
                let min = Math.min(r, g, b);
                let delta = max - min;
                let currentSat = (max === 0) ? 0 : delta / max;

                let totalSatMult = saturationScale;

                if (edits.vibrance !== 0) {
                    const vibFactor = (1 - currentSat); 
                    totalSatMult += ((vibranceScale - 1) * vibFactor);
                }

                r = lum + (r - lum) * totalSatMult;
                g = lum + (g - lum) * totalSatMult;
                b = lum + (b - lum) * totalSatMult;
            }

            // Final Clamp
            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
          }

          ctx.putImageData(imageData, 0, 0);

          // --- 5. Sharpness / Clarity / Noise ---
          // Using integer math where possible to avoid floating point errors causing black screen
          if (edits.noiseReduction > 0 || edits.sharpness > 0 || edits.clarity > 0) {
               const tempCanvas = document.createElement('canvas');
               tempCanvas.width = finalWidth;
               tempCanvas.height = finalHeight;
               const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;
               
               // Noise Reduction
               if (edits.noiseReduction > 0) {
                   tempCtx.drawImage(canvas, 0, 0);
                   ctx.filter = `blur(${edits.noiseReduction / 40}px)`; 
                   ctx.drawImage(tempCanvas, 0, 0);
                   ctx.filter = 'none';
               }

               // Sharpness / Clarity
               if (edits.sharpness > 0 || edits.clarity > 0) {
                    const sharpData = ctx.getImageData(0, 0, finalWidth, finalHeight);
                    const pixels = sharpData.data;
                    const sourceData = new Uint8ClampedArray(pixels);
                    
                    const sharpAmount = edits.sharpness / 100;
                    const clarityAmount = edits.clarity / 80;
                    const threshold = 10; 

                    // Skip edges
                    for (let y = 1; y < finalHeight - 1; y++) {
                        for (let x = 1; x < finalWidth - 1; x++) {
                            const idx = (y * finalWidth + x) * 4;
                            
                            for (let c = 0; c < 3; c++) {
                                const val = sourceData[idx + c];
                                
                                // Neighbor indices
                                const up = sourceData[((y - 1) * finalWidth + x) * 4 + c];
                                const down = sourceData[((y + 1) * finalWidth + x) * 4 + c];
                                const left = sourceData[(y * finalWidth + (x - 1)) * 4 + c];
                                const right = sourceData[(y * finalWidth + (x + 1)) * 4 + c];

                                // Simple Laplacian Filter
                                const laplacian = (4 * val) - (up + down + left + right);

                                if (Math.abs(laplacian) > threshold) {
                                    let newVal = val;
                                    // Add sharpness (high freq)
                                    newVal += (laplacian * sharpAmount);
                                    // Add clarity (mid freq boost simulation)
                                    newVal += (laplacian * clarityAmount * 0.6);
                                    
                                    pixels[idx + c] = Math.max(0, Math.min(255, newVal));
                                }
                            }
                        }
                    }
                    ctx.putImageData(sharpData, 0, 0);
               }
          }
      }

      // Export
      const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
      // Ensure quality is never below 0.1 or above 1
      const quality = options.format === 'jpeg' ? Math.max(0.1, Math.min(1, options.quality / 100)) : undefined;
      
      canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed.'));
        }, mimeType, quality);
    };
    img.onerror = () => reject(new Error('Failed to load image for editing.'));
    img.src = imageUrl;
  });
};
