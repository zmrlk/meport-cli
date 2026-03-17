import { describe, it, expect } from "vitest";
import { detectContradictions } from "./contradictions.js";
import type { DimensionValue, InferredValue } from "../schema/types.js";

// ─── Helpers ──────────────────────────────────────────────

function makeDim(
  dimension: string,
  value: string | number
): DimensionValue {
  return {
    dimension,
    value,
    confidence: 1.0,
    source: "explicit",
    question_id: "test_q",
  };
}

function makeInferred(
  dimension: string,
  value: string
): InferredValue {
  return {
    dimension,
    value,
    confidence: 0.7,
    source: "behavioral",
    signal_id: "test_signal",
    override: "secondary",
  };
}

function makeExplicit(
  entries: Array<[string, string | number]>
): Record<string, DimensionValue> {
  return Object.fromEntries(
    entries.map(([dim, val]) => [dim, makeDim(dim, val)])
  );
}

function makeInferredRecord(
  entries: Array<[string, string]>
): Record<string, InferredValue> {
  return Object.fromEntries(
    entries.map(([dim, val]) => [dim, makeInferred(dim, val)])
  );
}

// ─── contradiction_verbosity ──────────────────────────────

describe("contradiction_verbosity", () => {
  it("fires when explicit='minimal' and inferred='detailed'", () => {
    const explicit = makeExplicit([
      ["communication.verbosity_preference", "minimal"],
    ]);
    const inferred = makeInferredRecord([
      ["communication.verbosity_preference", "detailed"],
    ]);

    const contradictions = detectContradictions(explicit, inferred);
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_verbosity"
    );

    expect(c).toBeDefined();
    expect(c?.resolution).toBe("flag_both");
  });

  it("does not fire when explicit and inferred values match", () => {
    const explicit = makeExplicit([
      ["communication.verbosity_preference", "minimal"],
    ]);
    const inferred = makeInferredRecord([
      ["communication.verbosity_preference", "minimal"],
    ]);

    const contradictions = detectContradictions(explicit, inferred);
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_verbosity"
    );

    expect(c).toBeUndefined();
  });

  it("does not fire when explicit verbosity is missing", () => {
    const explicit = makeExplicit([]);
    const inferred = makeInferredRecord([
      ["communication.verbosity_preference", "detailed"],
    ]);

    const contradictions = detectContradictions(explicit, inferred);
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_verbosity"
    );

    expect(c).toBeUndefined();
  });

  it("does not fire when inferred verbosity is missing", () => {
    const explicit = makeExplicit([
      ["communication.verbosity_preference", "minimal"],
    ]);
    const inferred = makeInferredRecord([]);

    const contradictions = detectContradictions(explicit, inferred);
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_verbosity"
    );

    expect(c).toBeUndefined();
  });

  it("does not fire when explicit='detailed' and inferred='minimal' (only one direction triggers)", () => {
    // The rule only checks explicit=minimal AND inferred=detailed
    const explicit = makeExplicit([
      ["communication.verbosity_preference", "detailed"],
    ]);
    const inferred = makeInferredRecord([
      ["communication.verbosity_preference", "minimal"],
    ]);

    const contradictions = detectContradictions(explicit, inferred);
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_verbosity"
    );

    expect(c).toBeUndefined();
  });
});

// ─── contradiction_directness_rsd ────────────────────────

