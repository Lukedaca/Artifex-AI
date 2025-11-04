import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { UploadedFile, EditorAction, AnalysisResult } from '../types';
import { analyzeImage, autopilotImage, autoCropImage, removeObject } from '../services/geminiService';
import { applyEditsToImage } from '../utils/imageProcessor';
import { UndoIcon } from './icons';

interface EditorViewProps {
  files: UploadedFile[];
  activeAction: EditorAction;
  onActionCompleted: () => void;
  onFileUpdate: (fileId: string, newFile: File) => void;
}

const EditorView: React.FC<EditorViewProps> = ({ files, activeAction, onActionCompleted, onFileUpdate }) => {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [localFiles, setLocalFiles] = useState<UploadedFile[]>(files);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brushSize, setBrushSize] = useState(40);
  const [isDrawing, setIsDrawing] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);

  useEffect(() => {
    setLocalFiles(files);
    if (files.length > 0 && !files.find(f => f.id === selectedFileId)) {
      setSelectedFileId(files[0].id);
    } else if (files.length === 0) {
      setSelectedFileId(null);
    }
  }, [files, selectedFileId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (localFiles.length <= 1) return;

      const currentIndex = localFiles.findIndex(f => f.id === selectedFileId);
      if (currentIndex === -1) return;

      let nextIndex = -1;

      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % localFiles.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + localFiles.length) % localFiles.length;
      }

      if (nextIndex !== -1) {
        e.preventDefault();
        setSelectedFileId(localFiles[nextIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [localFiles, selectedFileId]);

  const selectedFile = localFiles.find(f => f.id === selectedFileId);

  const updateFileState = useCallback((fileId: string, updates: Partial<UploadedFile>) => {
    setLocalFiles(prevFiles => prevFiles.map(f => f.id === fileId ? { ...f, ...updates } : f));
  }, []);

  const setupCanvas = useCallback(() => {
    const image = imageRef.current;
    const canvas = maskCanvasRef.current;
    if (image && canvas && image.complete) {
      const { width, height, top, left } = image.getBoundingClientRect();
      const parentRect = image.parentElement!.getBoundingClientRect();
      
      canvas.style.left = `${left - parentRect.left}px`;
      canvas.style.top = `${top - parentRect.top}px`;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      if (canvas.width !== image.naturalWidth || canvas.height !== image.naturalHeight) {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
      }
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setUndoStack([]);
      }
    }
  }, []);

  const handleImageLoad = () => {
    if (activeAction?.action === 'remove-object') {
      setupCanvas();
    }
  };
  
  useEffect(() => {
    const image = imageRef.current;
    if (activeAction?.action === 'remove-object') {
      setupCanvas();
      window.addEventListener('resize', setupCanvas);
      if (image && image.complete) {
        setupCanvas();
      }
    }
    return () => window.removeEventListener('resize', setupCanvas);
  }, [activeAction, selectedFile, setupCanvas]);

  const getScaledCoords = (e: React.MouseEvent<HTMLCanvasElement>): {x: number, y: number} => {
    const canvas = maskCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas || activeAction?.action !== 'remove-object') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setUndoStack(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    setIsDrawing(true);
    const pos = getScaledCoords(e);
    lastPosRef.current = pos;
    
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 0, 255, 0.5)';
    ctx.fill();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPosRef.current || activeAction?.action !== 'remove-object') return;
    const canvas = maskCanvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getScaledCoords(e);
    
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPosRef.current = pos;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const handleUndoMask = () => {
    if (undoStack.length === 0) return;
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const lastState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    ctx.putImageData(lastState, 0, 0);
  };
  
  const handleClearMask = () => {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
        setUndoStack(prev => [...prev, ctx.getImageData(0, 0, canvas!.width, canvas!.height)]);
        ctx.clearRect(0, 0, canvas!.width, canvas!.height);
    }
  };
  
  const handleRemoveObject = async () => {
      if (!selectedFile || !maskCanvasRef.current) return;
      setIsLoading(true);
      setError(null);
      try {
        const originalImage = imageRef.current!;
        const maskCanvas = maskCanvasRef.current;
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = originalImage.naturalWidth;
        compositeCanvas.height = originalImage.naturalHeight;
        const ctx = compositeCanvas.getContext('2d');
        if (!ctx) throw new Error("Could not create composite canvas context");
        ctx.drawImage(originalImage, 0, 0);
        ctx.drawImage(maskCanvas, 0, 0);
        const compositeBase64 = compositeCanvas.toDataURL(selectedFile.file.type).split(',')[1];
        const newFile = await removeObject(compositeBase64, selectedFile.file.type);
        onFileUpdate(selectedFile.id, newFile);
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred during object removal.');
      } finally {
        setIsLoading(false);
        onActionCompleted();
        handleClearMask();
        setUndoStack([]);
      }
  };

  const handleAction = useCallback(async (action: string) => {
    if (!selectedFile) return;
    setIsLoading(true);
    setError(null);
    try {
      switch (action) {
        case 'analysis':
          updateFileState(selectedFile.id, { isAnalyzing: true, analysis: undefined });
          const analysis = await analyzeImage(selectedFile.file);
          updateFileState(selectedFile.id, { analysis, isAnalyzing: false });
          break;
        case 'autopilot':
          const autopilotEditedFile = await autopilotImage(selectedFile.file);
          onFileUpdate(selectedFile.id, autopilotEditedFile);
          break;
        case 'auto-crop':
          const cropCoords = await autoCropImage(selectedFile.file);
          const croppedBlob = await applyEditsToImage(selectedFile.file, {}, cropCoords, 'image/png');
          const croppedFile = new File([croppedBlob], selectedFile.file.name.replace(/\.[^/.]+$/, "") + "_cropped.png", { type: 'image/png' });
          onFileUpdate(selectedFile.id, croppedFile);
          break;
        default:
          setIsLoading(false);
          return;
      }
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
      if (action === 'analysis') {
        updateFileState(selectedFile.id, { isAnalyzing: false });
      }
    } finally {
      if (action !== 'remove-object') {
        setIsLoading(false);
        onActionCompleted();
      }
    }
  }, [selectedFile, updateFileState, onFileUpdate, onActionCompleted]);

  useEffect(() => {
    if (activeAction) {
      handleAction(activeAction.action);
    }
  }, [activeAction, handleAction]);
  
  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 p-4 text-center">
        Žádné fotky k úpravě. Nahrajte prosím nějaké přes "Nahrát fotky".
      </div>
    );
  }

  const renderAnalysis = (analysis: AnalysisResult) => (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-100">Popis</h4>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{analysis.description}</p>
      </div>
      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-100">Návrhy na vylepšení</h4>
        <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-600 dark:text-slate-400 mt-2">
          {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-100">Technické informace</h4>
        <div className="grid grid-cols-3 gap-3 text-sm mt-2">
            <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-lg text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">ISO</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{analysis.technicalInfo.ISO}</p>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-lg text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">Clona</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{analysis.technicalInfo.Aperture}</p>
            </div>
            <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-lg text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">Závěrka</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{analysis.technicalInfo.ShutterSpeed}</p>
            </div>
        </div>
      </div>
    </div>
  );

  const renderActivePanel = () => {
    if (activeAction?.action === 'remove-object') {
      return (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-100">Odstranit objekt</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Přejeďte štětcem přes oblasti, které chcete odstranit. AI je inteligentně vyplní.
            </p>
          </div>
          <div>
            <label htmlFor="brush-size" className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Velikost štětce: {brushSize}px</label>
            <input type="range" id="brush-size" min="5" max="150" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="custom-slider" />
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={handleUndoMask} disabled={undoStack.length === 0 || isLoading} className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-slate-300 dark:border-slate-700 text-sm font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
              <UndoIcon className="w-4 h-4 mr-2" />
              Zpět
            </button>
            <button onClick={handleClearMask} disabled={isLoading} className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-slate-300 dark:border-slate-700 text-sm font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
              Vyčistit
            </button>
          </div>
          <button onClick={handleRemoveObject} disabled={isLoading} className="aurora-glow w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 disabled:opacity-50 transition-all transform hover:-translate-y-0.5 active:translate-y-0">
            {isLoading ? 'Zpracovávám...' : 'Spustit odstranění'}
          </button>
        </div>
      );
    }

    if (selectedFile?.isAnalyzing) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-2 text-slate-500 dark:text-slate-400">
            <svg className="animate-spin h-8 w-8 text-fuchsia-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span className="text-lg font-semibold">Analyzuji...</span>
        </div>
      );
    }

    if (selectedFile?.analysis) {
      return renderAnalysis(selectedFile.analysis);
    }

    return <p className="text-sm text-slate-500 dark:text-slate-400">Vyberte nástroj pro úpravu obrázku.</p>
  }

  return (
    <div className="h-full w-full flex flex-col md:flex-row">
      <div className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-r border-slate-200/50 dark:border-slate-800/50 flex flex-col shadow-2xl z-10">
        <div className="p-5 border-b border-slate-200/50 dark:border-slate-800/50">
          <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100">AI Nástroje</h3>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          {error && <div className="p-3 mb-4 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-500/20">{error}</div>}
          {renderActivePanel()}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col bg-slate-100/50 dark:bg-slate-950/70 min-w-0">
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
          {selectedFile && (
            <>
              <img 
                ref={imageRef}
                src={selectedFile.previewUrl} 
                alt="Selected" 
                className={`max-w-full max-h-full object-contain shadow-2xl rounded-xl transition-all duration-300 ${activeAction?.action === 'remove-object' ? 'opacity-90' : ''}`}
                onLoad={handleImageLoad}
              />
              {activeAction?.action === 'remove-object' && (
                <canvas
                  ref={maskCanvasRef}
                  className="absolute cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              )}
            </>
          )}
          {isLoading && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="text-white text-center">
                <svg className="animate-spin h-10 w-10 mx-auto text-fuchsia-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p className="mt-3 font-semibold text-lg">Zpracovávám...</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 h-40 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-t border-slate-200/50 dark:border-slate-800/50 p-3">
          <div className="h-full flex items-center overflow-x-auto">
            {localFiles.map(file => (
              <div key={file.id} className="p-2 flex-shrink-0 group">
                 <div className={`relative p-1 rounded-xl transition-all duration-300 ${selectedFileId === file.id ? '' : ''}`}>
                    {selectedFileId === file.id && <div className="absolute inset-0 rounded-xl aurora-glow-strong animate-pulse-slow"></div>}
                    <button onClick={() => setSelectedFileId(file.id)} className={`h-full aspect-video rounded-lg overflow-hidden relative transition-all transform duration-300 ${selectedFileId === file.id ? 'scale-105 shadow-2xl' : 'group-hover:scale-105'}`}>
                        <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover" />
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorView;