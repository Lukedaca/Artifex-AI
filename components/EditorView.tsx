
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
    ExportIcon,
    ChevronDoubleLeftIcon,
    ZoomInIcon,
    ZoomOutIcon,
    MagnifyingGlassIcon,
    XIcon
} from './icons';
import type { UploadedFile, AnalysisResult, EditorAction, History, Preset, ProactiveSuggestion, Feedback, ManualEdits, View } from '../types';
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
  // Navigation for export redirect
  onNavigate: (payload: { view: View; action?: string }) => void;
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
  aspectRatio: undefined, // Undefined means original ratio
  cropRect: undefined, 
};

const ASPECT_RATIOS = [
    { label: 'Originál', value: 'Original' },
    { label: '1:1', value: '1:1' },
    { label: '16:9', value: '16:9' },
    { label: '4:3', value: '4:3' },
    { label: '9:16', value: '9:16' },
    { label: '5:4', value: '5:4' },
];

// Main Component
const EditorView: React.FC<EditorViewProps> = (props) => {
  const { files, activeFileId, onSetFiles, onSetActiveFileId, activeAction, addNotification, history, onUndo, onRedo, onNavigate } = props;

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [editedPreviewUrl, setEditedPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  // State for specific tool inputs
  const [removeObjectPrompt, setRemoveObjectPrompt] = useState('');
  const [replaceBgPrompt, setReplaceBgPrompt] = useState('');
  const [cropAspectRatio, setCropAspectRatio] = useState('Original');
  const [autoCropPrompt, setAutoCropPrompt] = useState(''); // Text prompt for auto crop
  const [styleTransferFile, setStyleTransferFile] = useState<File | null>(null);
  const styleFileInputRef = useRef<HTMLInputElement>(null);
  const [manualEdits, setManualEdits] = useState<ManualEdits>(INITIAL_EDITS);
  // Shared export options state
  const [exportOptions, setExportOptions] = useState({
        format: 'jpeg',
        quality: 100,
        scale: 1,
    });
  // State for comparison slider
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isHoldingCompare, setIsHoldingCompare] = useState(false); // New state for quick peek
  const [compareSliderPosition, setCompareSliderPosition] = useState(50); // Percentage
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const imageBoundsRef = useRef<HTMLDivElement>(null);
  
  // State for Zoom and Pan
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePosition, setLastMousePosition] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // --- Manual Crop State ---
  const [isManualCropping, setIsManualCropping] = useState(false);
  const [cropSelection, setCropSelection] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [cropStart, setCropStart] = useState<{x: number, y: number} | null>(null);


  const [showFeedback, setShowFeedback] = useState<string | null>(null); // actionId for feedback

  const activeFile = useMemo(() => files.find(f => f.id === activeFileId), [files, activeFileId]);
  
  // When active file changes, reset the manual edits and clear the live preview.
  useEffect(() => {
      setManualEdits(INITIAL_EDITS);
      setEditedPreviewUrl(null); // Clear manual edit preview
      setIsCompareMode(false); // Exit compare mode when file changes
      setZoomLevel(1); // Reset zoom
      setPanPosition({ x: 0, y: 0 }); // Reset pan
      setIsManualCropping(false);
      setCropSelection(null);
  }, [activeFileId]);

  // Effect to generate a live preview when manual edits change
  useEffect(() => {
    if (!activeFile) {
      return;
    }
    
    // Check if edits are at initial values
    const areEditsInitial = Object.values(manualEdits).every(v => v === 0 || v === undefined);

    if (areEditsInitial) {
      if (editedPreviewUrl) setEditedPreviewUrl(null); // Clear preview if resets to 0
      return;
    }

    setIsGeneratingPreview(true);
    
    // Debounce to avoid lagging UI
    const handler = setTimeout(async () => {
      if (!activeFile) return;
      try {
        // Apply edits to the current active file (which might already have AI edits)
        const imageBlob = await applyEditsAndExport(
          activeFile.previewUrl,
          manualEdits,
          { format: 'jpeg', quality: 80, scale: 0.8 } // Lower scale/quality slightly for faster live preview
        );
        const objectUrl = URL.createObjectURL(imageBlob);
        setEditedPreviewUrl(objectUrl);
      } catch (e) {
        console.error("Failed to generate live preview", e);
        addNotification('Náhled úprav se nepodařilo vygenerovat.', 'error');
      } finally {
        setIsGeneratingPreview(false);
      }
    }, 250); 

    return () => clearTimeout(handler);
  }, [activeFile, manualEdits, addNotification]); // Intentionally excluding editedPreviewUrl to avoid loops
  
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

  // --- Zoom and Pan Logic ---

  const handleZoom = useCallback((delta: number) => {
      setZoomLevel(prev => {
          const newZoom = Math.max(1, Math.min(5, prev + delta));
          // Reset pan if zooming out to 1
          if (newZoom === 1) {
              setPanPosition({ x: 0, y: 0 });
          }
          return newZoom;
      });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
      // Disable zoom on scroll if Manual Cropping is active to prevent confusion
      if (isManualCropping) return;

      // Prevent default scrolling behavior when hovering over the image
      e.preventDefault();
      const delta = e.deltaY * -0.001; // Convert scroll delta to zoom delta
      handleZoom(delta);
  }, [handleZoom, isManualCropping]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (isManualCropping) {
          // Only start crop drag if we are not already in confirmation mode (cropSelection present)
          if (!cropSelection || (cropSelection.w === 0 && cropSelection.h === 0)) {
            handleCropStart(e);
          }
          return;
      }

      if (isDraggingSlider) return; // Let slider logic handle its own drag
      
      // Only allow panning if zoomed in
      if (zoomLevel > 1) {
          setIsPanning(true);
          const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
          const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
          setLastMousePosition({ x: clientX, y: clientY });
      }
  };

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (isManualCropping && isDraggingCrop) {
          handleCropMove(e);
          return;
      }

      if (isPanning) {
          const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
          const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
          
          const deltaX = clientX - lastMousePosition.x;
          const deltaY = clientY - lastMousePosition.y;

          setPanPosition(prev => ({
              x: prev.x + deltaX,
              y: prev.y + deltaY
          }));

          setLastMousePosition({ x: clientX, y: clientY });
      }
  }, [isPanning, lastMousePosition, isManualCropping, isDraggingCrop]);

  const handleMouseUp = useCallback((e: MouseEvent | TouchEvent) => {
      if (isManualCropping) {
          handleCropEnd();
          return;
      }
      setIsPanning(false);
  }, [isManualCropping]);

  // Add window listeners for mouse move/up to handle dragging outside container
  useEffect(() => {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchend', handleMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('touchmove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          window.removeEventListener('touchend', handleMouseUp);
      };
  }, [handleMouseMove, handleMouseUp]);

  // Keyboard listeners for Zoom (Arrow Keys) as requested
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!activeFile) return;
          // Only act if not typing in an input
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

          if (e.key === 'ArrowUp') {
              e.preventDefault();
              handleZoom(0.1);
          } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              handleZoom(-0.1);
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, handleZoom]);


  // --- Manual Crop Interaction Logic ---
  const startManualCropMode = () => {
      setIsManualCropping(true);
      setZoomLevel(1); // Reset zoom for easier cropping
      setPanPosition({x: 0, y: 0});
      setCropSelection(null);
      addNotification('Režim ořezu aktivní: Táhněte myší přes obrázek pro výběr.', 'info');
  };

  const cancelManualCropMode = () => {
      setIsManualCropping(false);
      setCropSelection(null);
  };

  const handleCropStart = (e: React.MouseEvent | React.TouchEvent) => {
      if (!imageRef.current) return;
      
      const rect = imageRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      // Calculate relative position within image 0-100%
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      
      setCropStart({ x, y });
      setCropSelection({ x, y, w: 0, h: 0 }); // Start with 0 size
      setIsDraggingCrop(true);
  };

  const handleCropMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingCrop || !cropStart || !imageRef.current) return;
      
      const rect = imageRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const currentX = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const currentY = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      
      const x = Math.min(currentX, cropStart.x);
      const y = Math.min(currentY, cropStart.y);
      const w = Math.abs(currentX - cropStart.x);
      const h = Math.abs(currentY - cropStart.y);
      
      setCropSelection({ x, y, w, h });
  };

  const handleCropEnd = () => {
      setIsDraggingCrop(false);
      setCropStart(null);
  };

  const applyManualCrop = () => {
      if (!cropSelection || !imageRef.current || cropSelection.w < 1 || cropSelection.h < 1) {
           addNotification("Vyberte prosím oblast pro oříznutí.", "error");
           return;
      }
      
      // Convert percentages to real image pixels
      const img = imageRef.current;
      // We need the natural dimensions of the underlying image, not displayed dimensions
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      
      const cropX = Math.round((cropSelection.x / 100) * naturalWidth);
      const cropY = Math.round((cropSelection.y / 100) * naturalHeight);
      const cropW = Math.round((cropSelection.w / 100) * naturalWidth);
      const cropH = Math.round((cropSelection.h / 100) * naturalHeight);
      
      setManualEdits(prev => ({
          ...prev,
          cropRect: { x: cropX, y: cropY, width: cropW, height: cropH },
          aspectRatio: undefined // Explicit crop overrides aspect ratio
      }));
      
      setIsManualCropping(false);
      setCropSelection(null);
      addNotification("Oříznutí aplikováno.", "info");
  };


  // --- Comparison Slider Drag Logic ---
  const handleSliderMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDraggingSlider || !imageBoundsRef.current) return;

    const rect = imageBoundsRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    
    // Calculate X relative to the zoomed container width? 
    // Standard logic works because getBoundingClientRect returns visual size on screen
    const x = clientX - rect.left;
    let newPosition = (x / rect.width) * 100;
    
    // Clamp between 0 and 100
    newPosition = Math.max(0, Math.min(100, newPosition));

    setCompareSliderPosition(newPosition);
  }, [isDraggingSlider]);

  const handleSliderInteractionEnd = useCallback(() => {
      setIsDraggingSlider(false);
  }, []);

  useEffect(() => {
      if (isDraggingSlider) {
          window.addEventListener('mousemove', handleSliderMove);
          window.addEventListener('touchmove', handleSliderMove);
          window.addEventListener('mouseup', handleSliderInteractionEnd);
          window.addEventListener('touchend', handleSliderInteractionEnd);
      }

      return () => {
          window.removeEventListener('mousemove', handleSliderMove);
          window.removeEventListener('touchmove', handleSliderMove);
          window.removeEventListener('mouseup', handleSliderInteractionEnd);
          window.removeEventListener('touchend', handleSliderInteractionEnd);
      };
  }, [isDraggingSlider, handleSliderMove, handleSliderInteractionEnd]);

  
  const updateFile = useCallback((fileId: string, updates: Partial<UploadedFile>, actionName: string) => {
    onSetFiles(currentFiles => 
      currentFiles.map(f => f.id === fileId ? { ...f, ...updates } : f),
      actionName
    );
  }, [onSetFiles]);
  
  const handleAiAction = useCallback(async (action: () => Promise<{ file: File }>, actionName: string, onSuccess?: () => void) => {
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
          
          if (onSuccess) {
              onSuccess();
          }
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
  
  // Modified Auto Crop to support aspect ratio and optional redirect
  const handleAutoCrop = (shouldRedirectToExport = false) => {
      handleAiAction(
          () => geminiService.autoCrop(activeFile!.file, cropAspectRatio, autoCropPrompt), 
          'Automatické oříznutí',
          () => {
              if (shouldRedirectToExport) {
                  onNavigate({ view: 'editor', action: 'export' });
              }
          }
      );
  };
  
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
          onNavigate({ view: 'editor', action: 'auto-crop' });
      } else if (suggestion.action === 'remove-object') {
          onNavigate({ view: 'editor', action: 'remove-object' });
          addNotification('Nástroj pro odstranění objektu je připraven.', 'info');
      }
  };

    const handleEditChange = useCallback(<K extends keyof ManualEdits>(key: K, value: ManualEdits[K]) => {
        setManualEdits(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleResetEdits = useCallback(() => {
        setManualEdits(INITIAL_EDITS);
    }, []);
    
    // Handles the confirmation when clicking "Finish & Export" in Manual Edits
    const handleManualExportRequest = useCallback(() => {
        if (window.confirm("Chcete dokončit úpravy a přejít do sekce Export pro uložení fotografie?")) {
            onNavigate({ view: 'editor', action: 'export' });
        }
    }, [onNavigate]);

    const handleDownload = async () => {
        if (!activeFile) {
            addNotification('Žádný aktivní obrázek k exportu.', 'error');
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Exportuji obrázek...');

        try {
            // Combine AI edits (previewUrl) with Manual Edits
            const imageBlob = await applyEditsAndExport(
                activeFile.previewUrl,
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
        return <ManualEditControls 
                  edits={manualEdits} 
                  onEditChange={handleEditChange} 
                  onReset={handleResetEdits}
                  exportOptions={exportOptions}
                  onExportOptionsChange={setExportOptions}
                  onRequestExport={handleManualExportRequest}
                  onStartManualCrop={startManualCropMode}
               />;
      case 'autopilot':
         return (
            <div className="p-4 space-y-4 text-center animate-fade-in-right">
                <AutopilotIcon className="w-16 h-16 mx-auto text-cyan-400"/>
                <h3 className="text-lg font-bold text-slate-100">Autopilot AI</h3>
                <p className="text-sm text-slate-400">Nechte AI automaticky vylepšit váš obrázek jedním kliknutím. Zachová původní strukturu a zaměří se na barvy a světlo.</p>
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
                <div className="p-4 space-y-4 animate-fade-in-right">
                    <div className="text-center">
                         <AutoCropIcon className="w-12 h-12 mx-auto text-cyan-400 mb-2"/>
                         <h3 className="text-lg font-bold text-slate-100">Chytrý Ořez</h3>
                    </div>
                    
                    <div>
                        <label className="text-sm font-medium text-slate-300 mb-2 block">Instrukce pro AI (Volitelné)</label>
                        <textarea 
                            value={autoCropPrompt} 
                            onChange={e => setAutoCropPrompt(e.target.value)} 
                            rows={2} 
                            placeholder="např. 'Ořízni jen na brankáře', 'Detail míče'..." 
                            className="w-full bg-slate-800 rounded-md p-2 text-sm focus:ring-cyan-500 focus:border-cyan-500 border-slate-700 mb-3"
                        ></textarea>

                        <label className="text-sm font-medium text-slate-300 mb-2 block">Formát ořezu</label>
                        <div className="grid grid-cols-3 gap-2">
                            {ASPECT_RATIOS.map((ratio) => (
                                <button
                                    key={ratio.value}
                                    onClick={() => setCropAspectRatio(ratio.value)}
                                    className={`px-2 py-2 text-xs font-medium rounded-md border transition-all ${
                                        cropAspectRatio === ratio.value 
                                            ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-md' 
                                            : 'border-slate-700 hover:bg-slate-800 text-slate-400'
                                    }`}
                                >
                                    {ratio.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <button onClick={() => handleAutoCrop(false)} disabled={isLoading} className="w-full inline-flex items-center justify-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50">
                            {isLoading ? 'Ořezávám...' : 'Pouze Oříznout'}
                        </button>
                        <button onClick={() => handleAutoCrop(true)} disabled={isLoading} className="w-full aurora-glow inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:bg-cyan-600 disabled:opacity-50">
                             {isLoading ? 'Zpracovávám...' : 'Oříznout a přejít k exportu'}
                        </button>
                    </div>
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
        <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden" onWheel={handleWheel}>
          {isLoading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
              <ArrowPathIcon className="w-12 h-12 text-fuchsia-500 animate-spin" />
              <p className="mt-4 text-lg text-white font-semibold">{loadingMessage}</p>
            </div>
          )}
          
          {activeFile && (
            <div 
                ref={imageContainerRef}
                className="relative w-full h-full flex items-center justify-center select-none touch-none"
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
                style={{ cursor: isManualCropping ? 'crosshair' : (zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default') }}
            >
                {/* Wrapper div for Zoom and Pan transform */}
                <div 
                    className="relative transition-transform duration-75 ease-out"
                    style={{ 
                        transform: `scale(${zoomLevel}) translate(${panPosition.x}px, ${panPosition.y}px)`,
                        maxWidth: '100%',
                        maxHeight: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    {/* 
                    Comparison Logic: 
                    1. If isHoldingCompare is TRUE (user pressing eye button), show ONLY Original (Highest Priority).
                    2. Else if isCompareMode is TRUE (slider active), show Slider View.
                    3. Else show standard Edited View.
                    */}
                    
                    {isHoldingCompare ? (
                        <div className="relative max-w-full max-h-full z-50 animate-fade-in">
                            <img
                                src={activeFile.originalPreviewUrl}
                                alt="Originál"
                                className="block max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                draggable="false"
                            />
                            <div className="absolute top-4 left-4 bg-cyan-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                                Původní fotografie
                            </div>
                        </div>
                    ) : isCompareMode ? (
                    <div ref={imageBoundsRef} className="relative max-w-full max-h-full shadow-2xl rounded-lg overflow-hidden group select-none">
                        {/* After Image (Bottom Layer) - now represents the 'Right' side naturally */}
                        <img
                            key={activeFile.id + (editedPreviewUrl || activeFile.previewUrl)}
                            src={editedPreviewUrl || activeFile.previewUrl}
                            alt="Po úpravě"
                            className="block max-w-full max-h-full object-contain rounded-lg"
                            draggable="false"
                        />
                        
                        {/* Before Image (Top Layer) - clipped from right to show 'Left' side */}
                        <div 
                            className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-lg"
                            style={{ clipPath: `inset(0 ${100 - compareSliderPosition}% 0 0)` }}
                        >
                            <img
                                src={activeFile.originalPreviewUrl}
                                alt="Před úpravou"
                                className="block max-w-full max-h-full object-contain absolute top-0 left-0 w-full h-full"
                                draggable="false"
                            />
                        </div>

                        {/* Labels */}
                        <div className={`absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded pointer-events-none transition-opacity duration-300 ${isDraggingSlider ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            Před
                        </div>
                        <div className={`absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded pointer-events-none transition-opacity duration-300 ${isDraggingSlider ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            Po
                        </div>

                        {/* Slider Divider and Handle */}
                        <div
                            className="absolute top-0 bottom-0 w-1 cursor-ew-resize flex items-center justify-center z-10 group/slider"
                            style={{ left: `${compareSliderPosition}%`, transform: 'translateX(-50%)' }}
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingSlider(true); }}
                            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingSlider(true); }}
                            draggable="false"
                        >
                            <div className="absolute w-0.5 h-full bg-white/80 shadow-[0_0_8px_rgba(0,0,0,0.8)]"></div>
                            <div className="absolute w-8 h-8 rounded-full bg-slate-900/90 backdrop-blur-sm border-2 border-cyan-400 flex items-center justify-center text-cyan-400 shadow-lg transition-transform hover:scale-110 active:scale-95">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /> {/* Left Arrow */}
                                </svg>
                                <svg className="w-4 h-4 -ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /> {/* Right Arrow */}
                                </svg>
                            </div>
                        </div>
                    </div>
                    ) : (
                    <div className="relative max-w-full max-h-full">
                        <img
                            ref={imageRef}
                            key={activeFile.id + (editedPreviewUrl || activeFile.previewUrl)}
                            src={editedPreviewUrl || activeFile.previewUrl}
                            alt="Active"
                            className={`block max-w-full max-h-full object-contain shadow-2xl rounded-lg transition-opacity duration-200 ${isGeneratingPreview ? 'opacity-70' : 'opacity-100'}`}
                            draggable="false"
                        />
                        {/* Manual Crop Overlay & Controls */}
                        {isManualCropping && (
                            <>
                                <div className="absolute inset-0 pointer-events-none z-40 select-none">
                                    {/* Darken entire area */}
                                    <div className="absolute inset-0 bg-black/50"></div>
                                    
                                    {/* Cutout for selection */}
                                    {cropSelection && cropSelection.w > 0 && (
                                        <div 
                                            className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                                            style={{
                                                left: `${cropSelection.x}%`,
                                                top: `${cropSelection.y}%`,
                                                width: `${cropSelection.w}%`,
                                                height: `${cropSelection.h}%`,
                                            }}
                                        >
                                            {/* Rule of thirds grid */}
                                            <div className="absolute w-full h-1/3 top-1/3 border-t border-b border-white/30"></div>
                                            <div className="absolute h-full w-1/3 left-1/3 border-l border-r border-white/30"></div>
                                        </div>
                                    )}
                                </div>

                                {/* AGENT CONFIRMATION DIALOG */}
                                {cropSelection && cropSelection.w > 5 && cropSelection.h > 5 ? (
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900/95 backdrop-blur-xl p-6 rounded-2xl border border-cyan-500/50 shadow-2xl flex flex-col items-center animate-fade-in-up min-w-[300px]">
                                        <div className="text-cyan-400 mb-2">
                                            <AutoCropIcon className="w-8 h-8" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-1">Potvrdit výběr?</h3>
                                        <p className="text-slate-400 text-sm mb-4 text-center">Jste s tímto výřezem spokojeni?</p>
                                        <div className="flex space-x-3 w-full">
                                            <button 
                                                onClick={() => setCropSelection(null)} 
                                                className="flex-1 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                                            >
                                                Zkusit znovu
                                            </button>
                                            <button 
                                                onClick={applyManualCrop} 
                                                className="flex-1 py-2 text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 rounded-lg transition-all shadow-lg"
                                            >
                                                Ano, oříznout
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* INSTRUCTION BANNER */
                                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-2xl animate-fade-in-up">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                                            <span className="text-white text-sm font-semibold">Vyberte oblast tažením myši</span>
                                        </div>
                                        <div className="h-6 w-px bg-slate-700"></div>
                                        <button onClick={cancelManualCropMode} className="text-slate-400 hover:text-white text-sm font-medium transition-colors">
                                            Zrušit
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    )}
                    {isGeneratingPreview && !isCompareMode && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                            <ArrowPathIcon className="w-8 h-8 text-white animate-spin" />
                        </div>
                    )}
                </div>

                 {/* Zoom Controls */}
                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-2 bg-slate-900/80 backdrop-blur-md p-2 rounded-full border border-slate-700/50 shadow-xl">
                     <button onClick={() => handleZoom(-0.5)} className="p-1.5 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white" title="Oddálit (Šipka dolů)">
                         <ZoomOutIcon className="w-5 h-5" />
                     </button>
                     <span className="text-xs font-mono w-12 text-center text-slate-300 select-none">{Math.round(zoomLevel * 100)}%</span>
                     <button onClick={() => handleZoom(0.5)} className="p-1.5 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white" title="Přiblížit (Šipka nahoru)">
                         <ZoomInIcon className="w-5 h-5" />
                     </button>
                     <div className="w-px h-4 bg-slate-700 mx-1"></div>
                     <button onClick={() => { setZoomLevel(1); setPanPosition({x:0, y:0}); }} className="p-1.5 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white" title="Resetovat pohled">
                         <MagnifyingGlassIcon className="w-5 h-5" />
                     </button>
                 </div>
                 
                 {/* Comparison and View Controls */}
                 <div className="absolute bottom-4 right-4 flex items-center gap-2 z-30">
                     {/* Hold to Quick Compare */}
                    <button
                        onMouseDown={() => setIsHoldingCompare(true)}
                        onMouseUp={() => setIsHoldingCompare(false)}
                        onMouseLeave={() => setIsHoldingCompare(false)}
                        onTouchStart={() => setIsHoldingCompare(true)}
                        onTouchEnd={() => setIsHoldingCompare(false)}
                        className="flex items-center justify-center w-10 h-10 bg-slate-900/50 backdrop-blur-md rounded-full border border-slate-700/50 text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/50 transition-all active:scale-95 shadow-lg"
                        title="Podržte pro zobrazení originálu"
                    >
                        <EyeIcon className="w-5 h-5" />
                    </button>

                    {/* Toggle Slider Mode */}
                    <button 
                        onClick={() => setIsCompareMode(p => !p)}
                        className={`flex items-center gap-2 px-4 py-2 bg-slate-900/50 backdrop-blur-md rounded-lg border border-slate-700/50 text-sm font-medium select-none transition-colors shadow-lg ${isCompareMode ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'text-slate-200 hover:bg-slate-800/70'}`}
                    >
                        <ChevronDoubleLeftIcon className={`w-4 h-4 transition-transform ${isCompareMode ? 'rotate-180' : ''}`} />
                        <span>{isCompareMode ? 'Skrýt posuvník' : 'Porovnat posuvníkem'}</span>
                    </button>
                 </div>

                 {showFeedback && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 animate-fade-in-slide-up">
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
