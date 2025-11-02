
import React from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
        className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 relative transform transition-all"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Google Gemini API Klíč</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          Pro využití AI funkcí je nutné nastavit váš Google API klíč jako proměnnou prostředí <code className="bg-slate-200 dark:bg-slate-700 p-1 rounded-md text-sm">API_KEY</code>. Klíč můžete zdarma získat v <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline font-medium">Google AI Studiu</a>.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tato aplikace byla nakonfigurována tak, aby používala klíč výhradně z proměnných prostředí z bezpečnostních důvodů.</p>


        <div className="mt-8 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-slate-500 transition-colors"
          >
            Rozumím
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;