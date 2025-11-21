
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UploadIcon, ArrowPathIcon, ExportIcon, XCircleIcon } from './icons';
import Header from './Header';

interface RAWConverterViewProps {
    title: string;
    onOpenApiKeyModal: () => void;
    onToggleSidebar: () => void;
    addNotification: (message: string, type?: 'info' | 'error') => void;
    onFilesConverted: (files: File[]) => void;
}

// Define minimal interface for exifr
interface ExifrModule {
    thumbnail: (file: File | Blob | ArrayBuffer) => Promise<Uint8Array | undefined>;
    preview: (file: File | Blob | ArrayBuffer) => Promise<Uint8Array | undefined>;
    default: ExifrModule; // Handle potential default export
}

const RAW_EXTENSIONS_STRING = ".cr2,.cr3,.nef,.arw,.orf,.raf,.dng,.pef,.rw2";

interface ConvertedFile {
    originalName: string;
    blob: Blob;
    url: string;
    sizeLabel: string;
    isHighQuality: boolean;
    dimensions?: string;
    sourceMethod?: string;
}

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
                // Limit search window to avoid hanging on huge files without finding EOI
                const maxSearch = Math.min(view.length - 1, i + 20_000_000); // Limit max JPEG size check to 20MB per candidate
                
                for (let j = i + 200; j < maxSearch; j++) {
                     if (view[j] === 0xFF && view[j + 1] === 0xD9) {
                        const end = j + 2;
                        const length = end - start;
                        
                        // Filter: Candidate must be > 100KB to be a potential high quality preview
                        if (length > 100_000) {
                             candidates.push({ start, length });
                        }
                        foundEOI = true;
                        break; 
                     }
                }
                
                if (foundEOI) {
                    // If we found a large image, jump ahead to avoid scanning inside it
                    i += 1000; 
                }
            }
        }

        // Sort by length descending (Largest file size first)
        candidates.sort((a, b) => b.length - a.length);

        // Return top 3 largest blobs
        return candidates.slice(0, 3).map(c => 
            new Blob([view.slice(c.start, c.start + c.length)], { type: 'image/jpeg' })
        );

    } catch (e) {
        console.error("Scanner failed", e);
        return [];
    }
};


