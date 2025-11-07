import { CropCoordinates, ManualEdits } from '../types';

/**
 * Converts a base64 string to a File object.
 */
export const base64ToFile = async (base64: string, filename: string, mimeType: string): Promise<File> => {
  const res = await fetch(`data:${mimeType};base64,${base64}`);
  const blob = await res.blob();
  return new File([blob], filename, { type: mimeType });
};

/**
 * Loads an image from a File object.
 */
const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Resizes an image file for analysis, maintaining aspect ratio.
 */
export const resizeImageForAnalysis = async (file: File, maxSize: number): Promise<Blob> => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  let { width, height } = img;

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

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas to Blob conversion failed'));
      }
    }, 'image/jpeg', 0.9);
  });
};

/**
 * Applies visual edits (brightness, contrast, etc.) and cropping to an image.
 */
export const applyEditsToImage = async (
  file: File,
  edits: Partial<Omit<ManualEdits, 'crop'>>,
  crop?: CropCoordinates,
  outputFormat: string = 'image/png'
): Promise<Blob> => {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  const sourceX = crop ? img.naturalWidth * crop.x : 0;
  const sourceY = crop ? img.naturalHeight * crop.y : 0;
  const sourceWidth = crop ? img.naturalWidth * crop.width : img.naturalWidth;
  const sourceHeight = crop ? img.naturalHeight * crop.height : img.naturalHeight;

  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  // Build the CSS filter string
  const filters = [
    `brightness(${100 + (edits.brightness || 0)}%)`,
    `contrast(${100 + (edits.contrast || 0)}%)`,
    `saturate(${100 + (edits.saturation || 0)}%)`,
  ];
  
  // Note: True highlights/shadows/clarity/vibrance adjustments are complex and would require
  // pixel-level manipulation, which is beyond the scope of simple canvas filters.
  // The below filters are approximations.
  ctx.filter = filters.join(' ');
  
  ctx.drawImage(
    img,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas to Blob conversion failed'));
      }
    }, outputFormat, 1); // Use full quality for PNG
  });
};

export const cropImageToAspectRatio = async (file: File, aspectRatio: number): Promise<Blob> => {
    const img = await loadImage(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    let sourceX = 0, sourceY = 0, sourceWidth = img.naturalWidth, sourceHeight = img.naturalHeight;
    const originalAspectRatio = img.naturalWidth / img.naturalHeight;

    if (originalAspectRatio > aspectRatio) { // Image is wider than target
        sourceWidth = img.naturalHeight * aspectRatio;
        sourceX = (img.naturalWidth - sourceWidth) / 2;
    } else if (originalAspectRatio < aspectRatio) { // Image is taller than target
        sourceHeight = img.naturalWidth / aspectRatio;
        sourceY = (img.naturalHeight - sourceHeight) / 2;
    }

    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);

    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Crop to aspect ratio failed.'));
        }, 'image/png');
    });
};

export const resizeImage = async (file: File, targetWidth: number): Promise<Blob> => {
    const img = await loadImage(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const aspectRatio = img.naturalHeight / img.naturalWidth;
    const targetHeight = Math.round(targetWidth * aspectRatio);

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Image resize failed.'));
        }, 'image/png');
    });
};


/**
 * Normalizes an image file to a standard format (e.g., JPEG) to ensure compatibility.
 * This is useful for images like HEIC or other formats browsers may not handle well in canvas.
 */
export const normalizeImageFile = async (file: File, format: 'image/jpeg' | 'image/png' = 'image/jpeg', quality = 0.9): Promise<File> => {
  // If the file is already a standard web format, we can skip normalization
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return file;
  }
  
  // For non-standard files, attempt to draw them to canvas to convert.
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
      throw new Error('Could not get canvas context for normalization');
  }

  ctx.drawImage(img, 0, 0);

  return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
          if (blob) {
              const newFileName = file.name.replace(/\.[^/.]+$/, `.${format.split('/')[1]}`);
              resolve(new File([blob], newFileName, { type: format }));
          } else {
              reject(new Error('Image normalization failed'));
          }
      }, format, quality);
  });
};