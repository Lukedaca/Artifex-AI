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

/**
 * Checks if the user has already selected an API key via the AI Studio host.
 * @returns {Promise<boolean>} A promise that resolves to true if a key is selected, false otherwise.
 */
export const hasSelectedApiKey = async (): Promise<boolean> => {
  if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
    return await window.aistudio.hasSelectedApiKey();
  }
  // This function is designed to work within the AI Studio environment.
  // We'll return false if the host feature is not available, prompting the user with the modal.
  return false;
};

/**
 * Opens the AI Studio dialog for the user to select their API key.
 * @returns {Promise<void>} A promise that resolves when the dialog is opened.
 */
export const openSelectKey = async (): Promise<void> => {
  if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
    await window.aistudio.openSelectKey();
  } else {
    console.warn('API key selection is not available in this environment.');
  }
};