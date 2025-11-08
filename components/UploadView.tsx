import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon } from './icons';
import Header from './Header';

interface UploadViewProps {
  onFilesSelected: (files: File[]) => void;
  // Props for the Header
  title: string;
  onOpenApiKeyModal: () => void;
  onToggleSidebar: () => void;
}

const UploadView: React.FC<UploadViewProps> = ({ 
  onFilesSelected, 
  title, 
  onOpenApiKeyModal,
  onToggleSidebar
}) => {
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
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesSelected(files);
      }
      e.dataTransfer.clearData();
    }
  }, [onFilesSelected]);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        onFilesSelected(files);
      }
    }
  };
  
  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full h-full flex flex-col">
       <Header 
        title={title} 
        onOpenApiKeyModal={onOpenApiKeyModal}
        onToggleSidebar={onToggleSidebar}
      />
      <div className="flex-1 w-full flex items-center justify-center p-4 sm:p-8">
        <div 
          className={`w-full max-w-4xl flex flex-col items-center justify-center p-12 rounded-3xl transition-all duration-300 ease-in-out relative group`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className={`absolute inset-0 rounded-3xl transition-all duration-300 ${isDragging ? 'aurora-glow-strong animate-pulse' : 'opacity-0'}`}></div>
          <div 
            className="absolute inset-0 rounded-3xl"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='24' ry='24' stroke='%2338bdf8' stroke-width='3' stroke-dasharray='10%2c 10' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e")`
            }}
          >
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="rounded-3xl">
              <rect width="100%" height="100%" fill="none" rx="24" ry="24" 
                stroke="url(#aurora-gradient)" 
                strokeWidth="3" 
                strokeDasharray="10, 10" 
                strokeDashoffset="0" 
                strokeLinecap="butt"
                className={isDragging ? "marching-ants" : ""}
              />
              <defs>
                <linearGradient id="aurora-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#d946ef" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          
          <div className="text-center z-10">
              <UploadIcon 
                className="mx-auto h-20 w-20 text-slate-500 mb-6 transition-all duration-500 ease-out" 
                style={{ transform: isDragging ? 'scale(1.15) translateY(-12px)' : 'scale(1)', filter: isDragging ? `drop-shadow(0 0 15px #22d3ee)` : 'none' }}
              />
              <h3 className="mt-4 text-3xl font-bold tracking-tight text-slate-100">
                Přetáhněte fotografie sem
              </h3>
              <p className="mt-2 text-lg text-slate-400">
                nebo klikněte pro výběr souborů z vašeho počítače
              </p>
              <div className="mt-12">
                  <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelect}
                      className="hidden"
                  />
                  <button
                      type="button"
                      onClick={onButtonClick}
                      className="inline-flex items-center px-10 py-4 border border-transparent text-base font-semibold rounded-xl shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-fuchsia-500 transition-all transform hover:-translate-y-1 active:translate-y-0 hover:shadow-2xl hover:shadow-cyan-500/30 aurora-glow"
                  >
                      <UploadIcon className="-ml-1 mr-3 h-6 w-6" />
                      Vybrat soubory
                  </button>
              </div>
              <p className="mt-10 text-xs text-slate-500">
                Podporujeme formáty JPG, PNG a WEBP.
              </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadView;