import React from 'react';
import { LogoIcon, AutopilotIcon, EraserIcon, BatchIcon, GenerateImageIcon } from './icons';

interface HomeViewProps {
  onEnterApp: () => void;
}

const features = [
  {
    icon: <AutopilotIcon className="w-6 h-6" />,
    name: 'AI Autopilot',
    description: 'Automatické vylepšení jedním kliknutím'
  },
  {
    icon: <EraserIcon className="w-6 h-6" />,
    name: 'Odstranění objektů',
    description: 'Inteligentní mazání nežádoucích prvků'
  },
  {
    icon: <BatchIcon className="w-6 h-6" />,
    name: 'Hromadné úpravy',
    description: 'Zpracujte stovky fotek najednou'
  },
  {
    icon: <GenerateImageIcon className="w-6 h-6" />,
    name: 'Generování obrázků',
    description: 'Vytvořte AI obrázky z textového popisu'
  },
];

const HomeView: React.FC<HomeViewProps> = ({ onEnterApp }) => {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center text-center px-4 py-8 relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Enhanced Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse-slow animation-delay-2000"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl opacity-50"></div>

      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyan-400/30 rounded-full animate-pulse-slow"></div>
        <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-fuchsia-400/40 rounded-full animate-pulse-slow animation-delay-500"></div>
        <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-purple-400/30 rounded-full animate-pulse-slow animation-delay-300"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-6xl w-full">
        {/* Hero Section */}
        <div className="animate-fade-in-up">
          <div className="relative inline-block">
            <LogoIcon className="w-28 h-28 md:w-32 md:h-32 text-cyan-400 mx-auto drop-shadow-2xl" />
            <div className="absolute inset-0 w-28 h-28 md:w-32 md:h-32 mx-auto bg-cyan-400/20 rounded-full blur-xl animate-pulse-slow"></div>
          </div>

          <h1 className="mt-8 text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-purple-500 bg-clip-text text-transparent aurora-text-glow leading-tight gradient-animated">
            Artifex AI
          </h1>

          <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-slate-300 font-medium leading-relaxed">
            Transformujte své fotografie silou umělé inteligence.<br className="hidden sm:block" />
            <span className="text-slate-400">Analyzujte, upravujte a vytvářejte ohromující vizuály jediným kliknutím.</span>
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl px-4 animate-fade-in-up animation-delay-200">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group card-interactive relative bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-2xl p-6 hover:bg-slate-800/60 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Icon container with gradient background */}
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <div className="text-cyan-400 group-hover:text-cyan-300 transition-colors">
                  {feature.icon}
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-100 mb-2 group-hover:text-white transition-colors">
                {feature.name}
              </h3>

              <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors leading-relaxed">
                {feature.description}
              </p>

              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/0 via-fuchsia-500/0 to-purple-500/0 group-hover:from-cyan-500/10 group-hover:via-fuchsia-500/10 group-hover:to-purple-500/10 transition-all duration-300 pointer-events-none"></div>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={onEnterApp}
          aria-label="Vstoupit do Artifex AI studia"
          className="mt-16 btn-primary inline-flex items-center gap-3 px-10 py-5 sm:px-12 sm:py-6 border border-transparent text-base sm:text-lg font-bold rounded-2xl shadow-2xl text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-cyan-500 transition-all transform hover:-translate-y-1 hover:scale-105 active:translate-y-0 active:scale-100 aurora-glow animate-fade-in-up animation-delay-400"
        >
          <span>Vstoupit do studia</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>

        {/* Subtle version indicator */}
        <p className="mt-12 text-xs text-slate-600 font-medium tracking-wide animate-fade-in animation-delay-500">
          ARTIFEX AI v3.1 • CELESTIAL
        </p>
      </div>
    </div>
  );
};

export default HomeView;