describe("contradiction_directness_rsd", () => {
  it("fires when directness='blunt' and rsd='elevated'", () => {
    const explicit = makeExplicit([
      ["communication.directness", "blunt"],
      ["neurodivergent.rejection_sensitivity", "elevated"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_directness_rsd"
    );

    expect(c).toBeDefined();
    expect(c?.resolution).toBe("nuance_both");
  });

  it("fires when directness='direct' and rsd='high'", () => {
    const explicit = makeExplicit([
      ["communication.directness", "direct"],
      ["neurodivergent.rejection_sensitivity", "high"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_directness_rsd"
    );

    expect(c).toBeDefined();
  });

  it("fires when directness='blunt' and rsd='high'", () => {
    const explicit = makeExplicit([
      ["communication.directness", "blunt"],
      ["neurodivergent.rejection_sensitivity", "high"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_directness_rsd"
    );

    expect(c).toBeDefined();
  });

  it("does not fire when directness is not blunt or direct", () => {
    const explicit = makeExplicit([
      ["communication.directness", "gentle"],
      ["neurodivergent.rejection_sensitivity", "elevated"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_directness_rsd"
    );

    expect(c).toBeUndefined();
  });

  it("does not fire when rsd is not elevated or high", () => {
    const explicit = makeExplicit([
      ["communication.directness", "blunt"],
      ["neurodivergent.rejection_sensitivity", "low"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_directness_rsd"
    );

    expect(c).toBeUndefined();
  });

  it("does not fire when either dimension is missing", () => {
    const explicit = makeExplicit([
      ["communication.directness", "blunt"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_directness_rsd"
    );

    expect(c).toBeUndefined();
  });
});

// ─── contradiction_praise_validation ─────────────────────

describe("contradiction_praise_validation", () => {
  it("fires when praise='none' and validation='high'", () => {
    const explicit = makeExplicit([
      ["communication.praise_tolerance", "none"],
      ["personality.validation_need", "high"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_praise_validation"
    );

    expect(c).toBeDefined();
    expect(c?.resolution).toBe("nuance_both");
  });

  it("fires when praise='none' and validation='seeks_actively'", () => {
    const explicit = makeExplicit([
      ["communication.praise_tolerance", "none"],
      ["personality.validation_need", "seeks_actively"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_praise_validation"
    );

    expect(c).toBeDefined();
  });

  it("does not fire when praise is not 'none'", () => {
    const explicit = makeExplicit([
      ["communication.praise_tolerance", "moderate"],
      ["personality.validation_need", "high"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_praise_validation"
    );

    expect(c).toBeUndefined();
  });

  it("does not fire when validation is not 'high' or 'seeks_actively'", () => {
    const explicit = makeExplicit([
      ["communication.praise_tolerance", "none"],
      ["personality.validation_need", "low"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_praise_validation"
    );

    expect(c).toBeUndefined();
  });

  it("does not fire when either dimension is missing", () => {
    const explicit = makeExplicit([
      ["communication.praise_tolerance", "none"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_praise_validation"
    );

    expect(c).toBeUndefined();
  });
});

// ─── contradiction_proactivity_tool ──────────────────────

describe("contradiction_proactivity_tool", () => {
  it("fires when proactivity=4 (numeric) and relationship='tool'", () => {
    const explicit = makeExplicit([
      ["ai.proactivity", 4],
      ["ai.relationship_model", "tool"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_proactivity_tool"
    );

    expect(c).toBeDefined();
    expect(c?.resolution).toBe("flag_for_reveal");
  });

  it("fires when proactivity=5 (numeric) and relationship='tool'", () => {
    const explicit = makeExplicit([
      ["ai.proactivity", 5],
      ["ai.relationship_model", "tool"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_proactivity_tool"
    );

    expect(c).toBeDefined();
  });

  it("fires when proactivity='4' (string) and relationship='tool'", () => {
    const explicit = makeExplicit([
      ["ai.proactivity", "4"],
      ["ai.relationship_model", "tool"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_proactivity_tool"
    );

    expect(c).toBeDefined();
  });

  it("fires when proactivity='5' (string) and relationship='tool'", () => {
    const explicit = makeExplicit([
      ["ai.proactivity", "5"],
      ["ai.relationship_model", "tool"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_proactivity_tool"
    );

    expect(c).toBeDefined();
  });

  it("does not fire when proactivity is below 4", () => {
    const explicit = makeExplicit([
      ["ai.proactivity", 3],
      ["ai.relationship_model", "tool"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_proactivity_tool"
    );

    expect(c).toBeUndefined();
  });

  it("does not fire when relationship is not 'tool'", () => {
    const explicit = makeExplicit([
      ["ai.proactivity", 5],
      ["ai.relationship_model", "partner"],
    ]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_proactivity_tool"
    );

    expect(c).toBeUndefined();
  });

  it("does not fire when either dimension is missing", () => {
    const explicit = makeExplicit([["ai.proactivity", 5]]);

    const contradictions = detectContradictions(explicit, {});
    const c = contradictions.find(
      (x) => x.rule_id === "contradiction_proactivity_tool"
    );

    expect(c).toBeUndefined();
  });
});

// ─── Integration: empty inputs ────────────────────────────

describe("detectContradictions — edge cases", () => {
  it("returns empty array when both maps are empty", () => {
    const result = detectContradictions({}, {});
    expect(result).toEqual([]);
  });

  it("returns multiple contradictions when multiple rules fire", () => {
    const explicit = makeExplicit([
      ["communication.verbosity_preference", "minimal"],
      ["communication.directness", "blunt"],
      ["neurodivergent.rejection_sensitivity", "elevated"],
    ]);
    const inferred = makeInferredRecord([
      ["communication.verbosity_preference", "detailed"],
    ]);

    const contradictions = detectContradictions(explicit, inferred);
    expect(contradictions.length).toBeGreaterThanOrEqual(2);
  });
});
