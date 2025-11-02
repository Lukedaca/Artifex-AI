import { ManualEdits, CropCoordinates } from "../types";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

// #region Color Conversion
const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s, l];
};

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        h /= 360;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [r * 255, g * 255, b * 255];
};
// #endregion

// Fast box blur for clarity
const boxBlur = (imageData: ImageData, radius: number): Uint8ClampedArray => {
    const { data, width, height } = imageData;
    const blurredData = new Uint8ClampedArray(data.length);
    const side = radius * 2 + 1;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, count = 0;
            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    const ix = clamp(x + kx, 0, width - 1);
                    const iy = clamp(y + ky, 0, height - 1);
                    const idx = (iy * width + ix) * 4;
                    r += data[idx];
                    g += data[idx + 1];
                    b += data[idx + 2];
                    count++;
                }
            }
            const currentIdx = (y * width + x) * 4;
            blurredData[currentIdx] = r / count;
            blurredData[currentIdx + 1] = g / count;
            blurredData[currentIdx + 2] = b / count;
            blurredData[currentIdx + 3] = data[currentIdx + 3]; // Alpha
        }
    }
    return blurredData;
}


export const applyEditsToImageData = (imageData: ImageData, edits: Omit<ManualEdits, 'crop'>): ImageData => {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;

    // Pre-calculate factors
    const brightness = (edits.brightness / 100) * 255;
    const contrast = edits.contrast / 100;
    const saturation = edits.saturation / 100;
    const vibrance = edits.vibrance / 100;
    const shadows = edits.shadows / 100;
    const highlights = edits.highlights / 100;
    const clarity = edits.clarity / 100;

    const contrastFactor = 1 + contrast;

    let blurredData: Uint8ClampedArray | null = null;
    if (clarity > 0) {
        const blurRadius = Math.max(1, Math.floor((width + height) * 0.005));
        // FIX: The object passed to boxBlur was not assignable to type 'ImageData'
        // because it was missing the 'colorSpace' property. Added it to conform to the type.
        blurredData = boxBlur({data, width, height, colorSpace: imageData.colorSpace}, blurRadius);
    }

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        
        // 1. Clarity (Unsharp Mask)
        if (clarity > 0 && blurredData) {
            const blurR = blurredData[i];
            const blurG = blurredData[i+1];
            const blurB = blurredData[i+2];
            r = clamp(r + (r - blurR) * clarity, 0, 255);
            g = clamp(g + (g - blurG) * clarity, 0, 255);
            b = clamp(b + (b - blurB) * clarity, 0, 255);
        }

        // 2. Brightness & Contrast
        r = clamp((r - 128) * contrastFactor + 128 + brightness, 0, 255);
        g = clamp((g - 128) * contrastFactor + 128 + brightness, 0, 255);
        b = clamp((b - 128) * contrastFactor + 128 + brightness, 0, 255);
        
        // 3. HSL adjustments
        if (saturation !== 0 || vibrance !== 0 || shadows !== 0 || highlights !== 0) {
            let [h, s, l] = rgbToHsl(r, g, b);

            // Shadows & Highlights
            if (shadows !== 0 || highlights !== 0) {
                // Apply a curve-like adjustment
                const shadowAdj = shadows * (1 - l);
                const highlightAdj = highlights * l;
                l = clamp(l + shadowAdj + highlightAdj, 0, 1);
            }
            
            // Saturation & Vibrance
            if (saturation !== 0 || vibrance !== 0) {
                const vibAdj = vibrance * (1 - Math.abs(s * 2 - 1)); // More effect on less saturated colors
                s = clamp(s + s * saturation + vibAdj, 0, 1);
            }

            [r, g, b] = hslToRgb(h, s, l);
        }

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
    }
    return new ImageData(data, width, height);
};

export const applyEditsToImage = (file: File, edits: ManualEdits): Promise<File> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.crossOrigin = 'anonymous';

        image.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return reject(new Error('Could not get canvas context'));
            
            ctx.drawImage(image, 0, 0);
            
            const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const editedImageData = applyEditsToImageData(originalImageData, edits);
            ctx.putImageData(editedImageData, 0, 0);

            canvas.toBlob((blob) => {
                if (!blob) return reject(new Error('Canvas toBlob failed'));
                const newFileName = file.name.replace(/\.[^/.]+$/, "") + "_edited.png";
                const newFile = new File([blob], newFileName, { type: 'image/png' });
                resolve(newFile);
            }, 'image/png', 0.98);
        };
        image.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
        image.src = url;
    });
};

export const cropImageToAspectRatio = (file: File, targetAspectRatio: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      const { width: originalWidth, height: originalHeight } = image;
      const originalAspectRatio = originalWidth / originalHeight;

      let sx = 0, sy = 0, sWidth = originalWidth, sHeight = originalHeight;

      if (originalAspectRatio > targetAspectRatio) {
        sWidth = originalHeight * targetAspectRatio;
        sx = (originalWidth - sWidth) / 2;
      } else if (originalAspectRatio < targetAspectRatio) {
        sHeight = originalWidth / targetAspectRatio;
        sy = (originalHeight - sHeight) / 2;
      }

      const canvas = document.createElement('canvas');
      canvas.width = sWidth;
      canvas.height = sHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) return reject(new Error('Could not get canvas context'));

      ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

      canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          const newFileName = file.name.replace(/\.[^/.]+$/, "") + "_cropped.png";
          const newFile = new File([blob], newFileName, { type: 'image/png' });
          resolve(newFile);
        }, 'image/png', 0.95);
    };

    image.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
    image.src = url;
  });
};

export const base64ToFile = (base64: string, filename: string, mimeType: string): Promise<File> => {
    return fetch(`data:${mimeType};base64,${base64}`)
        .then(res => res.blob())
        .then(blob => new File([blob], filename, { type: mimeType }));
};

export const cropImageToCoordinates = (file: File, coords: CropCoordinates): Promise<File> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      const { width: originalWidth, height: originalHeight } = image;

      const sx = originalWidth * coords.x;
      const sy = originalHeight * coords.y;
      const sWidth = originalWidth * coords.width;
      const sHeight = originalHeight * coords.height;
      
      if (sWidth <= 0 || sHeight <= 0) {
        return reject(new Error('Invalid crop dimensions calculated.'));
      }

      const canvas = document.createElement('canvas');
      canvas.width = sWidth;
      canvas.height = sHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) return reject(new Error('Could not get canvas context'));

      ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

      canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas toBlob failed'));
          const newFileName = file.name.replace(/\.[^/.]+$/, "") + "_autocropped.png";
          const newFile = new File([blob], newFileName, { type: 'image/png' });
          resolve(newFile);
        }, 'image/png', 0.95);
    };

    image.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
    image.src = url;
  });
};