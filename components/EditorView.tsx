
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { analyzeImage, autopilotImage } from '../services/geminiService';
import type { UploadedFile, AnalysisResult, ManualEdits, EditorViewProps } from '../types';
import { AnalysisIcon, AutopilotIcon, ManualEditIcon } from './icons';
import { applyEditsToImage, base64ToFile, cropImageToAspectRatio } from '../utils/imageProcessor';

const DEFAULT_EDITS: Omit<ManualEdits, 'crop'> = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    sharpness: 100,
};

const ASPECT_RATIOS = [
    { label: '16:9 (Širokoúhlý)', value: 16 / 9 },
    { label: '4:3 (Standardní)', value: 4 / 3 },
    { label: '1:1 (Čtverec)', value: 1 },
    { label: '3:2 (Fotografie)', value: 3 / 2 },
];

const EditorView: React.FC<EditorViewProps> = ({ files, isApiKeyAvailable, activeAction, onActionCompleted, onFileUpdate }) => {
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [activePanel, setActivePanel] = useState<string | null>(null);

    useEffect(() => {
        if (files.length > 0 && !selectedFileId) {
            setSelectedFileId(files[0].id);
        }
        if (files.length === 0) {
            setSelectedFileId(null);
        }
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

// FIX: Corrected the AutopilotPanel component to properly define state, handle events, and return JSX.
// The original code had scoping issues which caused variables like `setError`, `err`, and `setIsLoading`
// to be undefined, and it was missing a return statement, which is why TypeScript inferred a `void` return type.
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
    const [edits, setEdits] = useState<ManualEdits>(DEFAULT_EDITS);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleEditChange = (param: keyof ManualEdits, value: number | undefined) => {
        setEdits(prev => ({...prev, [param]: value}));
    };
    
    const handleApplyEdits = async () => {
        setIsProcessing(true);
        try {
            let processedFile = file.file;
            if (edits.crop) {
                processedFile = await cropImageToAspectRatio(processedFile, edits.crop);
            }
            const newFile = await applyEditsToImage(processedFile, edits);
            onFileUpdate(file.id, newFile);
            onClose();
        } catch (error) {
            console.error("Failed to apply edits", error);
        } finally {
            setIsProcessing(false);
        }
    }

    return (
        <div>
            <PanelHeader title="Manuální úpravy" icon={<ManualEditIcon className="w-6 h-6"/>} onClose={onClose} />
            <div className="p-4 space-y-4">
                <div className="relative h-40 mb-4 rounded-lg overflow-hidden">
                    <img src={file.previewUrl} style={{ filter: `brightness(${edits.brightness}%) contrast(${edits.contrast}%) saturate(${edits.saturation}%)` }} className="w-full h-full object-cover" alt="Preview"/>
                </div>
                
                <div>
                    <label htmlFor="crop-ratio" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Oříznutí</label>
                    <select
                        id="crop-ratio"
                        value={edits.crop || ''}
                        onChange={(e) => handleEditChange('crop', e.target.value ? Number(e.target.value) : undefined)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md"
                    >
                        <option value="">Zachovat původní</option>
                        {ASPECT_RATIOS.map(ratio => (
                            <option key={ratio.label} value={ratio.value}>{ratio.label}</option>
                        ))}
                    </select>
                </div>
                
                <SliderControl label="Jas" value={edits.brightness} min={50} max={150} onChange={v => handleEditChange('brightness', v)} />
                <SliderControl label="Kontrast" value={edits.contrast} min={50} max={150} onChange={v => handleEditChange('contrast', v)} />
                <SliderControl label="Sytost" value={edits.saturation} min={0} max={200} onChange={v => handleEditChange('saturation', v)} />
                <SliderControl label="Ostrost" value={edits.sharpness} min={0} max={200} onChange={v => handleEditChange('sharpness', v)} />

                <div className="flex space-x-2 pt-4">
                    <button onClick={() => setEdits(DEFAULT_EDITS)} className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">Reset</button>
                    <button onClick={handleApplyEdits} disabled={isProcessing} className="w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400">
                        {isProcessing ? 'Aplikuji...' : 'Aplikovat'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const SliderControl: React.FC<{ label: string; value: number; min: number; max: number; onChange: (value: number) => void }> = ({ label, value, min, max, onChange}) => (
    <div>
        <label className="flex justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
            <span>{label}</span>
            <span>{value}</span>
        </label>
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer slider-thumb" />
    </div>
);


export default EditorView;