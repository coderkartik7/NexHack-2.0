import { db } from './db';
import type { LearnerProfile } from '../calibration/types';

const ACTIVE_PROFILE_KEY = 'gesturelearn_active_profile_id';

export function createDefaultLearnerProfile(mode: 'head' | 'hand' = 'head'): LearnerProfile {
  return {
    id: `prof_default_${mode}`,
    name: `Default ${mode === 'head' ? 'Head Control' : 'Hand Control'}`,
    mode,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 2,
    cursorMapping: {
      gainX: 1.5,
      gainY: 1.5,
      offsetX: mode === 'head' ? 0 : 0.5,
      offsetY: mode === 'head' ? 0 : 0.5,
    },
    restBaseline: {
      mean: { headX: 0, headY: 0, jawOpen: 0.05, browRaise: 0.05, blink: 0.05, handX: 0.5, handY: 0.5, pinch: 0.8, openPalm: 1.0 },
      std: { headX: 0.02, headY: 0.02, jawOpen: 0.01, browRaise: 0.01, blink: 0.01, handX: 0.02, handY: 0.02, pinch: 0.02, openPalm: 0.02 },
      p95: { headX: 0.04, headY: 0.04, jawOpen: 0.08, browRaise: 0.08, blink: 0.08, handX: 0.54, handY: 0.54, pinch: 0.84, openPalm: 1.04 },
      durationMs: 15000,
      sampleCount: 450,
    },
    commands: {
      select: {
        signal: mode === 'head' ? 'jawOpen' : 'pinch',
        direction: mode === 'head' ? 'high' : 'low',
        enter: mode === 'head' ? 0.35 : 0.28,
        exit: mode === 'head' ? 0.2 : 0.45,
        minHoldMs: 150,
        cooldownMs: 200,
        separability: { dPrime: 2.5, overlap: 0.05, rating: 'reliable' },
      },
      grab: {
        signal: mode === 'head' ? 'browRaise' : 'openPalm',
        direction: 'high',
        enter: mode === 'head' ? 0.35 : 1.35,
        exit: mode === 'head' ? 0.2 : 1.15,
        minHoldMs: 150,
        cooldownMs: 200,
        separability: { dPrime: 2.5, overlap: 0.05, rating: 'reliable' },
      },
      pause: {
        signal: 'blink',
        direction: 'high',
        enter: 0.8,
        exit: 0.4,
        minHoldMs: 300,
        cooldownMs: 300,
        separability: { dPrime: 2.5, overlap: 0.05, rating: 'reliable' },
      },
    },
  };
}

export async function listProfiles(): Promise<LearnerProfile[]> {
  const profiles = await db.profiles.orderBy('updatedAt').reverse().toArray();
  if (profiles.length === 0) {
    const defaultProfile = createDefaultLearnerProfile('head');
    await db.profiles.put(defaultProfile);
    setActiveProfileId(defaultProfile.id);
    return [defaultProfile];
  }
  return profiles;
}

export async function getProfile(id: string): Promise<LearnerProfile | undefined> {
  return await db.profiles.get(id);
}

export async function saveProfile(profile: LearnerProfile): Promise<void> {
  profile.updatedAt = Date.now();
  await db.profiles.put(profile);
}

export async function deleteProfile(id: string): Promise<void> {
  await db.profiles.delete(id);
  const activeId = getActiveProfileId();
  if (activeId === id) {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
  }
}

export async function renameProfile(id: string, newName: string): Promise<void> {
  const profile = await db.profiles.get(id);
  if (profile) {
    profile.name = newName.trim();
    profile.updatedAt = Date.now();
    await db.profiles.put(profile);
  }
}

export async function duplicateProfile(id: string): Promise<LearnerProfile | null> {
  const original = await db.profiles.get(id);
  if (!original) return null;

  const copy: LearnerProfile = {
    ...original,
    id: 'prof_' + Math.random().toString(36).substring(2, 9),
    name: `${original.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.profiles.put(copy);
  return copy;
}

export function getActiveProfileId(): string | null {
  return localStorage.getItem(ACTIVE_PROFILE_KEY);
}

export function setActiveProfileId(id: string): void {
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
}

/**
 * Exports profile to JSON string
 */
export function exportProfileToJson(profile: LearnerProfile): string {
  return JSON.stringify(profile, null, 2);
}

/**
 * Imports profile from JSON with schema validation
 */
export const CURRENT_PROFILE_VERSION = 2;

/**
 * Imports profile from JSON with schema validation and migrations.
 * Bump profile version and migrates existing head/hand profiles so they still load and validate.
 */
export function importProfileFromJson(jsonStr: string): LearnerProfile {
  let data: unknown;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    throw new Error('Invalid JSON file format.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Profile JSON must be a valid object.');
  }

  const p = data as Partial<LearnerProfile>;

  if (!p.name || typeof p.name !== 'string') {
    throw new Error("Missing or invalid 'name' in profile data.");
  }
  if (p.mode !== 'head' && p.mode !== 'hand' && p.mode !== 'eye') {
    throw new Error("Invalid 'mode' (must be 'head', 'hand', or 'eye').");
  }
  if (!p.cursorMapping || typeof p.cursorMapping.gainX !== 'number') {
    throw new Error('Missing or corrupt cursorMapping configuration.');
  }
  if (!p.commands || !p.commands.select || !p.commands.grab || !p.commands.pause) {
    throw new Error("Profile must include calibrated bindings for 'select', 'grab', and 'pause'.");
  }

  // Eye mode requires a valid GazeModel
  if (p.mode === 'eye') {
    if (!p.gaze || !p.gaze.weightsX || !p.gaze.weightsY || !p.gaze.featureMean) {
      throw new Error("Profile in 'eye' mode requires a valid fitted GazeModel ('gaze' property).");
    }
  }

  // Ensure fresh unique ID and timestamp if imported
  const importedProfile: LearnerProfile = {
    id: 'prof_' + Math.random().toString(36).substring(2, 9),
    name: p.name.trim(),
    mode: p.mode,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: CURRENT_PROFILE_VERSION,
    cursorMapping: p.cursorMapping,
    restBaseline: p.restBaseline ?? ({} as any),
    commands: p.commands,
    gaze: p.gaze,
    largeTargetMode: p.largeTargetMode ?? false,
    dwellSelectionEnabled: p.dwellSelectionEnabled ?? false,
    dwellTimeMs: p.dwellTimeMs ?? 1000,
  };

  return importedProfile;
}
