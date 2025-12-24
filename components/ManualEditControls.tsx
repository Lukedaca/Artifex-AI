
import React, { useState } from 'react';
import type { ManualEdits, WatermarkSettings } from '../types';
import { AutoCropIcon, ExportIcon, WatermarkIcon } from './icons';
import { useTranslation } from '../contexts/LanguageContext';

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
  const { t } = useTranslation();
  const [showWatermark, setShowWatermark] = useState(false);

  // Wrapper to handle edit change but NOT trigger snapshot yet
  const handleChange = <K extends keyof ManualEdits>(key: K, value: ManualEdits[K]) => {
      onEditChange(key, value);
  };

  const updateWatermark = (updates: Partial<WatermarkSettings>) => {
      const current = edits.watermark || { enabled: false, text: '', opacity: 50, size: 20, position: 'bottom-right', color: '#ffffff' };
      handleChange('watermark', { ...current, ...updates });
      onSnapshot();
  };

  const ASPECT_RATIOS = [
      { label: t.export_original, value: undefined }, // undefined means no crop
      { label: '1:1', value: 1 },
      { label: '16:9', value: 16/9 },
      { label: '4:3', value: 4/3 },
      { label: '3:2', value: 3/2 },
  ];

  return (
    <div className="p-4 space-y-5 animate-fade-in-right pb-20"> {/* Extra padding bottom for export button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-100">{t.manual_title}</h3>
        <button onClick={onReset} className="text-sm font-medium text-cyan-400 hover:underline">{t.manual_reset}</button>
      </div>

      {/* Crop Section */}
      <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="flex items-center gap-2">
              <AutoCropIcon className="w-4 h-4 text-cyan-400" />
              <label className="text-sm font-medium text-slate-300">{t.tool_crop_title}</label>
          </div>
          
          <button 
              onClick={onStartManualCrop}
              className="w-full flex items-center justify-center px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors border border-slate-600"
          >
              <span className="mr-2">✂️</span> {t.manual_crop_active}
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

      <Slider label={t.manual_brightness} value={edits.brightness} onChange={(v) => handleChange('brightness', v)} onAfterChange={onSnapshot} />
      <Slider label={t.manual_contrast} value={edits.contrast} onChange={(v) => handleChange('contrast', v)} onAfterChange={onSnapshot} />
      <Slider label={t.manual_saturation} value={edits.saturation} onChange={(v) => handleChange('saturation', v)} onAfterChange={onSnapshot} />
      <Slider label={t.manual_vibrance} value={edits.vibrance} onChange={(v) => handleChange('vibrance', v)} onAfterChange={onSnapshot} />
      <Slider label={t.manual_shadows} value={edits.shadows} onChange={(v) => handleChange('shadows', v)} onAfterChange={onSnapshot} />
      <Slider label={t.manual_highlights} value={edits.highlights} onChange={(v) => handleChange('highlights', v)} onAfterChange={onSnapshot} />
      <Slider label={t.manual_clarity} value={edits.clarity} min={0} onChange={(v) => handleChange('clarity', v)} onAfterChange={onSnapshot} />
      <Slider label={t.manual_sharpness} value={edits.sharpness} min={0} onChange={(v) => handleChange('sharpness', v)} onAfterChange={onSnapshot} />
      <Slider label={t.manual_noise} value={edits.noiseReduction} min={0} onChange={(v) => handleChange('noiseReduction', v)} onAfterChange={onSnapshot} />

      {/* Watermark Section */}
      <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <button onClick={() => setShowWatermark(!showWatermark)} className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
                <WatermarkIcon className="w-4 h-4 text-cyan-400" />
                <label className="text-sm font-medium text-slate-300">Inteligentní Vodoznak</label>
            </div>
            <span className="text-xs text-slate-500">{showWatermark ? '▼' : '▶'}</span>
          </button>
          
          {showWatermark && (
              <div className="space-y-3 pt-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                     <span className="text-xs text-slate-400">Aktivovat</span>
                     <input type="checkbox" checked={edits.watermark?.enabled || false} onChange={(e) => updateWatermark({ enabled: e.target.checked })} />
                  </div>
                  {edits.watermark?.enabled && (
                      <>
                        <input 
                            type="text" 
                            value={edits.watermark?.text || ''} 
                            onChange={(e) => updateWatermark({ text: e.target.value })}
                            placeholder="© Váš text"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                        />
                        <div className="grid grid-cols-2 gap-2">
                             <input 
                                type="color" 
                                value={edits.watermark?.color || '#ffffff'}
                                onChange={(e) => updateWatermark({ color: e.target.value })}
                                className="w-full h-8 bg-transparent cursor-pointer"
                             />
                             <select 
                                value={edits.watermark?.position || 'bottom-right'}
                                onChange={(e) => updateWatermark({ position: e.target.value as any })}
                                className="bg-slate-900 border border-slate-700 rounded text-xs text-white"
                             >
                                 <option value="bottom-right">Vpravo dole</option>
                                 <option value="bottom-left">Vlevo dole</option>
                                 <option value="center">Střed</option>
                                 <option value="tiled">Opakovat (Tiled)</option>
                             </select>
                        </div>
                        <div className="space-y-1">
                             <label className="text-[10px] text-slate-500">Průhlednost</label>
                             <input type="range" min="10" max="100" value={edits.watermark?.opacity || 50} onChange={(e) => updateWatermark({ opacity: Number(e.target.value) })} className="custom-slider h-1" />
                        </div>
                      </>
                  )}
              </div>
          )}
      </div>

      <hr className="border-slate-700/50 my-4" />

      {/* Export Settings inside Manual Edits */}
      <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">{t.manual_export_settings}</h4>
          
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
                      <label className="text-xs text-slate-400">{t.export_quality}</label>
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
              {t.manual_finish}
          </button>
      </div>
    </div>
  );
};

export default ManualEditControls;
