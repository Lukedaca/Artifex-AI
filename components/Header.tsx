
import React from 'react';
import { MenuIcon, SparklesIcon } from './icons';
import { useTranslation } from '../contexts/LanguageContext';

interface HeaderProps {
  title: string;
  onToggleSidebar: () => void;
  credits?: number;
  onBuyCredits?: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, onToggleSidebar, credits, onBuyCredits }) => {
  const { language, setLanguage, t } = useTranslation();

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
        
        {/* Credits Display */}
        {credits !== undefined && (
            <button 
                onClick={onBuyCredits}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded-full border border-slate-700/50 hover:bg-slate-700 hover:border-amber-400/50 transition-all cursor-pointer group" 
                title={t.credits_buy}
            >
                <SparklesIcon className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-200">{credits}</span>
                <span className="ml-1 text-[10px] text-cyan-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">+</span>
            </button>
        )}

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
