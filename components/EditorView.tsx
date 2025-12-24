
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Header from './Header';
import ManualEditControls from './ManualEditControls';
import FeedbackButtons from './FeedbackButtons';
import Histogram from './Histogram';
import CompareSlider from './CompareSlider';
import { 
    UndoIcon, 
    EyeIcon, 
    UploadIcon, 
    AutopilotIcon, 
    ArrowPathIcon,
    ZoomInIcon,
    ZoomOutIcon,
    MagnifyingGlassIcon,
    XIcon,
    SparklesIcon,
    FilmIcon,
    YoutubeIcon,
    ExportIcon,
    MicrophoneIcon,
    ExpandIcon
} from './icons';
import type { UploadedFile, EditorAction, History, Preset, ManualEdits, View } from '../types';
import * as geminiService from '../services/geminiService';
import { applyEditsAndExport } from '../utils/imageProcessor';
import { useTranslation } from '../contexts/LanguageContext';

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
  onNavigate: (payload: { view: View; action?: string }) => void;
  onOpenApiKeyModal: () => void;
  onToggleSidebar: () => void;
  credits: number;
  onDeductCredits: (amount: number) => boolean;
}

const getApiErrorMessage = (error: unknown, defaultMessage = 'An error occurred.'): string => {
    if (error instanceof Error) return error.message;
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
  aspectRatio: undefined,
  cropRect: undefined, 
  watermark: { enabled: false, text: '', opacity: 50, size: 20, position: 'bottom-right', color: '#ffffff' }
};

