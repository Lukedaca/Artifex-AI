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
                return { ...uploadedFile, id: uploadedFile.id }; // Return original with a stable ID if processing fails
            }
        });
        
        const processedFiles = await Promise.all(processedFilePromises);

        onProcessingComplete(processedFiles);
        // setIsProcessing will be set to false by the parent component navigating away
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
            <div className="flex-shrink-0 mb-6">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Hromadné zpracování</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Aplikujte úpravy na všechny nahrané obrázky najednou.</p>
            </div>
            
            <div className="flex-shrink-0 mb-6 bg-white dark:bg-slate-800/50 p-4 rounded-lg flex flex-col sm:flex-row items-center gap-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="w-full sm:w-auto">
                    <label htmlFor="aspect-ratio" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Poměr stran pro oříznutí</label>
                    <select
                        id="aspect-ratio"
                        value={selectedAspectRatio}
                        onChange={(e) => setSelectedAspectRatio(Number(e.target.value))}
                        disabled={isProcessing}
                        className="block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md text-slate-800 dark:text-white"
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
                        className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-sky-500 disabled:bg-sky-600/50 dark:disabled:bg-sky-800/50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                    >
                        <BatchIcon className="-ml-1 mr-2 h-5 w-5" />
                        {isProcessing ? `Zpracovávám (${progress.current}/${progress.total})...` : `Spustit zpracování (${files.length} souborů)`}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto -mr-2 pr-2">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {files.map(file => (
                        <div key={file.id} className="relative aspect-[16/10] bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden group shadow-md transition-all duration-300 hover:shadow-xl hover:scale-105">
                            <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover"/>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                            <p className="absolute bottom-2 left-2 right-2 text-xs text-white truncate px-1">{file.file.name}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default BatchView;