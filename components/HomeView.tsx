import React from 'react';
import { LogoIcon } from './icons';

interface HomeViewProps {
  onEnterApp: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onEnterApp }) => {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center text-center p-4 relative overflow-hidden bg-slate-950 text-white">
      {/* Background Glows */}
      <div className="absolute top-[-20%] left-[-20%] w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse-slow animation-delay-2000"></div>

      <div className="relative z-10 flex flex-col items-center animate-fade-in-up">
        <LogoIcon className="w-24 h-24 text-cyan-400" />
        <h1 className="mt-6 text-6xl md:text-7xl font-extrabold bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent aurora-text-glow">
          Artifex AI
        </h1>
        <p className="mt-4 max-w-2xl text-lg md:text-xl text-slate-400">
          Transformujte své fotografie silou umělé inteligence. Analyzujte, upravujte a vytvářejte ohromující vizuály jediným kliknutím.
        </p>
        <button
          onClick={onEnterApp}
          className="mt-12 inline-flex items-center px-12 py-5 border border-transparent text-lg font-semibold rounded-2xl shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-fuchsia-500 transition-all transform hover:-translate-y-1 active:translate-y-0 hover:shadow-2xl hover:shadow-cyan-500/30 aurora-glow"
        >
          Vstoupit do studia
        </button>
      </div>
    </div>
  );
};

export default HomeView;