const EditorView: React.FC<EditorViewProps> = (props) => {
  const { files, activeFileId, onSetFiles, onSetActiveFileId, activeAction, addNotification, language, credits, onDeductCredits } = props;
  const { t: trans } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [editedPreviewUrl, setEditedPreviewUrl] = useState<string | null>(null);
  const [manualEdits, setManualEdits] = useState<ManualEdits>(INITIAL_EDITS);
  const [exportOptions, setExportOptions] = useState({ format: 'jpeg', quality: 90, scale: 1 });
  const [isComparing, setIsComparing] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  
  // YouTube Thumbnail State
  const [thumbnailTopic, setThumbnailTopic] = useState('');
  const [thumbnailText, setThumbnailText] = useState('');
  const [thumbnailResolution, setThumbnailResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [thumbnailFormat, setThumbnailFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');

  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });

  const activeFile = useMemo(() => files.find(f => f.id === activeFileId), [files, activeFileId]);
  const isYouTubeMode = activeAction?.action === 'youtube-thumbnail';

  // Voice Recognition (Simple Client Side)
  useEffect(() => {
      let recognition: any;
      if (isVoiceActive) {
          // @ts-ignore
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (SpeechRecognition) {
              recognition = new SpeechRecognition();
              recognition.continuous = true;
              recognition.lang = language === 'cs' ? 'cs-CZ' : 'en-US';
              recognition.onresult = (event: any) => {
                  const last = event.results.length - 1;
                  const command = event.results[last][0].transcript.toLowerCase().trim();
                  console.log("Voice Command:", command);
                  
                  if (command.includes('jas') || command.includes('brightness')) {
                      if (command.includes('víc') || command.includes('up') || command.includes('přidat')) {
                          setManualEdits(prev => { const n = {...prev, brightness: Math.min(100, prev.brightness + 10)}; return n; });
                      } else if (command.includes('méně') || command.includes('down') || command.includes('ubrat')) {
                           setManualEdits(prev => { const n = {...prev, brightness: Math.max(-100, prev.brightness - 10)}; return n; });
                      }
                  } else if (command.includes('kontrast') || command.includes('contrast')) {
                       if (command.includes('víc') || command.includes('up')) {
                           setManualEdits(prev => { const n = {...prev, contrast: Math.min(100, prev.contrast + 10)}; return n; });
                       }
                  } else if (command.includes('reset')) {
                      setManualEdits(INITIAL_EDITS);
                  }
              };
              recognition.start();
          } else {
              addNotification("Váš prohlížeč nepodporuje hlasové ovládání.", "error");
              setIsVoiceActive(false);
          }
      }
      return () => {
          if (recognition) recognition.stop();
      };
  }, [isVoiceActive, language]);

  const updateFile = useCallback((fileId: string, updates: Partial<UploadedFile>, actionName: string) => {
    onSetFiles(currentFiles => currentFiles.map(f => f.id === fileId ? { ...f, ...updates } : f), actionName);
  }, [onSetFiles]);

  // Debounced Edit Application
  useEffect(() => {
    if (!activeFile) return;
    
    const apply = async () => {
        try {
            const blob = await applyEditsAndExport(activeFile.originalPreviewUrl, manualEdits, { format: 'jpeg', quality: 90, scale: 0.5 }); // Low scale for preview speed
            const url = URL.createObjectURL(blob);
            setEditedPreviewUrl(url);
        } catch (e) {
            console.error(e);
        }
    };

    const t = setTimeout(apply, 150);
    return () => clearTimeout(t);
  }, [activeFile, manualEdits]);

  const handleManualExport = async () => {
    if (!activeFile) return;
    setIsLoading(true);
    try {
        const blob = await applyEditsAndExport(activeFile.originalPreviewUrl, manualEdits, exportOptions);
        const url = URL.createObjectURL(blob);
        
        // Trigger Download
        const link = document.createElement('a');
        link.href = url;
        link.download = `edited_${activeFile.file.name.replace(/\.[^/.]+$/, "")}.${exportOptions.format === 'jpeg' ? 'jpg' : 'png'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        addNotification(trans.msg_success, 'info');
    } catch (e) {
        addNotification(trans.msg_error, 'error');
    } finally {
        setIsLoading(false);
    }
  };

  const handleGenerateThumbnail = async () => {
    if (!thumbnailTopic.trim()) {
        addNotification(trans.tool_youtube_topic_ph, 'error');
        return;
    }

    const COST = 10;
    if (!onDeductCredits(COST)) {
        addNotification(`${trans.credits_low}. ${trans.credits_cost}: ${COST}`, 'error');
        return;
    }

    // ... (Keep existing key check)
    if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await window.aistudio.openSelectKey();
        }
    }

    setIsLoading(true);
    setLoadingMessage("Gemini 3 Pro navrhuje virální miniaturu...");
    try {
        const { file } = await geminiService.generateYouTubeThumbnail(
            thumbnailTopic, 
            thumbnailText, 
            { resolution: thumbnailResolution, format: thumbnailFormat }
        );
        const previewUrl = URL.createObjectURL(file);
        const newUploadedFile: UploadedFile = {
            id: `yt-${Date.now()}`,
            file,
            previewUrl,
            originalPreviewUrl: previewUrl,
        };
        onSetFiles(prev => [...prev, newUploadedFile], 'YouTube Thumbnail Creation');
        onSetActiveFileId(newUploadedFile.id);
        addNotification(trans.msg_success, 'info');
    } catch (e: any) {
        let errorMsg = e instanceof Error ? e.message : trans.msg_error;
        if (errorMsg.includes("Requested entity was not found")) {
             if (window.aistudio) await window.aistudio.openSelectKey();
        }
        addNotification(errorMsg, 'error');
    } finally {
        setIsLoading(false);
    }
  };

  // If we are not in YouTube mode and have no file, show "No Image"
  if (!activeFile && !isYouTubeMode) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-950">
         <Header title={trans.app_title} onToggleSidebar={props.onToggleSidebar} credits={credits} />
         <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
            <div className="p-6 bg-slate-900 rounded-3xl mb-6 border border-slate-800">
                <UploadIcon className="w-16 h-16 opacity-30" />
            </div>
            <p className="text-xl font-bold text-slate-300">{trans.editor_no_image}</p>
         </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
        <Header title={isYouTubeMode ? "YouTube Thumbnail Studio" : trans.nav_studio} onToggleSidebar={props.onToggleSidebar} credits={credits} />
        
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            {/* Viewport */}
            <div className="flex-1 bg-slate-900/40 relative overflow-hidden flex items-center justify-center p-4">
                <div className="w-full max-w-4xl h-full relative flex items-center justify-center">
                    
                    {/* Voice Director Button */}
                    {!isYouTubeMode && activeFile && (
                        <button 
                            onClick={() => setIsVoiceActive(!isVoiceActive)}
                            className={`absolute top-4 left-4 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 ${isVoiceActive ? 'bg-red-500 animate-pulse text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                            title="Voice Director (Beta)"
                        >
                            <MicrophoneIcon className="w-6 h-6" />
                        </button>
                    )}

                    {activeFile ? (
                        <div className="relative group shadow-2xl rounded-xl overflow-hidden border border-white/10 ring-1 ring-white/5 max-h-full max-w-full">
                           {isComparing ? (
                               <CompareSlider 
                                   beforeUrl={activeFile.originalPreviewUrl} 
                                   afterUrl={editedPreviewUrl || activeFile.previewUrl} 
                               />
                           ) : (
                               <>
                                <img src={editedPreviewUrl || activeFile.previewUrl} alt="Preview" className="max-h-full max-w-full object-contain select-none" />
                                <button
                                    onMouseDown={() => setIsComparing(true)}
                                    onMouseUp={() => setIsComparing(false)}
                                    onTouchStart={() => setIsComparing(true)}
                                    onTouchEnd={() => setIsComparing(false)}
                                    className="absolute bottom-4 right-4 bg-slate-900/80 text-white px-4 py-2 rounded-full text-xs font-bold border border-white/10 hover:bg-black transition-colors z-20"
                                >
                                    {trans.compare_btn} (Hold)
                                </button>
                               </>
                           )}
                        </div>
                    ) : isYouTubeMode ? (
                        <div className="w-full h-full border-2 border-dashed border-red-500/20 rounded-3xl flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-sm group">
                            <div className="p-8 bg-red-500/5 rounded-full mb-6 group-hover:bg-red-500/10 transition-all duration-500">
                                <YoutubeIcon className="w-20 h-20 text-red-600 opacity-20 group-hover:opacity-60 group-hover:scale-110 transition-all" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-600 tracking-tighter uppercase">Thumbnail Designer</h2>
                        </div>
                    ) : null}
                </div>
                
                {isLoading && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center">
                        <div className="w-16 h-16 border-4 border-slate-800 border-t-cyan-500 rounded-full animate-spin mb-6"></div>
                        <p className="text-xl font-black text-white tracking-tight animate-pulse">{loadingMessage}</p>
                    </div>
                )}
            </div>

            {/* Controls Sidebar */}
            <div className="w-full lg:w-96 bg-slate-900/90 backdrop-blur-3xl border-l border-white/5 flex flex-col z-20 overflow-y-auto custom-scrollbar">
                
                {/* Histogram Widget */}
                {!isYouTubeMode && activeFile && (
                    <div className="px-8 pt-6">
                        <Histogram imageUrl={editedPreviewUrl || activeFile.previewUrl} />
                    </div>
                )}

                <div className="p-8 space-y-8 pt-2">
                    {/* ... (Keep existing YouTube logic) ... */}
                    {isYouTubeMode && (
                        <div className="space-y-6 animate-fade-in-right">
                             {/* ... Inputs for Youtube ... */}
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{trans.tool_youtube_topic}</label>
                                <textarea 
                                    rows={3}
                                    value={thumbnailTopic} 
                                    onChange={(e) => setThumbnailTopic(e.target.value)}
                                    placeholder={trans.tool_youtube_topic_ph}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-2 focus:ring-red-600 outline-none transition-all placeholder:text-slate-700 shadow-inner"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{trans.tool_youtube_text}</label>
                                <input 
                                    type="text" 
                                    value={thumbnailText} 
                                    onChange={(e) => setThumbnailText(e.target.value)}
                                    placeholder={trans.tool_youtube_text_ph}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:ring-2 focus:ring-red-600 outline-none transition-all placeholder:text-slate-700 shadow-inner"
                                />
                            </div>
                             <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>{trans.credits_cost}:</span>
                                <span className="font-bold text-amber-400">10 {trans.credits_remaining}</span>
                             </div>
                             <button 
                                onClick={handleGenerateThumbnail} 
                                disabled={isLoading}
                                className="w-full py-5 bg-red-600 hover:bg-red-500 rounded-2xl text-sm font-black text-white shadow-2xl shadow-red-600/30 transition-all flex items-center justify-center gap-3 active:scale-[0.97] disabled:opacity-50"
                            >
                                <SparklesIcon className="w-5 h-5" />
                                {trans.tool_youtube_btn}
                            </button>
                        </div>
                    )}

                    {!isYouTubeMode && activeFile && (
                         <ManualEditControls 
                            edits={manualEdits}
                            onEditChange={(k, v) => setManualEdits(p => ({...p, [k]: v}))}
                            onReset={() => setManualEdits(INITIAL_EDITS)}
                            exportOptions={exportOptions}
                            onExportOptionsChange={setExportOptions}
                            onRequestExport={handleManualExport}
                            onStartManualCrop={() => {}}
                            onSnapshot={() => {}}
                         />
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default EditorView;
