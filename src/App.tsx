import React, { useState, useEffect, useCallback, useReducer } from 'react';

// Views
import HomeView from './components/HomeView';
import UploadView from './components/UploadView';
import EditorView from './components/EditorView';
import BatchView from './components/BatchView';
import GenerateImageView from './components/GenerateImageView';

// Components
import Sidebar from './components/Sidebar';
import { ToastContainer } from './components/ToastNotification';

// Types
import type { UploadedFile, View, EditorAction, History, HistoryEntry, Preset } from './types';

// Utils & Services
import { normalizeImageFile } from './utils/imageProcessor';
import { getPresets } from './services/userProfileService';


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
  type: 'info' | 'error' | 'success' | 'warning';
}

function App() {
  const [view, setView] = useState<View>('home');
  const [history, dispatchHistory] = useReducer(historyReducer, initialHistoryState);
  const { present: { state: files } } = history;

  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<EditorAction>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userPresets, setUserPresets] = useState<Preset[]>([]);


  // --- Effects ---

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

  const addNotification = useCallback((message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
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
        addNotification('Nejprve prosím nahrajte obrázek.', 'error');
        return;
    }
    setView(newView);
    if (action) {
      setActiveAction({ action, timestamp: Date.now() });
    } else {
      setActiveAction(null);
    }
  }, [files.length, addNotification]);

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
        addNotification(`Soubor ${file.name} není podporován.`, 'error');
      }
    });

    await Promise.all(promises);

    if (validFiles.length > 0) {
      setFiles(
        currentFiles => [...currentFiles, ...validFiles],
        `Nahráno ${validFiles.length} souborů`
      );
      setView('editor');
    }
  }, [addNotification, setFiles]);

  const handleImageGenerated = useCallback((file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const newFile: UploadedFile = {
      id: `${Date.now()}-${Math.random()}`,
      file: file,
      previewUrl: previewUrl,
      originalPreviewUrl: previewUrl,
    };
    setFiles(currentFiles => [...currentFiles, newFile], 'Generován obrázek');
    setView('editor');
    addNotification('Obrázek byl úspěšně vygenerován a přidán do projektu.', 'info');
  }, [addNotification, setFiles]);

  const handleBatchComplete = useCallback((updatedFiles: { id: string; file: File }[]) => {
    const updatedFilesMap = new Map(updatedFiles.map(f => [f.id, f]));
    setFiles(
      currentFiles => currentFiles.map(cf => {
        if (updatedFilesMap.has(cf.id)) {
          const newFile = updatedFilesMap.get(cf.id)!;
          // Clean up old object URL
          URL.revokeObjectURL(cf.previewUrl);
          // FIX: The 'newFile' variable is an object {id: string, file: File}.
          // URL.createObjectURL expects a File/Blob, not the wrapper object.
          // The `file` property of the new state should also be the File object itself.
          return { ...cf, file: newFile.file, previewUrl: URL.createObjectURL(newFile.file) };
        }
        return cf;
      }),
      'Batch úpravy'
    );
    setView('editor');
  }, [setFiles]);
  
  const getPageTitle = () => {
      if (view === 'upload') return 'Nahrát fotky';
      if (view === 'editor') return 'Editor & AI Analýza';
      if (view === 'batch') return 'Hromadné zpracování';
      if (view === 'generate') return 'Generátor obrázků';
      return 'Dashboard';
  }

  const renderView = () => {
    const headerProps = {
        title: getPageTitle(),
        onToggleSidebar: handleToggleSidebar,
    };

    switch (view) {
      case 'home':
        return <HomeView onEnterApp={() => setView('upload')} />;
      case 'upload':
        return <UploadView {...headerProps} onFilesSelected={handleFilesSelected} />;
      case 'editor':
        return <EditorView {...headerProps} files={files} activeFileId={activeFileId} onSetFiles={setFiles} onSetActiveFileId={setActiveFileId} activeAction={activeAction} addNotification={addNotification} userPresets={userPresets} onPresetsChange={setUserPresets} history={history} onUndo={() => dispatchHistory({type: 'UNDO'})} onRedo={() => dispatchHistory({type: 'REDO'})} />;
      case 'batch':
        return <BatchView {...headerProps} files={files} onBatchComplete={handleBatchComplete} addNotification={addNotification} />;
      case 'generate':
        return <GenerateImageView {...headerProps} onImageGenerated={handleImageGenerated} />;
      default:
        return <UploadView {...headerProps} onFilesSelected={handleFilesSelected} />;
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

        <ToastContainer
          notifications={notifications}
          onClose={(id) => setNotifications(current => current.filter(notif => notif.id !== id))}
        />
    </div>
  );
}

export default App;