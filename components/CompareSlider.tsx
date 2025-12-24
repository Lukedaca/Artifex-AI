
import React, { useState, useRef, useEffect } from 'react';

interface CompareSliderProps {
    beforeUrl: string;
    afterUrl: string;
}

const CompareSlider: React.FC<CompareSliderProps> = ({ beforeUrl, afterUrl }) => {
    const [sliderPos, setSliderPos] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const handleMove = (clientX: number) => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
            setSliderPos((x / rect.width) * 100);
        }
    };

    const onMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        handleMove(e.clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        handleMove(e.touches[0].clientX);
    };

    useEffect(() => {
        const onMouseUp = () => isDragging.current = false;
        const onMouseMove = (e: MouseEvent) => {
            if (isDragging.current) handleMove(e.clientX);
        };

        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('mousemove', onMouseMove);
        return () => {
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('mousemove', onMouseMove);
        };
    }, []);

    return (
        <div 
            ref={containerRef} 
            className="relative w-full h-full select-none overflow-hidden cursor-col-resize group"
            onMouseDown={onMouseDown}
            onTouchMove={onTouchMove}
        >
            {/* Background (After Image) */}
            <img src={afterUrl} alt="After" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />

            {/* Foreground (Before Image) - Clipped */}
            <div 
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
            >
                <img src={beforeUrl} alt="Before" className="absolute inset-0 w-full h-full object-contain" />
                <div className="absolute top-4 left-4 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur">PŘED</div>
            </div>
            
            <div className="absolute top-4 right-4 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur pointer-events-none">PO</div>

            {/* Slider Handle */}
            <div 
                className="absolute top-0 bottom-0 w-1 bg-white cursor-col-resize z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                style={{ left: `${sliderPos}%` }}
            >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l-3 3 3 3m8-6l3 3-3 3" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default CompareSlider;
