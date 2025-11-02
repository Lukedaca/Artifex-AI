// FIX: Create the EditorView component.
import React, { useState, useEffect, useCallback } from 'react';
import type { UploadedFile, EditorAction, AnalysisResult } from '../types';
import { analyzeImage, autopilotImage, autoCropImage } from '../services/geminiService';
import { applyEditsToImage } from '../utils/imageProcessor';

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
          break;
      }
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
      if (action === 'analysis') {
        updateFileState(selectedFile.id, { isAnalyzing: false });
      }
    } finally {
      setIsLoading(false);
      onActionCompleted();
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

  return (
    <div className="h-full w-full flex flex-col md:flex-row">
      <div className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-white dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold text-lg">AI Analýza &amp; Nástroje</h3>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          {error && <div className="p-3 mb-4 bg-red-500/10 text-red-500 rounded-md text-sm">{error}</div>}
          {selectedFile?.isAnalyzing && (
            <div className="flex items-center justify-center space-x-2 text-slate-500 dark:text-slate-400">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span>Analyzuji...</span>
            </div>
          )}
          {selectedFile?.analysis && renderAnalysis(selectedFile.analysis)}
          {!selectedFile?.isAnalyzing && !selectedFile?.analysis && <p className="text-sm text-slate-400 dark:text-slate-500">Vyberte nástroj pro úpravu obrázku.</p>}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col bg-slate-100 dark:bg-slate-950 min-w-0">
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
          {selectedFile && <img src={selectedFile.previewUrl} alt="Selected" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />}
          {isLoading && !selectedFile?.isAnalyzing && (
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
