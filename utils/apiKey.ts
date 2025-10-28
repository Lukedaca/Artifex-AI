/**
 * Saves the Gemini API key to session storage.
 * @param key The API key to save.
 */
export const saveApiKey = (key: string): void => {
  sessionStorage.setItem('gemini-api-key', key);
};

/**
 * Retrieves the Gemini API key, checking session storage first, then environment variables.
 * @returns The API key if found, otherwise null.
 */
export const getApiKey = (): string | null => {
  return sessionStorage.getItem('gemini-api-key') || process.env.API_KEY || null;
}

/**
 * Checks if the Gemini API key is available.
 * @returns True if the key is set, false otherwise.
 */
export const isApiKeySet = (): boolean => {
  return !!getApiKey();
};
