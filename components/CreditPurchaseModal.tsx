
import React from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { SparklesIcon, XIcon, KeyIcon } from './icons';

interface CreditPurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPurchase: (amount: number) => void;
}

const CreditPurchaseModal: React.FC<CreditPurchaseModalProps> = ({ isOpen, onClose, onPurchase }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    const packages = [
        { name: t.store_pack_basic, amount: 50, price: "$4.99", color: "from-cyan-500 to-blue-500", popular: false },
        { name: t.store_pack_pro, amount: 150, price: "$12.99", color: "from-fuchsia-500 to-purple-600", popular: true },
        { name: t.store_pack_ultra, amount: 500, price: "$34.99", color: "from-amber-400 to-orange-500", popular: false },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl relative">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-all z-10"
                >
                    <XIcon className="w-5 h-5" />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Left: Info */}
                    <div className="p-8 md:p-12 flex flex-col justify-center bg-slate-800/30">
                        <div className="w-16 h-16 bg-amber-400/10 rounded-2xl flex items-center justify-center mb-6">
                            <SparklesIcon className="w-8 h-8 text-amber-400" />
                        </div>
                        <h2 className="text-3xl font-black text-white mb-4">{t.store_title}</h2>
                        <p className="text-slate-400 leading-relaxed mb-6">
                            {t.store_desc}
                        </p>
                        <ul className="space-y-3 text-sm text-slate-300">
                            <li className="flex items-center gap-2">
                                <span className="text-green-400">✓</span> Gemini 3 Pro Quality
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-green-400">✓</span> Veo Video Generation
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-green-400">✓</span> YouTube Thumbnails
                            </li>
                        </ul>
                    </div>

                    {/* Right: Packages */}
                    <div className="p-8 bg-slate-900 flex flex-col gap-4 justify-center">
                        {packages.map((pkg, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => onPurchase(pkg.amount)}
                                className={`relative group cursor-pointer p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-all transform hover:scale-[1.02] ${pkg.popular ? 'ring-2 ring-fuchsia-500 border-transparent' : ''}`}
                            >
                                {pkg.popular && (
                                    <span className="absolute -top-3 right-4 bg-fuchsia-600 text-[10px] font-bold px-2 py-0.5 rounded-full text-white uppercase tracking-wider">
                                        {t.store_best_value}
                                    </span>
                                )}
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${pkg.color} flex items-center justify-center shadow-lg`}>
                                            <SparklesIcon className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">{pkg.name}</h3>
                                            <p className="text-xs text-slate-400 font-bold">{pkg.amount} Credits</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="block font-black text-white text-lg">{pkg.price}</span>
                                        <span className="text-[10px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase font-bold">{t.store_btn_buy}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreditPurchaseModal;
