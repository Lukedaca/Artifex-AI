
export type Language = 'cs' | 'en';

export interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string;
  originalPreviewUrl: string;
  analysis?: AnalysisResult;
  isAnalyzing?: boolean;
  socialContent?: SocialMediaContent;
  generatedVideo?: GeneratedVideo;
  assessment?: QualityAssessment;
}

export interface QualityAssessment {
    score: number; // 0-100
    isBestPick: boolean;
    flags: string[]; // ['Blurry', 'Closed Eyes', 'Bad Exposure', 'Great Composition']
}

export interface SocialMediaContent {
    captions: {
        tone: string;
        text: string;
    }[];
    hashtags: string[];
}

export interface GeneratedVideo {
    url: string;
    expiry: number;
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

export interface WatermarkSettings {
    enabled: boolean;
    text: string;
    opacity: number; // 0-100
    size: number; // 10-100 (percentage of width mostly)
    position: 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'tiled';
    color: string;
}

export interface ManualEdits {
  brightness: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  shadows: number;
  highlights: number;
  clarity: number;
  sharpness: number;
  noiseReduction: number;
  cropRect?: CropCoordinates;
  aspectRatio?: number;
  watermark?: WatermarkSettings;
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

export type View = 'home' | 'upload' | 'editor' | 'batch' | 'generate' | 'raw-converter';

export interface HistoryEntry {
  state: UploadedFile[];
  actionName: string;
}

export interface History {
  past: HistoryEntry[];
  present: HistoryEntry;
  future: HistoryEntry[];
}

export interface Preset {
  id: string;
  name: string;
  edits: Omit<ManualEdits, 'cropRect'>;
}

export interface AutopilotTendencies {
  brightness: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  shadows: number;
  highlights: number;
  clarity: number;
  sharpness: number;
  noiseReduction: number;
}

export type Feedback = 'good' | 'bad';

export interface UserProfile {
  autopilotTendencies: AutopilotTendencies;
  feedbackHistory: Record<string, Feedback>;
  presets: Preset[];
  credits: number;
  hasSeenOnboarding: boolean;
  isAdmin: boolean;
}
