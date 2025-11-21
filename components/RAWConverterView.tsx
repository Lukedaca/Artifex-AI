
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UploadIcon, ArrowPathIcon, ExportIcon, XCircleIcon } from './icons';
import Header from './Header';
import { processRawFile, RAW_EXTENSIONS_STRING } from '../utils/rawProcessor';

interface RAWConverterViewProps {
    title: string;
    onOpenApiKeyModal: () => void;
    onToggleSidebar: () => void;
    addNotification: (message: string, type?: 'info' | 'error') => void;
    onFilesConverted: (files: File[]) => void;
}

interface ConvertedFile {
    originalName: string;
    blob: Blob;
    url: string;
    sizeLabel: string;
}


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

        for (const file of rawFiles) {
            try {
                const jpegFile = await processRawFile(file);
                const sizeInMB = (jpegFile.size / (1024 * 1024)).toFixed(2);
                
                newConvertedFiles.push({
                    originalName: jpegFile.name,
                    blob: jpegFile,
                    url: URL.createObjectURL(jpegFile),
                    sizeLabel: `${sizeInMB} MB`,
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
                            Samostatný nástroj pro hromadnou konverzi. Pro běžné úpravy můžete RAW soubory nahrát přímo v hlavní nabídce.
                        </p>
                    </div>

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
                                                <div className="px-2 py-1 bg-black/50 text-slate-300 text-xs rounded backdrop-blur-md flex flex-col items-end">
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
                                {isConverting ? `Analyzuji a převádím (${progress.current}/${progress.total})...` : `Konvertovat ${rawFiles.length === 0 ? '' : (rawFiles.length === 1 ? '1 soubor' : `${rawFiles.length} souborů`)}`}
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
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
    );
}

export default RAWConverterView;
