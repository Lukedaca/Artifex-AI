
import React from 'react';
import { LogoIcon, AutopilotIcon, EraserIcon, BatchIcon, GenerateImageIcon } from './icons';
import { useTranslation } from '../contexts/LanguageContext';

interface HomeViewProps {
  onEnterApp: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onEnterApp }) => {
  const { t } = useTranslation();

  const features = [
    { icon: <AutopilotIcon className="w-5 h-5 text-cyan-400" />, name: t.nav_autopilot },
    { icon: <EraserIcon className="w-5 h-5 text-cyan-400" />, name: t.nav_remove_obj },
    { icon: <BatchIcon className="w-5 h-5 text-cyan-400" />, name: t.nav_batch },
    { icon: <GenerateImageIcon className="w-5 h-5 text-cyan-400" />, name: t.nav_gen },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="relative z-10 flex flex-col items-center max-w-5xl w-full">
        <div className="animate-fade-in-up flex flex-col items-center text-center">
            <div className="p-4 rounded-3xl bg-slate-800/30 backdrop-blur-xl border border-white/5 mb-8 shadow-2xl">
              <LogoIcon className="w-20 h-20 text-cyan-400" />
            </div>
            
            <div className="mb-6">
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter bg-gradient-to-b from-white via-white to-slate-500 bg-clip-text text-transparent aurora-text-glow">
                Fotograf <span className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text">AI</span>
              </h1>
            </div>

            <p className="max-w-xl text-lg md:text-xl text-slate-400 leading-relaxed font-medium">
              {t.home_subtitle}
            </p>
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {features.map((feature, index) => (
            <div key={index} className="glass-card flex flex-col items-center justify-center p-6 rounded-3xl transition-all duration-500 hover:scale-105 hover:bg-white/5 group">
              <div className="p-3 rounded-2xl bg-cyan-500/10 mb-4 group-hover:bg-cyan-500/20 transition-colors">
                {feature.icon}
              </div>
              <span className="font-bold text-xs uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">{feature.name}</span>
            </div>
          ))}
        </div>
        
        <div className="mt-16 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <button
            onClick={onEnterApp}
            className="shimmer-btn relative group inline-flex items-center px-16 py-6 border border-transparent text-xl font-black rounded-full shadow-2xl text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 transition-all transform hover:-translate-y-2 active:translate-y-0 active:scale-95"
          >
            <span className="relative z-10 flex items-center">
              {t.home_enter}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 ml-3 group-hover:translate-x-2 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
            <div className="absolute inset-0 rounded-full bg-cyan-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
          </button>
        </div>
        
        <div className="mt-20 flex items-center gap-8 opacity-30 grayscale hover:grayscale-0 transition-all duration-1000">
           <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Powered by Gemini 2.5 Pro</span>
           <div className="w-1 h-1 rounded-full bg-slate-700"></div>
           <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Imagen 4.0 Studio</span>
        </div>
      </div>
    </div>
  );
};

export default HomeView;
