import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon } from './icons';

interface UploadViewProps {
  onFilesSelected: (files: File[]) => void;
}

const UploadView: React.FC<UploadViewProps> = ({ onFilesSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const acceptedFiles = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
      if (acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles);
      }
      e.dataTransfer.clearData();
    }
  }, [onFilesSelected]);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const acceptedFiles = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
      if (acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles);
      }
    }
  };
  
  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4 sm:p-8">
      <div 
        className={`w-full max-w-3xl flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-3xl transition-all duration-300 ease-in-out ${
          isDragging 
          ? 'border-solid border-sky-500 bg-sky-500/10 scale-105 shadow-2xl shadow-sky-500/20 ring-4 ring-sky-500/20' 
          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/50'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="text-center">
            <UploadIcon 
              className="mx-auto h-16 w-16 text-slate-400 dark:text-slate-500 mb-5 transition-transform duration-300" 
              style={{ transform: isDragging ? 'scale(1.2) translateY(-10px)' : 'scale(1)'}}
            />
            <h3 className="mt-4 text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              Přetáhněte fotografie sem
            </h3>
            <p className="mt-2 text-md text-slate-500 dark:text-slate-400">
              nebo klikněte pro výběr souborů
            </p>
            <div className="mt-10">
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/gif,image/webp,image/raw,image/tiff"
                    onChange={handleFileSelect}
                    className="hidden"
                />
                <button
                    type="button"
                    onClick={onButtonClick}
                    className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-xl shadow-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 focus:ring-sky-500 transition-all transform hover:-translate-y-1 hover:shadow-2xl"
                >
                    <UploadIcon className="-ml-1 mr-3 h-5 w-5" />
                    Vybrat soubory
                </button>
            </div>
            <p className="mt-8 text-xs text-slate-400 dark:text-slate-500">
              Podporované formáty: JPG, PNG, RAW, TIFF (max 10 souborů)
            </p>
        </div>
      </div>
    </div>
  );
};

export default UploadView;