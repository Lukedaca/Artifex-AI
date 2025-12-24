
import React, { useState, useMemo } from 'react';
import type { UploadedFile } from '../types';
import { autopilotImage, assessQuality } from '../services/geminiService';
import { AutopilotIcon, ArrowPathIcon, SparklesIcon } from './icons';
import Header from './Header';
import { useTranslation } from '../contexts/LanguageContext';

interface BatchViewProps {
  files: UploadedFile[];
  onBatchComplete: (updatedFiles: { id: string; file: File }[]) => void;
  onSetFiles: (updater: (files: UploadedFile[]) => UploadedFile[], actionName: string) => void;
  addNotification: (message: string, type?: 'info' | 'error') => void;
  title: string;
  onOpenApiKeyModal: () => void;
  onToggleSidebar: () => void;
}

const BatchView: React.FC<BatchViewProps> = ({ files, onBatchComplete, onSetFiles, addNotification, title, onOpenApiKeyModal, onToggleSidebar }) => {
  const { t } = useTranslation();
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set(files.map(f => f.id)));
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const selectedFiles = useMemo(() => files.filter(f => selectedFileIds.has(f.id)), [files, selectedFileIds]);

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) newSet.delete(fileId);
      else newSet.add(fileId);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFileIds.size === files.length) setSelectedFileIds(new Set());
    else setSelectedFileIds(new Set(files.map(f => f.id)));
  };

  const handleBatchAutopilot = async () => {
    if (selectedFiles.length === 0) {
      addNotification(t.raw_no_files, 'error');
      return;
    }
    setIsProcessing(true);
    setProgress({ current: 0, total: selectedFiles.length });
    const updatedFiles: { id: string; file: File }[] = [];
    for (const file of selectedFiles) {
      try {
        const { file: newFile } = await autopilotImage(file.file);
        updatedFiles.push({ id: file.id, file: newFile });
      } catch (e) {
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
  };

  const handleRunCulling = async () => {
      if (files.length === 0) return;
      setIsProcessing(true);
      setProgress({ current: 0, total: files.length });
      
      for (const file of files) {
          try {
              const assessment = await assessQuality(file.file);
              onSetFiles(curr => curr.map(f => f.id === file.id ? { ...f, assessment } : f), 'Smart Culling');
          } catch (e) {
              console.error(e);
          } finally {
              setProgress(prev => ({ ...prev, current: prev.current + 1 }));
          }
      }
      setIsProcessing(false);
      addNotification(t.msg_success, 'info');
  };

  const selectBestPicks = () => {
      const bestIds = new Set(files.filter(f => f.assessment?.isBestPick).map(f => f.id));
      setSelectedFileIds(bestIds);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <Header title={title} onOpenApiKeyModal={onOpenApiKeyModal} onToggleSidebar={onToggleSidebar} />
      <div className="flex-1 w-full flex flex-col items-center p-4 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-6xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-100">{t.batch_title}</h1>
            <p className="mt-3 text-xl text-slate-400 max-w-3xl mx-auto">{t.batch_subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col items-center text-center">
                  <SparklesIcon className="w-10 h-10 text-cyan-400 mb-3" />
                  <h3 className="font-bold text-lg">{t.turbo_culling}</h3>
                  <p className="text-sm text-slate-500 mb-4">{t.turbo_culling_desc}</p>
                  <button onClick={handleRunCulling} disabled={isProcessing} className="mt-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg border border-slate-700 transition-colors">
                      {t.turbo_run_culling}
                  </button>
              </div>
              <div className="md:col-span-2 backdrop-blur-xl p-6 rounded-2xl shadow-lg border border-slate-800/50">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold">{t.batch_select}</h2>
                        <button onClick={selectBestPicks} className="text-[10px] uppercase tracking-widest font-bold text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded border border-cyan-400/20 hover:bg-cyan-400/20 transition-all">Select AI Picks</button>
                    </div>
                    <button onClick={toggleSelectAll} className="px-4 py-2 text-sm font-medium rounded-md border border-slate-700 hover:bg-slate-800 transition-colors">
                        {selectedFileIds.size === files.length ? t.batch_deselect_all : t.batch_select_all}
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    {files.map(file => (
                        <div key={file.id} className="relative aspect-square cursor-pointer group" onClick={() => toggleFileSelection(file.id)}>
                            <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-cover rounded-lg" />
                            <div className={`absolute inset-0 rounded-lg transition-all ${selectedFileIds.has(file.id) ? 'ring-4 ring-cyan-500 bg-black/30' : 'group-hover:bg-black/50'}`}>
                                {file.assessment && (
                                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                                        {file.assessment.isBestPick && (
                                            <div className="bg-cyan-500 text-[8px] font-bold text-white px-1.5 py-0.5 rounded shadow-lg animate-pulse" title={t.turbo_best_pick}>TOP</div>
                                        )}
                                        {file.assessment.score < 40 && (
                                            <div className="bg-red-500 text-[8px] font-bold text-white px-1.5 py-0.5 rounded shadow-lg" title={t.turbo_bad_quality}>LOW</div>
                                        )}
                                    </div>
                                )}
                                {selectedFileIds.has(file.id) && (
                                    <div className="absolute top-2 right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center text-white border-2 border-slate-900 shadow-xl">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
              </div>
          </div>
          
          <div className="backdrop-blur-xl p-8 rounded-2xl shadow-lg border border-slate-800/50 bg-gradient-to-br from-slate-900 to-slate-900/50">
                <h2 className="text-xl font-bold mb-4">{t.turbo_express}</h2>
                <p className="text-sm text-slate-400 mb-6">{t.turbo_express_desc}</p>
                <button
                    onClick={handleBatchAutopilot}
                    disabled={isProcessing || selectedFiles.length === 0}
                    className="w-full sm:w-auto inline-flex items-center px-10 py-4 border border-transparent text-base font-bold rounded-xl shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 disabled:opacity-50 transition-all transform hover:-translate-y-1 active:translate-y-0 aurora-glow"
                >
                    <AutopilotIcon className="mr-3 h-6 w-6" />
                    {t.turbo_express_btn} ({selectedFiles.length})
                </button>
                {isProcessing && (
                    <div className="mt-8">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium text-slate-300">{t.batch_processing}</span>
                            <span className="text-xs font-mono text-cyan-400">{progress.current} / {progress.total}</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                            <div className="bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-cyan-500 h-full transition-all duration-500 animate-pulse" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                        </div>
                    </div>
                )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchView;
