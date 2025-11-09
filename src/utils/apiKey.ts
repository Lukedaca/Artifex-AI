// API Key management for standalone Artifex AI application
// Stores API key in localStorage for persistent access

const API_KEY_STORAGE_KEY = 'artifex-gemini-api-key';

/**
 * Checks if the user has stored an API key in localStorage.
 * @returns {Promise<boolean>} A promise that resolves to true if a key is stored, false otherwise.
 */
export const hasSelectedApiKey = async (): Promise<boolean> => {
  const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  return storedKey !== null && storedKey.trim().length > 0;
};

/**
 * Saves the API key to localStorage.
 * @param {string} apiKey - The API key to save
 */
export const saveApiKey = (apiKey: string): void => {
  localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
};

/**
 * Gets the API key from localStorage.
 * @returns {Promise<string | null>} The API key or null if not found
 */
export const getApiKey = async (): Promise<string | null> => {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
};

/**
 * Removes the API key from localStorage.
 */
export const clearApiKey = (): void => {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
};
