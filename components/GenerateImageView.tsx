
import React, { useState } from 'react';
import { generateImage } from '../services/geminiService';
import { base64ToFile } from '../utils/imageProcessor';
import { GenerateImageIcon, UploadIcon } from './icons';

interface GenerateImageViewProps {
    isApiKeyAvailable: boolean;
    onImageGenerated: (file: File) => void;
}

const ApiKeyWarning: React.FC = () => (
    <div className="mt-4 p-3 bg-yellow-100/80 dark:bg-yellow-900/30 border border-yellow-400/50 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
        Pro použití této funkce je vyžadován API klíč. Klikněte na ikonu klíče v záhlaví a zadejte svůj klíč.
    </div>
);

const GenerateImageView: React.FC<GenerateImageViewProps> = ({ isApiKeyAvailable, onImageGenerated }) => {
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
            setError(err instanceof Error ? err.message : 'Došlo k neznámé chybě při generování obrázku.');
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
        <div className="h-full w-full flex flex-col items-center justify-center p-4 sm:p-8 bg-slate-100 dark:bg-slate-950">
            <div className="w-full max-w-4xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Vytvořte cokoliv s AI</h1>
                    <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
                        Popište obrázek, který si přejete vygenerovat, a nechte AI, aby ho vytvořila za vás.
                    </p>
                </div>
                
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                            <label htmlFor="prompt" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Popis obrázku (prompt)
                            </label>
                            <textarea
                                id="prompt"
                                rows={4}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="např. Fotorealistický portrét astronauta jedoucího na koni na Marsu"
                                className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                            />
                            {!isApiKeyAvailable ? (
                                <ApiKeyWarning />
                            ) : (
                                <button
                                    onClick={handleGenerate}
                                    disabled={isLoading || !prompt.trim()}
                                    className="mt-4 w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400/50 disabled:cursor-not-allowed"
                                >
                                    <GenerateImageIcon className="-ml-1 mr-3 h-5 w-5" />
                                    {isLoading ? 'Generuji...' : 'Generovat obrázek'}
                                </button>
                            )}
                            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
                        </div>

                        <div className="md:w-72 flex-shrink-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/50 rounded-lg p-4 aspect-square">
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center text-slate-500">
                                    <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <p className="mt-3 text-sm">Chvilku strpení...</p>
                                </div>
                            )}
                            {!isLoading && generatedImage && (
                                <div className="w-full h-full flex flex-col">
                                    <img src={generatedImage} alt="Vygenerovaný obrázek" className="w-full h-full object-contain rounded-md flex-1" />
                                    <button
                                        onClick={handleAddToProject}
                                        className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                                    >
                                        <UploadIcon className="-ml-1 mr-2 h-5 w-5" />
                                        Přidat do projektu
                                    </button>
                                </div>
                            )}
                            {!isLoading && !generatedImage && (
                                <div className="text-center text-slate-500 dark:text-slate-400">
                                    <GenerateImageIcon className="mx-auto h-12 w-12 mb-2" />
                                    <p>Váš vygenerovaný obrázek se zobrazí zde.</p>
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
