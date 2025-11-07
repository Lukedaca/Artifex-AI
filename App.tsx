import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import UploadView from './components/UploadView';
import EditorView from './components/EditorView';
import BatchView from './components/BatchView';
import GenerateImageView from './components/GenerateImageView';
import { MenuIcon, MoonIcon, SunIcon, KeyIcon, XCircleIcon, InformationCircleIcon } from './components/icons';
import type { UploadedFile, EditorAction, View, History, HistoryEntry } from './types';
import ApiKeyModal from './components/ApiKeyModal';
import { hasSelectedApiKey } from './utils/apiKey';
import { normalizeImageFile } from './utils/imageProcessor';
import HomeView from './components/HomeView';

type Theme = 'light' | 'dark';

interface Notification {
  id: number;
  message: string;
  type: 'error' | 'info';
}

const getInitialHistory = (): History => ({
  past: [],
  present: { state: [], actionName: 'Start' },
  future: [],
});

const App: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<View>('home');
  const [history, setHistory] = useState<History>(getInitialHistory());
  const [theme, setTheme] = useState<Theme>('dark');
  const [activeAction, setActiveAction] = useState<EditorAction>(null);
  const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [contentKey, setContentKey] = useState(0); // Used to re-trigger animations
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isAppEntered, setIsAppEntered] = useState(false);

  const uploadedFiles = history.present.state;

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  const addNotification = useCallback((message: string, type: 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeNotification(id);
    }, 6000);
  }, []);

  const checkKeyAndSetModal = useCallback(async () => {
    setIsCheckingApiKey(true);
    try {
      const hasKey = await hasSelectedApiKey();
      setApiKeyModalOpen(!hasKey);
    } catch (e) {
      console.error("Error checking for API key:", e);
      setApiKeyModalOpen(true);
    } finally {
      setIsCheckingApiKey(false);
    }
  }, []);

  useEffect(() => {
    if(!isAppEntered) return;
    checkKeyAndSetModal();
  }, [isAppEntered, checkKeyAndSetModal]);

  const updateHistory = (newPresentState: UploadedFile[], actionName: string) => {
    setHistory(h => ({
      past: [...h.past, h.present],
      present: { state: newPresentState, actionName },
      future: []
    }));
  };

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

  const jumpToState = useCallback((index: number) => {
    setHistory(h => {
      const newPast = h.past.slice(0, index);
      const stateToJumpTo = h.past[index];
      const newFuture = [...h.past.slice(index + 1), h.present, ...h.future];
      return {
        past: newPast,
        present: stateToJumpTo,
        future: newFuture,
      };
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === 'z') {
          e.preventDefault();
          handleUndo();
        } else if (e.key === 'y' || (e.shiftKey && e.key === 'Z')) {
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

  const handleFileSelection = useCallback(async (files: File[]) => {
    const newFilesPromises: Promise<UploadedFile | null>[] = files.map(file => {
      return normalizeImageFile(file)
        .then(normalizedFile => {
          const objectUrl = URL.createObjectURL(normalizedFile);
          return {
            id: `${normalizedFile.name}-${normalizedFile.lastModified}-${Math.random()}`,
            file: normalizedFile,
            previewUrl: objectUrl,
            originalPreviewUrl: objectUrl,
          };
        })
        .catch(error => {
          console.error(`Chyba při zpracování souboru ${file.name}:`, error);
          addNotification(`Chyba u '${file.name}': ${error.message}`, 'error');
          return null;
        });
    });

    const settledFiles = await Promise.all(newFilesPromises);
    const newFiles = settledFiles.filter((f): f is UploadedFile => f !== null);

    if (newFiles.length === 0) {
      return;
    }
    
    setHistory(h => {
      [...h.past, h.present, ...h.future].forEach(entry => 
          entry.state.forEach(f => {
              if (f.previewUrl && f.previewUrl !== f.originalPreviewUrl) URL.revokeObjectURL(f.previewUrl);
              if (f.originalPreviewUrl) URL.revokeObjectURL(f.originalPreviewUrl);
          })
      );
      return { past: [], present: { state: newFiles, actionName: 'Nahrání obrázků' }, future: [] };
    });
    setCurrentView('editor');
    setActiveAction(null);
    setContentKey(prev => prev + 1);
  }, [addNotification]);
  
  const handleFileUpdate = useCallback((fileId: string, newFile: File, actionName: string) => {
    const newPresentState = history.present.state.map(f => {
      if (f.id === fileId) {
        if(f.previewUrl !== f.originalPreviewUrl) URL.revokeObjectURL(f.previewUrl);
        return {
          ...f,
          file: newFile,
          previewUrl: URL.createObjectURL(newFile),
          analysis: undefined,
          isAnalyzing: false,
        };
      }
      return f;
    });
    updateHistory(newPresentState, actionName);
  }, [history.present.state]);

  const handleFileMetadataUpdate = useCallback((fileId: string, updates: Partial<Omit<UploadedFile, 'file' | 'previewUrl' | 'id' | 'originalPreviewUrl'>>) => {
      setHistory(h => {
          const newPresentState = h.present.state.map(f => {
              if (f.id === fileId) {
                  return { ...f, ...updates };
              }
              return f;
          });
          // Do not create a new history entry for metadata changes like analysis results
          return { ...h, present: { ...h.present, state: newPresentState } };
      });
  }, []);
  
  const handleImageGenerated = useCallback((file: File, actionName: string) => {
    const objectUrl = URL.createObjectURL(file);
    const newFile: UploadedFile = {
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: objectUrl,
      originalPreviewUrl: objectUrl,
    };
    
    const newPresentState = [...history.present.state, newFile];
    updateHistory(newPresentState, actionName);
    setCurrentView('editor');
    setContentKey(prev => prev + 1);
  }, [history.present.state]);

  const handleNavigation = useCallback((payload: { view: View; action?: string }) => {
    const { view, action } = payload;
    
    if (view === 'home') {
      setIsAppEntered(false);
      setCurrentView('home');
      return;
    }

    if (view === 'upload') {
      setHistory(getInitialHistory());
    }
    
    if ((view === 'editor' || view === 'batch') && uploadedFiles.length === 0) {
      addNotification('Nejprve prosím nahrajte nějaké obrázky.', 'info');
      setCurrentView('upload');
      setContentKey(prev => prev + 1);
      return;
    }
    
    if (currentView !== view) {
      setCurrentView(view);
      setContentKey(prev => prev + 1);
    }
    
    setActiveAction(action ? { action, timestamp: Date.now() } : null);

  }, [uploadedFiles.length, currentView, addNotification]);

  const handleProcessingComplete = (newFiles: UploadedFile[], actionName: string) => {
    updateHistory(newFiles, actionName);
    setCurrentView('editor');
    setContentKey(prev => prev + 1);
  };
  
  const onActionCompleted = () => {
    setActiveAction(null);
  };
  
  const renderCurrentView = () => {
    switch (currentView) {
      case 'editor':
        return <EditorView 
                  files={uploadedFiles} 
                  activeAction={activeAction}
                  onActionCompleted={onActionCompleted}
                  onFileUpdate={handleFileUpdate} 
                  onFileMetadataUpdate={handleFileMetadataUpdate}
                  history={{
                    log: [ ...history.past, history.present],
                    canUndo: history.past.length > 0,
                    canRedo: history.future.length > 0,
                  }}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onJumpToState={jumpToState}
                  addNotification={addNotification}
                  onNavigate={handleNavigation}
                />;
      case 'batch':
        return <BatchView files={uploadedFiles} onProcessingComplete={handleProcessingComplete} />;
      case 'generate':
        return <GenerateImageView onImageGenerated={(file) => handleImageGenerated(file, 'Generování obrázku')} />;
      case 'upload':
      default:
        return <UploadView onFilesSelected={handleFileSelection} />;
    }
  };
  
  const viewTitles: Record<View, string> = {
    home: 'Vítejte ve Studiu',
    upload: 'Nahrát fotografie',
    editor: 'Editor & AI Analýza',
    batch: 'Hromadné zpracování',
    generate: 'Vytvořit obrázek AI',
  };

  if (isCheckingApiKey && isAppEntered) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <svg className="animate-spin h-10 w-10 text-fuchsia-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      </div>
    );
  }

  if (isApiKeyModalOpen) {
    return (
       <ApiKeyModal 
        isOpen={isApiKeyModalOpen}
        onKeySelectionAttempt={checkKeyAndSetModal}
      />
    );
  }

  if (!isAppEntered) {
    return <HomeView onEnterApp={() => {
      setIsAppEntered(true);
      setCurrentView('upload');
    }} />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onNavigate={handleNavigation}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        currentView={currentView}
        activeAction={activeAction}
      />
      
      <div className={`flex-1 flex flex-col min-w-0 h-full transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-24' : 'lg:pl-64'}`}>
        <header className="flex-shrink-0 flex items-center justify-between h-20 px-4 md:px-6 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl z-10">
          <div className="flex items-center space-x-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors">
                <MenuIcon className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 hidden sm:block">
              {viewTitles[currentView]}
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={toggleTheme} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all" title="Změnit téma">
                {theme === 'dark' ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
            </button>
            <button onClick={() => setApiKeyModalOpen(true)} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all" title="Zadat API klíč">
                <KeyIcon className="w-6 h-6" />
            </button>
          </div>
        </header>

        <main key={contentKey} className="flex-1 overflow-auto animate-fade-in" style={{ animation: 'fade-in 0.5s ease-in-out' }}>
            {renderCurrentView()}
        </main>
      </div>

      <div aria-live="assertive" className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-[100]">
        <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="max-w-sm w-full bg-white dark:bg-slate-800 shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 dark:ring-white dark:ring-opacity-10 overflow-hidden animate-fade-in-right"
            >
              <div className="p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {notification.type === 'error' ? (
                      <XCircleIcon className="h-6 w-6 text-red-400" aria-hidden="true" />
                    ) : (
                      <InformationCircleIcon className="h-6 w-6 text-cyan-400" aria-hidden="true" />
                    )}
                  </div>
                  <div className="ml-3 w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {notification.type === 'error' ? 'Chyba' : 'Informace'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {notification.message}
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex">
                    <button
                      type="button"
                      className="bg-white dark:bg-slate-800 rounded-md inline-flex text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-fuchsia-500 transition-colors"
                      onClick={() => {
                        removeNotification(notification.id);
                      }}
                    >
                      <span className="sr-only">Zavřít</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
