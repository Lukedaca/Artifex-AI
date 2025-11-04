import React, { useState } from 'react';
import { generateImage } from '../services/geminiService';
import { base64ToFile } from '../utils/imageProcessor';
import { GenerateImageIcon, UploadIcon } from './icons';

// Helper to create more user-friendly API error messages
const getApiErrorMessage = (error: unknown, defaultMessage: string = 'Došlo k neznámé chybě.'): string => {
    if (error instanceof Error) {
        if (error.message.toLowerCase().includes('api key') || error.message.toLowerCase().includes('auth')) {
            return 'API klíč není platný nebo chybí. Zkontrolujte prosím, zda je správně nastaven.';
        }
        return error.message;
    }
    return defaultMessage;
};

// FIX: Defined missing props interface for GenerateImageView component.
interface GenerateImageViewProps {
    onImageGenerated: (file: File) => void;
}

const GenerateImageView: React.FC<GenerateImageViewProps> = ({ onImageGenerated }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);
        try {
            const base64Image = await generateImage(prompt);
            setGeneratedImage(`data:image/jpeg;base64,${base64Image}`);
        } catch (err) {
            setError(getApiErrorMessage(err, 'Došlo k neznámé chybě při generování obrázku.'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddToProject = async () => {
        if (!generatedImage) return;
        try {
            const file = await base64ToFile(generatedImage.split(',')[1], `${prompt.substring(0, 30).replace(/\s/g, '_') || 'generated'}.jpeg`, 'image/jpeg');
            onImageGenerated(file);
        } catch (err) {
            setError('Nepodařilo se přidat obrázek do projektu.');
        }
    };

    return (
        <div className="h-full w-full flex flex-col items-center justify-center p-4 sm:p-8">
            <div className="w-full max-w-5xl">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Vytvořte cokoliv s AI</h1>
                    <p className="mt-3 text-xl text-slate-500 dark:text-slate-400 max-w-3xl mx-auto">
                        Popište obrázek, který si přejete vygenerovat, a nechte AI, aby ho vytvořila za vás.
                    </p>
                </div>
                
                <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-800/50">
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex-1">
                            <label htmlFor="prompt" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Popis obrázku (prompt)
                            </label>
                            <textarea
                                id="prompt"
                                rows={5}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="např. Fotorealistický portrét astronauta jedoucího na koni na Marsu"
                                className="block w-full border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm text-base p-3 transition-shadow"
                            />
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading || !prompt.trim()}
                                className="mt-6 w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5 active:translate-y-0 aurora-glow"
                            >
                                <GenerateImageIcon className="-ml-1 mr-3 h-5 w-5" />
                                {isLoading ? 'Generuji...' : 'Generovat obrázek'}
                            </button>
                            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-500/10 p-3 rounded-md border border-red-500/20">{error}</p>}
                        </div>

                        <div className="md:w-96 flex-shrink-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/60 rounded-lg p-4 aspect-square">
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center text-slate-500">
                                    <svg className="animate-spin h-12 w-12 text-fuchsia-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <p className="mt-4 text-lg font-semibold">Chvilku strpení...</p>
                                </div>
                            )}
                            {!isLoading && generatedImage && (
                                <div className="w-full h-full flex flex-col animate-fade-in">
                                    <img src={generatedImage} alt="Vygenerovaný obrázek" className="w-full h-full object-contain rounded-md flex-1" />
                                    <button
                                        onClick={handleAddToProject}
                                        className="mt-4 w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-lg text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 transition transform hover:-translate-y-0.5 active:translate-y-0"
                                    >
                                        <UploadIcon className="-ml-1 mr-2 h-5 w-5" />
                                        Přidat do projektu
                                    </button>
                                </div>
                            )}
                            {!isLoading && !generatedImage && (
                                <div className="text-center text-slate-500 dark:text-slate-400">
                                    <GenerateImageIcon className="mx-auto h-16 w-16 mb-4" />
                                    <p className="text-lg">Váš vygenerovaný obrázek se zobrazí zde.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GenerateImageView;