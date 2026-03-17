/**
 * Meport Inference Engine — orchestrates all 3 layers
 */

export {
  detectBehavioralSignals,
  buildBehavioralContext,
  type BehavioralContext,
} from "./behavioral.js";

export { detectCompoundSignals } from "./compound.js";

export { detectContradictions } from "./contradictions.js";

export { runLayer3, type Layer3Config } from "./emergent.js";

export { runPackLayer2 } from "./pack-inference.js";

import type {
  PersonaProfile,
  InferredValue,
  CompoundValue,
  Contradiction,
  Answer,
  Question,
} from "../schema/types.js";

import { detectBehavioralSignals, buildBehavioralContext } from "./behavioral.js";
import { detectCompoundSignals } from "./compound.js";
import { detectContradictions } from "./contradictions.js";

/**
 * Run Layer 2 inference (deterministic, no AI needed).
 * Mutates the profile in place, adding inferred/compound/contradictions.
 */
export function runLayer2(
  profile: PersonaProfile,
  answers: Map<string, Answer>,
  questions: Map<string, Question>
): PersonaProfile {
  // 2A: Behavioral signals
  const questionTypeMap = new Map<string, { type: string }>();
  for (const [id, q] of questions) {
    questionTypeMap.set(id, { type: q.type });
  }

  const ctx = buildBehavioralContext(answers, questionTypeMap);
  const behavioralSignals = detectBehavioralSignals(ctx);

  for (const signal of behavioralSignals) {
    profile.inferred[signal.dimension] = signal;
  }

  // 2B: Compound signals
  // Resolve raw option.value → maps_to.value for compound rule matching
  const getAnswerValue = (questionId: string): string | undefined => {
    const answer = answers.get(questionId);
    if (!answer || answer.skipped) return undefined;

    // Handle numeric values (scale questions) — convert to string for compound rule matching
    if (typeof answer.value === "number") {
      return String(answer.value);
    }

    const rawValue = typeof answer.value === "string" ? answer.value : undefined;
    if (!rawValue) return undefined;

    // Look up the question to resolve maps_to
    const question = questions.get(questionId);
    if (question?.options) {
      const selectedOption = question.options.find((o) => o.value === rawValue);
      if (selectedOption?.maps_to) {
        return selectedOption.maps_to.value;
      }
    }

    // For scale/open_text, return raw value
    return rawValue;
  };

  const compoundSignals = detectCompoundSignals(getAnswerValue);
  for (const signal of compoundSignals) {
    profile.compound[signal.dimension] = signal;
  }

  // 2C: Contradictions
  const contradictions = detectContradictions(
    profile.explicit,
    profile.inferred
  );
  profile.contradictions = contradictions;

  profile.updated_at = new Date().toISOString();

  return profile;
}
