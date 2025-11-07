import React from 'react';
import { LogoIcon, AutopilotIcon, EraserIcon, BatchIcon, GenerateImageIcon } from './icons';

interface HomeViewProps {
  onEnterApp: () => void;
}

const features = [
  { icon: <AutopilotIcon className="w-5 h-5 text-cyan-400" />, name: 'AI Autopilot' },
  { icon: <EraserIcon className="w-5 h-5 text-cyan-400" />, name: 'Odstranění objektů' },
  { icon: <BatchIcon className="w-5 h-5 text-cyan-400" />, name: 'Hromadné úpravy' },
  { icon: <GenerateImageIcon className="w-5 h-5 text-cyan-400" />, name: 'Generování obrázků' },
];


const HomeView: React.FC<HomeViewProps> = ({ onEnterApp }) => {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center text-center p-4 relative overflow-hidden bg-slate-950 text-white">
      {/* Background Glows */}
      <div className="absolute top-[-20%] left-[-20%] w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse-slow animation-delay-2000"></div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="animate-fade-in-up">
            <LogoIcon className="w-24 h-24 text-cyan-400" />
            <h1 className="mt-6 text-6xl md:text-7xl font-extrabold bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent aurora-text-glow">
            Artifex AI
            </h1>
            <p className="mt-4 max-w-2xl text-lg md:text-xl text-slate-400">
            Transformujte své fotografie silou umělé inteligence. Analyzujte, upravujte a vytvářejte ohromující vizuály jediným kliknutím.
            </p>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {features.map((feature, index) => (
            <div key={index} className="flex items-center space-x-3 text-slate-300 bg-slate-500/10 px-4 py-2 rounded-full border border-slate-500/20">
              {feature.icon}
              <span className="font-medium text-sm">{feature.name}</span>
            </div>
          ))}
        </div>
        
        <button
          onClick={onEnterApp}
          className="mt-12 inline-flex items-center px-12 py-5 border border-transparent text-lg font-semibold rounded-2xl shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-fuchsia-500 transition-all transform hover:-translate-y-1 active:translate-y-0 hover:shadow-2xl hover:shadow-cyan-500/30 aurora-glow animate-fade-in-up"
          style={{ animationDelay: '400ms' }}
        >
          Vstoupit do studia
        </button>
      </div>
    </div>
  );
};

export default HomeView;
