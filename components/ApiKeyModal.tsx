
import React, { useState, useEffect } from 'react';
import { openSelectKey, storeApiKey } from '../utils/apiKey';
import { useTranslation } from '../contexts/LanguageContext';

interface ApiKeyModalProps {
  isOpen: boolean;
  onKeySelectionAttempt: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onKeySelectionAttempt }) => {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState('');
  
  // INTELIGENTNÍ DETEKCE:
  // Pokud okno 'aistudio' neexistuje (běžíme na Cloudu/Vercelu/Netlify),
  // rovnou zobrazíme manuální vstup. Není důvod ukazovat tlačítko, které nebude fungovat.
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
      if (isOpen) {
          // Check if we are in the specific AI Studio iframe environment
          const isAIStudio = typeof window !== 'undefined' && 
                             window.aistudio && 
                             typeof window.aistudio.openSelectKey === 'function';
          
          // If NOT in AI Studio, default to manual input immediately
          setShowManualInput(!isAIStudio);
      }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectKey = async () => {
    setError(null);
    const success = await openSelectKey();
    
    if (success) {
        onKeySelectionAttempt();
    } else {
        // Fallback if detection failed and user clicked anyway
        setError(t.msg_error);
        setShowManualInput(true);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!manualKey.trim()) {
          setError(t.msg_api_missing);
          return;
      }
      // Basic format check for Google API Keys (usually start with AIza)
      if (!manualKey.trim().startsWith('AIza')) {
          setError("API Key looks invalid (usually starts with 'AIza').");
          return;
      }
      storeApiKey(manualKey.trim());
      onKeySelectionAttempt();
  };

  return (
    <div 
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 relative transform transition-all border border-slate-800 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 aurora-glow"></div>
        
        <h2 className="text-2xl font-bold text-slate-100 mt-4 mb-2">{t.modal_api_title}</h2>
        <p className="text-slate-400 mb-6 text-sm">
          {t.modal_api_desc}
        </p>
        
        {error && (
             <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-fade-in-right">
                <p className="text-xs text-red-300 font-medium">{error}</p>
             </div>
        )}

        <div className="space-y-4">
             {!showManualInput ? (
                 <>
                    <button
                        type="button"
                        onClick={handleSelectKey}
                        className="aurora-glow w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-semibold rounded-md shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 focus:outline-none transition-all"
                    >
                        {t.modal_api_btn_auto}
                    </button>
                    <div className="text-center mt-4">
                        <button 
                            onClick={() => setShowManualInput(true)} 
                            className="text-xs text-slate-500 hover:text-cyan-400 underline"
                        >
                            {t.modal_api_manual_toggle}
                        </button>
                    </div>
                 </>
             ) : (
                <form onSubmit={handleManualSubmit} className="space-y-4 animate-fade-in-up">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">{t.modal_api_manual_label}</label>
                        <input 
                            type="password"
                            value={manualKey}
                            onChange={(e) => setManualKey(e.target.value)}
                            placeholder="AIza..."
                            autoFocus
                            className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none placeholder-slate-600"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!manualKey}
                        className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-semibold rounded-md shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 disabled:opacity-50 transition-all aurora-glow"
                    >
                        {t.modal_api_btn_save}
                    </button>
                </form>
             )}
        </div>
        
        <p className="text-xs text-slate-500 mt-6 text-center">
             {t.modal_api_footer} <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline">Google AI Studio</a>.
        </p>
      </div>
    </div>
  );
};

export default ApiKeyModal;
