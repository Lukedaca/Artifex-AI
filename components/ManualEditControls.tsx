
import React from 'react';
import type { ManualEdits } from '../types';
import { AutoCropIcon, ExportIcon } from './icons';

interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  onAfterChange: () => void; // Triggered on mouse up / touch end
}

const Slider: React.FC<SliderProps> = ({ label, value, min = -100, max = 100, step = 1, onChange, onAfterChange }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <span className="text-sm font-mono text-slate-400 w-12 text-right">{value.toFixed(0)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onMouseUp={onAfterChange}
      onTouchEnd={onAfterChange}
      onKeyUp={onAfterChange}
      className="custom-slider"
    />
  </div>
);

interface ManualEditControlsProps {
  edits: ManualEdits;
  onEditChange: <K extends keyof ManualEdits>(key: K, value: ManualEdits[K]) => void;
  onReset: () => void;
  exportOptions: { format: string; quality: number; scale: number };
  onExportOptionsChange: (options: { format: string; quality: number; scale: number }) => void;
  onRequestExport: () => void;
  onStartManualCrop: () => void; // Trigger for classic crop
  onSnapshot: () => void; // Request to save current state to history
}

const ASPECT_RATIOS = [
    { label: 'Orig.', value: undefined }, // undefined means no crop
    { label: '1:1', value: 1 },
    { label: '16:9', value: 16/9 },
    { label: '4:3', value: 4/3 },
    { label: '3:2', value: 3/2 },
];

const ManualEditControls: React.FC<ManualEditControlsProps> = ({ 
    edits, 
    onEditChange, 
    onReset,
    exportOptions,
    onExportOptionsChange,
    onRequestExport,
    onStartManualCrop,
    onSnapshot
}) => {

  // Wrapper to handle edit change but NOT trigger snapshot yet
  const handleChange = <K extends keyof ManualEdits>(key: K, value: ManualEdits[K]) => {
      onEditChange(key, value);
  };

  return (
    <div className="p-4 space-y-5 animate-fade-in-right pb-20"> {/* Extra padding bottom for export button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-100">Manuální úpravy</h3>
        <button onClick={onReset} className="text-sm font-medium text-cyan-400 hover:underline">Resetovat</button>
      </div>

      {/* Crop Section */}
      <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="flex items-center gap-2">
              <AutoCropIcon className="w-4 h-4 text-cyan-400" />
              <label className="text-sm font-medium text-slate-300">Oříznutí</label>
          </div>
          
          <button 
              onClick={onStartManualCrop}
              className="w-full flex items-center justify-center px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors border border-slate-600"
          >
              <span className="mr-2">✂️</span> Aktivovat manuální ořez
          </button>

          <div className="pt-2 border-t border-slate-700/50">
            <label className="text-xs text-slate-400 mb-1 block">Rychlý ořez (Střed)</label>
            <div className="grid grid-cols-5 gap-1">
                {ASPECT_RATIOS.map((ratio) => (
                    <button
                        key={ratio.label}
                        onClick={() => { handleChange('aspectRatio', ratio.value); onSnapshot(); }}
                        className={`px-1 py-1.5 text-[10px] font-medium rounded border transition-all ${
                            edits.aspectRatio === ratio.value
                                ? 'bg-cyan-500/20 border-cyan-500 text-white'
                                : 'border-slate-600 hover:bg-slate-700 text-slate-400'
                        }`}
                    >
                        {ratio.label}
                    </button>
                ))}
            </div>
          </div>
      </div>

      <Slider label="Jas" value={edits.brightness} onChange={(v) => handleChange('brightness', v)} onAfterChange={onSnapshot} />
      <Slider label="Kontrast" value={edits.contrast} onChange={(v) => handleChange('contrast', v)} onAfterChange={onSnapshot} />
      <Slider label="Sytost" value={edits.saturation} onChange={(v) => handleChange('saturation', v)} onAfterChange={onSnapshot} />
      <Slider label="Živost" value={edits.vibrance} onChange={(v) => handleChange('vibrance', v)} onAfterChange={onSnapshot} />
      <Slider label="Stíny" value={edits.shadows} onChange={(v) => handleChange('shadows', v)} onAfterChange={onSnapshot} />
      <Slider label="Světlé tóny" value={edits.highlights} onChange={(v) => handleChange('highlights', v)} onAfterChange={onSnapshot} />
      <Slider label="Zřetelnost" value={edits.clarity} min={0} onChange={(v) => handleChange('clarity', v)} onAfterChange={onSnapshot} />
      <Slider label="Ostrost" value={edits.sharpness} min={0} onChange={(v) => handleChange('sharpness', v)} onAfterChange={onSnapshot} />
      <Slider label="Redukce šumu" value={edits.noiseReduction} min={0} onChange={(v) => handleChange('noiseReduction', v)} onAfterChange={onSnapshot} />

      <hr className="border-slate-700/50 my-4" />

      {/* Export Settings inside Manual Edits */}
      <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Nastavení Exportu</h4>
          
          {/* Format Selector */}
          <div className="grid grid-cols-2 gap-2">
              <button 
                  onClick={() => onExportOptionsChange({...exportOptions, format: 'jpeg'})} 
                  className={`px-3 py-2 text-xs rounded border transition-all ${exportOptions.format === 'jpeg' ? 'bg-cyan-500/20 border-cyan-500 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
              >
                  JPEG
              </button>
              <button 
                  onClick={() => onExportOptionsChange({...exportOptions, format: 'png'})} 
                  className={`px-3 py-2 text-xs rounded border transition-all ${exportOptions.format === 'png' ? 'bg-cyan-500/20 border-cyan-500 text-white' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
              >
                  PNG
              </button>
          </div>

          {/* Quality Slider (JPEG only) */}
          {exportOptions.format === 'jpeg' && (
              <div className="space-y-1">
                   <div className="flex justify-between">
                      <label className="text-xs text-slate-400">Kvalita</label>
                      <span className="text-xs text-slate-400">{exportOptions.quality}%</span>
                   </div>
                   <input
                      type="range" min="1" max="100" value={exportOptions.quality}
                      onChange={(e) => onExportOptionsChange({...exportOptions, quality: Number(e.target.value)})}
                      className="custom-slider h-1"
                  />
              </div>
          )}

          <button 
              onClick={onRequestExport} 
              className="w-full aurora-glow flex items-center justify-center px-4 py-3 mt-4 border border-transparent text-sm font-bold rounded-lg shadow-lg text-white bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:bg-cyan-600 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
              <ExportIcon className="w-4 h-4 mr-2" />
              Dokončit a Exportovat
          </button>
      </div>
    </div>
  );
};

export default ManualEditControls;
