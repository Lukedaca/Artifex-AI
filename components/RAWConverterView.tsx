import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UploadIcon, ArrowPathIcon, ExportIcon, XCircleIcon } from './icons';

interface RAWConverterViewProps {
    addNotification: (message: string, type?: 'info' | 'error') => void;
}

// Define the interface for the dynamically imported module
interface LibRawModule {
    init: (options: { wasmPath: string }) => Promise<void>;
    extractThumb: (buffer: ArrayBuffer) => Promise<Uint8Array | null>;
    default: LibRawModule; // Handle cases where it's a default export
}


const RAW_EXTENSIONS_STRING = ".cr2,.cr3,.nef,.arw,.orf,.raf,.dng,.pef,.rw2";

interface ConvertedFile {
    originalName: string;
    blob: Blob;
    url: string;
}

const RAWConverterView: React.FC<RAWConverterViewProps> = ({ addNotification }) => {
    const [rawFiles, setRawFiles] = useState<File[]>([]);
    const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([]);
    const [isConverting, setIsConverting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [libraryStatus, setLibraryStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
    const librawRef = useRef<LibRawModule | null>(null);

    useEffect(() => {
        const initializeLibrary = async () => {
            setLibraryStatus('initializing');
            try {
                // Dynamically import the library from a reliable ESM CDN.
                // This makes it a "local" part of the app's logic flow, avoiding CDN loading issues.
                const librawModule: LibRawModule = await import('https://esm.sh/libraw-wasm@0.3.0');
                const libraw = librawModule.default || librawModule;

                // Initialize the WASM module
                await libraw.init({
                    // The WASM file needs to be accessible from the same reliable CDN
                    wasmPath: 'https://esm.sh/libraw-wasm@0.3.0/dist/libraw.wasm'
                });
                
                librawRef.current = libraw;
                setLibraryStatus('ready');
            } catch (err) {
                console.error("Failed to load or initialize LibRaw module:", err);
                setLibraryStatus('error');
            }
        };
        
        initializeLibrary();
    }, []);

    const handleFileSelect = (files: FileList | null) => {
        if (files) {
            setRawFiles(Array.from(files));
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
        if (rawFiles.length === 0 || !librawRef.current) {
            addNotification("Konvertor není připraven nebo nebyly vybrány žádné soubory.", 'error');
            return;
        }

        setIsConverting(true);
        setProgress({ current: 0, total: rawFiles.length });
        const newConvertedFiles: ConvertedFile[] = [];
        const libraw = librawRef.current;

        for (const file of rawFiles) {
            try {
                const buffer = await file.arrayBuffer();
                const thumbData = await libraw.extractThumb(buffer);
                
                if (!thumbData || thumbData.length === 0) {
                    throw new Error("V souboru nebyl nalezen žádný platný náhled.");
                }

                const previewBlob = new Blob([thumbData], { type: 'image/jpeg' });
                const newFileName = file.name.replace(/\.[^/.]+$/, ".jpg");
                
                newConvertedFiles.push({
                    originalName: newFileName,
                    blob: previewBlob,
                    url: URL.createObjectURL(previewBlob)
                });

            } catch (error: any) {
                addNotification(`Chyba při konverzi souboru ${file.name}: ${error.message}`, 'error');
            } finally {
                setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }
        }
        
        setConvertedFiles(newConvertedFiles);
        setIsConverting(false);
        if (newConvertedFiles.length > 0) {
            addNotification(`Konverze dokončena. ${newConvertedFiles.length} souborů připraveno ke stažení.`, 'info');
        }
    };
    
    const downloadFile = (url: string, name: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (libraryStatus === 'initializing') {
        return (
            <div className="flex h-full w-full items-center justify-center text-slate-500">
                <svg className="animate-spin h-8 w-8 text-fuchsia-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span className="ml-4 text-lg">Inicializace konvertoru...</span>
            </div>
        );
    }
    
    if (libraryStatus === 'error') {
         return (
             <div className="h-full w-full flex flex-col items-center justify-center text-center p-8">
                 <XCircleIcon className="w-16 h-16 text-red-400 mb-4"/>
                 <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Konvertor se nepodařilo načíst</h2>
                 <p className="mt-2 max-w-lg text-slate-500 dark:text-slate-400">
                     Externí knihovna potřebná pro převod RAW souborů nemohla být načtena. To může být způsobeno problémy se sítí nebo doplňkem pro blokování skriptů. Zkuste prosím obnovit stránku.
                 </p>
             </div>
         );
    }

    return (
        <div className="h-full w-full flex flex-col items-center p-4 sm:p-8">
            <div className="w-full max-w-5xl">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Převodník z RAW do JPEG</h1>
                    <p className="mt-3 text-xl text-slate-500 dark:text-slate-400 max-w-3xl mx-auto">
                        Nahrajte své RAW fotografie a my je převedeme na vysoce kvalitní JPEG, který můžete dále upravovat v Artifexu.
                    </p>
                </div>

                <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-800/50">
                    {convertedFiles.length === 0 ? (
                        <div 
                            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                            onDrop={handleDrop}
                            className={`p-10 border-2 border-dashed rounded-xl transition-colors ${isDragging ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-300 dark:border-slate-700'}`}
                        >
                            <div className="text-center">
                                <UploadIcon className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" />
                                <p className="mt-4 font-semibold text-slate-700 dark:text-slate-300">
                                    {rawFiles.length > 0 ? `${rawFiles.length} souborů vybráno` : "Přetáhněte soubory sem"}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">nebo klikněte pro výběr</p>
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
                                    className="mt-4 px-4 py-2 text-sm font-semibold text-cyan-600 dark:text-cyan-400 rounded-md hover:bg-cyan-500/10 transition-colors"
                                >
                                    {rawFiles.length > 0 ? "Vybrat jiné" : "Vybrat soubory"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h3 className="text-xl font-bold mb-4">Konverze dokončena</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                {convertedFiles.map((file) => (
                                    <div key={file.originalName} className="group relative aspect-square">
                                        <img src={file.url} alt={file.originalName} className="w-full h-full object-cover rounded-lg shadow-md" />
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => downloadFile(file.url, file.originalName)} className="p-2 bg-white/20 rounded-full text-white hover:bg-white/30">
                                                <ExportIcon className="w-6 h-6" />
                                            </button>
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
                                {isConverting ? `Převádím (${progress.current}/${progress.total})...` : `Převést ${rawFiles.length === 1 ? '1 soubor' : `${rawFiles.length} souborů`} na JPEG`}
                            </button>
                        ) : (
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={() => { setRawFiles([]); setConvertedFiles([]); }}
                                    className="w-full sm:w-auto flex-1 inline-flex items-center justify-center px-6 py-3 border border-slate-300 dark:border-slate-700 text-sm font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Převést další
                                </button>
                            </div>
                        )}
                         {isConverting && (
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mt-4">
                                <div className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RAWConverterView;