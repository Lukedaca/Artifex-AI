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
    const timer = setTimeout(() => {
      setIsFading(true);
      setTimeout(onTimeout, 300); // Wait for fade out animation
    }, 10000); // 10 second timeout

    return () => clearTimeout(timer);
  }, [onTimeout]);

  const handleFeedbackClick = (feedback: Feedback) => {
    setFeedbackGiven(feedback);
    onFeedback(feedback);
    setIsFading(true);
    setTimeout(onTimeout, 300);
  };

  const getButtonClass = (type: Feedback) => {
    if (feedbackGiven) {
      return feedbackGiven === type ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'opacity-50';
    }
    return 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800';
  };

  return (
    <div className={`transition-all duration-300 ${isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        <div className="flex flex-col items-center gap-3 bg-slate-900/40 backdrop-blur-sm p-3 rounded-lg border border-slate-800/40">
            <p className="text-xs text-slate-400 font-medium">Jak se AI povedl výsledek?</p>
            <div className="flex items-center space-x-2">
                <button
                    onClick={() => handleFeedbackClick('good')}
                    disabled={!!feedbackGiven}
                    className={`p-2 rounded-full border transition-all ${getButtonClass('good')}`}
                    aria-label="Dobrá práce"
                >
                    <ThumbsUpIcon className="w-5 h-5" />
                </button>
                <button
                    onClick={() => handleFeedbackClick('bad')}
                    disabled={!!feedbackGiven}
                    className={`p-2 rounded-full border transition-all ${getButtonClass('bad')}`}
                    aria-label="Špatná práce"
                >
                    <ThumbsDownIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    </div>
  );
};

export default FeedbackButtons;