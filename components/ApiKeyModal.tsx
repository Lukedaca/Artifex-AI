import React, { useState } from 'react';
import { openSelectKey, saveApiKey } from '../utils/apiKey';

interface ApiKeyModalProps {
  isOpen: boolean;
  onKeySelectionAttempt: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onKeySelectionAttempt }) => {
  const [apiKey, setApiKey] = useState('');
  const [isInAIStudio] = useState(() => typeof window !== 'undefined' && window.aistudio !== undefined);

  if (!isOpen) return null;

  const handleSelectKey = async () => {
    await openSelectKey();
    onKeySelectionAttempt();
  };

  const handleSaveKey = () => {
    const trimmedKey = apiKey.trim();
    if (trimmedKey.length === 0) {
      alert('Prosím, zadejte platný API klíč.');
      return;
    }
    saveApiKey(trimmedKey);
    setApiKey('');
    onKeySelectionAttempt();
  };

  return (
    <div
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{ pointerEvents: 'auto' }}
    >
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 relative transform transition-all border border-slate-800/50 overflow-hidden animate-scale-in" style={{ pointerEvents: 'auto' }}>
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 aurora-glow"></div>

        <h2 id="modal-title" className="text-2xl font-bold text-slate-100 mt-4 mb-2">Vyžadován Google Gemini API Klíč</h2>
        <p className="text-slate-400 mb-4">
          Pro využití AI funkcí v této aplikaci je nutné zadat váš Google API klíč.
        </p>
        <p className="text-sm text-slate-400 mb-6">
          Klíč můžete zdarma získat v <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline font-medium">Google AI Studiu</a>. Ujistěte se, že máte na svém účtu povolenou fakturaci. Více informací naleznete v <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline font-medium">dokumentaci k fakturaci</a>.
        </p>

        {isInAIStudio ? (
          // AI Studio mode: Show button to open native picker
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
        ) : (
          // Standalone mode: Show input field
          <div className="mt-6">
            <label htmlFor="api-key-input" className="block text-sm font-medium text-slate-300 mb-2">
              Váš Google Gemini API klíč
            </label>
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSaveKey()}
              placeholder="Zadejte váš API klíč..."
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              autoFocus
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleSaveKey}
                className="btn-primary aurora-glow inline-flex items-center justify-center gap-2 px-6 py-3 border border-transparent text-base font-bold rounded-xl shadow-2xl text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500 transform transition-all hover:-translate-y-0.5 hover:scale-105 active:translate-y-0 active:scale-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span>Uložit API klíč</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiKeyModal;