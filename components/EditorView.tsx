
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { analyzeImage, autopilotImage, autoCropImage } from '../services/geminiService';
import type { UploadedFile, AnalysisResult, ManualEdits, EditorViewProps, CropCoordinates } from '../types';
import { AnalysisIcon, AutopilotIcon, AutoCropIcon, ManualEditIcon, UndoIcon, RedoIcon } from './icons';
import { applyEditsToImage, base64ToFile, cropImageToAspectRatio, cropImageToCoordinates, applyEditsToImageData } from '../utils/imageProcessor';

const DEFAULT_EDITS: Omit<ManualEdits, 'crop'> = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    vibrance: 0,
    shadows: 0,
    highlights: 0,
    clarity: 0,
};

const ASPECT_RATIOS = [
    { label: '16:9 (Širokoúhlý)', value: 16 / 9 },
    { label: '4:3 (Standardní)', value: 4 / 3 },
    { label: '1:1 (Čtverec)', value: 1 },
    { label: '3:2 (Fotografie)', value: 3 / 2 },
];

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

const useHistory = <T,>(initialState: T) => {
    const historyRef = useRef({
        past: [] as T[],
        present: initialState,
        future: [] as T[],
    });

    const [, forceUpdate] = useState({});

    const canUndo = historyRef.current.past.length > 0;
    const canRedo = historyRef.current.future.length > 0;

    const setState = useCallback((newState: T) => {
        const current = historyRef.current;
        if (JSON.stringify(newState) === JSON.stringify(current.present)) {
            return;
        }
        historyRef.current = {
            past: [...current.past, current.present],
            present: newState,
            future: [],
        };
        forceUpdate({});
    }, []);

    const undo = useCallback(() => {
        const current = historyRef.current;
        if (current.past.length === 0) return;

        const previous = current.past[current.past.length - 1];
        const newPast = current.past.slice(0, current.past.length - 1);
        
        historyRef.current = {
            past: newPast,
            present: previous,
            future: [current.present, ...current.future],
        };
        forceUpdate({});
    }, []);

    const redo = useCallback(() => {
        const current = historyRef.current;
        if (current.future.length === 0) return;

        const next = current.future[0];
        const newFuture = current.future.slice(1);
        
        historyRef.current = {
            past: [...current.past, current.present],
            present: next,
            future: newFuture,
        };
        forceUpdate({});
    }, []);

    const reset = useCallback((newState: T) => {
        historyRef.current = {
            past: [],
            present: newState,
            future: [],
        };
        forceUpdate({});
    }, []);

    return {
        state: historyRef.current.present,
        setState,
        undo,
        redo,
        canUndo,
        canRedo,
        reset,
    };
};

