import React from 'react';
import type { ManualEdits } from '../types';

interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ label, value, min = -100, max = 100, step = 1, onChange }) => (
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
      className="custom-slider"
    />
  </div>
);

interface ManualEditControlsProps {
  edits: ManualEdits;
  onEditChange: <K extends keyof ManualEdits>(key: K, value: ManualEdits[K]) => void;
  onReset: () => void;
}

const ManualEditControls: React.FC<ManualEditControlsProps> = ({ edits, onEditChange, onReset }) => {
  return (
    <div className="p-4 space-y-5 animate-fade-in-right">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-100">Manuální úpravy</h3>
        <button onClick={onReset} className="text-sm font-medium text-cyan-400 hover:underline">Resetovat</button>
      </div>

      <Slider label="Jas" value={edits.brightness} onChange={(v) => onEditChange('brightness', v)} />
      <Slider label="Kontrast" value={edits.contrast} onChange={(v) => onEditChange('contrast', v)} />
      <Slider label="Sytost" value={edits.saturation} onChange={(v) => onEditChange('saturation', v)} />
      <Slider label="Živost" value={edits.vibrance} onChange={(v) => onEditChange('vibrance', v)} />
      <Slider label="Stíny" value={edits.shadows} onChange={(v) => onEditChange('shadows', v)} />
      <Slider label="Světlé tóny" value={edits.highlights} onChange={(v) => onEditChange('highlights', v)} />
      <Slider label="Zřetelnost" value={edits.clarity} min={0} onChange={(v) => onEditChange('clarity', v)} />
      <Slider label="Ostrost" value={edits.sharpness} min={0} onChange={(v) => onEditChange('sharpness', v)} />
      <Slider label="Redukce šumu" value={edits.noiseReduction} min={0} onChange={(v) => onEditChange('noiseReduction', v)} />
    </div>
  );
};

export default ManualEditControls;