
import React, { useState, useMemo } from 'react';
import type { UploadedFile } from '../types';
import { autopilotImage } from '../services/geminiService';
import { AutopilotIcon } from './icons';
import Header from './Header';
import { useTranslation } from '../contexts/LanguageContext';

interface BatchViewProps {
  files: UploadedFile[];
  onBatchComplete: (updatedFiles: { id: string; file: File }[]) => void;
  addNotification: (message: string, type?: 'info' | 'error') => void;
  // Header props
  title: string;
  onOpenApiKeyModal: () => void;
  onToggleSidebar: () => void;
}

const BatchView: React.FC<BatchViewProps> = ({ files, onBatchComplete, addNotification, title, onOpenApiKeyModal, onToggleSidebar }) => {
  const { t } = useTranslation();
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set(files.map(f => f.id)));
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const selectedFiles = useMemo(() => files.filter(f => selectedFileIds.has(f.id)), [files, selectedFileIds]);

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFileIds.size === files.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(files.map(f => f.id)));
    }
  };

  const handleBatchAutopilot = async () => {
    if (selectedFiles.length === 0) {
      addNotification(t.raw_no_files, 'error');
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: selectedFiles.length });

    const updatedFiles: { id: string; file: File }[] = [];
    const errors: string[] = [];

    for (const file of selectedFiles) {
      try {
        const { file: newFile } = await autopilotImage(file.file);
        updatedFiles.push({ id: file.id, file: newFile });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        errors.push(`${t.batch_error} ${file.file.name}: ${message}`);
        addNotification(`${t.batch_error} ${file.file.name}`, 'error');
      } finally {
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
    }

    setIsProcessing(false);

    if (updatedFiles.length > 0) {
      onBatchComplete(updatedFiles);
      addNotification(t.batch_complete, 'info');
    }

    if (errors.length > 0) {
       // Optional: more detailed error reporting
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <Header 
        title={title} 
        onOpenApiKeyModal={onOpenApiKeyModal}
        onToggleSidebar={onToggleSidebar}
      />
      <div className="flex-1 w-full flex flex-col items-center p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-6xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-100">{t.batch_title}</h1>
            <p className="mt-3 text-xl text-slate-400 max-w-3xl mx-auto">
              {t.batch_subtitle}
            </p>
          </div>

          <div className="backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-800/50">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">{t.batch_select}</h2>
                <p className="text-sm text-slate-500">{selectedFileIds.size} / {files.length} {t.batch_selected}</p>
              </div>
              <button 
                onClick={toggleSelectAll}
                className="px-4 py-2 text-sm font-medium rounded-md border border-slate-700 hover:bg-slate-800 transition-colors"
              >
                {selectedFileIds.size === files.length ? t.batch_deselect_all : t.batch_select_all}
              </button>
            </div>

            {files.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {files.map(file => (
                    <div key={file.id} className="relative aspect-square cursor-pointer group" onClick={() => toggleFileSelection(file.id)}>
                    <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover rounded-lg shadow-md" />
                    <div 
                        className={`absolute inset-0 rounded-lg transition-all duration-200 ${selectedFileIds.has(file.id) ? 'ring-4 ring-cyan-500 ring-offset-2 ring-offset-slate-900 bg-black/30' : 'group-hover:bg-black/50'}`}
                    >
                        {selectedFileIds.has(file.id) && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-white border-2 border-slate-900">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        )}
                    </div>
                    </div>
                ))}
                </div>
            ) : (
                <div className="text-center py-10 border-2 border-dashed border-slate-700 rounded-lg">
                    <p className="text-slate-500">{t.editor_upload_hint}</p>
                </div>
            )}
            
            <div className="mt-8 pt-8 border-t border-slate-700/80">
                <h2 className="text-xl font-bold mb-4">Dostupné akce</h2>
                <button
                    onClick={handleBatchAutopilot}
                    disabled={isProcessing || selectedFiles.length === 0}
                    className="w-full sm:w-auto inline-flex items-center px-8 py-3 border border-transparent text-base font-semibold rounded-lg shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-1 active:translate-y-0 aurora-glow"
                >
                    <AutopilotIcon className="mr-3 h-6 w-6" />
                    {t.batch_run} {selectedFiles.length}
                </button>
                {isProcessing && (
                    <div className="mt-6">
                        <div className="flex justify-between mb-1">
                            <span className="text-base font-medium text-slate-300">{t.batch_processing}</span>
                            <span className="text-sm font-medium text-slate-300">{progress.current} / {progress.total}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2.5">
                            <div className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                        </div>
                    </div>
                )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchView;
