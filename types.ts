// FIX: Define all necessary types for the application.

export interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string;
  analysis?: AnalysisResult;
  isAnalyzing?: boolean;
}

export interface AnalysisResult {
  description: string;
  suggestions: string[];
  technicalInfo: {
    ISO: string;
    Aperture: string;
    ShutterSpeed: string;
  };
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

export type View = 'upload' | 'editor' | 'batch' | 'generate';
