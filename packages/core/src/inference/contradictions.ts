/**
 * Layer 2C — Contradiction Detection
 *
 * Cross-validates explicit answers that conflict with each other
 * or with behavioral signals. Produces nuanced export instructions.
 */

import type {
  Contradiction,
  DimensionValue,
  InferredValue,
} from "../schema/types.js";

interface ContradictionRule {
  rule_id: string;
  evaluate: (
    explicit: Record<string, DimensionValue>,
    inferred: Record<string, InferredValue>
  ) => Contradiction | null;
}

const rules: ContradictionRule[] = [
  {
    rule_id: "contradiction_verbosity",
    evaluate: (explicit, inferred) => {
      const explicitVerbosity = explicit["communication.verbosity_preference"];
      const inferredVerbosity = inferred["communication.verbosity_preference"];

      if (!explicitVerbosity || !inferredVerbosity) return null;
      if (explicitVerbosity.value === inferredVerbosity.value) return null;

      // User says "minimal" but writes long texts (or vice versa)
      if (
        explicitVerbosity.value === "minimal" &&
        inferredVerbosity.value === "detailed"
      ) {
        return {
          rule_id: "contradiction_verbosity",
          dimensions: [
            "communication.verbosity_preference",
            "communication.verbosity_preference",
          ],
          description:
            "User says they prefer concise responses but writes detailed open-text answers",
          resolution: "flag_both",
          note: "User WANTS concise AI but IS naturally verbose. Export: match their stated preference, not observed behavior.",
          confidence_impact:
            "reduce explicit to 0.8, add secondary signal at 0.6",
        };
      }

      return null;
    },
  },

  {
    rule_id: "contradiction_directness_rsd",
    evaluate: (explicit) => {
      const directness = explicit["communication.directness"];
      const rsd = explicit["neurodivergent.rejection_sensitivity"];

      if (!directness || !rsd) return null;

      if (
        (directness.value === "blunt" || directness.value === "direct") &&
        (rsd.value === "elevated" || rsd.value === "high")
      ) {
        return {
          rule_id: "contradiction_directness_rsd",
          dimensions: [
            "communication.directness",
            "neurodivergent.rejection_sensitivity",
          ],
          description:
            "User wants blunt communication but has high rejection sensitivity",
          resolution: "nuance_both",
          note: "User wants direct communication FROM AI but is sensitive to criticism OF them. Export: be direct in advice/information but careful in evaluation/feedback.",
          confidence_impact: "keep both, add compound note",
        };
      }

      return null;
    },
  },

  {
    rule_id: "contradiction_praise_validation",
    evaluate: (explicit) => {
      const praise = explicit["communication.praise_tolerance"];
      const validation = explicit["personality.validation_need"];

      if (!praise || !validation) return null;

      if (
        praise.value === "none" &&
        (validation.value === "high" || validation.value === "seeks_actively")
      ) {
        return {
          rule_id: "contradiction_praise_validation",
          dimensions: [
            "communication.praise_tolerance",
            "personality.validation_need",
          ],
          description:
            "User cringes at praise but has high validation need",
          resolution: "nuance_both",
          note: "User cringes at surface praise but needs acknowledgment of substance. Export: skip cheerleading, DO acknowledge real progress and quality.",
          confidence_impact: "keep both, add compound note",
        };
      }

      return null;
    },
  },

  {
    rule_id: "contradiction_proactivity_tool",
    evaluate: (explicit) => {
      const proactivity = explicit["ai.proactivity"];
      const relationship = explicit["ai.relationship_model"];

      if (!proactivity || !relationship) return null;

      const proactivityNum =
        typeof proactivity.value === "number"
          ? proactivity.value
          : parseInt(proactivity.value as string, 10);

      if (proactivityNum >= 4 && relationship.value === "tool") {
        return {
          rule_id: "contradiction_proactivity_tool",
          dimensions: ["ai.proactivity", "ai.relationship_model"],
          description:
            "User wants proactive AI but sees it as a tool",
          resolution: "flag_for_reveal",
          note: "Wants proactive AI but sees it as a tool — might mean 'proactive tool' (suggests automation) not 'proactive partner' (initiates conversation).",
          confidence_impact: "flag for post-profiling clarification",
        };
      }

      return null;
    },
  },
];

// ─── Engine ────────────────────────────────────────────────

export function detectContradictions(
  explicit: Record<string, DimensionValue>,
  inferred: Record<string, InferredValue>
): Contradiction[] {
  const contradictions: Contradiction[] = [];

  for (const rule of rules) {
    const result = rule.evaluate(explicit, inferred);
    if (result) {
      contradictions.push(result);
    }
  }

  return contradictions;
}
