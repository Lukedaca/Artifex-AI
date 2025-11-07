// FIX: Define all necessary types for the application.

export interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string;
  originalPreviewUrl: string; // Added for before/after comparison
  analysis?: AnalysisResult;
  isAnalyzing?: boolean;
}

export interface ProactiveSuggestion {
  text: string;
  action: 'remove-object' | 'auto-crop';
}

export interface AnalysisResult {
  description: string;
  suggestions: string[];
  technicalInfo: {
    ISO: string;
    Aperture: string;
    ShutterSpeed: string;
  };
  proactiveSuggestions?: ProactiveSuggestion[];
}

export interface ManualEdits {
  brightness: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  shadows: number;
  highlights: number;
  clarity: number;
  crop?: CropCoordinates;
}

export interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type EditorAction = {
  action: string;
  timestamp: number;
} | null;

export type View = 'home' | 'upload' | 'editor' | 'batch' | 'generate';

// --- History ---
export interface HistoryEntry {
  state: UploadedFile[];
  actionName: string;
}

export interface History {
  past: HistoryEntry[];
  present: HistoryEntry;
  future: HistoryEntry[];
}


// --- User Profile and Learning ---

export interface Preset {
  id: string;
  name: string;
  edits: Omit<ManualEdits, 'crop'>;
}

export interface AutopilotTendencies {
  brightness: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  shadows: number;
  highlights: number;
  clarity: number;
}

export type Feedback = 'good' | 'bad';

export interface UserProfile {
  autopilotTendencies: AutopilotTendencies;
  feedbackHistory: Record<string, Feedback>; // key: actionId
  presets: Preset[];
}
