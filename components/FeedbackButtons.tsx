
import React, { useState, useEffect } from 'react';
import { ThumbsUpIcon, ThumbsDownIcon } from './icons';
import type { Feedback } from '../types';

interface FeedbackButtonsProps {
  onFeedback: (feedback: Feedback) => void;
  onTimeout: () => void;
}

const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({ onFeedback, onTimeout }) => {
  const [isFading, setIsFading] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Feedback | null>(null);

  useEffect(() => {
    // Show for 15 seconds to give user enough time to evaluate
    const timer = setTimeout(() => {
      if (!feedbackGiven) {
          setIsFading(true);
          setTimeout(onTimeout, 500);
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, [onTimeout, feedbackGiven]);

  const handleFeedbackClick = (feedback: Feedback) => {
    setFeedbackGiven(feedback);
    onFeedback(feedback);
    // Determine fade out logic based on feedback
    setTimeout(() => {
        setIsFading(true);
        setTimeout(onTimeout, 500);
    }, 1500);
  };

  return (
    <div className={`transition-all duration-500 transform ${isFading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
        <div className="flex flex-col items-center gap-3 bg-slate-900/90 backdrop-blur-xl px-6 py-4 rounded-2xl border border-slate-700 shadow-2xl ring-1 ring-slate-800">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Hodnocení AI výsledku</p>
            
            <div className="flex items-center gap-6">
                {/* DISLIKE BUTTON - RED */}
                <button
                    onClick={() => handleFeedbackClick('bad')}
                    disabled={!!feedbackGiven}
                    className={`group flex flex-col items-center gap-1 transition-all duration-300 ${
                        feedbackGiven === 'bad' 
                            ? 'scale-110' 
                            : feedbackGiven === 'good'
                                ? 'opacity-20 grayscale'
                                : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    title="Nelíbí se mi (AI se z toho poučí)"
                >
                    <div className={`p-4 rounded-2xl border-2 transition-all duration-300 ${
                         feedbackGiven === 'bad'
                            ? 'bg-red-500 text-white border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                            : 'bg-slate-800/50 border-slate-600 text-slate-400 group-hover:border-red-500 group-hover:text-red-400 group-hover:bg-red-500/10'
                    }`}>
                        <ThumbsDownIcon className="w-8 h-8" />
                    </div>
                </button>

                <div className="w-px h-10 bg-slate-700/50"></div>

                {/* LIKE BUTTON - GREEN */}
                <button
                    onClick={() => handleFeedbackClick('good')}
                    disabled={!!feedbackGiven}
                    className={`group flex flex-col items-center gap-1 transition-all duration-300 ${
                        feedbackGiven === 'good' 
                            ? 'scale-110' 
                            : feedbackGiven === 'bad'
                                ? 'opacity-20 grayscale'
                                : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    title="Líbí se mi (Uložit preferenci)"
                >
                    <div className={`p-4 rounded-2xl border-2 transition-all duration-300 ${
                         feedbackGiven === 'good'
                            ? 'bg-green-500 text-white border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                            : 'bg-slate-800/50 border-slate-600 text-slate-400 group-hover:border-green-500 group-hover:text-green-400 group-hover:bg-green-500/10'
                    }`}>
                        <ThumbsUpIcon className="w-8 h-8" />
                    </div>
                </button>
            </div>

            {feedbackGiven && (
                <div className="mt-1 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 animate-fade-in-up">
                    <p className={`text-xs font-medium ${feedbackGiven === 'good' ? 'text-green-400' : 'text-red-400'}`}>
                        {feedbackGiven === 'good' ? 'Preference uložena' : 'Budeme ladit model'}
                    </p>
                </div>
            )}
        </div>
    </div>
  );
};

export default FeedbackButtons;
