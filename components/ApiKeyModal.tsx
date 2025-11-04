import React from 'react';
import { openSelectKey } from '../utils/apiKey';

interface ApiKeyModalProps {
  isOpen: boolean;
  onKeySelectionAttempt: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onKeySelectionAttempt }) => {
  if (!isOpen) return null;

  const handleSelectKey = async () => {
    await openSelectKey();
    onKeySelectionAttempt();
  };

  return (
    <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 relative transform transition-all border border-slate-200/50 dark:border-slate-800/50 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 aurora-glow"></div>
        
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-4 mb-2">Vyžadován Google Gemini API Klíč</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          Pro využití AI funkcí v této aplikaci je nutné vybrat váš Google API klíč.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Klíč můžete zdarma získat v <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline font-medium">Google AI Studiu</a>. Ujistěte se, že máte na svém účtu povolenou fakturaci. Více informací naleznete v <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline font-medium">dokumentaci k fakturaci</a>.
        </p>
        
        <div className="mt-8 flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleSelectKey}
            className="aurora-glow w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-semibold rounded-md shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-fuchsia-500 transform transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Vybrat API klíč
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;