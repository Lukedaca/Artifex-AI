
import React from 'react';
import type { EditorAction, View } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
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
  ChevronDoubleLeftIcon,
  StyleTransferIcon,
  BackgroundReplacementIcon,
  PresetIcon,
  SparklesIcon,
  FilmIcon,
  YoutubeIcon,
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

const NavItem: React.FC<NavItemProps> = ({ icon, label, onClick, isCollapsed, isActive }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center text-sm font-medium rounded-lg hover:bg-slate-500/10 transition-all duration-200 group ${isCollapsed ? 'justify-center py-3' : 'space-x-4 px-4 py-2.5'} ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`} 
    title={isCollapsed ? label : undefined}
  >
    <span className="relative z-10">{icon}</span>
    {!isCollapsed && <span className="relative z-10">{label}</span>}
  </button>
);

const Sidebar = ({ isOpen, isCollapsed, onClose, onNavigate, onToggleCollapse, currentView, activeAction }: SidebarProps) => {
  const { t } = useTranslation();

  const mainTools: {icon: React.ReactNode, label: string, view: View, action?: string}[] = [
    { icon: <LogoIcon className="w-5 h-5 flex-shrink-0" />, label: t.nav_studio, view: "home" },
    { icon: <UploadIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_upload, view: "upload" },
    { icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>, label: t.nav_raw, view: "raw-converter" },
    { icon: <AnalysisIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_analysis, view: "editor", action: "analysis" },
    { icon: <ManualEditIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_manual, view: "editor", action: "manual-edit" },
    { icon: <BatchIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_batch, view: "batch" },
  ];

  const presetsTools: {icon: React.ReactNode, label: string, view: View, action?: string}[] = [
    { icon: <PresetIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_presets, view: "editor", action: "user-presets" },
  ];

  const aiTools: {icon: React.ReactNode, label: string, view: View, action?: string}[] = [
    { icon: <AutopilotIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_autopilot, view: "editor", action: "autopilot" },
    { icon: <YoutubeIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_youtube, view: "editor", action: "youtube-thumbnail" },
    { icon: <SparklesIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_social, view: "editor", action: "social-media" },
    { icon: <FilmIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_video, view: "editor", action: "video-generation" },
    { icon: <EraserIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_remove_obj, view: "editor", action: "remove-object" },
    { icon: <AutoCropIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_crop, view: "editor", action: "auto-crop" },
    { icon: <StyleTransferIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_style, view: "editor", action: "style-transfer" },
    { icon: <BackgroundReplacementIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_bg, view: "editor", action: "replace-background" },
    { icon: <GenerateImageIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_gen, view: "generate" },
    { icon: <ExportIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_export, view: "editor", action: "export" },
    { icon: <HistoryIcon className="w-5 h-5 flex-shrink-0"/>, label: t.nav_history, view: "editor", action: "history" },
  ];

  const handleNavigation = (payload: { view: View; action?: string }) => {
    onNavigate(payload);
    onClose();
  }

  return (
    <>
      <div className={`fixed inset-0 bg-slate-900/80 z-40 transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
      <aside className={`fixed top-0 left-0 h-full backdrop-blur-2xl border-r border-slate-800/50 z-50 transform transition-all duration-300 ease-in-out flex-shrink-0 ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'} ${isCollapsed ? 'lg:w-24' : 'lg:w-64'} lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          <div className={`relative flex items-center h-20 border-b border-slate-800/50 flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'justify-center px-4' : 'space-x-3 px-5'}`}>
            <LogoIcon className="w-8 h-8 text-cyan-400 flex-shrink-0" />
            {!isCollapsed && (
              <div className="flex-grow overflow-hidden">
                <h1 className="text-xl font-extrabold bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-500 bg-clip-text text-transparent aurora-text-glow">Fotograf AI</h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest -mt-1">Studio</p>
              </div>
            )}
            <button onClick={onToggleCollapse} className="hidden lg:flex items-center justify-center absolute top-1/2 -translate-y-1/2 -right-3.5 z-10 w-7 h-7 bg-slate-800 rounded-full shadow-lg border border-slate-700 text-slate-500 hover:text-cyan-500 transition-all duration-300 hover:scale-110 active:scale-100">
                <ChevronDoubleLeftIcon className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          <nav className="flex-grow flex flex-col space-y-8 overflow-y-auto p-4 custom-scrollbar">
            <div>
              {!isCollapsed && <h2 className="px-4 mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Tools</h2>}
              {isCollapsed && <hr className="mb-4 border-slate-700/80" />}
              <div className="space-y-1.5 relative">
                {mainTools.map((item) => {
                  const isActive = item.view === currentView && (item.action ? item.action === (activeAction?.action) : activeAction === null);
                  return (
                    <NavItem key={item.label} icon={item.icon} label={item.label} onClick={() => handleNavigation({ view: item.view, action: item.action })} isCollapsed={isCollapsed} isActive={isActive} />
                  );
                })}
              </div>
            </div>
             <div>
              {!isCollapsed && <h2 className="px-4 mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Styles</h2>}
              {isCollapsed && <hr className="my-4 border-slate-700/80" />}
              <div className="space-y-1.5 relative">
                {presetsTools.map((item) => {
                  const isActive = item.view === currentView && (item.action ? item.action === (activeAction?.action) : !activeAction);
                  return (
                    <NavItem key={item.label} icon={item.icon} label={item.label} onClick={() => handleNavigation({ view: item.view, action: item.action })} isCollapsed={isCollapsed} isActive={isActive}/>
                  );
                })}
              </div>
            </div>
            <div>
              {!isCollapsed && <h2 className="px-4 mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">AI Power</h2>}
              {isCollapsed && <hr className="my-4 border-slate-700/80" />}
              <div className="space-y-1.5 relative">
                {aiTools.map((item) => {
                  const isActive = item.view === currentView && (item.action ? item.action === (activeAction?.action) : !activeAction);
                  return (
                    <NavItem key={item.label} icon={item.icon} label={item.label} onClick={() => handleNavigation({ view: item.view, action: item.action })} isCollapsed={isCollapsed} isActive={isActive}/>
                  );
                })}
              </div>
            </div>
          </nav>

          {!isCollapsed && (
            <div className="mt-auto pt-4 p-4 text-center text-[10px] text-slate-500 font-mono flex-shrink-0">
              Fotograf AI © 2025 v3.5
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
