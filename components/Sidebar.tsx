import React from 'react';
import type { EditorAction, View } from '../types';
import {
  UploadIcon,
  AnalysisIcon,
  ManualEditIcon,
  BatchIcon,
  AutopilotIcon,
  AutoCropIcon,
  EraserIcon,
  GenerateImageIcon,
  ExportIcon,
  HistoryIcon,
  LogoIcon,
  ChevronDoubleLeftIcon
} from './icons';

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onNavigate: (payload: { view: View; action?: string }) => void;
  onToggleCollapse: () => void;
  currentView: View;
  activeAction: EditorAction;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isCollapsed: boolean;
  isActive: boolean;
}

const mainTools: {icon: React.ReactNode, label: string, view: View, action?: string}[] = [
  { icon: <UploadIcon className="w-5 h-5 flex-shrink-0"/>, label: "Nahrát fotky", view: "upload" },
  { icon: <AnalysisIcon className="w-5 h-5 flex-shrink-0"/>, label: "AI Analýza", view: "editor", action: "analysis" },
  { icon: <ManualEditIcon className="w-5 h-5 flex-shrink-0"/>, label: "Manuální úpravy", view: "editor", action: "manual-edit" },
  { icon: <BatchIcon className="w-5 h-5 flex-shrink-0"/>, label: "Batch zpracování", view: "batch" },
];

const aiTools: {icon: React.ReactNode, label: string, view: View, action?: string}[] = [
  { icon: <AutopilotIcon className="w-5 h-5 flex-shrink-0"/>, label: "Autopilot AI", view: "editor", action: "autopilot" },
  { icon: <EraserIcon className="w-5 h-5 flex-shrink-0"/>, label: "Odstranit objekt", view: "editor", action: "remove-object" },
  { icon: <AutoCropIcon className="w-5 h-5 flex-shrink-0"/>, label: "Automatické oříznutí", view: "editor", action: "auto-crop" },
  { icon: <GenerateImageIcon className="w-5 h-5 flex-shrink-0"/>, label: "Vytvořit obrázek", view: "generate" },
  { icon: <ExportIcon className="w-5 h-5 flex-shrink-0"/>, label: "Export", view: "editor" },
  { icon: <HistoryIcon className="w-5 h-5 flex-shrink-0"/>, label: "Historie", view: "editor" },
];

// FIX: Changed component definition to React.FC<NavItemProps> to correctly handle the 'key' prop in lists.
const NavItem: React.FC<NavItemProps> = ({ icon, label, onClick, isCollapsed, isActive }) => (
  <button onClick={onClick} className={`w-full flex items-center text-sm font-medium rounded-lg hover:bg-sky-500/10 hover:text-sky-600 dark:hover:bg-sky-500/10 dark:hover:text-sky-400 transition-all duration-200 group ${isCollapsed ? 'justify-center py-3' : 'space-x-3 px-3 py-2.5'} ${isActive ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'text-slate-600 dark:text-slate-300'}`} title={isCollapsed ? label : undefined}>
    {icon}
    {!isCollapsed && <span>{label}</span>}
  </button>
);

const Sidebar = ({ isOpen, isCollapsed, onClose, onNavigate, onToggleCollapse, currentView, activeAction }: SidebarProps) => {
  const handleNavigation = (payload: { view: View; action?: string }) => {
    onNavigate(payload);
    onClose();
  }

  return (
    <>
      <div className={`fixed inset-0 bg-slate-900/80 z-40 transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
      <aside className={`fixed top-0 left-0 h-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-r border-slate-200 dark:border-slate-800 z-50 transform transition-all duration-300 ease-in-out flex-shrink-0 ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'} ${isCollapsed ? 'lg:w-20' : 'lg:w-60'} lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          <div className={`relative flex items-center h-16 border-b border-slate-200/80 dark:border-slate-800/80 flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'justify-center px-4' : 'space-x-3 px-4'}`}>
            <LogoIcon className="w-8 h-8 text-sky-500 dark:text-sky-400 flex-shrink-0" />
            {!isCollapsed && (
              <div className="flex-grow overflow-hidden">
                <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">Artifex AI</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 -mt-0.5">v2.0</p>
              </div>
            )}
            <button onClick={onToggleCollapse} className="hidden lg:flex items-center justify-center absolute top-1/2 -translate-y-1/2 -right-3 z-10 w-6 h-6 bg-white dark:bg-slate-800 rounded-full shadow-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-sky-500 transition-opacity">
                <ChevronDoubleLeftIcon className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          <nav className="flex-grow flex flex-col space-y-6 overflow-y-auto p-4">
            <div>
              {!isCollapsed && <h2 className="px-3 mb-2 text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">Hlavní nástroje</h2>}
              {isCollapsed && <hr className="mb-4 border-slate-200 dark:border-slate-700" />}
              <div className="space-y-1">
                {mainTools.map((item) => {
                  const isActive = item.view === currentView && (item.action ? item.action === (activeAction?.action) : activeAction === null);
                  return (
                    <NavItem key={item.label} icon={item.icon} label={item.label} onClick={() => handleNavigation({ view: item.view, action: item.action })} isCollapsed={isCollapsed} isActive={isActive} />
                  );
                })}
              </div>
            </div>
            <div>
              {!isCollapsed && <h2 className="px-3 mb-2 text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">AI nástroje</h2>}
              {isCollapsed && <hr className="my-4 border-slate-200 dark:border-slate-700" />}
              <div className="space-y-1">
                {aiTools.map((item) => {
                  const isActive = item.view === currentView && (item.action ? item.action === (activeAction?.action) : !activeAction);
                  return (
                    <NavItem key={item.label} icon={item.icon} label={item.label} onClick={() => handleNavigation({ view: item.view, action: item.action })} isCollapsed={isCollapsed} isActive={isActive} />
                  );
                })}
              </div>
            </div>
          </nav>

          {!isCollapsed && (
            <div className="mt-auto pt-4 p-4 text-center text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
              © 2024 Artifex AI
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;