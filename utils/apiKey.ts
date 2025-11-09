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

const API_KEY_STORAGE_KEY = 'artifex-gemini-api-key';

/**
 * Checks if the user has already selected an API key via the AI Studio host or localStorage.
 * @returns {Promise<boolean>} A promise that resolves to true if a key is selected, false otherwise.
 */
export const hasSelectedApiKey = async (): Promise<boolean> => {
  // First, check if running in AI Studio environment
  if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
    return await window.aistudio.hasSelectedApiKey();
  }

  // Fallback: check localStorage for standalone mode
  const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  return storedKey !== null && storedKey.trim().length > 0;
};

/**
 * Opens the AI Studio dialog for the user to select their API key.
 * In standalone mode, this is handled by the ApiKeyModal component.
 * @returns {Promise<void>} A promise that resolves when the dialog is opened.
 */
export const openSelectKey = async (): Promise<void> => {
  if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
    await window.aistudio.openSelectKey();
  }
  // In standalone mode, the modal handles the key input
};

/**
 * Saves the API key to localStorage (for standalone mode).
 * @param {string} apiKey - The API key to save
 */
export const saveApiKey = (apiKey: string): void => {
  localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
};

/**
 * Gets the API key from localStorage or AI Studio.
 * @returns {Promise<string | null>} The API key or null if not found
 */
export const getApiKey = async (): Promise<string | null> => {
  // In standalone mode, return from localStorage
  return localStorage.getItem(API_KEY_STORAGE_KEY);
};

/**
 * Removes the API key from localStorage.
 */
export const clearApiKey = (): void => {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
};