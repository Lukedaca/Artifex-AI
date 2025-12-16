
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Header from './Header';
import ManualEditControls from './ManualEditControls';
import FeedbackButtons from './FeedbackButtons';
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
    FilmIcon
} from './icons';
import type { UploadedFile, EditorAction, History, Preset, ManualEdits, View } from '../types';
import * as geminiService from '../services/geminiService';
import { recordExplicitFeedback } from '../services/userProfileService';
import { applyEditsAndExport } from '../utils/imageProcessor';
import { useTranslation } from '../contexts/LanguageContext';

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

const getApiErrorMessage = (error: unknown, defaultMessage = 'An error occurred.'): string => {
    if (error instanceof Error) {
        if (error.message.toLowerCase().includes('api key') || error.message.toLowerCase().includes('auth')) {
            return 'API Key Error.';
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

interface LocalHistory {
    past: ManualEdits[];
    present: ManualEdits;
    future: ManualEdits[];
}

// Main Component
const EditorView: React.FC<EditorViewProps> = (props) => {
  const { files, activeFileId, onSetFiles, onSetActiveFileId, activeAction, addNotification, history, onUndo, onRedo, onNavigate } = props;
  const { t, language } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [editedPreviewUrl, setEditedPreviewUrl] = useState<string | null>(null);
  
  // State for specific tool inputs
  const [removeObjectPrompt, setRemoveObjectPrompt] = useState('');
  const [replaceBgPrompt, setReplaceBgPrompt] = useState('');
  const [cropAspectRatio, setCropAspectRatio] = useState('Original');
  const [autoCropPrompt, setAutoCropPrompt] = useState(''); // Text prompt for auto crop
  const [styleTransferFile, setStyleTransferFile] = useState<File | null>(null);
  const [videoPrompt, setVideoPrompt] = useState('');
  const styleFileInputRef = useRef<HTMLInputElement>(null);
  
  // Local Manual Edits State & History
  const [manualEdits, setManualEdits] = useState<ManualEdits>(INITIAL_EDITS);
  const [manualHistory, setManualHistory] = useState<LocalHistory>({
      past: [],
      present: INITIAL_EDITS,
      future: []
  });

  // Shared export options state
  const [exportOptions, setExportOptions] = useState({
        format: 'jpeg',
        quality: 100,
        scale: 1,
    });
  // State for comparison slider
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isHoldingCompare, setIsHoldingCompare] = useState(false);
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
  
  // 'create' = drawing new box, 'move' = dragging whole box, 'resize-nw' = resizing from top-left, etc.
  type InteractionMode = 'none' | 'create' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se';
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('none');
  const [cropStart, setCropStart] = useState<{x: number, y: number} | null>(null); // Mouse start pos in %
  const [cropAnchor, setCropAnchor] = useState<{x: number, y: number, w: number, h: number} | null>(null); // Initial rect state before drag


  const [showFeedback, setShowFeedback] = useState<string | null>(null); // actionId for feedback

  const activeFile = useMemo(() => files.find(f => f.id === activeFileId), [files, activeFileId]);
  
  // When active file changes, reset the manual edits and clear the live preview.
  useEffect(() => {
      setManualEdits(INITIAL_EDITS);
      setManualHistory({ past: [], present: INITIAL_EDITS, future: [] });
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

    // Debounce to avoid lagging UI
    const handler = setTimeout(async () => {
      if (!activeFile) return;
      try {
        // Apply edits to the current active file (which might already have AI edits)
        const imageBlob = await applyEditsAndExport(
          activeFile.previewUrl,
          manualEdits,
          { format: 'jpeg', quality: 85, scale: 1 }
        );
        const objectUrl = URL.createObjectURL(imageBlob);
        setEditedPreviewUrl(objectUrl);
      } catch (e) {
        console.error("Failed to generate live preview", e);
        addNotification(t.msg_error, 'error');
      }
    }, 250); 

    return () => clearTimeout(handler);
  }, [activeFile, manualEdits, addNotification, t.msg_error]); 
  
  // Effect to clean up the blob URL when it changes or the component unmounts
  useEffect(() => {
      const urlToClean = editedPreviewUrl;
      return () => {
          if (urlToClean) {
              URL.revokeObjectURL(urlToClean);
          }
      };
  }, [editedPreviewUrl]);

  // --- Local History Logic ---
  const saveManualHistorySnapshot = useCallback(() => {
      setManualHistory(prev => {
          // Avoid duplicate history entries
          if (JSON.stringify(prev.present) === JSON.stringify(manualEdits)) {
              return prev;
          }
          return {
              past: [...prev.past, prev.present],
              present: manualEdits,
              future: []
          };
      });
  }, [manualEdits]);

  const undoManualEdit = useCallback(() => {
      setManualHistory(prev => {
          if (prev.past.length === 0) return prev;
          const newPresent = prev.past[prev.past.length - 1];
          const newPast = prev.past.slice(0, -1);
          setManualEdits(newPresent);
          return {
              past: newPast,
              present: newPresent,
              future: [prev.present, ...prev.future]
          };
      });
  }, []);

  const redoManualEdit = useCallback(() => {
      setManualHistory(prev => {
          if (prev.future.length === 0) return prev;
          const newPresent = prev.future[0];
          const newFuture = prev.future.slice(1);
          setManualEdits(newPresent);
          return {
              past: [...prev.past, prev.present],
              present: newPresent,
              future: newFuture
          };
      });
  }, []);

  // --- Zoom and Pan Logic ---
  const handleZoom = useCallback((delta: number) => {
      setZoomLevel(prev => {
          const newZoom = Math.max(1, Math.min(5, prev + delta));
          if (newZoom === 1) {
              setPanPosition({ x: 0, y: 0 });
          }
          return newZoom;
      });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
      if (isManualCropping) return;
      e.preventDefault();
      const delta = e.deltaY * -0.001;
      handleZoom(delta);
  }, [handleZoom, isManualCropping]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (isManualCropping) {
        handleCropInteractionStart(e);
        return;
      }
      if (isDraggingSlider) return; 
      if (zoomLevel > 1) {
          setIsPanning(true);
          const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
          const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as any).clientY;
          setLastMousePosition({ x: clientX, y: clientY });
      }
  };

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (isManualCropping && interactionMode !== 'none') {
          handleCropInteractionMove(e);
          return;
      }
      if (isPanning) {
          const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
          const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as any).clientY;
          const deltaX = clientX - lastMousePosition.x;
          const deltaY = clientY - lastMousePosition.y;
          setPanPosition(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
          setLastMousePosition({ x: clientX, y: clientY });
      }
  }, [isPanning, lastMousePosition, isManualCropping, interactionMode]);

  const handleMouseUp = useCallback((e: MouseEvent | TouchEvent) => {
      if (isManualCropping) {
          handleCropInteractionEnd();
          return;
      }
      setIsPanning(false);
  }, [isManualCropping]);

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

  // --- Keyboard Logic (Undo/Redo/Zoom) ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!activeFile) return;
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

          if (e.key === 'ArrowUp') {
              e.preventDefault();
              handleZoom(0.1);
          } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              handleZoom(-0.1);
          } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
              e.preventDefault();
              if (e.shiftKey) {
                  // Redo Logic
                  if (manualHistory.future.length > 0) {
                      redoManualEdit();
                  } else {
                      onRedo();
                  }
              } else {
                  // Undo Logic
                  // 1. Cancel Crop Mode if active
                  if (isManualCropping) {
                      cancelManualCropMode();
                      return;
                  }
                  // 2. Local Manual Edits Undo
                  if (manualHistory.past.length > 0) {
                      undoManualEdit();
                  } else {
                      // 3. Global Undo Safety Guard
                      if (history.past.length > 0) {
                          const previousState = history.past[history.past.length - 1];
                          if (previousState.state.length === 0) {
                              addNotification(t.msg_error, 'info'); // Simplified msg
                          } else {
                              onUndo();
                          }
                      } else {
                           addNotification(t.msg_error, 'info');
                      }
                  }
              }
          } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
              e.preventDefault();
              if (manualHistory.future.length > 0) {
                   redoManualEdit();
              } else {
                   onRedo();
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, handleZoom, onUndo, onRedo, manualHistory, undoManualEdit, redoManualEdit, isManualCropping, history, addNotification, t.msg_error]);


  // --- Manual Crop Interaction Logic ---
  const startManualCropMode = () => {
      setIsManualCropping(true);
      setZoomLevel(1);
      setPanPosition({x: 0, y: 0});
      
      // Snapshot current edits before starting crop flow so we can undo the whole crop operation
      saveManualHistorySnapshot();

      if (!manualEdits.cropRect && !cropSelection) {
          setCropSelection({ x: 10, y: 10, w: 80, h: 80 });
      } else if (!manualEdits.cropRect) {
          setCropSelection({ x: 10, y: 10, w: 80, h: 80 });
      }
  };

  const cancelManualCropMode = () => {
      setIsManualCropping(false);
      setCropSelection(null); 
  };

  const getRelativeCoords = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
      if (!imageRef.current) return { x: 0, y: 0 };
      const rect = imageRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
      const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as any).clientY;
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      return { x, y };
  };

  const handleCropInteractionStart = (e: React.MouseEvent | React.TouchEvent) => {
      const coords = getRelativeCoords(e);
      if (cropSelection) {
          const handleSize = 5; 
          const isNear = (px: number, py: number) => Math.abs(px - coords.x) < handleSize && Math.abs(py - coords.y) < handleSize * (imageRef.current!.offsetWidth / imageRef.current!.offsetHeight);

          if (isNear(cropSelection.x, cropSelection.y)) setInteractionMode('resize-nw');
          else if (isNear(cropSelection.x + cropSelection.w, cropSelection.y)) setInteractionMode('resize-ne');
          else if (isNear(cropSelection.x, cropSelection.y + cropSelection.h)) setInteractionMode('resize-sw');
          else if (isNear(cropSelection.x + cropSelection.w, cropSelection.y + cropSelection.h)) setInteractionMode('resize-se');
          else if (
              coords.x >= cropSelection.x && 
              coords.x <= cropSelection.x + cropSelection.w && 
              coords.y >= cropSelection.y && 
              coords.y <= cropSelection.y + cropSelection.h
          ) setInteractionMode('move');
          else {
               setInteractionMode('create');
               setCropSelection({ x: coords.x, y: coords.y, w: 0, h: 0 });
          }
      } else {
          setInteractionMode('create');
          setCropSelection({ x: coords.x, y: coords.y, w: 0, h: 0 });
      }
      setCropStart(coords);
      setCropAnchor(cropSelection);
  };

  const handleCropInteractionMove = (e: MouseEvent | TouchEvent) => {
      if (interactionMode === 'none' || !cropStart || !imageRef.current) return;
      const current = getRelativeCoords(e);
      const clamp = (v: number) => Math.max(0, Math.min(100, v));
      const dx = current.x - cropStart.x;
      const dy = current.y - cropStart.y;

      if (interactionMode === 'create') {
          const startX = cropStart.x;
          const startY = cropStart.y;
          const newX = current.x;
          const newY = current.y;
          setCropSelection({
              x: clamp(Math.min(startX, newX)),
              y: clamp(Math.min(startY, newY)),
              w: Math.abs(newX - startX),
              h: Math.abs(newY - startY)
          });
      } else if (interactionMode === 'move' && cropAnchor) {
          let newX = cropAnchor.x + dx;
          let newY = cropAnchor.y + dy;
          newX = Math.max(0, Math.min(100 - cropAnchor.w, newX));
          newY = Math.max(0, Math.min(100 - cropAnchor.h, newY));
          setCropSelection({ ...cropAnchor, x: newX, y: newY });
      } else if (cropAnchor) {
          let { x, y, w, h } = cropAnchor;
          if (interactionMode === 'resize-se') {
              w = clamp(cropAnchor.w + dx);
              h = clamp(cropAnchor.h + dy);
          } else if (interactionMode === 'resize-sw') {
              x = clamp(cropAnchor.x + dx);
              w = cropAnchor.w - dx;
              if (w < 0) { x = x + w; w = Math.abs(w); } 
          } else if (interactionMode === 'resize-ne') {
              y = clamp(cropAnchor.y + dy);
              h = cropAnchor.h - dy;
              w = clamp(cropAnchor.w + dx);
               if (h < 0) { y = y + h; h = Math.abs(h); }
          } else if (interactionMode === 'resize-nw') {
              x = clamp(cropAnchor.x + dx);
              y = clamp(cropAnchor.y + dy);
              w = cropAnchor.w - dx;
              h = cropAnchor.h - dy;
               if (w < 0) { x = x + w; w = Math.abs(w); }
               if (h < 0) { y = y + h; h = Math.abs(h); }
          }
          setCropSelection({ x, y, w, h });
      }
  };

  const handleCropInteractionEnd = () => {
      setInteractionMode('none');
      setCropStart(null);
      setCropAnchor(null);
  };

  const applyManualCrop = () => {
      if (!cropSelection || !imageRef.current || cropSelection.w < 1 || cropSelection.h < 1) {
           addNotification(t.msg_error, "error");
           return;
      }
      const img = imageRef.current;
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      const cropX = Math.round((cropSelection.x / 100) * naturalWidth);
      const cropY = Math.round((cropSelection.y / 100) * naturalHeight);
      const cropW = Math.round((cropSelection.w / 100) * naturalWidth);
      const cropH = Math.round((cropSelection.h / 100) * naturalHeight);
      
      setManualEdits(prev => ({
          ...prev,
          cropRect: { x: cropX, y: cropY, width: cropW, height: cropH },
          aspectRatio: undefined 
      }));
      // Save state after crop applied
      saveManualHistorySnapshot();

      setIsManualCropping(false);
      setCropSelection(null);
      addNotification(t.msg_success, "info");
  };


  // --- Comparison Slider Drag Logic ---
  const handleSliderMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDraggingSlider || !imageBoundsRef.current) return;
    const rect = imageBoundsRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
    const x = clientX - rect.left;
    let newPosition = (x / rect.width) * 100;
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
      setLoadingMessage(t.editor_analyzing);
      setShowFeedback(null);
      try {
          const { file: newFile } = await action();
          const newPreviewUrl = URL.createObjectURL(newFile);
          
          const actionId = `${Date.now()}`;
          updateFile(activeFile.id, {
              file: newFile,
              previewUrl: newPreviewUrl,
              analysis: undefined 
          }, actionName);
          addNotification(t.msg_success, 'info');
          setShowFeedback(actionId);
          
          if (onSuccess) onSuccess();
      } catch (e) {
          addNotification(getApiErrorMessage(e, t.msg_error), 'error');
      } finally {
          setIsLoading(false);
      }
  }, [activeFile, addNotification, updateFile, t.editor_analyzing, t.msg_success, t.msg_error]);

  // --- Handlers for specific AI actions ---
  const handleAnalyze = useCallback(async () => {
    if (!activeFile) return;
    setIsLoading(true);
    setLoadingMessage(t.editor_analyzing);
    updateFile(activeFile.id, { isAnalyzing: true, analysis: undefined }, 'Start Analysis');
    try {
      // Pass the current language to the API service
      const result = await geminiService.analyzeImage(activeFile.file, language);
      updateFile(activeFile.id, { isAnalyzing: false, analysis: result }, 'Analysis Completed');
    } catch (e) {
      updateFile(activeFile.id, { isAnalyzing: false }, 'Analysis Failed');
      addNotification(getApiErrorMessage(e, t.msg_error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeFile, updateFile, addNotification, language, t.editor_analyzing, t.msg_error]);

  const handleAutopilot = () => {
    handleAiAction(() => geminiService.autopilotImage(activeFile!.file), 'Autopilot Enhancement');
  };

  const handleRemoveObject = () => {
    if (!removeObjectPrompt) {
        addNotification('Prosím popište objekt k odstranění.', 'error');
        return;
    }
    handleAiAction(
        () => geminiService.removeObject(activeFile!.file, removeObjectPrompt), 
        `Remove: ${removeObjectPrompt}`,
        () => setRemoveObjectPrompt('')
    );
  };

  const handleReplaceBackground = () => {
    if (!replaceBgPrompt) {
        addNotification('Prosím popište nové pozadí.', 'error');
        return;
    }
    handleAiAction(
        () => geminiService.replaceBackground(activeFile!.file, replaceBgPrompt), 
        `BG Replace: ${replaceBgPrompt}`,
        () => setReplaceBgPrompt('')
    );
  };

  const handleAutoCrop = () => {
    handleAiAction(
        () => geminiService.autoCrop(activeFile!.file, cropAspectRatio, autoCropPrompt),
        `Auto Crop: ${cropAspectRatio}`,
        () => {
             // Reset form but stay on tool
        }
    );
  };

  const handleStyleTransfer = () => {
      if (!styleTransferFile) {
          addNotification('Prosím vyberte obrázek stylu.', 'error');
          return;
      }
      handleAiAction(
          () => geminiService.styleTransfer(activeFile!.file, styleTransferFile),
          'Style Transfer',
          () => setStyleTransferFile(null)
      );
  };
  
  const handleGenerateSocial = async () => {
        if (!activeFile) return;
        setIsLoading(true);
        setLoadingMessage(t.editor_analyzing);
        try {
            const content = await geminiService.generateSocialContent(activeFile.file, language);
            updateFile(activeFile.id, { socialContent: content }, 'Generated Social Content');
            addNotification(t.msg_success, 'info');
        } catch (e) {
             addNotification(getApiErrorMessage(e, t.msg_error), 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (!activeFile) return;
        setIsLoading(true);
        setLoadingMessage('Generování videa (To může chvíli trvat)...');
        try {
            const videoUrl = await geminiService.generateVideoFromImage(activeFile.file, videoPrompt);
            updateFile(activeFile.id, { generatedVideo: { url: videoUrl, expiry: Date.now() + 3600000 } }, 'Video Generated');
            addNotification(t.msg_success, 'info');
        } catch (e) {
             addNotification(getApiErrorMessage(e, t.msg_error), 'error');
        } finally {
            setIsLoading(false);
        }
    };


  const handleManualExport = async () => {
      if (!activeFile) return;
      try {
          const blob = await applyEditsAndExport(activeFile.previewUrl, manualEdits, exportOptions);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          // Determine extension based on format
          const ext = exportOptions.format === 'jpeg' ? 'jpg' : 'png';
          a.download = `edited_${activeFile.file.name.split('.')[0]}.${ext}`;
          a.click();
          URL.revokeObjectURL(url);
          addNotification(t.msg_success, 'info');
      } catch (e) {
          addNotification(t.msg_error, 'error');
      }
  };

  const handleApplyPreset = (preset: Preset) => {
      setManualEdits(prev => ({...prev, ...preset.edits}));
      saveManualHistorySnapshot();
      addNotification(`Preset "${preset.name}" applied.`, 'info');
  };

  // --- Render Helpers ---

  // 1. If no image selected
  if (!activeFile) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-950">
         <Header title={t.app_title} onOpenApiKeyModal={props.onOpenApiKeyModal} onToggleSidebar={props.onToggleSidebar} />
         <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <UploadIcon className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-xl font-medium">{t.editor_no_image}</p>
            <p className="mt-2 text-sm">{t.editor_upload_hint}</p>
         </div>
      </div>
    );
  }

  // 2. Main Render
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
        <Header title={t.nav_studio} onOpenApiKeyModal={props.onOpenApiKeyModal} onToggleSidebar={props.onToggleSidebar} />
        
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
            
            {/* --- LEFT: Image Canvas --- */}
            <div className="flex-1 bg-slate-900/50 relative overflow-hidden flex items-center justify-center bg-grid-pattern group" ref={imageContainerRef}
                 onWheel={handleWheel}
                 onMouseDown={handleMouseDown}
                 onTouchStart={handleMouseDown}
            >
                {/* Image Container with Zoom/Pan */}
                {activeFile && (
                    <div 
                        ref={imageBoundsRef}
                        className={`relative shadow-2xl transition-transform duration-75 ease-out origin-center ${!isPanning && !isManualCropping ? 'transition-all duration-300' : ''}`}
                        style={{ 
                            transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
                            cursor: isManualCropping ? 'crosshair' : (zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'),
                            maxHeight: '90%',
                            maxWidth: '90%'
                        }}
                    >
                         {/* Show VIDEO if generated and active tool is video */}
                         {activeAction?.action === 'video-generation' && activeFile.generatedVideo ? (
                             <video 
                                src={activeFile.generatedVideo.url} 
                                controls 
                                autoPlay 
                                loop 
                                className="max-h-full max-w-full rounded-sm shadow-2xl ring-2 ring-cyan-500/50"
                             />
                         ) : (
                             <>
                                {/* Base Image */}
                                <img 
                                    ref={imageRef}
                                    src={activeFile.previewUrl} 
                                    alt="Edit" 
                                    className="max-h-full max-w-full object-contain rounded-sm select-none pointer-events-none" // pointer-events-none important for drag handling on container
                                />
                                
                                {/* Manual Edits Overlay (Live Preview) */}
                                {!isCompareMode && editedPreviewUrl && !isHoldingCompare && (
                                    <img 
                                        src={editedPreviewUrl} 
                                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                    />
                                )}

                                {/* Comparison Slider Overlay */}
                                {(isCompareMode || isHoldingCompare) && editedPreviewUrl && (
                                    <div className="absolute inset-0 w-full h-full select-none overflow-hidden">
                                        {/* "Before" Label */}
                                        <div className="absolute top-4 left-4 bg-black/60 text-white text-xs px-2 py-1 rounded z-20 pointer-events-none">{t.compare_before}</div>
                                        {/* "After" Label */}
                                        <div className="absolute top-4 right-4 bg-black/60 text-white text-xs px-2 py-1 rounded z-20 pointer-events-none">{t.compare_after}</div>

                                        {/* Top Layer (Edited/After) - Clipped */}
                                        <div 
                                            className="absolute inset-0 w-full h-full"
                                            style={{ clipPath: `inset(0 ${100 - compareSliderPosition}% 0 0)` }}
                                        >
                                            <img src={editedPreviewUrl} className="w-full h-full object-contain" />
                                        </div>

                                        {/* Slider Handle */}
                                        <div 
                                            className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:bg-cyan-400 transition-colors"
                                            style={{ left: `${compareSliderPosition}%` }}
                                            onMouseDown={() => setIsDraggingSlider(true)}
                                            onTouchStart={() => setIsDraggingSlider(true)}
                                        >
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-900">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                )}
                             </>
                         )}

                         {/* Manual Crop Overlay */}
                         {isManualCropping && cropSelection && (
                             <div className="absolute inset-0 z-30 pointer-events-none">
                                 {/* Darken area outside crop */}
                                 <div className="absolute inset-0 bg-black/50" 
                                      style={{ 
                                          clipPath: `polygon(0% 0%, 0% 100%, ${cropSelection.x}% 100%, ${cropSelection.x}% ${cropSelection.y}%, ${cropSelection.x + cropSelection.w}% ${cropSelection.y}%, ${cropSelection.x + cropSelection.w}% ${cropSelection.y + cropSelection.h}%, ${cropSelection.x}% ${cropSelection.y + cropSelection.h}%, ${cropSelection.x}% 100%, 100% 100%, 100% 0%)`
                                      }}
                                 ></div>
                                 
                                 {/* Crop Rectangle */}
                                 <div 
                                     className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] pointer-events-auto cursor-move"
                                     style={{ 
                                         left: `${cropSelection.x}%`, 
                                         top: `${cropSelection.y}%`, 
                                         width: `${cropSelection.w}%`, 
                                         height: `${cropSelection.h}%` 
                                     }}
                                 >
                                     {/* Grid Lines */}
                                     <div className="absolute inset-0 flex flex-col">
                                         <div className="flex-1 border-b border-white/30"></div>
                                         <div className="flex-1 border-b border-white/30"></div>
                                         <div className="flex-1"></div>
                                     </div>
                                     <div className="absolute inset-0 flex flex-row">
                                          <div className="flex-1 border-r border-white/30"></div>
                                          <div className="flex-1 border-r border-white/30"></div>
                                          <div className="flex-1"></div>
                                     </div>

                                     {/* Handles */}
                                     <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-slate-900 cursor-nw-resize"></div>
                                     <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-slate-900 cursor-ne-resize"></div>
                                     <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-slate-900 cursor-sw-resize"></div>
                                     <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-slate-900 cursor-se-resize"></div>
                                 </div>
                             </div>
                         )}
                    </div>
                )}
                
                {/* Floating Action Bar (Zoom/Undo) */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center space-x-2 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 shadow-xl z-40">
                    <button onClick={onUndo} className="p-2 hover:text-white text-slate-400 transition-colors" title="Zpět (Ctrl+Z)">
                        <UndoIcon className="w-5 h-5" />
                    </button>
                    <div className="w-px h-4 bg-slate-700"></div>
                    <button onClick={() => handleZoom(-0.2)} className="p-2 hover:text-white text-slate-400 transition-colors">
                        <ZoomOutIcon className="w-5 h-5" />
                    </button>
                    <span className="text-xs font-mono w-12 text-center text-slate-300">{Math.round(zoomLevel * 100)}%</span>
                    <button onClick={() => handleZoom(0.2)} className="p-2 hover:text-white text-slate-400 transition-colors">
                        <ZoomInIcon className="w-5 h-5" />
                    </button>
                    <div className="w-px h-4 bg-slate-700"></div>
                    <button onClick={() => { setZoomLevel(1); setPanPosition({x:0,y:0}); }} className="p-2 hover:text-white text-slate-400 transition-colors" title="Fit to Screen">
                        <MagnifyingGlassIcon className="w-5 h-5" />
                    </button>
                    {editedPreviewUrl && (
                        <>
                             <div className="w-px h-4 bg-slate-700"></div>
                             <button 
                                className={`p-2 transition-colors ${isCompareMode ? 'text-cyan-400' : 'text-slate-400 hover:text-white'}`}
                                onClick={() => setIsCompareMode(p => !p)}
                                title={t.compare_btn}
                                onMouseDown={() => setIsHoldingCompare(true)}
                                onMouseUp={() => setIsHoldingCompare(false)}
                                onMouseLeave={() => setIsHoldingCompare(false)}
                                onTouchStart={() => setIsHoldingCompare(true)}
                                onTouchEnd={() => setIsHoldingCompare(false)}
                             >
                                 <EyeIcon className="w-5 h-5" />
                             </button>
                        </>
                    )}
                </div>

                {/* Loading Overlay */}
                {isLoading && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
                        <p className="text-lg font-medium text-slate-200 animate-pulse">{loadingMessage}</p>
                    </div>
                )}
                
                {/* Crop Toolbar (Floating) */}
                {isManualCropping && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center space-x-3 bg-slate-900/90 backdrop-blur-md px-6 py-3 rounded-xl border border-cyan-500/50 shadow-2xl z-50 animate-fade-in-up">
                        <span className="text-sm font-bold text-white mr-2">Ořezávání...</span>
                        <button onClick={applyManualCrop} className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-md shadow-lg transition-colors">
                            Použít
                        </button>
                        <button onClick={cancelManualCropMode} className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Feedback Overlay */}
                <div className="absolute bottom-24 right-6 z-50">
                    {showFeedback && (
                         <FeedbackButtons 
                            onFeedback={(fb) => recordExplicitFeedback(showFeedback, fb)}
                            onTimeout={() => setShowFeedback(null)}
                         />
                    )}
                </div>
            </div>

            {/* --- RIGHT: Tools Panel --- */}
            <div className="w-full lg:w-80 bg-slate-900/80 backdrop-blur-xl border-l border-slate-800/50 flex flex-col h-[40vh] lg:h-auto z-20">
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    
                    {/* ANALYSIS PANEL */}
                    {(!activeAction || activeAction.action === 'analysis') && (
                        <div className="p-6 space-y-6 animate-fade-in-slide-up">
                             <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-100">{t.nav_analysis}</h3>
                                <button onClick={handleAnalyze} className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors">
                                    {activeFile.analysis ? 'Re-Analyze' : 'Spustit analýzu'}
                                </button>
                             </div>
                             
                             {activeFile.analysis ? (
                                 <div className="space-y-5 text-sm">
                                     <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                                         <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">{t.editor_desc}</span>
                                         <p className="text-slate-300 leading-relaxed">{activeFile.analysis.description}</p>
                                     </div>
                                     
                                     <div>
                                         <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">{t.editor_tech}</span>
                                         <div className="grid grid-cols-3 gap-2">
                                             <div className="bg-slate-800/50 p-2 rounded text-center border border-slate-700/50">
                                                 <span className="block text-[10px] text-slate-500">ISO</span>
                                                 <span className="font-mono text-cyan-400">{activeFile.analysis.technicalInfo.ISO}</span>
                                             </div>
                                             <div className="bg-slate-800/50 p-2 rounded text-center border border-slate-700/50">
                                                 <span className="block text-[10px] text-slate-500">Clona</span>
                                                 <span className="font-mono text-fuchsia-400">{activeFile.analysis.technicalInfo.Aperture}</span>
                                             </div>
                                             <div className="bg-slate-800/50 p-2 rounded text-center border border-slate-700/50">
                                                 <span className="block text-[10px] text-slate-500">Závěrka</span>
                                                 <span className="font-mono text-emerald-400">{activeFile.analysis.technicalInfo.ShutterSpeed}</span>
                                             </div>
                                         </div>
                                     </div>

                                     <div>
                                         <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">{t.editor_suggestions}</span>
                                         <ul className="space-y-2">
                                             {activeFile.analysis.suggestions.map((s, i) => (
                                                 <li key={i} className="flex items-start text-slate-300">
                                                     <span className="text-cyan-500 mr-2">•</span>
                                                     {s}
                                                 </li>
                                             ))}
                                         </ul>
                                     </div>

                                     {activeFile.analysis.proactiveSuggestions && activeFile.analysis.proactiveSuggestions.length > 0 && (
                                         <div>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">{t.editor_proactive}</span>
                                            <div className="space-y-2">
                                                {activeFile.analysis.proactiveSuggestions.map((s, i) => (
                                                    <div key={i} className="bg-gradient-to-r from-slate-800 to-slate-800/50 p-3 rounded-lg border border-slate-700 flex items-center justify-between group hover:border-cyan-500/50 transition-colors">
                                                        <span className="text-slate-300 text-xs">{s.text}</span>
                                                        <button 
                                                            onClick={() => {
                                                                // Switch to the relevant tool based on action
                                                                onNavigate({ view: 'editor', action: s.action });
                                                                if (s.action === 'remove-object') {
                                                                    // Pre-fill prompt if possible (requires parsing text, simplified here)
                                                                    setRemoveObjectPrompt(s.text.replace('Remove ', '')); 
                                                                }
                                                            }}
                                                            className="ml-2 bg-slate-700 hover:bg-cyan-600 text-white p-1.5 rounded-md transition-colors"
                                                        >
                                                            <ArrowPathIcon className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                         </div>
                                     )}
                                 </div>
                             ) : (
                                 <div className="text-center py-10 opacity-50">
                                     <ArrowPathIcon className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                                     <p className="text-sm">Analýza není k dispozici.</p>
                                 </div>
                             )}
                        </div>
                    )}

                    {/* MANUAL EDITS PANEL */}
                    {activeAction?.action === 'manual-edit' && (
                        <ManualEditControls 
                            edits={manualEdits} 
                            onEditChange={(key, value) => {
                                setManualEdits(prev => ({...prev, [key]: value}));
                            }}
                            onReset={() => {
                                setManualEdits(INITIAL_EDITS);
                                saveManualHistorySnapshot();
                            }}
                            exportOptions={exportOptions}
                            onExportOptionsChange={setExportOptions}
                            onRequestExport={handleManualExport}
                            onStartManualCrop={startManualCropMode}
                            onSnapshot={saveManualHistorySnapshot}
                        />
                    )}

                    {/* AUTOPILOT PANEL */}
                    {activeAction?.action === 'autopilot' && (
                        <div className="p-6 space-y-4 animate-fade-in-right">
                             <h3 className="text-lg font-bold text-slate-100">{t.nav_autopilot}</h3>
                             <p className="text-sm text-slate-400">{t.tool_autopilot_desc}</p>
                             <button
                                onClick={handleAutopilot}
                                disabled={isLoading}
                                className="w-full aurora-glow flex items-center justify-center px-4 py-3 mt-4 border border-transparent text-sm font-bold rounded-lg shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                             >
                                 <AutopilotIcon className="w-5 h-5 mr-2" />
                                 {t.tool_autopilot_btn}
                             </button>
                        </div>
                    )}

                    {/* SOCIAL MEDIA PANEL */}
                    {activeAction?.action === 'social-media' && (
                        <div className="p-6 space-y-4 animate-fade-in-right">
                             <h3 className="text-lg font-bold text-slate-100">{t.tool_social_title}</h3>
                             <p className="text-sm text-slate-400">{t.tool_social_desc}</p>
                             
                             <button
                                onClick={handleGenerateSocial}
                                disabled={isLoading}
                                className="w-full aurora-glow flex items-center justify-center px-4 py-3 mt-4 border border-transparent text-sm font-bold rounded-lg shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 transition-all"
                             >
                                 <SparklesIcon className="w-5 h-5 mr-2" />
                                 {t.tool_social_btn}
                             </button>

                             {activeFile.socialContent && (
                                 <div className="mt-6 space-y-6">
                                     <div className="space-y-4">
                                         {activeFile.socialContent.captions.map((cap, i) => (
                                             <div key={i} className="bg-slate-800 p-3 rounded-lg border border-slate-700 relative group">
                                                 <span className="text-[10px] uppercase font-bold text-cyan-500 mb-1 block">{cap.tone}</span>
                                                 <p className="text-sm text-slate-200">{cap.text}</p>
                                                 <button 
                                                    onClick={() => navigator.clipboard.writeText(cap.text)}
                                                    className="absolute top-2 right-2 p-1 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Copy"
                                                 >
                                                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                                                 </button>
                                             </div>
                                         ))}
                                     </div>
                                     <div>
                                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Hashtags</h4>
                                         <div className="flex flex-wrap gap-2">
                                             {activeFile.socialContent.hashtags.map(tag => (
                                                 <span key={tag} className="text-xs bg-slate-800 text-cyan-400 px-2 py-1 rounded-full cursor-pointer hover:bg-slate-700" onClick={() => navigator.clipboard.writeText(tag)}>
                                                     {tag}
                                                 </span>
                                             ))}
                                         </div>
                                     </div>
                                 </div>
                             )}
                        </div>
                    )}

                    {/* VIDEO GENERATION PANEL */}
                    {activeAction?.action === 'video-generation' && (
                        <div className="p-6 space-y-4 animate-fade-in-right">
                             <h3 className="text-lg font-bold text-slate-100">{t.tool_video_title}</h3>
                             <p className="text-sm text-slate-400">{t.tool_video_desc}</p>
                             
                             <textarea
                                value={videoPrompt}
                                onChange={e => setVideoPrompt(e.target.value)}
                                placeholder={t.tool_video_prompt}
                                className="w-full bg-slate-800 border border-slate-700 rounded-md p-3 text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                rows={2}
                             />

                             <button
                                onClick={handleGenerateVideo}
                                disabled={isLoading}
                                className="w-full aurora-glow flex items-center justify-center px-4 py-3 mt-4 border border-transparent text-sm font-bold rounded-lg shadow-lg text-white bg-gradient-to-r from-fuchsia-600 to-purple-700 hover:from-fuchsia-700 hover:to-purple-800 transition-all"
                             >
                                 <FilmIcon className="w-5 h-5 mr-2" />
                                 {t.tool_video_btn}
                             </button>

                             {activeFile.generatedVideo && (
                                 <div className="mt-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
                                     <p className="text-xs text-green-400 flex items-center">
                                         <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                                         Video je připraveno (vlevo).
                                     </p>
                                     <a 
                                        href={activeFile.generatedVideo.url} 
                                        download={`video_${activeFile.file.name}.mp4`}
                                        className="mt-2 block text-center text-xs text-cyan-400 hover:underline"
                                     >
                                         Stáhnout MP4
                                     </a>
                                 </div>
                             )}
                        </div>
                    )}
                    
                    {/* REMOVE OBJECT PANEL */}
                    {activeAction?.action === 'remove-object' && (
                        <div className="p-6 space-y-4 animate-fade-in-right">
                            <h3 className="text-lg font-bold text-slate-100">{t.nav_remove_obj}</h3>
                            <p className="text-sm text-slate-400">{t.tool_remove_desc}</p>
                            <textarea
                                value={removeObjectPrompt}
                                onChange={e => setRemoveObjectPrompt(e.target.value)}
                                placeholder={t.tool_remove_placeholder}
                                className="w-full bg-slate-800 border border-slate-700 rounded-md p-3 text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                rows={3}
                            />
                            <button
                                onClick={handleRemoveObject}
                                disabled={isLoading || !removeObjectPrompt}
                                className="w-full aurora-glow flex items-center justify-center px-4 py-3 mt-2 border border-transparent text-sm font-bold rounded-lg shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:bg-cyan-600 disabled:opacity-50 transition-all"
                            >
                                {t.tool_remove_btn}
                            </button>
                        </div>
                    )}

                    {/* AUTO CROP PANEL */}
                    {activeAction?.action === 'auto-crop' && (
                        <div className="p-6 space-y-4 animate-fade-in-right">
                            <h3 className="text-lg font-bold text-slate-100">{t.tool_crop_title}</h3>
                            
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">{t.tool_crop_instr}</label>
                                <input
                                    type="text"
                                    value={autoCropPrompt}
                                    onChange={e => setAutoCropPrompt(e.target.value)}
                                    placeholder={t.tool_crop_placeholder}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">{t.tool_crop_format}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Original', '1:1', '16:9', '4:3', '9:16', '5:4'].map(ratio => (
                                        <button
                                            key={ratio}
                                            onClick={() => setCropAspectRatio(ratio)}
                                            className={`px-2 py-2 text-xs font-medium rounded border transition-all ${cropAspectRatio === ratio ? 'bg-cyan-500/20 border-cyan-500 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                                        >
                                            {ratio}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleAutoCrop}
                                disabled={isLoading}
                                className="w-full aurora-glow flex items-center justify-center px-4 py-3 mt-2 border border-transparent text-sm font-bold rounded-lg shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:bg-cyan-600 disabled:opacity-50 transition-all"
                            >
                                {t.tool_crop_btn_only}
                            </button>
                        </div>
                    )}

                    {/* REPLACE BACKGROUND PANEL */}
                    {activeAction?.action === 'replace-background' && (
                        <div className="p-6 space-y-4 animate-fade-in-right">
                            <h3 className="text-lg font-bold text-slate-100">{t.nav_bg}</h3>
                            <p className="text-sm text-slate-400">{t.tool_bg_desc}</p>
                            <textarea
                                value={replaceBgPrompt}
                                onChange={e => setReplaceBgPrompt(e.target.value)}
                                placeholder={t.tool_bg_placeholder}
                                className="w-full bg-slate-800 border border-slate-700 rounded-md p-3 text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                rows={3}
                            />
                            <button
                                onClick={handleReplaceBackground}
                                disabled={isLoading || !replaceBgPrompt}
                                className="w-full aurora-glow flex items-center justify-center px-4 py-3 mt-2 border border-transparent text-sm font-bold rounded-lg shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:bg-cyan-600 disabled:opacity-50 transition-all"
                            >
                                {t.tool_bg_btn}
                            </button>
                        </div>
                    )}

                     {/* STYLE TRANSFER PANEL */}
                     {activeAction?.action === 'style-transfer' && (
                        <div className="p-6 space-y-4 animate-fade-in-right">
                            <h3 className="text-lg font-bold text-slate-100">{t.nav_style}</h3>
                            <p className="text-sm text-slate-400">{t.tool_style_desc}</p>
                            
                            <input 
                                type="file" 
                                ref={styleFileInputRef}
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => {
                                    if(e.target.files?.[0]) setStyleTransferFile(e.target.files[0]);
                                }}
                            />
                            
                            <div 
                                onClick={() => styleFileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center cursor-pointer hover:border-cyan-500 hover:bg-slate-800/50 transition-all"
                            >
                                {styleTransferFile ? (
                                    <div className="flex flex-col items-center">
                                        <img src={URL.createObjectURL(styleTransferFile)} alt="Style" className="w-20 h-20 object-cover rounded mb-2" />
                                        <span className="text-xs text-slate-300">{styleTransferFile.name}</span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-slate-400">{t.tool_style_select}</span>
                                )}
                            </div>

                            <button
                                onClick={handleStyleTransfer}
                                disabled={isLoading || !styleTransferFile}
                                className="w-full aurora-glow flex items-center justify-center px-4 py-3 mt-2 border border-transparent text-sm font-bold rounded-lg shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:bg-cyan-600 disabled:opacity-50 transition-all"
                            >
                                {t.tool_style_btn}
                            </button>
                        </div>
                    )}
                    
                     {/* PRESETS PANEL */}
                     {activeAction?.action === 'user-presets' && (
                        <div className="p-6 space-y-4 animate-fade-in-right">
                            <h3 className="text-lg font-bold text-slate-100">{t.nav_presets}</h3>
                            
                            {props.userPresets.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-4">Žádné uložené presety.</p>
                            ) : (
                                <div className="space-y-2">
                                    {props.userPresets.map(preset => (
                                        <div key={preset.id} className="flex items-start flex-col sm:flex-row sm:items-center justify-between bg-slate-800 p-3 rounded-md hover:bg-slate-700 transition-colors group gap-2">
                                            <span className="text-sm font-medium text-slate-200">{preset.name}</span>
                                            <div className="flex space-x-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                 <button 
                                                    onClick={() => handleApplyPreset(preset)}
                                                    className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded hover:bg-cyan-500/30"
                                                 >
                                                     Apply
                                                 </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* HISTORY PANEL */}
                    {activeAction?.action === 'history' && (
                        <div className="p-6 space-y-4 animate-fade-in-right">
                             <h3 className="text-lg font-bold text-slate-100">{t.nav_history}</h3>
                             <ul className="space-y-3 relative border-l border-slate-700 ml-2 pl-4">
                                 {history.past.map((entry, i) => (
                                     <li key={i} className="text-xs text-slate-500 relative">
                                         <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-slate-700"></div>
                                         {entry.actionName}
                                     </li>
                                 ))}
                                 <li className="text-sm font-bold text-cyan-400 relative">
                                      <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
                                      {history.present.actionName} (Current)
                                 </li>
                                 {history.future.map((entry, i) => (
                                     <li key={i} className="text-xs text-slate-500 opacity-50 relative">
                                          <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-slate-800 border border-slate-700"></div>
                                         {entry.actionName}
                                     </li>
                                 ))}
                             </ul>
                        </div>
                    )}

                </div>
                
                {/* File Strip (Bottom of Right Panel) */}
                <div className="h-24 bg-slate-900 border-t border-slate-800/50 p-2 flex space-x-2 overflow-x-auto custom-scrollbar flex-shrink-0">
                    {files.map(file => (
                        <div 
                            key={file.id} 
                            onClick={() => onSetActiveFileId(file.id)}
                            className={`relative aspect-square rounded-md overflow-hidden cursor-pointer flex-shrink-0 border-2 transition-all ${file.id === activeFileId ? 'border-cyan-500 ring-2 ring-cyan-500/20' : 'border-transparent hover:border-slate-600'}`}
                        >
                            <img src={file.previewUrl} className="w-full h-full object-cover" />
                            {file.isAnalyzing && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                    ))}
                    <div 
                        onClick={() => document.getElementById('add-more-files')?.click()}
                        className="aspect-square bg-slate-800 rounded-md flex items-center justify-center cursor-pointer hover:bg-slate-700 border-2 border-dashed border-slate-700 hover:border-slate-500 flex-shrink-0 text-slate-400"
                        title="Přidat další"
                    >
                        <span className="text-2xl">+</span>
                    </div>
                    {/* Hidden input for adding more files - simplified logic for demo */}
                    <input id="add-more-files" type="file" multiple className="hidden" onChange={(e) => {
                         if(e.target.files?.length) {
                             const newFiles = Array.from(e.target.files).map((item) => {
                                 const f = item as File;
                                 return {
                                     id: `${Date.now()}-${Math.random()}`,
                                     file: f,
                                     previewUrl: URL.createObjectURL(f),
                                     originalPreviewUrl: URL.createObjectURL(f)
                                 };
                             });
                             onSetFiles(curr => [...curr, ...newFiles], 'Added files');
                         }
                    }}/>
                </div>
            </div>
        </div>
    </div>
  );
};

export default EditorView;
