import React, { useState } from 'react';
import { LogoIcon, AutopilotIcon, EraserIcon, BatchIcon, GenerateImageIcon } from './icons';

interface HomeViewProps {
  onEnterApp: () => void;
}

interface Feature {
  icon: React.ReactNode;
  name: string;
  description: string;
  detailedDescription: string;
  benefits: string[];
}

const features: Feature[] = [
  {
    icon: <AutopilotIcon className="w-5 h-5" />,
    name: 'AI Autopilot',
    description: 'Automatické vylepšení',
    detailedDescription: 'Nechte umělou inteligenci analyzovat a vylepšit vaše fotografie profesionálním způsobem. AI automaticky upraví osvětlení, kontrast, barvy a ostrost.',
    benefits: [
      'Profesionální úprava jedním kliknutím',
      'Inteligentní korekce osvětlení a barev',
      'Automatická optimalizace ostrosti',
      'Ušetřete hodiny manuální práce'
    ]
  },
  {
    icon: <EraserIcon className="w-5 h-5" />,
    name: 'Odstranění objektů',
    description: 'Inteligentní mazání',
    detailedDescription: 'Odstraňte nežádoucí objekty z fotografií pomocí AI. Stačí označit, co chcete odstranit, a AI dokonale vyplní prázdné místo.',
    benefits: [
      'Odstranění turistů z fotografií',
      'Smazání nežádoucích předmětů',
      'Inteligentní výplň pozadí',
      'Přirozený výsledek bez stop'
    ]
  },
  {
    icon: <BatchIcon className="w-5 h-5" />,
    name: 'Hromadné úpravy',
    description: 'Zpracování více fotek',
    detailedDescription: 'Aplikujte stejné úpravy na stovky fotografií najednou. Ideální pro události, svatby nebo produktovou fotografii.',
    benefits: [
      'Zpracování stovek fotek najednou',
      'Konzistentní výsledky napříč všemi obrázky',
      'Automatizace opakujících se úprav',
      'Obrovská úspora času'
    ]
  },
  {
    icon: <GenerateImageIcon className="w-5 h-5" />,
    name: 'Generování obrázků',
    description: 'AI kreativita',
    detailedDescription: 'Vytvářejte jedinečné obrázky z textového popisu. Stačí popsat, co si představujete, a AI to vytvoří.',
    benefits: [
      'Tvorba originálního obsahu',
      'Neomezené kreativní možnosti',
      'Rychlé prototypování návrhů',
      'Žádné autorské problémy'
    ]
  },
];

const FeatureModal: React.FC<{ feature: Feature; onClose: () => void }> = ({ feature, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl p-6 sm:p-8 relative transform transition-all border border-slate-800/50 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-purple-500"></div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Zavřít"
        >
          <svg className="w-6 h-6 text-slate-400 hover:text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon and Title */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 flex items-center justify-center flex-shrink-0">
            <div className="text-cyan-400 scale-125">
              {feature.icon}
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">{feature.name}</h2>
            <p className="text-slate-400">{feature.description}</p>
          </div>
        </div>

        {/* Detailed Description */}
        <p className="text-slate-300 leading-relaxed mb-6">
          {feature.detailedDescription}
        </p>

        {/* Benefits List */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-200 mb-3">Výhody:</h3>
          {feature.benefits.map((benefit, index) => (
            <div key={index} className="flex items-start gap-3">
              <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-slate-300">{benefit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const HomeView: React.FC<HomeViewProps> = ({ onEnterApp }) => {
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center text-center px-4 py-12 relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
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
        <div className="animate-fade-in-up mb-12">
          {/* Logo with more space */}
          <div className="relative inline-block mb-8">
            <LogoIcon className="w-24 h-24 md:w-28 md:h-28 text-cyan-400 mx-auto drop-shadow-2xl" />
            <div className="absolute inset-0 w-24 h-24 md:w-28 md:h-28 mx-auto bg-cyan-400/20 rounded-full blur-xl animate-pulse-slow"></div>
          </div>

          {/* Catchy Marketing Headline */}
          <p className="text-lg sm:text-xl md:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-purple-400 font-bold mb-4 tracking-wide">
            Profesionální úprava fotek za sekundy
          </p>

          {/* Main Title - moved lower */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-purple-500 bg-clip-text text-transparent aurora-text-glow leading-tight gradient-animated mb-6">
            Artifex AI
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base md:text-lg text-slate-300 font-medium leading-relaxed">
            Transformujte své fotografie silou umělé inteligence.<br className="hidden sm:block" />
            <span className="text-slate-400">Analyzujte, upravujte a vytvářejte ohromující vizuály jediným kliknutím.</span>
          </p>
        </div>

        {/* Smaller Feature Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-4xl px-4 mb-10 animate-fade-in-up animation-delay-200">
          {features.map((feature, index) => (
            <button
              key={index}
              onClick={() => setSelectedFeature(feature)}
              className="group card-interactive relative bg-slate-900/40 backdrop-blur-sm border border-slate-800/50 rounded-xl p-4 hover:bg-slate-800/60 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer text-left"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Smaller Icon container */}
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <div className="text-cyan-400 group-hover:text-cyan-300 transition-colors">
                  {feature.icon}
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-100 mb-1 group-hover:text-white transition-colors">
                {feature.name}
              </h3>

              <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors leading-relaxed">
                {feature.description}
              </p>

              {/* Click indicator */}
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 via-fuchsia-500/0 to-purple-500/0 group-hover:from-cyan-500/10 group-hover:via-fuchsia-500/10 group-hover:to-purple-500/10 transition-all duration-300 pointer-events-none"></div>
            </button>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={onEnterApp}
          aria-label="Vstoupit do Artifex AI studia"
          className="btn-primary inline-flex items-center gap-3 px-8 py-4 sm:px-10 sm:py-5 border border-transparent text-base sm:text-lg font-bold rounded-xl shadow-2xl text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-cyan-500 transition-all transform hover:-translate-y-1 hover:scale-105 active:translate-y-0 active:scale-100 aurora-glow animate-fade-in-up animation-delay-400"
        >
          <span>Vstoupit do studia</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>

        {/* Subtle version indicator */}
        <p className="mt-8 text-xs text-slate-600 font-medium tracking-wide animate-fade-in animation-delay-500">
          ARTIFEX AI v3.1 • CELESTIAL
        </p>
      </div>

      {/* Feature Modal */}
      {selectedFeature && (
        <FeatureModal
          feature={selectedFeature}
          onClose={() => setSelectedFeature(null)}
        />
      )}
    </div>
  );
};

export default HomeView;
