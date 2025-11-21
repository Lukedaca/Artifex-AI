import type { UserProfile, AutopilotTendencies, Feedback, Preset } from '../types';

const USER_PROFILE_KEY = 'artifex_user_profile_v1';
const LEARNING_RATE = 0.1; // How much a single action affects the tendency
const DECAY_RATE = 0.95; // How much tendencies return to neutral over time

const getInitialProfile = (): UserProfile => ({
  autopilotTendencies: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    vibrance: 0,
    shadows: 0,
    highlights: 0,
    clarity: 0,
    sharpness: 0,
    noiseReduction: 0,
  },
  feedbackHistory: {},
  presets: [],
});

export const getUserProfile = (): UserProfile => {
  try {
    const storedProfile = localStorage.getItem(USER_PROFILE_KEY);
    if (storedProfile) {
      const profile = JSON.parse(storedProfile) as UserProfile;
      // Ensure all keys exist from the initial profile in case the structure has changed
      return {
        ...getInitialProfile(),
        ...profile,
        autopilotTendencies: {
            ...getInitialProfile().autopilotTendencies,
            ...(profile.autopilotTendencies || {})
        },
        presets: profile.presets || [],
      };
    }
  } catch (error) {
    console.error("Failed to parse user profile, resetting.", error);
    localStorage.removeItem(USER_PROFILE_KEY);
  }
  return getInitialProfile();
};

const saveUserProfile = (profile: UserProfile) => {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error("Failed to save user profile.", error);
  }
};

/**
 * Updates autopilot tendencies based on manual user adjustments.
 * If user increases a value AI suggested, the tendency for it increases, and vice-versa.
 */
export const updateUserTendencies = (adjustments: Partial<AutopilotTendencies>) => {
  const profile = getUserProfile();
  
  for (const key in adjustments) {
    const typedKey = key as keyof AutopilotTendencies;
    const adjustmentValue = adjustments[typedKey];
    if (typeof adjustmentValue === 'number' && adjustmentValue !== 0) {
      // Normalize adjustment to a -1 to 1 range (assuming adjustments are within -100 to 100)
      const normalizedAdjustment = Math.max(-1, Math.min(1, adjustmentValue / 50)); 
      
      // Update the tendency using a learning rate and decay
      const currentTendency = profile.autopilotTendencies[typedKey];
      profile.autopilotTendencies[typedKey] = 
        (currentTendency * DECAY_RATE) + (normalizedAdjustment * LEARNING_RATE);
      
      // Clamp the value between -1 and 1
      profile.autopilotTendencies[typedKey] = Math.max(-1, Math.min(1, profile.autopilotTendencies[typedKey]));
    }
  }

  saveUserProfile(profile);
};


export const recordExplicitFeedback = (actionId: string, feedback: Feedback) => {
  const profile = getUserProfile();
  
  profile.feedbackHistory[actionId] = feedback;
  
  // If feedback is bad, slightly decay all tendencies towards neutral
  if (feedback === 'bad') {
      for (const key in profile.autopilotTendencies) {
          const typedKey = key as keyof AutopilotTendencies;
          profile.autopilotTendencies[typedKey] *= 0.8; // Stronger decay for negative feedback
      }
  }
  
  saveUserProfile(profile);
};

// --- Preset Management ---

export const getPresets = (): Preset[] => {
  return getUserProfile().presets;
};

export const savePreset = (preset: Omit<Preset, 'id'>) => {
  const profile = getUserProfile();
  const newPreset: Preset = {
    ...preset,
    id: `${Date.now()}-${Math.random()}`,
  };
  profile.presets.push(newPreset);
  saveUserProfile(profile);
};

export const deletePreset = (presetId: string) => {
  const profile = getUserProfile();
  profile.presets = profile.presets.filter(p => p.id !== presetId);
  saveUserProfile(profile);
};