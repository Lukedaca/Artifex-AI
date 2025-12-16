
import React, { useState, useEffect, useCallback, useReducer } from 'react';

// Views
import HomeView from './components/HomeView';
import UploadView from './components/UploadView';
import EditorView from './components/EditorView';
import BatchView from './components/BatchView';
import GenerateImageView from './components/GenerateImageView';
import RAWConverterView from './components/RAWConverterView';

// Components
import Sidebar from './components/Sidebar';
import ApiKeyModal from './components/ApiKeyModal';
import { XCircleIcon } from './components/icons';

// Types
import type { UploadedFile, View, EditorAction, History, HistoryEntry, Preset } from './types';

// Utils & Services
import { hasSelectedApiKey } from './utils/apiKey';
import { normalizeImageFile } from './utils/imageProcessor';
import { getPresets } from './services/userProfileService';
import { useTranslation } from './contexts/LanguageContext';


// --- History Reducer ---
// This will handle undo/redo for the file list
const initialHistoryState: History = {
  past: [],
  present: { state: [], actionName: 'Initial State' },
  future: [],
};

function historyReducer(state: History, action: { type: 'SET'; payload: HistoryEntry } | { type: 'UNDO' } | { type: 'REDO' }) {
    const { past, present, future } = state;
    switch (action.type) {
        case 'SET':
            if (action.payload.state === present.state) {
                return state;
            }
            return {
                past: [...past, present],
                present: action.payload,
                future: [],
            };
        case 'UNDO':
            if (past.length === 0) return state;
            const previous = past[past.length - 1];
            const newPast = past.slice(0, past.length - 1);
            return {
                past: newPast,
                present: previous,
                future: [present, ...future],
            };
        case 'REDO':
            if (future.length === 0) return state;
            const next = future[0];
            const newFuture = future.slice(1);
            return {
                past: [...past, present],
                present: next,
                future: newFuture,
            };
        default:
            return state;
    }
}

interface Notification {
  id: number;
  message: string;
  type: 'info' | 'error';
}

