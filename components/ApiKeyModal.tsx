
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
    // After the user interacts with the dialog, trigger a re-check in the parent component.
    onKeySelectionAttempt();
  };

  return (
    <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 relative transform transition-all border border-slate-200 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Vyžadován Google Gemini API Klíč</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          Pro využití AI funkcí v této aplikaci je nutné vybrat váš Google API klíč.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Klíč můžete zdarma získat v <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline font-medium">Google AI Studiu</a>. Ujistěte se, že máte na svém účtu povolenou fakturaci. Více informací naleznete v <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline font-medium">dokumentaci k fakturaci</a>.
        </p>
        
        <div className="mt-8 flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleSelectKey}
            className="w-full inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-sky-500"
          >
            Vybrat API klíč
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;