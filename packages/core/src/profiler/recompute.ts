/**
 * recomputeProfile — Canonical operation to recalculate derived layers
 *
 * Called after ANY profile mutation (edit, update, refresh, packs add/remove, import).
 * Ensures inferred, compound, and contradictions are always consistent with explicit.
 */

import type { PersonaProfile, Answer } from "../schema/types.js";
import type { Pack } from "./pack-loader.js";
import { detectCompoundSignals } from "../inference/compound.js";
import { detectContradictions } from "../inference/contradictions.js";

/**
 * Recompute all derived layers from current explicit dimensions.
 * Pass packs if available (for compound signal detection).
 * Returns the same profile object, mutated.
 */
export function recomputeProfile(
  profile: PersonaProfile,
  packs?: Pack[]
): PersonaProfile {
  // Build answer lookup from explicit dimensions
  const getAnswerValue = (questionId: string): string | undefined => {
    // Try by question_id first
    for (const val of Object.values(profile.explicit)) {
      if (val.question_id === questionId) {
        return Array.isArray(val.value) ? val.value.join(",") : String(val.value);
      }
    }
    // Try by dimension key
    const dim = profile.explicit[questionId];
    if (dim) {
      return Array.isArray(dim.value) ? dim.value.join(",") : String(dim.value);
    }
    return undefined;
  };

  // Recompute compound signals
  const compounds = detectCompoundSignals(getAnswerValue);
  profile.compound = {};
  for (const signal of compounds) {
    profile.compound[signal.dimension] = signal;
  }

  // Recompute contradictions
  profile.contradictions = detectContradictions(
    profile.explicit,
    profile.inferred
  );

  // Recompute completeness
  const dimCount = Object.keys(profile.explicit).filter(
    (k) => !k.startsWith("_") && !k.startsWith("selected")
  ).length;
  profile.completeness = Math.min(100, Math.round((dimCount / 30) * 100));

  // Update timestamp
  profile.updated_at = new Date().toISOString();

  return profile;
}