const RAWConverterView: React.FC<RAWConverterViewProps> = ({ 
    title,
    onOpenApiKeyModal,
    onToggleSidebar,
    addNotification,
    onFilesConverted
}) => {
    const [rawFiles, setRawFiles] = useState<File[]>([]);
    const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([]);
    const [isConverting, setIsConverting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [libraryStatus, setLibraryStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
    const exifrRef = useRef<ExifrModule | null>(null);

    const initializeLibrary = async () => {
        setLibraryStatus('initializing');
        try {
            // @ts-ignore
            const module = await import('https://esm.sh/exifr@7.1.3');
            exifrRef.current = module.default || module;
            setLibraryStatus('ready');
        } catch (err) {
            console.error("Failed to load exifr module:", err);
            setLibraryStatus('ready'); // We proceed anyway, fallback scanner will work
        }
    };

    useEffect(() => {
        initializeLibrary();
    }, []);

    const handleFileSelect = (files: FileList | null) => {
        if (files) {
            const newFiles = Array.from(files);
            setRawFiles(newFiles);
            setConvertedFiles([]); // Clear previous results
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    };
    
    const handleConvert = async () => {
        if (rawFiles.length === 0) {
            addNotification("Nebyly vybrány žádné soubory.", 'error');
            return;
        }

        setIsConverting(true);
        setProgress({ current: 0, total: rawFiles.length });
        const newConvertedFiles: ConvertedFile[] = [];
        const exifr = exifrRef.current;

        for (const file of rawFiles) {
            try {
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
                // If so, skip the slow scanner to save performance.
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
                    throw new Error("V souboru nebyl nalezen žádný validní náhled.");
                }

                // 4. Select the BEST candidate (Highest Resolution)
                candidates.sort((a, b) => b.resolution - a.resolution);
                const bestCandidate = candidates[0];

                const newFileName = file.name.replace(/\.[^/.]+$/, ".jpg");
                const sizeInMB = (bestCandidate.blob.size / (1024 * 1024)).toFixed(2);
                const sizeLabel = `${sizeInMB} MB`;
                const isHighQuality = bestCandidate.resolution > 2_000_000; // > 2MP is considered HQ

                newConvertedFiles.push({
                    originalName: newFileName,
                    blob: bestCandidate.blob,
                    url: URL.createObjectURL(bestCandidate.blob),
                    sizeLabel,
                    isHighQuality,
                    dimensions: `${bestCandidate.width} x ${bestCandidate.height}`,
                    sourceMethod: bestCandidate.source
                });

            } catch (error: any) {
                console.error(error);
                addNotification(`Chyba při konverzi souboru ${file.name}: ${error.message || 'Neznámá chyba'}`, 'error');
            } finally {
                setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }
        }
        
        setConvertedFiles(newConvertedFiles);
        setIsConverting(false);
        if (newConvertedFiles.length > 0) {
            addNotification(`Konverze dokončena. ${newConvertedFiles.length} souborů připraveno.`, 'info');
        }
    };

    const handleAddToProject = () => {
        const files = convertedFiles.map(cf => new File([cf.blob], cf.originalName, { type: 'image/jpeg' }));
        onFilesConverted(files);
    };
    
    const downloadFile = (url: string, name: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="h-full w-full flex flex-col">
             <Header 
                title={title} 
                onOpenApiKeyModal={onOpenApiKeyModal}
                onToggleSidebar={onToggleSidebar}
            />
            
            <div className="flex-1 flex flex-col items-center p-4 sm:p-8 overflow-y-auto">
                <div className="w-full max-w-6xl">
                     <div className="text-center mb-10">
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-100">Převodník z RAW do JPEG</h1>
                        <p className="mt-3 text-xl text-slate-400 max-w-3xl mx-auto">
                            Nahrajte své RAW fotografie (CR2, NEF, ARW...). Náš inteligentní skener analyzuje soubor a vybere <strong>náhled s nejvyšším dostupným rozlišením</strong>.
                        </p>
                    </div>

                    {libraryStatus === 'initializing' ? (
                        <div className="h-64 w-full flex items-center justify-center text-slate-500 bg-slate-900/60 rounded-2xl border border-slate-800/50">
                            <svg className="animate-spin h-8 w-8 text-fuchsia-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span className="ml-4 text-lg">Příprava nástrojů...</span>
                        </div>
                    ) : (
                         <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-2xl shadow-lg border border-slate-800/50">
                            {convertedFiles.length === 0 ? (
                                <div 
                                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                                    onDrop={handleDrop}
                                    className={`p-10 border-2 border-dashed rounded-xl transition-colors ${isDragging ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700'}`}
                                >
                                    <div className="text-center">
                                        <UploadIcon className="mx-auto h-12 w-12 text-slate-500" />
                                        <p className="mt-4 font-semibold text-slate-300">
                                            {rawFiles.length > 0 ? `${rawFiles.length} souborů vybráno` : "Přetáhněte RAW soubory sem"}
                                        </p>
                                        <p className="text-sm text-slate-400">nebo klikněte pro výběr</p>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            accept={RAW_EXTENSIONS_STRING}
                                            onChange={(e) => handleFileSelect(e.target.files)}
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="mt-4 px-4 py-2 text-sm font-semibold text-cyan-400 rounded-md hover:bg-cyan-500/10 transition-colors"
                                        >
                                            {rawFiles.length > 0 ? "Vybrat jiné" : "Vybrat soubory"}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="text-xl font-bold mb-4">Konverze dokončena</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                        {convertedFiles.map((file) => (
                                            <div key={file.originalName} className="group relative aspect-square bg-slate-800 rounded-lg overflow-hidden shadow-md border border-slate-700/50">
                                                <img src={file.url} alt={file.originalName} className="w-full h-full object-contain" />
                                                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                                     {file.isHighQuality ? (
                                                        <span className="px-2 py-1 bg-emerald-500/90 text-white text-xs font-bold rounded shadow-sm">HQ Náhled</span>
                                                     ) : (
                                                        <span className="px-2 py-1 bg-yellow-500/90 text-black text-xs font-bold rounded shadow-sm">Low Res</span>
                                                     )}
                                                     <div className="px-2 py-1 bg-black/50 text-slate-300 text-xs rounded backdrop-blur-md flex flex-col items-end">
                                                         <span className="font-bold">{file.dimensions}</span>
                                                         <span className="opacity-70 text-[10px]">{file.sizeLabel}</span>
                                                     </div>
                                                </div>
                                                
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => downloadFile(file.url, file.originalName)} className="p-3 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-all transform hover:scale-110" title="Stáhnout">
                                                        <ExportIcon className="w-8 h-8" />
                                                    </button>
                                                </div>
                                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-xs text-center text-slate-300 truncate">
                                                    {file.originalName}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-8">
                                {convertedFiles.length === 0 ? (
                                    <button
                                        onClick={handleConvert}
                                        disabled={isConverting || rawFiles.length === 0}
                                        className="w-full inline-flex items-center justify-center px-6 py-4 border border-transparent text-lg font-semibold rounded-lg shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-1 active:translate-y-0 aurora-glow"
                                    >
                                        <ArrowPathIcon className="mr-3 h-6 w-6" />
                                        {isConverting ? `Analyzuji kvalitu (${progress.current}/${progress.total})...` : `Konvertovat ${rawFiles.length === 0 ? '' : (rawFiles.length === 1 ? '1 soubor' : `${rawFiles.length} souborů`)}`}
                                    </button>
                                ) : (
                                    <div className="flex flex-col sm:flex-row gap-4">
                                         <button
                                            onClick={handleAddToProject}
                                            className="w-full sm:w-auto flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 transition-all aurora-glow"
                                        >
                                            Přidat do Studia
                                        </button>
                                        <button
                                            onClick={() => { setRawFiles([]); setConvertedFiles([]); }}
                                            className="w-full sm:w-auto flex-1 inline-flex items-center justify-center px-6 py-3 border border-slate-700 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
                                        >
                                            Převést další
                                        </button>
                                    </div>
                                )}
                                {isConverting && (
                                    <div className="w-full bg-slate-700 rounded-full h-2.5 mt-4">
                                        <div className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                                        <p className="text-center text-xs text-slate-400 mt-2">
                                            Hledám maximální rozlišení v datech RAW souboru...
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RAWConverterView;
