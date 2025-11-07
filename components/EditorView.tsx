import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Types
import type { UploadedFile, ManualEdits, EditorAction, History, Preset, Feedback } from '../types';

// Services
import { analyzeImage, autopilotImage, autoCropImage } from '../services/geminiService';
import { applyEditsToImage } from '../utils/imageProcessor';
import { updateUserTendencies, recordExplicitFeedback } from '../services/userProfileService';

// Components
import Header from './Header';
import ManualEditControls from './ManualEditControls';
import FeedbackButtons from './FeedbackButtons';
import {
  AnalysisIcon,
  AutopilotIcon,
  AutoCropIcon,
  EraserIcon,
  UndoIcon,
  RedoIcon,
  EyeIcon,
  StyleTransferIcon,
  BackgroundReplacementIcon,
  PresetIcon,
  ExportIcon,
  HistoryIcon,
  UploadIcon
} from './icons';
import { LogoIcon } from './icons';

// --- Props ---
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
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenApiKeyModal: () => void;
  onToggleSidebar: () => void;
}


const INITIAL_EDITS: ManualEdits = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  shadows: 0,
  highlights: 0,
  clarity: 0,
};

// --- Main Component ---
const EditorView: React.FC<EditorViewProps> = (props) => {
  const { files, activeFileId, onSetFiles, onSetActiveFileId, activeAction, addNotification, history, onUndo, onRedo } = props;

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Pracuji...');
  const [error, setError] = useState<string | null>(null);

  const [manualEdits, setManualEdits] = useState<ManualEdits>(INITIAL_EDITS);
  const [showOriginal, setShowOriginal] = useState(false);
  const [feedbackActionId, setFeedbackActionId] = useState<string | null>(null);

  const activeFile = useMemo(() => files.find(f => f.id === activeFileId), [files, activeFileId]);
  
  // Ref to track edit changes for learning
  const editChangesRef = useRef<Partial<ManualEdits>>({});
  
  // Debounce saving tendency updates
  useEffect(() => {
    const handler = setTimeout(() => {
      if (Object.keys(editChangesRef.current).length > 0) {
        updateUserTendencies(editChangesRef.current);
        editChangesRef.current = {};
      }
    }, 2000);
    return () => clearTimeout(handler);
  }, [manualEdits]);

  // When active file changes, reset local state
  useEffect(() => {
    setError(null);
    setManualEdits(INITIAL_EDITS); // Reset edits when switching images
    setShowOriginal(false);
    setFeedbackActionId(null);
  }, [activeFileId]);
  
  const updateActiveFile = (updater: (file: UploadedFile) => UploadedFile, actionName: string) => {
    if (!activeFileId) return;
    onSetFiles(currentFiles => 
      currentFiles.map(f => f.id === activeFileId ? updater(f) : f),
      actionName
    );
  };
  
  // --- Handlers for AI Actions ---

  const handleAnalyze = useCallback(async () => {
    if (!activeFile) return;
    setIsLoading(true);
    setLoadingMessage('Analyzuji obrázek...');
    setError(null);
    updateActiveFile(f => ({ ...f, isAnalyzing: true }), 'Start Analysis');

    try {
      const result = await analyzeImage(activeFile.file);
      updateActiveFile(f => ({ ...f, analysis: result, isAnalyzing: false }), 'Image Analyzed');
      addNotification('Analýza obrázku dokončena.', 'info');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Neznámá chyba';
      setError(`Chyba při analýze: ${message}`);
      addNotification(`Chyba při analýze: ${message}`, 'error');
      updateActiveFile(f => ({ ...f, isAnalyzing: false }), 'Analysis Failed');
    } finally {
      setIsLoading(false);
    }
  }, [activeFile, updateActiveFile, addNotification]);

  const handleAutopilot = useCallback(async () => {
    if (!activeFile) return;
    setIsLoading(true);
    setLoadingMessage('Aplikuji AI vylepšení...');
    setError(null);
    
    try {
      const { file: newFile, edits } = await autopilotImage(activeFile.file);
      URL.revokeObjectURL(activeFile.previewUrl);
      const newPreviewUrl = URL.createObjectURL(newFile);
      const actionId = `autopilot-${Date.now()}`;

      updateActiveFile(f => ({ 
        ...f, 
        file: newFile, 
        previewUrl: newPreviewUrl 
      }), 'Autopilot Applied');
      setManualEdits({ ...INITIAL_EDITS, ...edits }); // Show what the AI did
      setFeedbackActionId(actionId);
      addNotification('Vylepšení Autopilot AI bylo aplikováno.', 'info');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Neznámá chyba';
      setError(`Chyba Autopilota: ${message}`);
      addNotification(`Chyba Autopilota: ${message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeFile, updateActiveFile, addNotification]);
  
  const handleAutoCrop = useCallback(async () => {
    if (!activeFile) return;
    setIsLoading(true);
    setLoadingMessage('Hledám nejlepší kompozici...');
    setError(null);

    try {
        const cropCoords = await autoCropImage(activeFile.file);
        const editedBlob = await applyEditsToImage(activeFile.file, {}, cropCoords);
        
        const newFileName = activeFile.file.name.replace(/\.[^/.]+$/, "_cropped.png");
        const newFile = new File([editedBlob], newFileName, { type: 'image/png' });

        URL.revokeObjectURL(activeFile.previewUrl);
        const newPreviewUrl = URL.createObjectURL(newFile);
        
        const actionId = `autocrop-${Date.now()}`;
        setFeedbackActionId(actionId);

        updateActiveFile(f => ({
            ...f,
            file: newFile,
            previewUrl: newPreviewUrl,
        }), 'Auto-crop Applied');
        
        addNotification('Bylo aplikováno automatické oříznutí.', 'info');
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Neznámá chyba';
        setError(`Chyba při ořezu: ${message}`);
        addNotification(`Chyba při ořezu: ${message}`, 'error');
    } finally {
        setIsLoading(false);
    }
}, [activeFile, updateActiveFile, addNotification]);


  const handleEditChange = useCallback(<K extends keyof ManualEdits>(key: K, value: ManualEdits[K]) => {
    const oldVal = manualEdits[key];
    setManualEdits(prev => ({ ...prev, [key]: value }));
    
    // Store difference for learning
    if (typeof value === 'number' && typeof oldVal === 'number') {
        const change = value - oldVal;
        editChangesRef.current[key] = (editChangesRef.current[key] || 0) + change;
    }
  }, [manualEdits]);
  
  const handleApplyManualEdits = useCallback(async () => {
    if (!activeFile) return;
    setIsLoading(true);
    setLoadingMessage('Aplikuji úpravy...');
    try {
        const editedBlob = await applyEditsToImage(activeFile.file, manualEdits);
        const newFileName = activeFile.file.name.replace(/\.[^/.]+$/, "_edited.png");
        const newFile = new File([editedBlob], newFileName, { type: 'image/png' });
        
        URL.revokeObjectURL(activeFile.previewUrl);
        const newPreviewUrl = URL.createObjectURL(newFile);
        
        updateActiveFile(f => ({
            ...f,
            file: newFile,
            previewUrl: newPreviewUrl,
        }), 'Manual Edits Applied');

        setManualEdits(INITIAL_EDITS); // Reset sliders after applying
        addNotification('Manuální úpravy byly aplikovány.', 'info');
    } catch (e) {
        addNotification('Nepodařilo se aplikovat úpravy.', 'error');
    } finally {
        setIsLoading(false);
    }
  }, [activeFile, manualEdits, updateActiveFile, addNotification]);

  const handleFeedback = (feedback: Feedback) => {
    if (feedbackActionId) {
      recordExplicitFeedback(feedbackActionId, feedback);
      const message = feedback === 'good' ? 'Děkujeme za zpětnou vazbu!' : 'Děkujeme, zkusíme to příště lépe.';
      addNotification(message, 'info');
    }
    setFeedbackActionId(null);
  };

  const renderActiveActionPanel = () => {
    if (!activeFile) return null;
    switch (activeAction?.action) {
      case 'analysis':
        return <AnalysisPanel file={activeFile} onAnalyze={handleAnalyze} isLoading={isLoading} />;
      case 'manual-edit':
        return (
          <div className="space-y-4">
            <ManualEditControls
              edits={manualEdits}
              onEditChange={handleEditChange}
              onReset={() => setManualEdits(INITIAL_EDITS)}
            />
            <div className="px-4">
              <button
                onClick={handleApplyManualEdits}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 transition"
              >
                Aplikovat úpravy
              </button>
            </div>
          </div>
        );
      case 'autopilot':
        return <SimpleActionPanel title="Autopilot AI" description="Nechte AI automaticky vylepšit váš obrázek jedním kliknutím." icon={<AutopilotIcon className="w-8 h-8"/>} onAction={handleAutopilot} actionText="Spustit Autopilota" isLoading={isLoading} />;
      case 'auto-crop':
        return <SimpleActionPanel title="Automatické oříznutí" description="AI analyzuje kompozici a navrhne nejlepší ořez pro maximální dopad." icon={<AutoCropIcon className="w-8 h-8"/>} onAction={handleAutoCrop} actionText="Spustit automatické oříznutí" isLoading={isLoading} />;
      // Stubs for other panels
      case 'remove-object':
        return <div className="p-4 text-center"><EraserIcon className="w-10 h-10 mx-auto text-slate-400 mb-2"/><p className="text-slate-500">Nástroj pro odstranění objektů již brzy.</p></div>;
      case 'style-transfer':
        return <div className="p-4 text-center"><StyleTransferIcon className="w-10 h-10 mx-auto text-slate-400 mb-2"/><p className="text-slate-500">Nástroj pro přenos stylu již brzy.</p></div>;
      case 'replace-background':
        return <div className="p-4 text-center"><BackgroundReplacementIcon className="w-10 h-10 mx-auto text-slate-400 mb-2"/><p className="text-slate-500">Nástroj pro výměnu pozadí již brzy.</p></div>;
       case 'user-presets':
        return <div className="p-4 text-center"><PresetIcon className="w-10 h-10 mx-auto text-slate-400 mb-2"/><p className="text-slate-500">Správa presetů již brzy.</p></div>;
       case 'export':
        return <div className="p-4 text-center"><ExportIcon className="w-10 h-10 mx-auto text-slate-400 mb-2"/><p className="text-slate-500">Možnosti exportu již brzy.</p></div>;
       case 'history':
        return <div className="p-4 text-center"><HistoryIcon className="w-10 h-10 mx-auto text-slate-400 mb-2"/><p className="text-slate-500">Historie úprav již brzy.</p></div>;
      default:
        return (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                <LogoIcon className="w-16 h-16 text-cyan-500/50 mb-4" />
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Vítejte v editoru</h3>
                <p className="text-slate-500 mt-2">Vyberte nástroj z levého menu pro zahájení úprav.</p>
            </div>
        );
    }
  };

  if (files.length === 0) {
      return (
        <div className="w-full h-full flex flex-col">
            <Header {...props} />
             <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <UploadIcon className="w-24 h-24 text-slate-300 dark:text-slate-700 mb-6" />
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Žádné obrázky k úpravě</h2>
                <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">Prosím, nahrajte nejprve nějaké obrázky.</p>
             </div>
        </div>
      );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-200/50 dark:bg-slate-900/50">
      <Header {...props} />
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Top Toolbar */}
          <div className="flex-shrink-0 h-16 bg-white/60 dark:bg-slate-900/70 backdrop-blur-xl flex items-center justify-between px-4 border-b border-slate-200/50 dark:border-slate-800/50">
            <div className="flex items-center gap-2">
                <button onClick={onUndo} disabled={history.past.length === 0} className="p-2 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-500/10"><UndoIcon className="w-5 h-5" /></button>
                <button onClick={onRedo} disabled={history.future.length === 0} className="p-2 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-500/10"><RedoIcon className="w-5 h-5" /></button>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate max-w-xs sm:max-w-sm md:max-w-md">{activeFile?.file.name}</p>
             <div className="flex items-center gap-2">
                 {activeFile && (
                    <button onClick={() => setShowOriginal(p => !p)} onMouseDown={() => setShowOriginal(true)} onMouseUp={() => setShowOriginal(false)} onTouchStart={() => setShowOriginal(true)} onTouchEnd={() => setShowOriginal(false)} className="flex items-center gap-2 p-2 rounded-lg text-sm hover:bg-slate-500/10">
                        <EyeIcon className="w-5 h-5"/>
                        <span className="hidden sm:inline">Původní</span>
                    </button>
                 )}
            </div>
          </div>
          {/* Image Viewer */}
          <div className="flex-1 bg-grid-pattern flex items-center justify-center p-4 relative overflow-auto">
            {isLoading && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-white">
                <svg className="animate-spin h-10 w-10 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p className="text-lg font-semibold">{loadingMessage}</p>
              </div>
            )}
            {activeFile && (
              <img
                key={activeFile.id + (showOriginal ? activeFile.originalPreviewUrl : activeFile.previewUrl)}
                src={showOriginal ? activeFile.originalPreviewUrl : activeFile.previewUrl}
                alt="Active file"
                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg transition-all"
                style={{ filter: `brightness(${100 + manualEdits.brightness}%) contrast(${100 + manualEdits.contrast}%) saturate(${100 + manualEdits.saturation}%)` }}
              />
            )}
            {feedbackActionId && (
                <div className="absolute bottom-4 right-4 z-10">
                    <FeedbackButtons onFeedback={handleFeedback} onTimeout={() => setFeedbackActionId(null)} />
                </div>
            )}
          </div>
        </div>
        
        {/* Right Sidebar */}
        <aside className="w-80 flex-shrink-0 border-l border-slate-200/50 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/70 backdrop-blur-xl flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {error && (
              <div className="p-4 m-4 bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20 rounded-lg text-sm">
                <p className="font-bold mb-1">Došlo k chybě</p>
                {error}
              </div>
            )}
            {renderActiveActionPanel()}
          </div>
        </aside>
      </div>
      
      {/* Filmstrip */}
      <div className="flex-shrink-0 h-28 bg-white/50 dark:bg-slate-900/60 backdrop-blur-lg border-t border-slate-200/50 dark:border-slate-800/50 p-2">
        <div className="h-full flex items-center space-x-3 overflow-x-auto">
          {files.map(file => (
            <button 
                key={file.id} 
                onClick={() => onSetActiveFileId(file.id)}
                className={`h-24 w-24 flex-shrink-0 rounded-lg overflow-hidden relative transition-all duration-200 focus:outline-none ${file.id === activeFileId ? 'ring-4 ring-cyan-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : 'hover:scale-105'}`}
            >
              <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover"/>
              {file.isAnalyzing && (
                 <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};


// --- Sub-components for EditorView ---

interface AnalysisPanelProps {
  file: UploadedFile;
  onAnalyze: () => void;
  isLoading: boolean;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ file, onAnalyze, isLoading }) => {
  return (
    <div className="p-4 space-y-6 animate-fade-in-right">
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">AI Analýza</h3>
        <p className="text-sm text-slate-500 mt-1">Získejte podrobný rozbor vaší fotografie, včetně technických údajů a návrhů na vylepšení.</p>
      </div>
      
      {!file.analysis ? (
        <button onClick={onAnalyze} disabled={isLoading} className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 disabled:opacity-50 transition">
          <AnalysisIcon className="w-5 h-5 mr-2" />
          {isLoading ? 'Analyzuji...' : 'Analyzovat obrázek'}
        </button>
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Popis</h4>
            <p className="text-slate-600 dark:text-slate-400">{file.analysis.description}</p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Návrhy na vylepšení</h4>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
              {file.analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Technické informace</h4>
            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                    <p className="text-xs text-slate-500">ISO</p>
                    <p className="font-mono font-semibold">{file.analysis.technicalInfo.ISO}</p>
                </div>
                 <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                    <p className="text-xs text-slate-500">Clona</p>
                    <p className="font-mono font-semibold">{file.analysis.technicalInfo.Aperture}</p>
                </div>
                 <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                    <p className="text-xs text-slate-500">Závěrka</p>
                    <p className="font-mono font-semibold">{file.analysis.technicalInfo.ShutterSpeed}</p>
                </div>
            </div>
          </div>
          <button onClick={onAnalyze} disabled={isLoading} className="w-full text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline pt-2">
            Analyzovat znovu
          </button>
        </div>
      )}
    </div>
  );
};

interface SimpleActionPanelProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    onAction: () => void;
    actionText: string;
    isLoading: boolean;
}

const SimpleActionPanel: React.FC<SimpleActionPanelProps> = ({ title, description, icon, onAction, actionText, isLoading }) => (
    <div className="p-4 animate-fade-in-right flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500 mb-4">
            {icon}
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        <p className="text-sm text-slate-500 mt-1 mb-6 max-w-xs">{description}</p>
        <button onClick={onAction} disabled={isLoading} className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 disabled:opacity-50 transition">
          {isLoading ? 'Pracuji...' : actionText}
        </button>
    </div>
);


export default EditorView;
