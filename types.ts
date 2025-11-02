import type { EditorAction } from './App';

export interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string;
  analysis?: AnalysisResult | null;
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

export interface EditorViewProps {
    files: UploadedFile[];
    isApiKeyAvailable: boolean;
    activeAction: EditorAction;
    onActionCompleted: () => void;
    onFileUpdate: (fileId: string, newFile: File) => void;
}

export interface ManualEdits {
    brightness: number;
    contrast: number;
    saturation: number;
    vibrance: number;
    shadows: number;
    highlights: number;
    clarity: number;
    crop?: number;
}

export interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}
