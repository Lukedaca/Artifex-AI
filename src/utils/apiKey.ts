// API Key management utilities for BYOK (Bring Your Own Key) model

const API_KEY_STORAGE_KEY = 'artifex-ai-gemini-key';

/**
 * Check if user has saved an API key
 */
export const hasSelectedApiKey = async (): Promise<boolean> => {
  try {
    const key = localStorage.getItem(API_KEY_STORAGE_KEY);
    return !!key && key.trim().length > 0;
  } catch (error) {
    console.error('Error checking API key:', error);
    return false;
  }
};

/**
 * Get the stored API key
 * @throws Error if no API key is found
 */
export const getApiKey = async (): Promise<string> => {
  try {
    const key = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (!key || key.trim().length === 0) {
      throw new Error('API klíč není nastaven. Pro použití AI funkcí prosím zadejte svůj Google Gemini API klíč.');
    }
    return key.trim();
  } catch (error) {
    throw error;
  }
};

/**
 * Save API key to localStorage
 */
export const setApiKey = async (apiKey: string): Promise<void> => {
  try {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API klíč nemůže být prázdný');
    }
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
  } catch (error) {
    console.error('Error saving API key:', error);
    throw error;
  }
};

/**
 * Clear the stored API key
 */
export const clearApiKey = async (): Promise<void> => {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing API key:', error);
    throw error;
  }
};
