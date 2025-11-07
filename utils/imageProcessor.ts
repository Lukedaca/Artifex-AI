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

export const resizeImage = (file: File, targetWidth: number): Promise<File> => {
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
            const aspectRatio = originalWidth / originalHeight;

            const targetHeight = targetWidth / aspectRatio;
            
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            canvas.toBlob((blob) => {
                if (blob) {
                    const newFileName = file.name.replace(/\.[^/.]+$/, "") + `_resized.png`;
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

export const resizeImageForAnalysis = (file: File, maxDimension: number): Promise<Blob> => {
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

            let { width, height } = img;

            if (width > height) {
                if (width > maxDimension) {
                    height = Math.round(height * (maxDimension / width));
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width = Math.round(width * (maxDimension / height));
                    height = maxDimension;
                }
            }

            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create blob from canvas for resizing'));
                }
                URL.revokeObjectURL(objectUrl);
            }, 'image/jpeg', 0.9); // Use JPEG for smaller size
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

/**
 * Scans a file for embedded JPEG data by looking for SOI and EOI markers.
 * This is a robust fallback for RAW files that are not easily parsed, like CR3.
 * @param file The file to scan.
 * @returns A promise that resolves to the largest found JPEG as a new File object, or null.
 */
const scanForJpeg = async (file: File): Promise<File | null> => {
    try {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        
        const jpegSOI = [0xFF, 0xD8, 0xFF]; // Start Of Image marker prefix
        const jpegEOI = [0xFF, 0xD9];       // End Of Image marker

        const previews = [];
        let searchIndex = 0;

        while (searchIndex < data.length) {
            let startIndex = -1;
            // Find the start of a potential JPEG (SOI marker FF D8 FF)
            for (let i = searchIndex; i < data.length - 2; i++) {
                // Check for FF D8 FF E0/E1/etc. to be more specific
                if (data[i] === jpegSOI[0] && data[i+1] === jpegSOI[1] && data[i+2] === jpegSOI[2]) {
                    startIndex = i;
                    break;
                }
            }

            if (startIndex === -1) {
                break; // No more SOI markers found
            }

            // Find the end of this JPEG (EOI marker FF D9)
            let endIndex = -1;
            for (let j = startIndex + 2; j < data.length - 1; j++) {
                if (data[j] === jpegEOI[0] && data[j+1] === jpegEOI[1]) {
                    endIndex = j + 2; // Include the EOI marker itself
                    break;
                }
            }
            
            if (endIndex !== -1) {
                previews.push({ start: startIndex, length: endIndex - startIndex });
                searchIndex = endIndex; // Continue searching from the end of the found JPEG
            } else {
                // If EOI isn't found, this wasn't a valid JPEG.
                // Move past the found SOI to avoid infinite loops.
                searchIndex = startIndex + 1; 
            }
        }

        if (previews.length === 0) {
            return null;
        }

        // The best preview is the largest one.
        previews.sort((a, b) => b.length - a.length);
        const bestPreview = previews[0];
        
        const jpegData = buffer.slice(bestPreview.start, bestPreview.start + bestPreview.length);
        const blob = new Blob([jpegData], { type: 'image/jpeg' });
        const newFileName = file.name.replace(/\.[^/.]+$/, ".jpg");
        
        return new File([blob], newFileName, { type: 'image/jpeg' });

    } catch (e) {
        console.error("Error scanning for embedded JPEG:", e);
        return null;
    }
}

export const normalizeImageFile = (file: File): Promise<File> => {
    return new Promise(async (resolve, reject) => {
        // Standard web formats can be used directly
        const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
        if (SUPPORTED_MIME_TYPES.includes(file.type)) {
            return resolve(file);
        }

        const extension = file.name.split('.').pop()?.toLowerCase();
        
        // For known RAW extensions, try to extract the embedded full-quality JPEG preview
        if (extension && RAW_EXTENSIONS.includes(extension)) {
            let extractedJpeg: File | null = null;
            
            // For TIFF-based RAWs, use the parser. For others (like CR3), it will fail and go to the fallback.
            extractedJpeg = await extractEmbeddedJpeg(file);
            
            // If the primary TIFF parser failed, fall back to a more generic JPEG scan.
            // This is especially useful for non-TIFF based RAWs like CR3.
            if (!extractedJpeg) {
                console.warn(`TIFF parser failed for ${extension}, falling back to generic JPEG scan.`);
                extractedJpeg = await scanForJpeg(file);
            }

            if (extractedJpeg) {
                return resolve(extractedJpeg);
            }
        }

        // As a final fallback for other formats or RAWs where all extraction failed,
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