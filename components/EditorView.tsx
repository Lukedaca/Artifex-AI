import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Header from './Header';
import ManualEditControls from './ManualEditControls';
import FeedbackButtons from './FeedbackButtons';
import { 
    UndoIcon, 
    RedoIcon, 
    EyeIcon, 
    UploadIcon, 
    AutopilotIcon, 
    ArrowPathIcon,
    AutoCropIcon,
    BackgroundReplacementIcon,
    StyleTransferIcon,
    HistoryIcon,
    PresetIcon,
    ExportIcon
} from './icons';
import type { UploadedFile, AnalysisResult, EditorAction, History, Preset, ProactiveSuggestion, Feedback, ManualEdits } from '../types';
import * as geminiService from '../services/geminiService';
import { recordExplicitFeedback } from '../services/userProfileService';
import { applyEditsAndExport } from '../utils/imageProcessor';

// Props Interface
interface EditorViewProps {
  files: UploadedFile[];
  activeFileId: string | null;
  onSetFiles: (updater: (files: UploadedFile[]) => UploadedFile[], actionName: string) => void;
  onSetActiveFileId: (id: string | null) => void;
  activeAction: EditorAction;
  addNotification: (message: string, type?: 'info' | 'error') => void;
  userPresets: Preset[];
  onPresetsChange: (presets: Preset[]) => void;
  history: History;
  onUndo: () => void;
  onRedo: () => void;
  // Header props
  title: string;
  onOpenApiKeyModal: () => void;
  onToggleSidebar: () => void;
}

const getApiErrorMessage = (error: unknown, defaultMessage = 'Došlo k neznámé chybě.'): string => {
    if (error instanceof Error) {
        if (error.message.toLowerCase().includes('api key') || error.message.toLowerCase().includes('auth')) {
            return 'API klíč není platný nebo chybí. Zkuste prosím vybrat jiný.';
        }
        return error.message;
    }
    return defaultMessage;
};

const INITIAL_EDITS: ManualEdits = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  shadows: 0,
  highlights: 0,
  clarity: 0,
  sharpness: 0,
  noiseReduction: 0,
};

