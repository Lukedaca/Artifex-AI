import React from 'react';
import { SunIcon, MoonIcon, KeyIcon, MenuIcon } from './icons';

interface HeaderProps {
  title: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenApiKeyModal: () => void;
  onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, isDarkMode, onToggleTheme, onOpenApiKeyModal, onToggleSidebar }) => {
  return (
    <header className="flex-shrink-0 flex items-center h-20 px-4 sm:px-8 border-b border-slate-200/50 dark:border-slate-800/50 w-full bg-white/60 dark:bg-slate-900/70 backdrop-blur-xl">
      {/* Mobile Menu Button */}
      <button
        onClick={onToggleSidebar}
        className="lg:hidden p-2 -ml-2 mr-4 text-slate-500 dark:text-slate-400"
        aria-label="Otevřít menu"
      >
        <MenuIcon className="w-6 h-6" />
      </button>

      {/* Title */}
      <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{title}</h1>
      </div>

      {/* Right side actions */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-full text-slate-500 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Přepnout téma"
        >
          {isDarkMode ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
        </button>
        <button
          onClick={onOpenApiKeyModal}
          className="p-2 rounded-full text-slate-500 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Nastavit API klíč"
        >
          <KeyIcon className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
};

export default Header;