const EditorView: React.FC<EditorViewProps> = ({ files, isApiKeyAvailable, activeAction, onActionCompleted, onFileUpdate }) => {
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [activePanel, setActivePanel] = useState<string | null>(null);
    const prevFileCount = useRef(files.length);

    useEffect(() => {
        if (files.length > prevFileCount.current) {
            // A file was added, select the newest one (last in the array)
            setSelectedFileId(files[files.length - 1].id);
        } else if (files.length > 0 && (!selectedFileId || !files.find(f => f.id === selectedFileId))) {
            // Initial load, or selected file was removed. Select the first one.
            setSelectedFileId(files[0].id);
        } else if (files.length === 0) {
            setSelectedFileId(null);
        }
        prevFileCount.current = files.length;
    }, [files, selectedFileId]);

    useEffect(() => {
        if (activeAction) {
            setActivePanel(activeAction.action);
        }
    }, [activeAction]);

    const selectedFile = useMemo(() => files.find(f => f.id === selectedFileId), [files, selectedFileId]);

    const handlePanelClose = () => {
        setActivePanel(null);
        onActionCompleted();
    };

    if (files.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Vítejte v Editoru</h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400">
                    Pro začátek nahrajte nějaké fotografie.
                </p>
            </div>
        );
    }
    
    return (
        <div className="h-full w-full flex flex-col lg:flex-row bg-slate-100 dark:bg-slate-950">
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 relative flex items-center justify-center p-4 bg-slate-200/50 dark:bg-black/50 overflow-hidden">
                    {selectedFile && (
                        <img 
                            src={selectedFile.previewUrl} 
                            alt={selectedFile.file.name}
                            className="max-w-full max-h-full object-contain"
                        />
                    )}
                </div>
                
                <div className="flex-shrink-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800">
                    <div className="p-2.5 overflow-x-auto">
                        <div className="flex space-x-3">
                            {files.map(file => (
                                <button key={file.id} onClick={() => setSelectedFileId(file.id)} className={`flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden transition-all duration-200 border-2 ${selectedFileId === file.id ? 'border-sky-500 scale-105 shadow-lg' : 'border-transparent hover:border-sky-500/50'}`}>
                                    <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover"/>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <aside className="w-full lg:w-80 flex-shrink-0 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col">
                {activePanel && selectedFile ? (
                    <div className="flex-1 overflow-y-auto">
                        {activePanel === 'analysis' && <AnalysisPanel file={selectedFile} isApiKeyAvailable={isApiKeyAvailable} onClose={handlePanelClose} />}
                        {activePanel === 'autopilot' && <AutopilotPanel file={selectedFile} isApiKeyAvailable={isApiKeyAvailable} onClose={handlePanelClose} onFileUpdate={onFileUpdate} />}
                        {activePanel === 'auto-crop' && <AutoCropPanel file={selectedFile} isApiKeyAvailable={isApiKeyAvailable} onClose={handlePanelClose} onFileUpdate={onFileUpdate} />}
                        {activePanel === 'manual-edit' && <ManualEditPanel file={selectedFile} onClose={handlePanelClose} onFileUpdate={onFileUpdate} />}
                    </div>
                ) : (
                    <div className="p-6 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                        <p>Vyberte nástroj z levého menu pro úpravu vybrané fotografie.</p>
                    </div>
                )}
            </aside>
        </div>
    );
};

const PanelHeader: React.FC<{ title: string; icon: React.ReactNode; onClose: () => void }> = ({ title, icon, onClose }) => (
    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
            <span className="text-sky-500">{icon}</span>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
    </div>
);

const ApiKeyWarning: React.FC = () => (
    <div className="m-4 p-3 bg-yellow-100/80 dark:bg-yellow-900/30 border border-yellow-400/50 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
        Pro použití této funkce je vyžadován API klíč. Klikněte na ikonu klíče v záhlaví a zadejte svůj klíč.
    </div>
);

const AnalysisPanel: React.FC<{ file: UploadedFile; isApiKeyAvailable: boolean; onClose: () => void; }> = ({ file, isApiKeyAvailable, onClose }) => {
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await analyzeImage(file.file);
            setAnalysis(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Došlo k neznámé chybě.');
        } finally {
            setIsLoading(false);
        }
    }, [file]);

    return (
        <div>
            <PanelHeader title="AI Analýza" icon={<AnalysisIcon className="w-6 h-6"/>} onClose={onClose} />
            <div className="p-4">
                {!isApiKeyAvailable ? (
                    <ApiKeyWarning />
                ) : (
                    <button onClick={handleAnalyze} disabled={isLoading} className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400">
                        {isLoading ? 'Analyzuji...' : 'Spustit analýzu'}
                    </button>
                )}

                {error && <p className="mt-4 text-sm text-red-500">Chyba: {error}</p>}
                
                {analysis && (
                    <div className="mt-6 space-y-4 text-sm">
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">Popis</h4>
                            <p className="text-slate-600 dark:text-slate-300">{analysis.description}</p>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Návrhy na vylepšení</h4>
                            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                                {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Technické informace</h4>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">ISO</div>
                                    <div className="font-semibold">{analysis.technicalInfo.ISO}</div>
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">Clona</div>
                                    <div className="font-semibold">{analysis.technicalInfo.Aperture}</div>
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">Závěrka</div>
                                    <div className="font-semibold">{analysis.technicalInfo.ShutterSpeed}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const AutopilotPanel: React.FC<{ file: UploadedFile; isApiKeyAvailable: boolean; onClose: () => void; onFileUpdate: (id: string, file: File) => void; }> = ({ file, isApiKeyAvailable, onClose, onFileUpdate }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAutopilot = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const base64Image = await autopilotImage(file.file);
            const newFile = await base64ToFile(base64Image, file.file.name.replace(/\.[^/.]+$/, "") + "_autopilot.png", 'image/png');
            onFileUpdate(file.id, newFile);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Došlo k neznámé chybě.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div>
            <PanelHeader title="Autopilot AI" icon={<AutopilotIcon className="w-6 h-6"/>} onClose={onClose} />
            <div className="p-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Nechte AI automaticky vylepšit vaši fotografii. Upraví jas, kontrast a barvy pro profesionální vzhled.</p>
                 {!isApiKeyAvailable ? (
                    <ApiKeyWarning />
                ) : (
                    <button onClick={handleAutopilot} disabled={isLoading} className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400">
                        {isLoading ? 'Pracuji...' : 'Spustit Autopilota'}
                    </button>
                )}
                {error && <p className="mt-4 text-sm text-red-500">Chyba: {error}</p>}
            </div>
        </div>
    );
};

const ManualEditPanel: React.FC<{ file: UploadedFile; onClose: () => void; onFileUpdate: (id: string, file: File) => void; }> = ({ file, onClose, onFileUpdate }) => {
    const { 
        state: committedEdits, 
        setState: setCommittedEdits, 
        undo, 
        redo, 
        canUndo, 
        canRedo,
        reset
    } = useHistory(DEFAULT_EDITS);

    const [liveEdits, setLiveEdits] = useState<ManualEdits>(DEFAULT_EDITS);
    const [isApplying, setIsApplying] = useState(false);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const debouncedEdits = useDebounce(liveEdits, 150);

    useEffect(() => {
        reset(DEFAULT_EDITS);
    }, [file.id, reset]);

    useEffect(() => {
        setLiveEdits(committedEdits);
    }, [committedEdits]);
    
    useEffect(() => {
        if (JSON.stringify(debouncedEdits) !== JSON.stringify(committedEdits)) {
             setCommittedEdits(debouncedEdits);
        }
    }, [debouncedEdits, committedEdits, setCommittedEdits]);


    useEffect(() => {
        const canvas = previewCanvasRef.current;
        const image = new Image();
        image.crossOrigin = 'anonymous';
        
        const renderPreview = () => {
            if (!canvas) return;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;

            const panelWidth = canvas.parentElement?.clientWidth || 320;
            const scale = Math.min(1, panelWidth / image.naturalWidth);
            const canvasWidth = image.naturalWidth * scale;
            const canvasHeight = image.naturalHeight * scale;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);
            
            try {
                const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
                const editedImageData = applyEditsToImageData(imageData, debouncedEdits);
                ctx.putImageData(editedImageData, 0, 0);
            } catch(e) {
                console.error("Error applying preview edits:", e);
                ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);
            }
        };

        image.src = file.previewUrl;
        image.onload = renderPreview;

    }, [file.previewUrl, debouncedEdits]);


    const handleEditChange = (param: keyof ManualEdits, value: number | undefined) => {
        setLiveEdits(prev => ({...prev, [param]: value}));
    };
    
    const handleReset = () => {
        reset(DEFAULT_EDITS);
    }
    
    const handleApplyEdits = async () => {
        setIsApplying(true);
        try {
            let processedFile = file.file;
            if (liveEdits.crop) {
                processedFile = await cropImageToAspectRatio(processedFile, liveEdits.crop);
            }
            const newFile = await applyEditsToImage(processedFile, liveEdits);
            onFileUpdate(file.id, newFile);
            onClose();
        } catch (error) {
            console.error("Failed to apply edits", error);
        } finally {
            setIsApplying(false);
        }
    }

    return (
        <div>
            <PanelHeader title="Manuální úpravy" icon={<ManualEditIcon className="w-6 h-6"/>} onClose={onClose} />
            <div className="p-4 space-y-1">
                <div className="relative h-48 mb-4 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                    <canvas ref={previewCanvasRef} className="max-w-full max-h-full" />
                </div>
                
                <EditSection title="Oříznutí">
                    <select
                        id="crop-ratio"
                        value={liveEdits.crop || ''}
                        onChange={(e) => handleEditChange('crop', e.target.value ? Number(e.target.value) : undefined)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md"
                    >
                        <option value="">Zachovat původní</option>
                        {ASPECT_RATIOS.map(ratio => (
                            <option key={ratio.label} value={ratio.value}>{ratio.label}</option>
                        ))}
                    </select>
                </EditSection>

                <EditSection title="Základní úpravy">
                    <SliderControl label="Jas" value={liveEdits.brightness} min={-100} max={100} onChange={v => handleEditChange('brightness', v)} />
                    <SliderControl label="Kontrast" value={liveEdits.contrast} min={-100} max={100} onChange={v => handleEditChange('contrast', v)} />
                </EditSection>
                
                <EditSection title="Barvy">
                    <SliderControl label="Sytost" value={liveEdits.saturation} min={-100} max={100} onChange={v => handleEditChange('saturation', v)} />
                    <SliderControl label="Živost" value={liveEdits.vibrance} min={-100} max={100} onChange={v => handleEditChange('vibrance', v)} />
                </EditSection>
                
                <EditSection title="Tónování">
                     <SliderControl label="Světla" value={liveEdits.highlights} min={-100} max={100} onChange={v => handleEditChange('highlights', v)} />
                     <SliderControl label="Stíny" value={liveEdits.shadows} min={-100} max={100} onChange={v => handleEditChange('shadows', v)} />
                </EditSection>
                
                <EditSection title="Detaily">
                    <SliderControl label="Zřetelnost" value={liveEdits.clarity} min={0} max={100} onChange={v => handleEditChange('clarity', v)} />
                </EditSection>

                <div className="flex space-x-2 pt-4">
                    <button 
                        onClick={undo}
                        disabled={!canUndo}
                        className="p-2 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Zpět"
                    >
                        <UndoIcon className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={redo}
                        disabled={!canRedo}
                        className="p-2 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Vpřed"
                    >
                        <RedoIcon className="w-5 h-5" />
                    </button>
                    <button onClick={handleReset} className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Reset</button>
                    <button onClick={handleApplyEdits} disabled={isApplying} className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 transition-colors">
                        {isApplying ? 'Aplikuji...' : 'Aplikovat'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const EditSection: React.FC<{title: string, children: React.ReactNode}> = ({ title, children }) => (
    <details className="py-2 group" open>
        <summary className="flex justify-between items-center font-semibold text-slate-800 dark:text-slate-100 cursor-pointer list-none">
            {title}
            <svg className="w-4 h-4 transition-transform duration-200 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </summary>
        <div className="pt-3 space-y-4">
            {children}
        </div>
    </details>
);

const SliderControl: React.FC<{ label: string; value: number; min: number; max: number; onChange: (value: number) => void }> = ({ label, value, min, max, onChange}) => (
    <div>
        <label className="flex justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
            <span>{label}</span>
            <span className='font-mono w-10 text-right'>{value}</span>
        </label>
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer slider-thumb" />
    </div>
);

const AutoCropPanel: React.FC<{ file: UploadedFile; isApiKeyAvailable: boolean; onClose: () => void; onFileUpdate: (id: string, file: File) => void; }> = ({ file, isApiKeyAvailable, onClose, onFileUpdate }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAutoCrop = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const cropCoords = await autoCropImage(file.file);
            const newFile = await cropImageToCoordinates(file.file, cropCoords);
            onFileUpdate(file.id, newFile);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Došlo k neznámé chybě.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div>
            <PanelHeader title="Automatické oříznutí" icon={<AutoCropIcon className="w-6 h-6"/>} onClose={onClose} />
            <div className="p-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Nechte AI analyzovat kompozici a navrhnout nejlepší ořez pro vaši fotografii, aby vynikl hlavní objekt.</p>
                 {!isApiKeyAvailable ? (
                    <ApiKeyWarning />
                ) : (
                    <button onClick={handleAutoCrop} disabled={isLoading} className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400">
                        {isLoading ? 'Pracuji...' : 'Spustit automatické oříznutí'}
                    </button>
                )}
                {error && <p className="mt-4 text-sm text-red-500">Chyba: {error}</p>}
            </div>
        </div>
    );
};


export default EditorView;
