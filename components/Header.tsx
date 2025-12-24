
import React from 'react';
import { MenuIcon } from './icons';
import { useTranslation } from '../contexts/LanguageContext';

interface HeaderProps {
  title: string;
  onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, onToggleSidebar }) => {
  const { language, setLanguage } = useTranslation();

  return (
    <header className="flex-shrink-0 flex items-center h-20 px-4 sm:px-8 border-b border-slate-800/50 w-full backdrop-blur-xl">
      {/* Mobile Menu Button */}
      <button
        onClick={onToggleSidebar}
        className="lg:hidden p-2 -ml-2 mr-4 text-slate-400"
        aria-label="Otevřít menu"
      >
        <MenuIcon className="w-6 h-6" />
      </button>

      {/* Title */}
      <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
      </div>

      {/* Right side actions */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Language Toggle */}
        <div className="flex bg-slate-800/80 rounded-lg p-1 border border-slate-700/50">
            <button 
                onClick={() => setLanguage('cs')} 
                className={`px-2 py-1 text-xs font-bold rounded transition-all ${language === 'cs' ? 'bg-cyan-500/20 text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
                CZ
            </button>
            <button 
                onClick={() => setLanguage('en')} 
                className={`px-2 py-1 text-xs font-bold rounded transition-all ${language === 'en' ? 'bg-cyan-500/20 text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
                EN
            </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
