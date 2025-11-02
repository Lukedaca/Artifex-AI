import type { ManualEdits, CropCoordinates } from '../types';

export const applyEditsToImage = (
    file: File,
    edits: Partial<Omit<ManualEdits, 'crop'>>,
    crop?: CropCoordinates,
    outputFormat: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(objectUrl);
                return reject(new Error('Could not get canvas context'));
            }

            let sourceX = 0;
            let sourceY = 0;
            let sourceWidth = img.width;
            let sourceHeight = img.height;

            if (crop) {
                sourceX = Math.floor(img.width * crop.x);
                sourceY = Math.floor(img.height * crop.y);
                sourceWidth = Math.floor(img.width * crop.width);
                sourceHeight = Math.floor(img.height * crop.height);
            }

            canvas.width = sourceWidth;
            canvas.height = sourceHeight;

            // Note: CSS filters are limited. Vibrance, clarity, shadows, highlights are not directly supported.
            // This is a simplified implementation.
            const filters = [
                `brightness(${100 + (edits.brightness || 0)}%)`,
                `contrast(${100 + (edits.contrast || 0)}%)`,
                `saturate(${100 + (edits.saturation || 0)}%)`,
            ].join(' ');

            ctx.filter = filters;

            ctx.drawImage(
                img,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                0,
                0,
                sourceWidth,
                sourceHeight
            );

            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create blob from canvas'));
                }
                URL.revokeObjectURL(objectUrl);
            }, outputFormat);
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(err);
        };
        img.src = objectUrl;
    });
};

export const cropImageToAspectRatio = (file: File, aspectRatio: number): Promise<File> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(objectUrl);
                return reject(new Error('Could not get canvas context'));
            }

            const originalWidth = img.width;
            const originalHeight = img.height;
            const originalAspectRatio = originalWidth / originalHeight;

            let targetWidth = originalWidth;
            let targetHeight = originalHeight;
            let offsetX = 0;
            let offsetY = 0;

            if (originalAspectRatio > aspectRatio) {
                // Image is wider than target aspect ratio, crop width
                targetWidth = originalHeight * aspectRatio;
                offsetX = (originalWidth - targetWidth) / 2;
            } else if (originalAspectRatio < aspectRatio) {
                // Image is taller than target aspect ratio, crop height
                targetHeight = originalWidth / aspectRatio;
                offsetY = (originalHeight - targetHeight) / 2;
            }
            
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            
            ctx.drawImage(img, offsetX, offsetY, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);

            canvas.toBlob((blob) => {
                if (blob) {
                    const newFileName = file.name.replace(/\.[^/.]+$/, "") + `_cropped.png`;
                    resolve(new File([blob], newFileName, { type: 'image/png' }));
                } else {
                    reject(new Error('Failed to create blob from canvas'));
                }
                URL.revokeObjectURL(objectUrl);
            }, 'image/png');
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        };
        img.src = objectUrl;
    });
};

export const base64ToFile = (base64: string, filename: string, mimeType: string): Promise<File> => {
    return fetch(`data:${mimeType};base64,${base64}`)
        .then(res => res.blob())
        .then(blob => new File([blob], filename, { type: mimeType }));
};