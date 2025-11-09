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
    <div className="w-full h-full flex flex-col bg-slate-950 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl animate-pulse-slow animation-delay-2000 pointer-events-none"></div>

      <Header
        title={title}
        onOpenApiKeyModal={onOpenApiKeyModal}
        onToggleSidebar={onToggleSidebar}
      />

      <div className="flex-1 w-full flex items-center justify-center p-4 sm:p-8 relative z-10">
        <div
          className={`w-full max-w-4xl flex flex-col items-center justify-center p-12 sm:p-16 rounded-3xl transition-all duration-300 ease-in-out relative group ${
            isDragging ? 'scale-[1.02]' : ''
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          role="region"
          aria-label="Oblast pro nahrání souborů"
        >
          {/* Glow effect when dragging */}
          <div className={`absolute inset-0 rounded-3xl transition-all duration-300 ${isDragging ? 'aurora-glow-strong animate-pulse' : 'opacity-0'}`}></div>

          {/* Dashed border with gradient */}
          <div className="absolute inset-0 rounded-3xl">
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

          <div className="text-center z-10 animate-fade-in-up">
            {/* Upload Icon */}
            <div className="relative inline-block">
              <UploadIcon
                className="mx-auto h-24 w-24 text-slate-400 transition-all duration-500 ease-out"
                style={{
                  transform: isDragging ? 'scale(1.2) translateY(-16px)' : 'scale(1)',
                  filter: isDragging ? `drop-shadow(0 0 20px #22d3ee)` : 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))'
                }}
              />
              {isDragging && (
                <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-2xl animate-pulse-slow"></div>
              )}
            </div>

            {/* Title and description */}
            <h3 className="mt-8 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-100">
              {isDragging ? 'Pusťte soubory sem!' : 'Přetáhněte fotografie sem'}
            </h3>
            <p className="mt-3 text-base sm:text-lg text-slate-400 max-w-md mx-auto">
              nebo klikněte na tlačítko níže pro výběr souborů z vašeho počítače
            </p>

            {/* File input and button */}
            <div className="mt-10">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Výběr souborů"
              />
              <button
                type="button"
                onClick={onButtonClick}
                aria-label="Vybrat soubory k nahrání"
                className="btn-primary inline-flex items-center gap-3 px-10 py-4 sm:px-12 sm:py-5 border border-transparent text-base sm:text-lg font-bold rounded-2xl shadow-2xl text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-cyan-500 transition-all transform hover:-translate-y-1 hover:scale-105 active:translate-y-0 active:scale-100 aurora-glow"
              >
                <UploadIcon className="w-6 h-6" />
                <span>Vybrat soubory</span>
              </button>
            </div>

            {/* Supported formats */}
            <div className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Podporujeme formáty JPG, PNG a WEBP • Více souborů najednou</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadView;