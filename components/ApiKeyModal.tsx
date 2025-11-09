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
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
    >
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 relative transform transition-all border border-slate-800/50 overflow-hidden animate-scale-in pointer-events-auto">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 aurora-glow"></div>

        <h2 id="modal-title" className="text-2xl font-bold text-slate-100 mt-4 mb-2">Vyžadován Google Gemini API Klíč</h2>
        <p className="text-slate-400 mb-4">
          Pro využití AI funkcí v této aplikaci je nutné vybrat váš Google API klíč.
        </p>
        <p className="text-sm text-slate-400 mb-6">
          Klíč můžete zdarma získat v <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline font-medium">Google AI Studiu</a>. Ujistěte se, že máte na svém účtu povolenou fakturaci. Více informací naleznete v <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline font-medium">dokumentaci k fakturaci</a>.
        </p>

        <div className="mt-8 flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleSelectKey}
            aria-label="Vybrat Google Gemini API klíč"
            className="btn-primary aurora-glow w-full inline-flex items-center justify-center gap-2 px-6 py-4 border border-transparent text-base font-bold rounded-xl shadow-2xl text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500 transform transition-all hover:-translate-y-0.5 hover:scale-105 active:translate-y-0 active:scale-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span>Vybrat API klíč</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;