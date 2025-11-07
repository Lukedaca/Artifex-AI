import React, { useState, useCallback, useEffect } from 'react';
import type { UploadedFile, Preset } from '../types';
import { cropImageToAspectRatio, resizeImage, applyEditsToImage } from '../utils/imageProcessor';
import { autopilotImage } from '../services/geminiService';
import { getPresets } from '../services/userProfileService';
import { BatchIcon, XIcon, AutopilotIcon, PresetIcon, AutoCropIcon, ResizeIcon } from './icons';

interface BatchViewProps {
  files: UploadedFile[];
  onProcessingComplete: (processedFiles: UploadedFile[], actionName: string) => void;
}

const ASPECT_RATIOS = [
    { label: 'Neřezat', value: 'none' },
    { label: '16:9 (Širokoúhlý)', value: String(16 / 9) },
    { label: '4:3 (Standardní)', value: String(4 / 3) },
    { label: '1:1 (Čtverec)', value: String(1) },
    { label: '3:2 (Fotografie)', value: String(3 / 2) },
    { label: '4:5 (Portrét)', value: String(4 / 5) },
];

const BatchView: React.FC<BatchViewProps> = ({ files, onProcessingComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [lightboxImage, setLightboxImage] = useState<UploadedFile | null>(null);

    // Pipeline state
    const [userPresets, setUserPresets] = useState<Preset[]>([]);
    const [selectedEnhancement, setSelectedEnhancement] = useState('none'); // 'none', 'autopilot', or preset.id
    const [selectedCrop, setSelectedCrop] = useState('none'); // aspect ratio as string, or 'none'
    const [resizeWidth, setResizeWidth] = useState('');

    useEffect(() => {
        setUserPresets(getPresets());
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setLightboxImage(null);
            }
        };

        if (lightboxImage) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [lightboxImage]);

    const handleProcessImages = useCallback(async () => {
        setIsProcessing(true);
        setProgress({ current: 0, total: files.length });

        const newFiles: UploadedFile[] = [];

        for (const uploadedFile of files) {
            try {
                let currentFile = uploadedFile.file;
                const originalUrl = uploadedFile.originalPreviewUrl;

                // Step 1: Enhancement
                if (selectedEnhancement === 'autopilot') {
                    currentFile = (await autopilotImage(currentFile)).file;
                } else if (selectedEnhancement !== 'none') {
                    const preset = userPresets.find(p => p.id === selectedEnhancement);
                    if (preset) {
                        const blob = await applyEditsToImage(currentFile, preset.edits);
                        currentFile = new File([blob], currentFile.name.replace(/\.[^/.]+$/, "_preset.png"), { type: 'image/png' });
                    }
                }

                // Step 2: Cropping
                if (selectedCrop !== 'none') {
                    currentFile = await cropImageToAspectRatio(currentFile, Number(selectedCrop));
                }

                // Step 3: Resizing
                const width = parseInt(resizeWidth, 10);
                if (!isNaN(width) && width > 0) {
                    currentFile = await resizeImage(currentFile, width);
                }

                newFiles.push({
                    id: `${currentFile.name}-${currentFile.lastModified}-${Math.random()}`,
                    file: currentFile,
                    previewUrl: URL.createObjectURL(currentFile),
                    originalPreviewUrl: originalUrl, // Preserve original for comparison
                });

            } catch (error) {
                console.error(`Failed to process ${uploadedFile.file.name}:`, error);
                newFiles.push({ ...uploadedFile, id: uploadedFile.id }); // Keep original on error
            } finally {
                setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }
        }
        
        onProcessingComplete(newFiles, 'Hromadné zpracování');

    }, [files, selectedEnhancement, selectedCrop, resizeWidth, userPresets, onProcessingComplete]);

    if (files.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 p-4 text-center">
                Žádné fotky ke zpracování. Nahrajte prosím nějaké přes "Nahrát fotky".
            </div>
        );
    }

    return (
        <>
            <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8">
                <div className="flex-shrink-0 mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Hromadné zpracování</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-lg">Sestavte sekvenci úprav a aplikujte ji na všechny obrázky najednou.</p>
                </div>
                
                <div className="flex-shrink-0 mb-8 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        {/* Enhancement Step */}
                        <div className="space-y-2">
                            <label htmlFor="enhancement" className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                                <AutopilotIcon className="w-5 h-5 mr-2" /> Krok 1: Vylepšení
                            </label>
                            <select
                                id="enhancement"
                                value={selectedEnhancement}
                                onChange={(e) => setSelectedEnhancement(e.target.value)}
                                disabled={isProcessing}
                                className="block w-full pl-3 pr-10 py-2.5 text-base border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md text-slate-800 dark:text-white"
                            >
                                <option value="none">Žádné</option>
                                <option value="autopilot">AI Autopilot</option>
                                {userPresets.length > 0 && <optgroup label="Vaše presety">
                                    {userPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </optgroup>}
                            </select>
                        </div>
                        {/* Crop Step */}
                        <div className="space-y-2">
                            <label htmlFor="aspect-ratio" className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                                <AutoCropIcon className="w-5 h-5 mr-2" /> Krok 2: Oříznutí
                            </label>
                            <select
                                id="aspect-ratio"
                                value={selectedCrop}
                                onChange={(e) => setSelectedCrop(e.target.value)}
                                disabled={isProcessing}
                                className="block w-full pl-3 pr-10 py-2.5 text-base border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md text-slate-800 dark:text-white"
                            >
                                {ASPECT_RATIOS.map(ratio => (
                                    <option key={ratio.label} value={ratio.value}>{ratio.label}</option>
                                ))}
                            </select>
                        </div>
                        {/* Resize Step */}
                        <div className="space-y-2">
                           <label htmlFor="resize-width" className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                                <ResizeIcon className="w-5 h-5 mr-2" /> Krok 3: Změna velikosti
                            </label>
                            <input
                                type="number"
                                id="resize-width"
                                value={resizeWidth}
                                onChange={(e) => setResizeWidth(e.target.value)}
                                disabled={isProcessing}
                                placeholder="Šířka v px (např. 2048)"
                                className="block w-full pl-3 pr-3 py-2.5 text-base border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            />
                        </div>
                    </div>
                     <div className="mt-6 pt-6 border-t border-slate-200/50 dark:border-slate-800/50 flex justify-end">
                        <button
                            onClick={handleProcessImages}
                            disabled={isProcessing}
                            className="aurora-glow w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <BatchIcon className="-ml-1 mr-3 h-5 w-5" />
                            {isProcessing ? `Zpracovávám (${progress.current}/${progress.total})...` : `Spustit zpracování (${files.length} souborů)`}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto -mr-2 pr-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                        {files.map(file => (
                            <div key={file.id} className="relative aspect-video bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden group shadow-md">
                                <button onClick={() => setLightboxImage(file)} className="w-full h-full block focus:outline-none transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/20 hover:scale-105 hover:z-10" aria-label={`Zobrazit náhled ${file.file.name}`}>
                                    <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover"/>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                                    <p className="absolute bottom-2 left-3 right-3 text-xs text-white truncate px-1 font-medium">{file.file.name}</p>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {lightboxImage && (
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[101] flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setLightboxImage(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Zvětšený náhled obrázku"
                >
                    <div className="relative max-w-5xl max-h-[90vh] transition-transform transform scale-95 motion-safe:animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <img src={lightboxImage.previewUrl} alt="Zvětšený náhled" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
                        <button 
                            onClick={() => setLightboxImage(null)}
                            className="absolute -top-3 -right-3 bg-white dark:bg-slate-800 rounded-full p-2 text-slate-600 dark:text-slate-300 hover:scale-110 transition-transform shadow-lg focus:outline-none focus:ring-2 focus:ring-white dark:focus:ring-slate-400"
                            aria-label="Zavřít náhled"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

export default BatchView;
