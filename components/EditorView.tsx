// FIX: Create the EditorView component.
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

  // State for object remover
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
      // Ensure canvas is setup if image is already loaded
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
    
    // Save state for undo
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

        // Draw original image
        ctx.drawImage(originalImage, 0, 0);

        // Draw mask on top
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
          // For actions like 'remove-object', the trigger is manual, not this effect.
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
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-slate-700 dark:text-slate-200">Popis</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400">{analysis.description}</p>
      </div>
      <div>
        <h4 className="font-semibold text-slate-700 dark:text-slate-200">Návrhy na vylepšení</h4>
        <ul className="list-disc list-inside space-y-1 text-sm text-slate-500 dark:text-slate-400">
          {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold text-slate-700 dark:text-slate-200">Technické informace</h4>
        <div className="grid grid-cols-3 gap-2 text-sm mt-1">
            <div className="bg-slate-100 dark:bg-slate-700/50 p-2 rounded-md text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">ISO</p>
                <p className="font-semibold">{analysis.technicalInfo.ISO}</p>
            </div>
            <div className="bg-slate-100 dark:bg-slate-700/50 p-2 rounded-md text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">Clona</p>
                <p className="font-semibold">{analysis.technicalInfo.Aperture}</p>
            </div>
            <div className="bg-slate-100 dark:bg-slate-700/50 p-2 rounded-md text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">Závěrka</p>
                <p className="font-semibold">{analysis.technicalInfo.ShutterSpeed}</p>
            </div>
        </div>
      </div>
    </div>
  );

  const renderActivePanel = () => {
    if (activeAction?.action === 'remove-object') {
      return (
        <div className="space-y-4">
          <h4 className="font-semibold text-slate-700 dark:text-slate-200">Odstranit objekt</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">
              Přejeďte štětcem přes oblasti, které chcete odstranit. AI je inteligentně vyplní.
          </p>
          <div>
            <label htmlFor="brush-size" className="block text-sm font-medium mb-1">Velikost štětce: {brushSize}px</label>
            <input type="range" id="brush-size" min="5" max="150" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer" />
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={handleUndoMask} disabled={undoStack.length === 0 || isLoading} className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50">
              <UndoIcon className="w-4 h-4 mr-2" />
              Zpět
            </button>
            <button onClick={handleClearMask} disabled={isLoading} className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50">
              Vyčistit masku
            </button>
          </div>
          <button onClick={handleRemoveObject} disabled={isLoading} className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 disabled:bg-sky-600/50">
            {isLoading ? 'Zpracovávám...' : 'Spustit odstranění'}
          </button>
        </div>
      );
    }

    if (selectedFile?.isAnalyzing) {
      return (
        <div className="flex items-center justify-center space-x-2 text-slate-500 dark:text-slate-400">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>Analyzuji...</span>
        </div>
      );
    }

    if (selectedFile?.analysis) {
      return renderAnalysis(selectedFile.analysis);
    }

    return <p className="text-sm text-slate-400 dark:text-slate-500">Vyberte nástroj pro úpravu obrázku.</p>
  }

  return (
    <div className="h-full w-full flex flex-col md:flex-row">
      <div className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-white dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold text-lg">AI Nástroje</h3>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          {error && <div className="p-3 mb-4 bg-red-500/10 text-red-500 rounded-md text-sm">{error}</div>}
          {renderActivePanel()}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-950 min-w-0">
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
          {selectedFile && (
            <>
              <img 
                ref={imageRef}
                src={selectedFile.previewUrl} 
                alt="Selected" 
                className={`max-w-full max-h-full object-contain shadow-2xl rounded-lg ${activeAction?.action === 'remove-object' ? 'opacity-90' : ''}`}
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
            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-10">
              <div className="text-white text-center">
                <svg className="animate-spin h-10 w-10 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p className="mt-2 font-semibold">Zpracovávám...</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 h-32 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 p-2">
          <div className="h-full flex items-center space-x-2 overflow-x-auto">
            {localFiles.map(file => (
              <button key={file.id} onClick={() => setSelectedFileId(file.id)} className={`h-full aspect-video rounded-md overflow-hidden flex-shrink-0 relative ring-2 transition-all ${selectedFileId === file.id ? 'ring-sky-500 scale-105 shadow-lg' : 'ring-transparent hover:ring-sky-500/50'}`}>
                <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorView;