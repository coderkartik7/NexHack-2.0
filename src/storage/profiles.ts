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
      headX: { mean: 0, std: 0.02, min: -0.1, max: 0.1, p95: 0.04, p99: 0.06 },
      headY: { mean: 0, std: 0.02, min: -0.1, max: 0.1, p95: 0.04, p99: 0.06 },
      headRoll: { mean: 0, std: 0.02, min: -0.1, max: 0.1, p95: 0.04, p99: 0.06 },
      jawOpen: { mean: 0.05, std: 0.01, min: 0, max: 0.1, p95: 0.08, p99: 0.1 },
      browRaise: { mean: 0.05, std: 0.01, min: 0, max: 0.1, p95: 0.08, p99: 0.1 },
      blink: { mean: 0.05, std: 0.01, min: 0, max: 0.1, p95: 0.08, p99: 0.1 },
      handX: { mean: 0.5, std: 0.02, min: 0.4, max: 0.6, p95: 0.54, p99: 0.56 },
      handY: { mean: 0.5, std: 0.02, min: 0.4, max: 0.6, p95: 0.54, p99: 0.56 },
      pinch: { mean: 0.8, std: 0.02, min: 0.7, max: 0.9, p95: 0.84, p99: 0.86 },
      openPalm: { mean: 1.0, std: 0.02, min: 0.9, max: 1.1, p95: 1.04, p99: 1.06 },
      gazeX: { mean: 0.5, std: 0.02, min: 0.4, max: 0.6, p95: 0.54, p99: 0.56 },
      gazeY: { mean: 0.5, std: 0.02, min: 0.4, max: 0.6, p95: 0.54, p99: 0.56 },
      irisDistL: { mean: 0.5, std: 0.02, min: 0.4, max: 0.6, p95: 0.54, p99: 0.56 },
      irisDistR: { mean: 0.5, std: 0.02, min: 0.4, max: 0.6, p95: 0.54, p99: 0.56 },
      eyeOpenness: { mean: 0.25, std: 0.02, min: 0.2, max: 0.3, p95: 0.28, p99: 0.3 },
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
