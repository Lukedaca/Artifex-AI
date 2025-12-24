
import type { UserProfile, AutopilotTendencies, Feedback, Preset } from '../types';

const USER_PROFILE_KEY = 'artifex_user_profile_v1';
const LEARNING_RATE = 0.1;
const DECAY_RATE = 0.95;

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
  credits: 50,
  hasSeenOnboarding: false,
  isAdmin: false
});

export const getUserProfile = (): UserProfile => {
  try {
    const storedProfile = localStorage.getItem(USER_PROFILE_KEY);
    let profile: UserProfile = getInitialProfile();

    if (storedProfile) {
      const parsed = JSON.parse(storedProfile) as UserProfile;
      profile = {
        ...getInitialProfile(),
        ...parsed,
        autopilotTendencies: {
            ...getInitialProfile().autopilotTendencies,
            ...(parsed.autopilotTendencies || {})
        },
        presets: parsed.presets || [],
        credits: typeof parsed.credits === 'number' ? parsed.credits : 50,
        hasSeenOnboarding: !!parsed.hasSeenOnboarding,
        isAdmin: !!parsed.isAdmin
      };
    }

    // --- SECURITY: Check for Admin URL Parameter ---
    // Usage: Open app with ?role=admin to activate admin mode permanently on this device
    if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('role') === 'admin') {
            profile.isAdmin = true;
            saveUserProfile(profile);
            // Clean URL
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.pushState({path:newUrl},'',newUrl);
        }
    }
    
    return profile;

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

export const updateCredits = (amount: number): number => {
    const profile = getUserProfile();
    // Admin has infinite credits, effectively
    if (profile.isAdmin) return 9999;
    
    profile.credits = Math.max(0, profile.credits + amount);
    saveUserProfile(profile);
    return profile.credits;
};

export const markOnboardingSeen = () => {
    const profile = getUserProfile();
    profile.hasSeenOnboarding = true;
    saveUserProfile(profile);
};

export const updateUserTendencies = (adjustments: Partial<AutopilotTendencies>) => {
  const profile = getUserProfile();
  
  for (const key in adjustments) {
    const typedKey = key as keyof AutopilotTendencies;
    const adjustmentValue = adjustments[typedKey];
    if (typeof adjustmentValue === 'number' && adjustmentValue !== 0) {
      const normalizedAdjustment = Math.max(-1, Math.min(1, adjustmentValue / 50)); 
      
      const currentTendency = profile.autopilotTendencies[typedKey];
      profile.autopilotTendencies[typedKey] = 
        (currentTendency * DECAY_RATE) + (normalizedAdjustment * LEARNING_RATE);
      
      profile.autopilotTendencies[typedKey] = Math.max(-1, Math.min(1, profile.autopilotTendencies[typedKey]));
    }
  }

  saveUserProfile(profile);
};


export const recordExplicitFeedback = (actionId: string, feedback: Feedback) => {
  const profile = getUserProfile();
  profile.feedbackHistory[actionId] = feedback;
  if (feedback === 'bad') {
      for (const key in profile.autopilotTendencies) {
          const typedKey = key as keyof AutopilotTendencies;
          profile.autopilotTendencies[typedKey] *= 0.8;
      }
  }
  saveUserProfile(profile);
};

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

export const checkIsAdmin = (): boolean => {
    return getUserProfile().isAdmin;
};
