import React, { useState, useEffect } from 'react';
import { getApiKey, setApiKey, clearApiKey } from '../utils/apiKey';

interface ApiKeyModalProps {
  isOpen: boolean;
  onKeySelectionAttempt: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onKeySelectionAttempt }) => {
  const [inputKey, setInputKey] = useState('');
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCurrentKey = async () => {
      try {
        const key = await getApiKey();
        setCurrentKey(key);
      } catch {
        setCurrentKey(null);
      }
    };
    if (isOpen) {
      loadCurrentKey();
    }
  }, [isOpen]);

  const handleSave = async () => {
    setError(null);

    if (!inputKey.trim()) {
      setError('Prosím zadejte API klíč');
      return;
    }

    setIsLoading(true);
    try {
      await setApiKey(inputKey);
      setCurrentKey(inputKey);
      setInputKey('');
      onKeySelectionAttempt();
    } catch (err) {
      setError('Chyba při ukládání API klíče');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    setIsLoading(true);
    try {
      await clearApiKey();
      setCurrentKey(null);
      setInputKey('');
    } catch (err) {
      setError('Chyba při mazání API klíče');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setInputKey('');
    setError(null);
    onKeySelectionAttempt();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[10000] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-purple-500"></div>

        <div className="p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-2">
                🔑 Google Gemini API Klíč
              </h2>
              <p className="text-slate-400 text-sm">
                BYOK (Bring Your Own Key) - Použijte svůj vlastní klíč
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Info boxes */}
          <div className="space-y-3 mb-6">
            <div className="bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 border border-cyan-500/20 rounded-xl p-4">
              <h3 className="text-cyan-300 font-semibold mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Co je to BYOK?
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                BYOK (Bring Your Own Key) znamená, že používáte <strong>svůj vlastní</strong> Google Gemini API klíč.
                Vaše fotografie se zpracovávají přes Google AI, ale <strong>vy máte plnou kontrolu</strong> nad náklady a využitím.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-green-400 font-semibold text-sm mb-1">✅ Zdarma na začátek</div>
                <div className="text-slate-400 text-xs">Google dává $300 free credits</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-purple-400 font-semibold text-sm mb-1">🔒 Soukromí</div>
                <div className="text-slate-400 text-xs">Klíč jen ve vašem prohlížeči</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-cyan-400 font-semibold text-sm mb-1">⚡ Top kvalita</div>
                <div className="text-slate-400 text-xs">Gemini 2.0 Flash AI</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="text-fuchsia-400 font-semibold text-sm mb-1">💰 Kontrola nákladů</div>
                <div className="text-slate-400 text-xs">Platíte jen co použijete</div>
              </div>
            </div>
          </div>

          {/* Current key status */}
          {currentKey && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-green-400 font-semibold mb-1">✓ API klíč je aktivní</div>
                  <div className="text-slate-400 text-sm font-mono">
                    {currentKey.substring(0, 8)}...{currentKey.substring(currentKey.length - 4)}
                  </div>
                </div>
                <button
                  onClick={handleClear}
                  disabled={isLoading}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                >
                  Odebrat klíč
                </button>
              </div>
            </div>
          )}

          {/* Input section */}
          <div className="mb-6">
            <label className="block text-slate-300 font-medium mb-3">
              Váš Google Gemini API klíč:
            </label>

            <div className="relative">
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="AIza..."
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono text-sm"
                disabled={isLoading}
              />
              {inputKey && (
                <button
                  onClick={() => setInputKey('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {error && (
              <p className="mt-2 text-red-400 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}

            <div className="mt-3 flex items-start gap-2 text-slate-400 text-xs">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>
                Váš API klíč se ukládá pouze do localStorage vašeho prohlížeče a nikdy není sdílen s nikým jiným.
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 hover:from-cyan-500/30 hover:to-fuchsia-500/30 border border-cyan-500/30 text-cyan-300 rounded-xl transition-all text-center font-medium flex items-center justify-center gap-2 group"
            >
              <span>Získat klíč zdarma</span>
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            <button
              onClick={handleSave}
              disabled={isLoading || !inputKey.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-white rounded-xl transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Ukládám...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Uložit klíč</span>
                </>
              )}
            </button>
          </div>

          {/* Continue without key button */}
          <button
            onClick={handleClose}
            className="w-full mt-3 px-6 py-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            Pokračovat bez klíče (manuální úpravy)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
