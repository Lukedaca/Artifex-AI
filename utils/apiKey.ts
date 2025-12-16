
// FIX: Resolve TypeScript type conflict by using a named interface `AIStudio` for `window.aistudio`.
// The previous inline type conflicted with an existing global definition.
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
 * Checks if the user has already selected an API key.
 * Priority 1: Check environment variable (Standard for Cloud/Production)
 * Priority 2: Check Local Storage (Fallback for client-side manual entry)
 * Priority 3: Check AI Studio context (For development within Google AI Studio)
 * @returns {Promise<boolean>} A promise that resolves to true if a key is available.
 */
export const hasSelectedApiKey = async (): Promise<boolean> => {
  // 1. Check standard Environment Variable
  if (process.env.API_KEY && process.env.API_KEY.length > 0) {
    return true;
  }

  // 2. Check Local Storage (Manual fallback)
  if (localStorage.getItem(LOCAL_STORAGE_KEY)) {
      return true;
  }

  // 3. Check AI Studio Host Features
  if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
    return await window.aistudio.hasSelectedApiKey();
  }
  
  // No key found
  return false;
};

/**
 * Stores the API key manually in local storage.
 */
export const storeApiKey = (key: string) => {
    if (!key) return;
    localStorage.setItem(LOCAL_STORAGE_KEY, key);
};

/**
 * Retrieves the stored API key.
 */
export const getStoredApiKey = (): string | null => {
    return localStorage.getItem(LOCAL_STORAGE_KEY);
}

/**
 * Opens the AI Studio dialog for the user to select their API key.
 * @returns {Promise<boolean>} Returns true if the dialog was opened, false if the feature is unavailable.
 */
export const openSelectKey = async (): Promise<boolean> => {
  if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
    await window.aistudio.openSelectKey();
    return true;
  } else {
    // Feature unavailable in standard browser/cloud environment
    return false;
  }
};
