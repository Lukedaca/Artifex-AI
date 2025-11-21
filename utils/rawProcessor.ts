
// Define minimal interface for exifr
interface ExifrModule {
    thumbnail: (file: File | Blob | ArrayBuffer) => Promise<Uint8Array | undefined>;
    preview: (file: File | Blob | ArrayBuffer) => Promise<Uint8Array | undefined>;
    default: ExifrModule; 
}

export const RAW_EXTENSIONS = [".cr2", ".cr3", ".nef", ".arw", ".orf", ".raf", ".dng", ".pef", ".rw2"];
export const RAW_EXTENSIONS_STRING = RAW_EXTENSIONS.join(',');

interface ImageCandidate {
    blob: Blob;
    width: number;
    height: number;
    resolution: number;
    source: string;
}

// Helper: Check if a blob is a valid image and get dimensions
const validateImageBlob = (blob: Blob): Promise<{ isValid: boolean; width: number; height: number }> => {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            // 1. Check dimensions (Filter out 1x1 masks or tiny icons)
            if (img.width < 50 || img.height < 50) {
                URL.revokeObjectURL(url);
                resolve({ isValid: false, width: 0, height: 0 });
                return;
            }

            // 2. Check for CONTENT (Filter out solid black images)
            const canvas = document.createElement('canvas');
            canvas.width = 40; 
            canvas.height = 40;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, 40, 40);
                try {
                    const imageData = ctx.getImageData(0, 0, 40, 40);
                    const data = imageData.data;
                    let totalSum = 0;
                    // Scan pixels
                    for (let i = 0; i < data.length; i += 4) {
                        totalSum += data[i] + data[i + 1] + data[i + 2]; // R+G+B
                    }
                    
                    if (totalSum === 0) {
                         URL.revokeObjectURL(url);
                         resolve({ isValid: false, width: 0, height: 0 });
                         return;
                    }
                } catch (e) {
                    // Ignore CORS issues
                }
            }

            resolve({ isValid: true, width: img.width, height: img.height });
            URL.revokeObjectURL(url);
        };
        img.onerror = () => {
            resolve({ isValid: false, width: 0, height: 0 });
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });
};

// Helper to scan binary data for JPEG candidates (Fallback method)
const scanForJpegCandidates = async (file: File): Promise<Blob[]> => {
    try {
        const buffer = await file.arrayBuffer();
        const view = new Uint8Array(buffer);
        const candidates: { start: number, length: number }[] = [];

        // Scan for JPEG SOI marker (FF D8 FF)
        // Optimization: Skip bytes to be faster
        for (let i = 0; i < view.length - 2; i++) {
            if (view[i] === 0xFF && view[i + 1] === 0xD8 && view[i + 2] === 0xFF) {
                const start = i;
                let foundEOI = false;
                
                // Look for EOI marker (FF D9)
                const maxSearch = Math.min(view.length - 1, i + 20_000_000); 
                
                for (let j = i + 200; j < maxSearch; j++) {
                     if (view[j] === 0xFF && view[j + 1] === 0xD9) {
                        const end = j + 2;
                        const length = end - start;
                        
                        // Filter: Candidate must be > 100KB 
                        if (length > 100_000) {
                             candidates.push({ start, length });
                        }
                        foundEOI = true;
                        break; 
                     }
                }
                
                if (foundEOI) {
                    i += 1000; 
                }
            }
        }

        candidates.sort((a, b) => b.length - a.length);
        return candidates.slice(0, 3).map(c => 
            new Blob([view.slice(c.start, c.start + c.length)], { type: 'image/jpeg' })
        );

    } catch (e) {
        console.error("Scanner failed", e);
        return [];
    }
};

let exifrInstance: ExifrModule | null = null;

const getExifr = async (): Promise<ExifrModule | null> => {
    if (exifrInstance) return exifrInstance;
    try {
        // @ts-ignore
        const module = await import('https://esm.sh/exifr@7.1.3');
        exifrInstance = module.default || module;
        return exifrInstance;
    } catch (e) {
        console.warn("Exifr load failed", e);
        return null;
    }
};

export interface ProcessedRawFile {
    originalName: string;
    blob: Blob;
    width: number;
    height: number;
    sourceMethod: string;
}

/**
 * Main function to process a RAW file and extract the best JPEG preview.
 */
export const processRawFile = async (file: File): Promise<File> => {
    const exifr = await getExifr();
    const candidates: ImageCandidate[] = [];

    // 1. Try Exifr Preview
    if (exifr) {
        try {
            const previewData = await exifr.preview(file);
            if (previewData) {
                const blob = new Blob([previewData], { type: 'image/jpeg' });
                const { isValid, width, height } = await validateImageBlob(blob);
                if (isValid) candidates.push({ blob, width, height, resolution: width * height, source: 'Metadata (Preview)' });
            }
        } catch (e) {}

        // 2. Try Exifr Thumbnail
        try {
            const thumbData = await exifr.thumbnail(file);
            if (thumbData) {
                    const blob = new Blob([thumbData], { type: 'image/jpeg' });
                    const { isValid, width, height } = await validateImageBlob(blob);
                    if (isValid) candidates.push({ blob, width, height, resolution: width * height, source: 'Metadata (Thumbnail)' });
            }
        } catch (e) {}
    }

    // Check if we already found a high-res image (> 4 Megapixels)
    const hasHighRes = candidates.some(c => c.resolution > 4_000_000);

    if (!hasHighRes) {
            // 3. Run Brute Force Scanner
            const scannedBlobs = await scanForJpegCandidates(file);
            for (const blob of scannedBlobs) {
            const { isValid, width, height } = await validateImageBlob(blob);
            if (isValid) candidates.push({ blob, width, height, resolution: width * height, source: 'Binary Scan' });
            }
    }

    if (candidates.length === 0) {
        throw new Error("Nebyl nalezen validní náhled.");
    }

    // 4. Select the BEST candidate
    candidates.sort((a, b) => b.resolution - a.resolution);
    const bestCandidate = candidates[0];

    const newFileName = file.name.replace(/\.[^/.]+$/, ".jpg");
    return new File([bestCandidate.blob], newFileName, { type: 'image/jpeg' });
};

export const isRawFile = (file: File): boolean => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return RAW_EXTENSIONS.includes(ext);
};
