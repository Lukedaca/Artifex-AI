import React, { useState, useCallback } from 'react';
import type { UploadedFile } from '../types';
import { cropImageToAspectRatio } from '../utils/imageProcessor';
import { BatchIcon } from './icons';

interface BatchViewProps {
  files: UploadedFile[];
  onProcessingComplete: (processedFiles: UploadedFile[]) => void;
}

const ASPECT_RATIOS = [
    { label: '16:9 (Širokoúhlý)', value: 16 / 9 },
    { label: '4:3 (Standardní)', value: 4 / 3 },
    { label: '1:1 (Čtverec)', value: 1 },
    { label: '3:2 (Fotografie)', value: 3 / 2 },
];

const BatchView: React.FC<BatchViewProps> = ({ files, onProcessingComplete }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedAspectRatio, setSelectedAspectRatio] = useState(ASPECT_RATIOS[0].value);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const handleProcessImages = useCallback(async () => {
        setIsProcessing(true);
        setProgress({ current: 0, total: files.length });
        
        const processedFilePromises = files.map(async (uploadedFile) => {
            try {
                const newFile = await cropImageToAspectRatio(uploadedFile.file, selectedAspectRatio);
                setProgress(prev => ({ ...prev, current: prev.current + 1 }));
                return {
                    id: `${newFile.name}-${newFile.lastModified}-${Math.random()}`,
                    file: newFile,
                    previewUrl: URL.createObjectURL(newFile),
                };
            } catch (error) {
                console.error(`Failed to process ${uploadedFile.file.name}:`, error);
                return { ...uploadedFile, id: uploadedFile.id }; 
            }
        });
        
        const processedFiles = await Promise.all(processedFilePromises);

        onProcessingComplete(processedFiles);
    }, [files, selectedAspectRatio, onProcessingComplete]);

    if (files.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 p-4 text-center">
                Žádné fotky ke zpracování. Nahrajte prosím nějaké přes "Nahrát fotky".
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8">
            <div className="flex-shrink-0 mb-8">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Hromadné zpracování</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-lg">Aplikujte úpravy na všechny nahrané obrázky najednou.</p>
            </div>
            
            <div className="flex-shrink-0 mb-8 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-xl flex flex-col sm:flex-row items-center gap-4 border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                <div className="w-full sm:w-auto">
                    <label htmlFor="aspect-ratio" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Poměr stran pro oříznutí</label>
                    <select
                        id="aspect-ratio"
                        value={selectedAspectRatio}
                        onChange={(e) => setSelectedAspectRatio(Number(e.target.value))}
                        disabled={isProcessing}
                        className="block w-full pl-3 pr-10 py-2.5 text-base border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md text-slate-800 dark:text-white"
                    >
                        {ASPECT_RATIOS.map(ratio => (
                            <option key={ratio.label} value={ratio.value}>{ratio.label}</option>
                        ))}
                    </select>
                </div>
                <div className="w-full sm:w-auto sm:ml-auto">
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
                        <div key={file.id} className="relative aspect-video bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden group shadow-md transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/20 hover:scale-105 hover:z-10">
                            <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover"/>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                            <p className="absolute bottom-2 left-3 right-3 text-xs text-white truncate px-1 font-medium">{file.file.name}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default BatchView;