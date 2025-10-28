
import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import UploadView from './components/UploadView';
import EditorView from './components/EditorView';
import BatchView from './components/BatchView';
import { MenuIcon, MoonIcon, SunIcon, KeyIcon } from './components/icons';
import type { UploadedFile } from './types';
import { isApiKeySet } from './utils/apiKey';
import ApiKeyModal from './components/ApiKeyModal';

type Theme = 'light' | 'dark';
type View = 'upload' | 'editor' | 'batch';
export type EditorAction = { action: string; timestamp: number } | null;

interface History {
  past: UploadedFile[][];
  present: UploadedFile[];
  future: UploadedFile[][];
}

const App: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<View>('upload');
  const [history, setHistory] = useState<History>({ past: [], present: [], future: [] });
  const [theme, setTheme] = useState<Theme>('dark');
  const [activeAction, setActiveAction] = useState<EditorAction>(null);
  const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [isApiKeyAvailable, setIsApiKeyAvailable] = useState(isApiKeySet());

  const uploadedFiles = history.present;

  const handleUndo = useCallback(() => {
    setHistory(h => {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      const newPast = h.past.slice(0, h.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [h.present, ...h.future],
      };
    });
  }, []);
  
  const handleRedo = useCallback(() => {
    setHistory(h => {
      if (h.future.length === 0) return h;
      const next = h.future[0];
      const newFuture = h.future.slice(1);
      return {
        past: [...h.past, h.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === 'z') {
          e.preventDefault();
          handleUndo();
        } else if (e.key === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };
  
  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => !prev);
  }

  const handleFileSelection = useCallback((files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    
    setHistory(h => {
      // Clean up all URLs from the previous session's history
      [...h.past.flat(), ...h.present, ...h.future.flat()].forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      // Start a new history
      return { past: [], present: newFiles, future: [] };
    });
    setCurrentView('editor');
  }, []);
  
  const handleFileUpdate = useCallback((fileId: string, newFile: File) => {
    setHistory(h => {
      const newPresent = h.present.map(f => {
        if (f.id === fileId) {
          // Note: We don't revoke the old URL here to keep it available in history
          return {
            id: fileId,
            file: newFile,
            previewUrl: URL.createObjectURL(newFile),
            analysis: undefined,
            isAnalyzing: false,
          };
        }
        return f;
      });
      return {
        past: [...h.past, h.present],
        present: newPresent,
        future: []
      };
    });
  }, []);

  const handleNavigation = useCallback((payload: { view: View; action?: string }) => {
    const { view, action } = payload;
    if (view === 'upload') {
      // Clear history and revoke all URLs when navigating to upload
      setHistory(h => {
        [...h.past.flat(), ...h.present, ...h.future.flat()].forEach(f => {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        });
        return { past: [], present: [], future: [] };
      });
    }
    
    if ((view === 'editor' || view === 'batch') && uploadedFiles.length === 0) {
      setCurrentView('upload');
      return;
    }
    setCurrentView(view);
    
    if (action) {
      setActiveAction({ action, timestamp: Date.now() });
    }

  }, [uploadedFiles.length]);

  const handleProcessingComplete = (newFiles: UploadedFile[]) => {
    // Don't revoke old URLs, just push the old state to history
    setHistory(h => ({
      past: [...h.past, h.present],
      present: newFiles,
      future: []
    }));
    setCurrentView('editor');
  };
  
  const onActionCompleted = () => {
    setActiveAction(null);
  };
  
  const handleKeySaved = () => {
    setIsApiKeyAvailable(true);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'editor':
        return <EditorView 
                  files={uploadedFiles} 
                  isApiKeyAvailable={isApiKeyAvailable}
                  activeAction={activeAction}
                  onActionCompleted={onActionCompleted}
                  onFileUpdate={handleFileUpdate} 
                />;
      case 'batch':
        return <BatchView files={uploadedFiles} onProcessingComplete={handleProcessingComplete} />;
      case 'upload':
      default:
        return <UploadView onFilesSelected={handleFileSelection} />;
    }
  };
  
  const viewTitles: Record<View, string> = {
    upload: 'Nahrát fotografie',
    editor: 'Editor & AI Analýza',
    batch: 'Hromadné zpracování',
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onNavigate={handleNavigation}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      
      <div className={`flex-1 flex flex-col min-w-0 h-full transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-60'}`}>
        <header className="flex-shrink-0 flex items-center justify-between h-16 px-4 md:px-6 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/80 backdrop-blur-lg z-10">
          <div className="flex items-center space-x-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors">
                <MenuIcon className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200 hidden sm:block">
              {viewTitles[currentView]}
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={toggleTheme} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all" title="Změnit téma">
                {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
            <button onClick={() => setApiKeyModalOpen(true)} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all" title="Zadat API klíč">
                <KeyIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
            {renderCurrentView()}
        </main>
      </div>
      
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
        onKeySaved={handleKeySaved}
      />
    </div>
  );
};

export default App;
