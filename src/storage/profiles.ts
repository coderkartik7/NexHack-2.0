import { db } from './db';
import type { LearnerProfile } from '../calibration/types';

const ACTIVE_PROFILE_KEY = 'gesturelearn_active_profile_id';

export async function listProfiles(): Promise<LearnerProfile[]> {
  return await db.profiles.orderBy('updatedAt').reverse().toArray();
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
  if (p.mode !== 'head' && p.mode !== 'hand') {
    throw new Error("Invalid 'mode' (must be 'head' or 'hand').");
  }
  if (!p.cursorMapping || typeof p.cursorMapping.gainX !== 'number') {
    throw new Error('Missing or corrupt cursorMapping configuration.');
  }
  if (!p.commands || !p.commands.select || !p.commands.grab || !p.commands.pause) {
    throw new Error("Profile must include calibrated bindings for 'select', 'grab', and 'pause'.");
  }

  // Ensure fresh unique ID and timestamp if imported
  const importedProfile: LearnerProfile = {
    id: 'prof_' + Math.random().toString(36).substring(2, 9),
    name: p.name.trim(),
    mode: p.mode,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: p.version ?? 1,
    cursorMapping: p.cursorMapping,
    restBaseline: p.restBaseline ?? ({} as any),
    commands: p.commands,
  };

  return importedProfile;
}
