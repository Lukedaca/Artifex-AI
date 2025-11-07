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

const RAW_EXTENSIONS = ['cr2', 'cr3', 'nef', 'arw', 'orf', 'raf', 'dng', 'pef', 'rw2'];

/**
 * Attempts to extract an embedded JPEG preview from a TIFF-based RAW file.
 * Many RAW formats (NEF, DNG, ARW, etc.) use a TIFF structure that often includes
 * a full-resolution JPEG preview. This function parses the file to find it.
 * @param file The RAW file.
 * @returns A Promise that resolves to a new JPEG File object or null if not found.
 */
const extractEmbeddedJpeg = async (file: File): Promise<File | null> => {
    try {
        const buffer = await file.arrayBuffer();
        const view = new DataView(buffer);

        // Check TIFF header (first 2 bytes)
        const byteOrder = view.getUint16(0, false);
        const isLittleEndian = byteOrder === 0x4949; // "II"
        const isBigEndian = byteOrder === 0x4D4D; // "MM"

        if (!isLittleEndian && !isBigEndian) {
            return null; // Not a TIFF-based file
        }

        // Check for TIFF magic number (42)
        if (view.getUint16(2, isLittleEndian) !== 42) {
            return null;
        }

        let ifdOffset = view.getUint32(4, isLittleEndian);
        const previews: { offset: number, length: number }[] = [];

        // Loop through all Image File Directories (IFDs) to find potential previews
        while (ifdOffset !== 0 && ifdOffset < buffer.byteLength) {
            const numDirEntries = view.getUint16(ifdOffset, isLittleEndian);
            let jpegOffset = 0;
            let jpegLength = 0;

            for (let i = 0; i < numDirEntries; i++) {
                const entryOffset = ifdOffset + 2 + (i * 12);
                if (entryOffset + 12 > buffer.byteLength) break;
                
                const tagId = view.getUint16(entryOffset, isLittleEndian);
                
                // Tag 0x0201: JPEGInterchangeFormat (Offset to JPEG SOI)
                if (tagId === 0x0201) {
                    jpegOffset = view.getUint32(entryOffset + 8, isLittleEndian);
                }
                // Tag 0x0202: JPEGInterchangeFormatLength (Length of JPEG data)
                if (tagId === 0x0202) {
                    jpegLength = view.getUint32(entryOffset + 8, isLittleEndian);
                }
            }

            if (jpegOffset > 0 && jpegLength > 0 && (jpegOffset + jpegLength) <= buffer.byteLength) {
                previews.push({ offset: jpegOffset, length: jpegLength });
            }

            const nextIfdOffsetPos = ifdOffset + 2 + numDirEntries * 12;
            if (nextIfdOffsetPos + 4 > buffer.byteLength) break;
            ifdOffset = view.getUint32(nextIfdOffsetPos, isLittleEndian);
        }

        if (previews.length === 0) return null;

        // The best preview is usually the largest one.
        previews.sort((a, b) => b.length - a.length);
        const bestPreview = previews[0];

        const jpegData = buffer.slice(bestPreview.offset, bestPreview.offset + bestPreview.length);
        const blob = new Blob([jpegData], { type: 'image/jpeg' });
        const newFileName = file.name.replace(/\.[^/.]+$/, ".jpg");
        return new File([blob], newFileName, { type: 'image/jpeg' });

    } catch (e) {
        console.error("Error extracting JPEG from RAW file:", e);
        return null;
    }
};


export const normalizeImageFile = (file: File): Promise<File> => {
    return new Promise(async (resolve, reject) => {
        // Standard web formats can be used directly
        const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
        if (SUPPORTED_MIME_TYPES.includes(file.type)) {
            return resolve(file);
        }

        // For known RAW extensions, first try to extract the embedded JPEG preview
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension && RAW_EXTENSIONS.includes(extension)) {
            const extractedJpeg = await extractEmbeddedJpeg(file);
            if (extractedJpeg) {
                return resolve(extractedJpeg);
            }
        }

        // As a fallback for other formats (like TIFF) or RAWs where extraction failed,
        // try to let the browser decode it by drawing it to a canvas.
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(objectUrl);
                return reject(new Error('Interní chyba: Nelze vytvořit kontext plátna.'));
            }

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                URL.revokeObjectURL(objectUrl);
                if (blob) {
                    const newFileName = file.name.replace(/\.[^/.]+$/, ".png");
                    const newFile = new File([blob], newFileName, { type: 'image/png' });
                    resolve(newFile);
                } else {
                    reject(new Error('Interní chyba: Nelze exportovat obrázek z plátna.'));
                }
            }, 'image/png');
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`Váš prohlížeč nepodporuje tento formát souboru. Zkuste ho prosím nejprve převést na JPG nebo PNG.`));
        };

        img.src = objectUrl;
    });
};
