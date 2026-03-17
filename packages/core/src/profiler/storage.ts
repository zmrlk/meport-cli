/**
 * Profile Persistence
 *
 * Save/load profiles to/from JSON files.
 * Local-first: everything stays on the user's machine.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { PersonaProfile } from "../schema/types.js";

/**
 * Save a profile to a JSON file
 */
export async function saveProfile(
  profile: PersonaProfile,
  filePath: string
): Promise<void> {
  profile.updated_at = new Date().toISOString();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(profile, null, 2), "utf-8");
}

/**
 * Load a profile from a JSON file
 */
export async function loadProfile(
  filePath: string
): Promise<PersonaProfile> {
  const content = await readFile(filePath, "utf-8");
  const profile = JSON.parse(content) as PersonaProfile;

  // Basic validation
  if (profile.schema_version !== "1.0") {
    throw new Error(
      `Unsupported schema version: ${profile.schema_version}. Expected 1.0.`
    );
  }

  if (!profile.profile_type) {
    throw new Error("Invalid profile: missing profile_type");
  }

  return profile;
}

/**
 * Check if a profile file exists and is valid
 */
export async function profileExists(
  filePath: string
): Promise<boolean> {
  try {
    await loadProfile(filePath);
    return true;
  } catch {
    return false;
  }
}