// Main Component
const EditorView: React.FC<EditorViewProps> = (props) => {
  const { files, activeFileId, onSetFiles, onSetActiveFileId, activeAction, addNotification, history, onUndo, onRedo } = props;

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [editedPreviewUrl, setEditedPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  // State for specific tool inputs
  const [removeObjectPrompt, setRemoveObjectPrompt] = useState('');
  const [replaceBgPrompt, setReplaceBgPrompt] = useState('');
  const [styleTransferFile, setStyleTransferFile] = useState<File | null>(null);
  const styleFileInputRef = useRef<HTMLInputElement>(null);
  const [manualEdits, setManualEdits] = useState<ManualEdits>(INITIAL_EDITS);
    const [exportOptions, setExportOptions] = useState({
        format: 'jpeg',
        quality: 90,
        scale: 1,
    });

  const [showFeedback, setShowFeedback] = useState<string | null>(null); // actionId for feedback

  const activeFile = useMemo(() => files.find(f => f.id === activeFileId), [files, activeFileId]);
  
  // When active file changes, reset the manual edits and clear the live preview.
  useEffect(() => {
      setManualEdits(INITIAL_EDITS);
  }, [activeFileId]);

  // Effect to generate a live preview when manual edits change
  useEffect(() => {
    if (!activeFile) {
      return;
    }
    
    const areEditsInitial = Object.values(manualEdits).every(v => v === 0);

    if (areEditsInitial) {
      if (editedPreviewUrl) setEditedPreviewUrl(null); // Triggers cleanup effect
      return;
    }

    setIsGeneratingPreview(true);
    const handler = setTimeout(async () => {
      if (!activeFile) return;
      try {
        const imageBlob = await applyEditsAndExport(
          activeFile.previewUrl,
          manualEdits,
          { format: 'jpeg', quality: 90, scale: 1 } // Use good quality for preview
        );
        const objectUrl = URL.createObjectURL(imageBlob);
        setEditedPreviewUrl(objectUrl);
      } catch (e) {
        console.error("Failed to generate live preview", e);
        addNotification('Náhled úprav se nepodařilo vygenerovat.', 'error');
      } finally {
        setIsGeneratingPreview(false);
      }
    }, 250); // Debounce user input

    return () => clearTimeout(handler);
  }, [activeFile, manualEdits, addNotification]);
  
  // Effect to clean up the blob URL when it changes or the component unmounts
  useEffect(() => {
      // This will store the URL to be cleaned up in the closure.
      const urlToClean = editedPreviewUrl;
      return () => {
          if (urlToClean) {
              URL.revokeObjectURL(urlToClean);
          }
      };
  }, [editedPreviewUrl]);

  
  const updateFile = useCallback((fileId: string, updates: Partial<UploadedFile>, actionName: string) => {
    onSetFiles(currentFiles => 
      currentFiles.map(f => f.id === fileId ? { ...f, ...updates } : f),
      actionName
    );
  }, [onSetFiles]);
  
  const handleAiAction = useCallback(async (action: () => Promise<{ file: File }>, actionName: string) => {
      if (!activeFile) return;
      setIsLoading(true);
      setLoadingMessage(`Aplikuji ${actionName}...`);
      setShowFeedback(null);
      try {
          const { file: newFile } = await action();
          const newPreviewUrl = URL.createObjectURL(newFile);
          
          // Before updating, clean up the old URL from the main file object
          URL.revokeObjectURL(activeFile.previewUrl);

          const actionId = `${Date.now()}`;
          updateFile(activeFile.id, {
              file: newFile,
              previewUrl: newPreviewUrl,
              analysis: undefined // Clear old analysis
          }, actionName);
          addNotification(`${actionName} byl úspěšně aplikován.`, 'info');
          setShowFeedback(actionId);
      } catch (e) {
          addNotification(getApiErrorMessage(e, `Nepodařilo se aplikovat ${actionName}.`), 'error');
      } finally {
          setIsLoading(false);
      }
  }, [activeFile, addNotification, updateFile]);

  // --- Handlers for specific AI actions ---
  const handleAnalyze = useCallback(async () => {
    if (!activeFile) return;
    setIsLoading(true);
    setLoadingMessage('Analyzuji obrázek...');
    updateFile(activeFile.id, { isAnalyzing: true, analysis: undefined }, 'Start Analysis');
    try {
      const result = await geminiService.analyzeImage(activeFile.file);
      updateFile(activeFile.id, { analysis: result, isAnalyzing: false }, 'Analysis Complete');
      addNotification('Analýza obrázku dokončena.', 'info');
    } catch (e) {
      addNotification(getApiErrorMessage(e, 'Analýza selhala.'), 'error');
      updateFile(activeFile.id, { isAnalyzing: false }, 'Analysis Failed');
    } finally {
        setIsLoading(false);
    }
  }, [activeFile, addNotification, updateFile]);

  const handleAutopilot = () => handleAiAction(() => geminiService.autopilotImage(activeFile!.file), 'Autopilot AI');
  const handleRemoveObject = () => handleAiAction(() => geminiService.removeObject(activeFile!.file, removeObjectPrompt), 'Odstranění objektu');
  const handleAutoCrop = () => handleAiAction(() => geminiService.autoCrop(activeFile!.file), 'Automatické oříznutí');
  const handleReplaceBg = () => handleAiAction(() => geminiService.replaceBackground(activeFile!.file, replaceBgPrompt), 'Výměna pozadí');
  const handleStyleTransfer = () => {
    if (!styleTransferFile) {
        addNotification("Vyberte prosím obrázek stylu.", "error");
        return;
    }
    handleAiAction(() => geminiService.styleTransfer(activeFile!.file, styleTransferFile), 'Přenos stylu');
  };

  const handleFeedback = (actionId: string, feedback: Feedback) => {
    recordExplicitFeedback(actionId, feedback);
    addNotification('Děkujeme za zpětnou vazbu!', 'info');
  };

  const handleProactiveSuggestion = (suggestion: ProactiveSuggestion) => {
      if (suggestion.action === 'auto-crop') {
          handleAutoCrop();
      } else if (suggestion.action === 'remove-object') {
          addNotification('Nástroj pro odstranění objektu je připraven.', 'info');
      }
  };

    const handleEditChange = useCallback(<K extends keyof ManualEdits>(key: K, value: ManualEdits[K]) => {
        setManualEdits(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleResetEdits = useCallback(() => {
        setManualEdits(INITIAL_EDITS);
    }, []);

    const handleDownload = async () => {
        if (!activeFile) {
            addNotification('Žádný aktivní obrázek k exportu.', 'error');
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Exportuji obrázek...');

        try {
            const imageBlob = await applyEditsAndExport(
                activeFile.previewUrl, // Use the current preview URL which reflects all AI edits
                manualEdits,
                exportOptions
            );

            const link = document.createElement('a');
            link.href = URL.createObjectURL(imageBlob);
            
            const fileExtension = exportOptions.format === 'jpeg' ? 'jpg' : 'png';
            const originalName = activeFile.file.name.replace(/\.[^/.]+$/, '');
            link.download = `${originalName}_artifex.${fileExtension}`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(link.href);
            addNotification('Obrázek byl úspěšně stažen.', 'info');

        } catch (e) {
            console.error('Download failed', e);
            addNotification(getApiErrorMessage(e, 'Export obrázku se nezdařil.'), 'error');
        } finally {
            setIsLoading(false);
        }
    };


  useEffect(() => {
    if (activeAction?.action === 'analysis' && activeFile && !activeFile.analysis && !activeFile.isAnalyzing) {
        handleAnalyze();
    }
  }, [activeAction, activeFile, handleAnalyze]);


  // RENDER LOGIC
  const renderActionPanel = () => {
    if (!activeFile) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 p-8">
            <UploadIcon className="w-16 h-16 mb-4" />
            <h2 className="text-xl font-bold text-slate-300">Žádný vybraný obrázek</h2>
            <p>Nahrajte nebo vyberte obrázek pro zahájení úprav.</p>
        </div>
      );
    }

    switch (activeAction?.action) {
      case 'analysis':
        return (
          <div className="p-4 space-y-4 animate-fade-in-right">
            <h3 className="text-lg font-bold text-slate-100">AI Analýza</h3>
            {activeFile.isAnalyzing && <div className="flex items-center space-x-2 text-slate-400"><ArrowPathIcon className="w-5 h-5 animate-spin" /><span>Analyzuji...</span></div>}
            {activeFile.analysis && (
              <div className="space-y-4 text-sm">
                <div><h4 className="font-semibold text-slate-300 mb-1">Popis</h4><p className="text-slate-400">{activeFile.analysis.description}</p></div>
                <div><h4 className="font-semibold text-slate-300 mb-1">Návrhy na vylepšení</h4><ul className="list-disc list-inside text-slate-400 space-y-1">{activeFile.analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                {activeFile.analysis.proactiveSuggestions && <div><h4 className="font-semibold text-slate-300 mb-1">Proaktivní návrhy</h4><div className="flex flex-col gap-2">{activeFile.analysis.proactiveSuggestions.map((s, i) => (<button key={i} onClick={() => handleProactiveSuggestion(s)} className="text-left text-cyan-400 hover:underline">{s.text}</button>))}</div></div>}
                <div><h4 className="font-semibold text-slate-300 mb-1">Technické informace</h4><p className="text-slate-400 font-mono text-xs">ISO: {activeFile.analysis.technicalInfo.ISO}, Clona: {activeFile.analysis.technicalInfo.Aperture}, Závěrka: {activeFile.analysis.technicalInfo.ShutterSpeed}</p></div>
              </div>
            )}
          </div>
        );
      case 'manual-edit':
        return <ManualEditControls edits={manualEdits} onEditChange={handleEditChange} onReset={handleResetEdits} />;
      case 'autopilot':
         return (
            <div className="p-4 space-y-4 text-center animate-fade-in-right">
                <AutopilotIcon className="w-16 h-16 mx-auto text-cyan-400"/>
                <h3 className="text-lg font-bold text-slate-100">Autopilot AI</h3>
                <p className="text-sm text-slate-400">Nechte AI automaticky vylepšit váš obrázek jedním kliknutím.</p>
                <button onClick={handleAutopilot} disabled={isLoading} className="w-full aurora-glow inline-flex items-center justify-center px-4 py-2 mt-4 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:bg-cyan-600 disabled:opacity-50">
                    {isLoading ? 'Pracuji...' : 'Spustit Autopilot'}
                </button>
            </div>
         );
      case 'remove-object':
        return (
            <div className="p-4 space-y-4 animate-fade-in-right">
                <h3 className="text-lg font-bold text-slate-100">Odstranit objekt</h3>
                <p className="text-sm text-slate-400">Popište objekt, který chcete z obrázku odstranit.</p>
                <textarea value={removeObjectPrompt} onChange={e => setRemoveObjectPrompt(e.target.value)} rows={3} placeholder="např. 'modré auto v pozadí'" className="w-full bg-slate-800 rounded-md p-2 text-sm focus:ring-cyan-500 focus:border-cyan-500 border-slate-700"></textarea>
                <button onClick={handleRemoveObject} disabled={isLoading || !removeObjectPrompt.trim()} className="w-full aurora-glow inline-flex items-center justify-center px-4 py-2 mt-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:bg-cyan-600 disabled:opacity-50">
                    {isLoading ? 'Odstraňuji...' : 'Odstranit'}
                </button>
            </div>
        );
        case 'auto-crop':
            return (
                <div className="p-4 space-y-4 text-center animate-fade-in-right">
                    <AutoCropIcon className="w-16 h-16 mx-auto text-cyan-400"/>
                    <h3 className="text-lg font-bold text-slate-100">Automatické oříznutí</h3>
                    <p className="text-sm text-slate-400">Nechte AI inteligentně oříznout obrázek pro vylepšení kompozice.</p>
                    <button onClick={handleAutoCrop} disabled={isLoading} className="w-full aurora-glow inline-flex items-center justify-center px-4 py-2 mt-4 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:bg-cyan-600 disabled:opacity-50">
                        {isLoading ? 'Ořezávám...' : 'Oříznout obrázek'}
                    </button>
                </div>
            );
        case 'replace-background':
            return (
                <div className="p-4 space-y-4 animate-fade-in-right">
                    <BackgroundReplacementIcon className="w-12 h-12 mx-auto text-cyan-400 mb-2"/>
                    <h3 className="text-lg font-bold text-slate-100">Vyměnit pozadí</h3>
                    <p className="text-sm text-slate-400">Popište nové pozadí, které chcete vložit do obrázku.</p>
                    <textarea value={replaceBgPrompt} onChange={e => setReplaceBgPrompt(e.target.value)} rows={3} placeholder="např. 'rušná ulice v Tokiu v noci'" className="w-full bg-slate-800 rounded-md p-2 text-sm focus:ring-cyan-500 focus:border-cyan-500 border-slate-700"></textarea>
                    <button onClick={handleReplaceBg} disabled={isLoading || !replaceBgPrompt.trim()} className="w-full aurora-glow inline-flex items-center justify-center px-4 py-2 mt-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:bg-cyan-600 disabled:opacity-50">
                        {isLoading ? 'Měním pozadí...' : 'Vyměnit pozadí'}
                    </button>
                </div>
            );
        case 'style-transfer':
            return (
                <div className="p-4 space-y-4 animate-fade-in-right">
                     <StyleTransferIcon className="w-12 h-12 mx-auto text-cyan-400 mb-2"/>
                    <h3 className="text-lg font-bold text-slate-100">Přenos stylu</h3>
                    <p className="text-sm text-slate-400">Vyberte obrázek, jehož styl chcete aplikovat na aktuální fotografii.</p>
                    <input
                        ref={styleFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => setStyleTransferFile(e.target.files ? e.target.files[0] : null)}
                        className="hidden"
                    />
                    <button onClick={() => styleFileInputRef.current?.click()} className="w-full flex items-center justify-center px-4 py-6 border-2 border-dashed border-slate-700 rounded-lg hover:border-cyan-500 transition-colors">
                        {styleTransferFile ? (
                            <p className="text-sm text-slate-300 break-all">{styleTransferFile.name}</p>
                        ) : (
                            <div className="text-center">
                                <UploadIcon className="w-8 h-8 mx-auto text-slate-500"/>
                                <p className="mt-2 text-sm text-slate-400">Vyberte obrázek stylu</p>
                            </div>
                        )}
                    </button>
                    <button onClick={handleStyleTransfer} disabled={isLoading || !styleTransferFile} className="w-full aurora-glow inline-flex items-center justify-center px-4 py-2 mt-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:bg-cyan-600 disabled:opacity-50">
                        {isLoading ? 'Aplikuji styl...' : 'Aplikovat styl'}
                    </button>
                </div>
            );
        case 'user-presets':
            return (
                <div className="p-4 space-y-4 animate-fade-in-right">
                    <div className="flex items-center gap-3"><PresetIcon className="w-6 h-6 text-cyan-400"/><h3 className="text-lg font-bold text-slate-100">Uživatelské presety</h3></div>
                    {props.userPresets.length > 0 ? (
                        <div className="space-y-2">
                            {props.userPresets.map(preset => (
                                <button key={preset.id} className="w-full text-left p-2 rounded hover:bg-slate-800 transition-colors">
                                    {preset.name}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500">Zatím nemáte žádné uložené presety.</p>
                    )}
                     <p className="text-sm text-slate-500 mt-4">Možnost ukládání a aplikace presetů bude brzy přidána.</p>
                </div>
            );
        case 'history':
            return (
                <div className="p-4 space-y-4 animate-fade-in-right">
                    <div className="flex items-center gap-3"><HistoryIcon className="w-6 h-6 text-cyan-400"/><h3 className="text-lg font-bold text-slate-100">Historie úprav</h3></div>
                    <div className="space-y-2 text-sm max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {[...history.past, history.present].slice().reverse().map((entry, index, arr) => (
                            <div key={entry.actionName + index} className={`px-3 py-2 rounded-md ${index === 0 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 bg-slate-800/50'}`}>
                               <span className="font-mono text-xs opacity-60 mr-2">{arr.length - 1 - index}</span> {entry.actionName}
                            </div>
                        ))}
                    </div>
                </div>
            );
        case 'export':
             return (
                <div className="p-4 space-y-5 animate-fade-in-right">
                    <div className="flex items-center gap-3"><ExportIcon className="w-6 h-6 text-cyan-400"/><h3 className="text-lg font-bold text-slate-100">Exportovat obrázek</h3></div>
                    <div>
                        <label className="text-sm font-medium text-slate-300">Formát</label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button onClick={() => setExportOptions(o => ({...o, format: 'jpeg'}))} className={`px-4 py-2 text-sm rounded-md border transition-all ${exportOptions.format === 'jpeg' ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-md' : 'border-slate-700 hover:bg-slate-800'}`}>JPEG</button>
                            <button onClick={() => setExportOptions(o => ({...o, format: 'png'}))} className={`px-4 py-2 text-sm rounded-md border transition-all ${exportOptions.format === 'png' ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-md' : 'border-slate-700 hover:bg-slate-800'}`}>PNG</button>
                        </div>
                    </div>
                    {exportOptions.format === 'jpeg' && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-slate-300">Kvalita</label>
                                <span className="text-sm font-mono text-slate-400 w-12 text-right">{exportOptions.quality}</span>
                            </div>
                            <input
                                type="range" min="1" max="100" value={exportOptions.quality}
                                onChange={(e) => setExportOptions(o => ({...o, quality: Number(e.target.value)}))}
                                className="custom-slider"
                            />
                        </div>
                    )}
                     <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Velikost</label>
                         <div className="mt-2 grid grid-cols-2 gap-2">
                            <button onClick={() => setExportOptions(o => ({...o, scale: 1}))} className={`px-4 py-2 text-sm rounded-md border transition-all ${exportOptions.scale === 1 ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-md' : 'border-slate-700 hover:bg-slate-800'}`}>Původní</button>
                            <button onClick={() => setExportOptions(o => ({...o, scale: 0.5}))} className={`px-4 py-2 text-sm rounded-md border transition-all ${exportOptions.scale === 0.5 ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-md' : 'border-slate-700 hover:bg-slate-800'}`}>Poloviční</button>
                        </div>
                    </div>
                    <button onClick={handleDownload} disabled={isLoading} className="w-full aurora-glow inline-flex items-center justify-center px-4 py-3 mt-4 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:bg-cyan-600 disabled:opacity-50">
                        {isLoading ? 'Exportuji...' : 'Stáhnout obrázek'}
                    </button>
                </div>
            );
      default:
        return (
          <div className="p-4 animate-fade-in-right">
            <h3 className="text-lg font-bold text-slate-100">Editor Artifex AI</h3>
            <p className="text-slate-400 mt-2">Vyberte nástroj z levého menu a začněte s úpravami.</p>
          </div>
        );
    }
  };

  if (!files || files.length === 0) {
      return (
          <div className="w-full h-full flex flex-col">
              <Header {...props} />
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 p-8">
                  <UploadIcon className="w-24 h-24 mb-6" />
                  <h2 className="text-3xl font-bold text-slate-200">Editor je připraven</h2>
                  <p className="mt-2 text-lg">Nahrajte prosím jeden nebo více obrázků pro zahájení úprav.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 bg-grid-pattern">
      <Header {...props} />
      <div className="flex-1 flex min-h-0">
        {/* Action Panel */}
        <div className="w-80 flex-shrink-0 bg-slate-950/70 backdrop-blur-xl border-r border-slate-800/50 overflow-y-auto custom-scrollbar">
          {renderActionPanel()}
        </div>

        {/* Main Image View */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
              <ArrowPathIcon className="w-12 h-12 text-fuchsia-500 animate-spin" />
              <p className="mt-4 text-lg text-white font-semibold">{loadingMessage}</p>
            </div>
          )}
          {activeFile && (
            <div className="relative w-full h-full flex items-center justify-center">
                <img
                    key={activeFile.id + (editedPreviewUrl || activeFile.previewUrl)}
                    src={isComparing ? activeFile.originalPreviewUrl : (editedPreviewUrl || activeFile.previewUrl)}
                    alt="Active"
                    className={`max-w-full max-h-full object-contain shadow-2xl rounded-lg transition-opacity duration-200 ${isGeneratingPreview ? 'opacity-70' : 'opacity-100'}`}
                />
                 {isGeneratingPreview && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                        <ArrowPathIcon className="w-8 h-8 text-white animate-spin" />
                    </div>
                 )}
                 <button 
                    onMouseDown={() => setIsComparing(true)}
                    onMouseUp={() => setIsComparing(false)}
                    onTouchStart={() => setIsComparing(true)}
                    onTouchEnd={() => setIsComparing(false)}
                    onMouseLeave={() => setIsComparing(false)} // Handle mouse leaving the button
                    className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-slate-900/50 backdrop-blur-md rounded-lg border border-slate-700/50 text-sm font-medium z-10 select-none"
                >
                    <EyeIcon className="w-5 h-5"/>
                    <span>{isComparing ? 'Původní' : 'Podržet pro porovnání'}</span>
                 </button>
                 {showFeedback && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 animate-fade-in-slide-up">
                        <FeedbackButtons onFeedback={(f) => handleFeedback(showFeedback, f)} onTimeout={() => setShowFeedback(null)} />
                    </div>
                 )}
            </div>
          )}
           <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
                <button onClick={onUndo} disabled={history.past.length === 0} className="p-2 bg-slate-800 rounded-full disabled:opacity-50 hover:bg-slate-700"><UndoIcon className="w-5 h-5" /></button>
                <button onClick={onRedo} disabled={history.future.length === 0} className="p-2 bg-slate-800 rounded-full disabled:opacity-50 hover:bg-slate-700"><RedoIcon className="w-5 h-5" /></button>
            </div>
        </div>

        {/* Filmstrip */}
        <div className="w-32 flex-shrink-0 bg-slate-950/70 backdrop-blur-lg border-l border-slate-800/50 p-2 overflow-y-auto custom-scrollbar">
            <div className="flex flex-col space-y-2">
                {files.map(file => (
                    <button key={file.id} onClick={() => onSetActiveFileId(file.id)} className={`relative aspect-square w-full rounded-md overflow-hidden focus:outline-none group transition-all duration-200 ${activeFileId === file.id ? 'ring-2 ring-offset-2 ring-offset-slate-950 ring-cyan-500' : 'hover:scale-105'}`}>
                        <img src={file.previewUrl} alt="thumbnail" className="w-full h-full object-cover" />
                        <div className={`absolute inset-0 bg-black/50 transition-opacity ${activeFileId === file.id ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}></div>
                    </button>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default EditorView;