function App() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('home');
  const [history, dispatchHistory] = useReducer(historyReducer, initialHistoryState);
  const { present: { state: files } } = history;

  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<EditorAction>(null);

  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyChecked, setApiKeyChecked] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userPresets, setUserPresets] = useState<Preset[]>([]);


  // --- Effects ---

  // API Key Check
  useEffect(() => {
    if (view === 'home' || apiKeyChecked) return;
    const checkKey = async () => {
        const hasKey = await hasSelectedApiKey();
        if (!hasKey) {
            setIsApiKeyModalOpen(true);
        }
        setApiKeyChecked(true); // only check once per session
    };
    checkKey();
  }, [view, apiKeyChecked]);

  // Load presets
  useEffect(() => {
      setUserPresets(getPresets());
  }, []);

  // Set permanent dark theme on mount
  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('artifex-theme', 'dark');
  }, []);

  // --- Handlers ---

  const setFiles = useCallback((newState: UploadedFile[] | ((prevState: UploadedFile[]) => UploadedFile[]), actionName: string) => {
    const newFiles = typeof newState === 'function' ? newState(files) : newState;
    dispatchHistory({ type: 'SET', payload: { state: newFiles, actionName } });
    if (newFiles.length > 0 && (!activeFileId || !newFiles.find(f => f.id === activeFileId))) {
      setActiveFileId(newFiles[0].id);
    }
    if (newFiles.length === 0) {
      setActiveFileId(null);
    }
  }, [files, activeFileId]);

  const addNotification = useCallback((message: string, type: 'info' | 'error' = 'info') => {
    const id = Date.now();
    setNotifications(n => [...n, { id, message, type }]);
    setTimeout(() => {
      setNotifications(n => n.filter(notif => notif.id !== id));
    }, 5000);
  }, []);
  
  const handleToggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const handleNavigate = useCallback(({ view: newView, action }: { view: View; action?: string }) => {
    if (newView === 'editor' && files.length === 0 && action) {
        // Fallback or generic message, though in practice t.editor_upload_hint covers this UX
        addNotification(t.editor_no_image, 'error');
        return;
    }
    setView(newView);
    if (action) {
      setActiveAction({ action, timestamp: Date.now() });
    } else {
      setActiveAction(null);
    }
  }, [files.length, addNotification, t.editor_no_image]);

  const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
    const validFiles: UploadedFile[] = [];
    const promises = selectedFiles.map(async file => {
      try {
        const normalizedFile = await normalizeImageFile(file);
        const previewUrl = URL.createObjectURL(normalizedFile);
        validFiles.push({
          id: `${Date.now()}-${Math.random()}`,
          file: normalizedFile,
          previewUrl: previewUrl,
          originalPreviewUrl: previewUrl,
        });
      } catch (error) {
        addNotification(`${t.msg_error}: ${file.name}`, 'error');
      }
    });

    await Promise.all(promises);

    if (validFiles.length > 0) {
      setFiles(
        currentFiles => [...currentFiles, ...validFiles],
        `Uploaded ${validFiles.length} files`
      );
      setView('editor');
      addNotification(`${validFiles.length} ${t.notify_upload_success}`, 'info');
    }
  }, [addNotification, setFiles, t.msg_error, t.notify_upload_success]);

  const handleImageGenerated = useCallback((file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const newFile: UploadedFile = {
      id: `${Date.now()}-${Math.random()}`,
      file: file,
      previewUrl: previewUrl,
      originalPreviewUrl: previewUrl,
    };
    setFiles(currentFiles => [...currentFiles, newFile], 'Generated Image');
    setView('editor');
    addNotification(t.notify_gen_success, 'info');
  }, [addNotification, setFiles, t.notify_gen_success]);

  const handleBatchComplete = useCallback((updatedFiles: { id: string; file: File }[]) => {
    const updatedFilesMap = new Map(updatedFiles.map(f => [f.id, f]));
    setFiles(
      currentFiles => currentFiles.map(cf => {
        if (updatedFilesMap.has(cf.id)) {
          const newFile = updatedFilesMap.get(cf.id)!;
          // Clean up old object URL
          // NOTE: Do not revoke here to support history undo
          return { ...cf, file: newFile.file, previewUrl: URL.createObjectURL(newFile.file) };
        }
        return cf;
      }),
      'Batch Edit'
    );
    setView('editor');
  }, [setFiles]);
  
  const handleRawFilesConverted = useCallback((files: File[]) => {
      handleFilesSelected(files);
  }, [handleFilesSelected]);

  const handleKeySelectionAttempt = useCallback(async () => {
    // When the user has attempted to select a key (closed the dialog),
    // we must assume success and proceed, as per Gemini API guidelines regarding race conditions.
    // Re-checking hasSelectedApiKey() immediately often returns false due to propagation delay,
    // causing the modal to reopen infinitely.
    setIsApiKeyModalOpen(false);
  }, []);
  
  const getPageTitle = () => {
      if (view === 'upload') return t.upload_title;
      if (view === 'editor') return t.nav_studio;
      if (view === 'batch') return t.batch_title;
      if (view === 'generate') return t.gen_title;
      if (view === 'raw-converter') return t.raw_title;
      return t.app_title;
  }

  const renderView = () => {
    const headerProps = {
        title: getPageTitle(),
        onOpenApiKeyModal: () => setIsApiKeyModalOpen(true),
        onToggleSidebar: handleToggleSidebar,
    };

    switch (view) {
      case 'home':
        return <HomeView onEnterApp={() => setView('upload')} />;
      case 'upload':
        return <UploadView {...headerProps} onFilesSelected={handleFilesSelected} addNotification={addNotification} />;
      case 'editor':
        return <EditorView {...headerProps} files={files} activeFileId={activeFileId} onSetFiles={setFiles} onSetActiveFileId={setActiveFileId} activeAction={activeAction} addNotification={addNotification} userPresets={userPresets} onPresetsChange={setUserPresets} history={history} onUndo={() => dispatchHistory({type: 'UNDO'})} onRedo={() => dispatchHistory({type: 'REDO'})} onNavigate={handleNavigate} />;
      case 'batch':
        return <BatchView {...headerProps} files={files} onBatchComplete={handleBatchComplete} addNotification={addNotification} />;
      case 'generate':
        return <GenerateImageView {...headerProps} onImageGenerated={handleImageGenerated} />;
      case 'raw-converter':
        return <RAWConverterView {...headerProps} addNotification={addNotification} onFilesConverted={handleRawFilesConverted} />;
      default:
        return <UploadView {...headerProps} onFilesSelected={handleFilesSelected} addNotification={addNotification} />;
    }
  };

  if (view === 'home') {
    return <HomeView onEnterApp={() => setView('upload')} />;
  }

  return (
    <div className={`h-screen w-screen overflow-hidden flex font-sans bg-slate-950`}>
        <Sidebar 
            isOpen={isSidebarOpen}
            isCollapsed={isSidebarCollapsed}
            onClose={() => setIsSidebarOpen(false)}
            onNavigate={handleNavigate}
            onToggleCollapse={() => setIsSidebarCollapsed(p => !p)}
            currentView={view}
            activeAction={activeAction}
        />
        <main className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-24' : 'lg:pl-64'}`}>
            {renderView()}
        </main>
        
        <ApiKeyModal isOpen={isApiKeyModalOpen} onKeySelectionAttempt={handleKeySelectionAttempt} />

        <div className="fixed top-5 right-5 z-[100] w-full max-w-sm space-y-3">
            {notifications.map(n => (
                <div key={n.id} className={`flex items-start p-4 rounded-lg shadow-lg text-sm font-medium border animate-fade-in-right ${n.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-200'}`}>
                    <span className="flex-1">{n.message}</span>
                    <button onClick={() => setNotifications(current => current.filter(notif => notif.id !== n.id))} className="ml-4 -mr-1 p-1 rounded-full hover:bg-black/10">
                        <XCircleIcon className="w-5 h-5" />
                    </button>
                </div>
            ))}
        </div>
    </div>
  );
}

export default App;
