
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

// We no longer store user keys in local storage for this version of the app.
// Access is controlled via Credits on the server/app side (simulated).

export const clearLegacyKeys = () => {
    localStorage.removeItem('gemini_api_key');
    localStorage.removeItem('artifex_user_api_key'); 
};
