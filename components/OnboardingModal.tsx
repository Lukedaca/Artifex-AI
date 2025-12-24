
import React, { useState } from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { LogoIcon, AutopilotIcon, YoutubeIcon, SparklesIcon } from './icons';

interface OnboardingModalProps {
    onComplete: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: t.onboarding_step1_title,
            desc: t.onboarding_step1_desc,
            icon: <LogoIcon className="w-20 h-20 text-cyan-400" />
        },
        {
            title: t.onboarding_step2_title,
            desc: t.onboarding_step2_desc,
            icon: <AutopilotIcon className="w-20 h-20 text-fuchsia-500" />
        },
        {
            title: t.onboarding_step3_title,
            desc: t.onboarding_step3_desc,
            icon: <div className="relative">
                    <SparklesIcon className="w-20 h-20 text-amber-400" />
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">50 Free</span>
                  </div>
        }
    ];

    const handleNext = () => {
        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            onComplete();
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl relative">
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20"></div>
                
                <div className="relative p-8 flex flex-col items-center text-center">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">{t.onboarding_title}</h2>
                    
                    <div className="mb-8 p-6 bg-slate-800/50 rounded-full shadow-inner border border-slate-700">
                        {steps[step].icon}
                    </div>

                    <h3 className="text-2xl font-black text-white mb-3 animate-fade-in-up">{steps[step].title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8 min-h-[60px] animate-fade-in-up">
                        {steps[step].desc}
                    </p>

                    <div className="flex gap-2 mb-8">
                        {steps.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-cyan-500' : 'w-2 bg-slate-700'}`}></div>
                        ))}
                    </div>

                    <button 
                        onClick={handleNext}
                        className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-600 hover:to-fuchsia-700 transition-all transform hover:-translate-y-1 shadow-lg aurora-glow"
                    >
                        {step === steps.length - 1 ? t.onboarding_btn_start : t.onboarding_btn_next}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingModal;
