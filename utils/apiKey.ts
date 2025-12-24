
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const LOCAL_STORAGE_KEY = 'gemini_api_key';

/**
 * Checks if an API key is available via environment or bridge.
 * No longer uses localStorage for security reasons.
 */
export const hasSelectedApiKey = async (): Promise<boolean> => {
  // 1. Primary: Check standard Environment Variable (Injected by host)
  if (process.env.API_KEY && process.env.API_KEY.length > 0) {
    return true;
  }

  // 2. Secondary: Check AI Studio Host bridge
  if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
    return await window.aistudio.hasSelectedApiKey();
  }
  
  return false;
};

/**
 * Cleanup function to remove any legacy keys from storage.
 */
export const clearLegacyKeys = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem('artifex_api_key'); // Legacy fallback
};

/**
 * Opens the AI Studio dialog if available.
 */
export const openSelectKey = async (): Promise<boolean> => {
  if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
    await window.aistudio.openSelectKey();
    return true;
  }
  return false;
};
