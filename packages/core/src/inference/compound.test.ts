import { describe, it, expect } from "vitest";
import { detectCompoundSignals } from "./compound.js";

// ─── Helper ───────────────────────────────────────────────

function makeGetAnswer(
  map: Record<string, string>
): (questionId: string) => string | undefined {
  return (id) => map[id];
}

// ─── compound_adhd ────────────────────────────────────────

describe("compound_adhd", () => {
  const adhdChecks = {
    t5_q01: "deadline_activated",
    t5_q02: "impaired",
    t5_q03: "moderate",
    t2_q13: "hyperfocus_or_nothing",
    t3_q05: "deadline_driven",
    t3_q16: "novelty_seeker",
    t3_q20: "boredom",
    t4_q19: "low",
  };

  it("returns 'strong' with confidence 0.9 when 5+ of 8 inputs match", () => {
    // 6 matching inputs → ratio 6/8 = 0.75 >= 0.7 → confidence 0.9
    // strengthFromMatches(6) → strong (>=4)
    const entries = Object.entries(adhdChecks).slice(0, 6);
    const getAnswer = makeGetAnswer(Object.fromEntries(entries));

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_adhd");

    expect(signal).toBeDefined();
    expect(signal?.value).toBe("strong");
    expect(signal?.confidence).toBe(0.9);
  });

  it("returns 'moderate' when 3 inputs match", () => {
    // strengthFromMatches(3) = moderate
    const entries = Object.entries(adhdChecks).slice(0, 3);
    const getAnswer = makeGetAnswer(Object.fromEntries(entries));

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_adhd");

    expect(signal).toBeDefined();
    expect(signal?.value).toBe("moderate");
  });

  it("returns 'mild' when exactly 2 inputs match", () => {
    // strengthFromMatches(2) = mild
    const entries = Object.entries(adhdChecks).slice(0, 2);
    const getAnswer = makeGetAnswer(Object.fromEntries(entries));

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_adhd");

    expect(signal).toBeDefined();
    expect(signal?.value).toBe("mild");
  });

  it("returns null when fewer than 2 inputs match", () => {
    const getAnswer = makeGetAnswer({ t5_q01: "deadline_activated" });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_adhd");

    expect(signal).toBeUndefined();
  });

  it("does not match on wrong values for the correct question IDs", () => {
    const getAnswer = makeGetAnswer({
      t5_q01: "procrastination", // wrong value
      t5_q02: "fine",            // wrong value
      t5_q03: "low",             // wrong value
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_adhd");

    expect(signal).toBeUndefined();
  });

  it("includes matching question IDs in the inputs array", () => {
    const getAnswer = makeGetAnswer({
      t5_q01: "deadline_activated",
      t5_q02: "impaired",
      t5_q03: "moderate",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_adhd");

    expect(signal?.inputs).toContain("t5_q01");
    expect(signal?.inputs).toContain("t5_q02");
    expect(signal?.inputs).toContain("t5_q03");
  });
});

// ─── compound_directness ──────────────────────────────────

describe("compound_directness", () => {
  it("returns 'very_high' when all 4 inputs match", () => {
    const getAnswer = makeGetAnswer({
      t1_q02: "blunt",
      t1_q09: "critical_first",
      t1_q13: "direct",
      t4_q06: "direct",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_directness");

    expect(signal).toBeDefined();
    expect(signal?.value).toBe("very_high");
    expect(signal?.confidence).toBe(0.95);
  });

  it("returns 'high' when 2 inputs match", () => {
    const getAnswer = makeGetAnswer({
      t1_q02: "blunt",
      t1_q09: "critical_first",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_directness");

    expect(signal).toBeDefined();
    expect(signal?.value).toBe("high");
    expect(signal?.confidence).toBe(0.8);
  });

  it("returns 'high' when 3 inputs match (not all 4)", () => {
    const getAnswer = makeGetAnswer({
      t1_q02: "direct",
      t1_q09: "direct_balanced",
      t1_q13: "direct",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_directness");

    expect(signal).toBeDefined();
    expect(signal?.value).toBe("high");
  });

  it("returns null when fewer than 2 inputs match", () => {
    const getAnswer = makeGetAnswer({ t1_q02: "blunt" });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_directness");

    expect(signal).toBeUndefined();
  });
});

// ─── compound_autonomy ────────────────────────────────────

describe("compound_autonomy", () => {
  it("returns 'very_high' when 3+ inputs match", () => {
    const getAnswer = makeGetAnswer({
      t4_q10: "autonomous",
      t4_q18: "low",
      t8_q03: "tool",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_autonomy");

    expect(signal).toBeDefined();
    expect(signal?.value).toBe("very_high");
    expect(signal?.confidence).toBe(0.9);
  });

  it("returns 'high' when exactly 2 inputs match", () => {
    const getAnswer = makeGetAnswer({
      t4_q10: "challenging",
      t4_q18: "low",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_autonomy");

    expect(signal).toBeDefined();
    expect(signal?.value).toBe("high");
    expect(signal?.confidence).toBe(0.7);
  });

  it("matches t8_q07 with string '1' (not number 1)", () => {
    // t8_q07 checks for "1" or "2" as strings
    const getAnswer = makeGetAnswer({
      t4_q10: "autonomous",
      t8_q07: "1",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_autonomy");

    expect(signal).toBeDefined();
    expect(signal?.inputs).toContain("t8_q07");
  });

  it("matches t8_q07 with string '2'", () => {
    const getAnswer = makeGetAnswer({
      t4_q10: "autonomous",
      t8_q07: "2",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_autonomy");

    expect(signal).toBeDefined();
    expect(signal?.inputs).toContain("t8_q07");
  });

  it("does not match t8_q07 with numeric value (only strings)", () => {
    // The source checks matchValues: ["1", "2"] — numeric 1 would NOT match
    const getAnswer = makeGetAnswer({
      t8_q07: "3", // wrong value
      t4_q18: "low",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_autonomy");

    // Only 1 match — should not fire
    expect(signal).toBeUndefined();
  });

  it("returns null when fewer than 2 inputs match", () => {
    const getAnswer = makeGetAnswer({ t4_q10: "autonomous" });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_autonomy");

    expect(signal).toBeUndefined();
  });
});

// ─── compound_anxiety ────────────────────────────────────

describe("compound_anxiety", () => {
  it("returns 'elevated' when 3+ of 4 inputs match", () => {
    const getAnswer = makeGetAnswer({
      t4_q13: "expected_it",
      t4_q14: "low",
      t4_q15: "high",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_anxiety");

    expect(signal).toBeDefined();
    expect(signal?.value).toBe("elevated");
    expect(signal?.confidence).toBe(0.7);
  });

  it("returns 'elevated' when all 4 inputs match", () => {
    const getAnswer = makeGetAnswer({
      t4_q13: "expected_it",
      t4_q14: "conditional",
      t4_q15: "high",
      t5_q08: "elevated",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_anxiety");

    expect(signal).toBeDefined();
    expect(signal?.value).toBe("elevated");
  });

  it("returns null when only 2 inputs match (threshold is 3)", () => {
    const getAnswer = makeGetAnswer({
      t4_q13: "expected_it",
      t4_q14: "low",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_anxiety");

    expect(signal).toBeUndefined();
  });

  it("returns null when fewer than 2 inputs match", () => {
    const getAnswer = makeGetAnswer({ t4_q13: "expected_it" });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_anxiety");

    expect(signal).toBeUndefined();
  });
});

// ─── compound_cognitive_style ─────────────────────────────

describe("compound_cognitive_style", () => {
  it("fires when 2+ of the 4 inputs are present", () => {
    const getAnswer = makeGetAnswer({
      t2_q01: "experiential",
      t2_q02: "intuitive",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find(
      (s) => s.rule_id === "compound_cognitive_style"
    );

    expect(signal).toBeDefined();
    expect(signal?.value).toBe("computed");
    expect(signal?.confidence).toBe(0.9);
  });

  it("builds export_instruction from matched values", () => {
    const getAnswer = makeGetAnswer({
      t2_q01: "experiential",
      t2_q02: "analytical",
      t2_q03: "concrete",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find(
      (s) => s.rule_id === "compound_cognitive_style"
    );

    expect(signal?.export_instruction).toContain("learn by doing");
    expect(signal?.export_instruction).toContain("provide data and analysis");
    expect(signal?.export_instruction).toContain(
      "use concrete examples and analogies"
    );
  });

  it("includes correct question IDs in inputs", () => {
    const getAnswer = makeGetAnswer({
      t2_q01: "theoretical",
      t2_q08: "visual_spatial",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find(
      (s) => s.rule_id === "compound_cognitive_style"
    );

    expect(signal?.inputs).toContain("t2_q01");
    expect(signal?.inputs).toContain("t2_q08");
    expect(signal?.inputs).not.toContain("t2_q02");
    expect(signal?.inputs).not.toContain("t2_q03");
  });

  it("returns null when fewer than 2 inputs are present", () => {
    const getAnswer = makeGetAnswer({ t2_q01: "experiential" });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find(
      (s) => s.rule_id === "compound_cognitive_style"
    );

    expect(signal).toBeUndefined();
  });

  it("returns null when no inputs are present", () => {
    const getAnswer = makeGetAnswer({});

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find(
      (s) => s.rule_id === "compound_cognitive_style"
    );

    expect(signal).toBeUndefined();
  });
});

// ─── compound_work_rhythm ─────────────────────────────────

describe("compound_work_rhythm", () => {
  it("fires when 2+ of the 4 inputs are present", () => {
    const getAnswer = makeGetAnswer({
      t3_q01: "sprinter",
      t3_q02: "late_morning",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_work_rhythm");

    expect(signal).toBeDefined();
    expect(signal?.value).toBe("computed");
    expect(signal?.confidence).toBe(0.85);
  });

  it("builds export_instruction from matched values", () => {
    const getAnswer = makeGetAnswer({
      t3_q01: "marathoner",
      t3_q02: "early_morning",
      t3_q12: "pomodoro",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_work_rhythm");

    expect(signal?.export_instruction).toContain(
      "Steady pace throughout the day"
    );
    expect(signal?.export_instruction).toContain("Peak: early morning");
    expect(signal?.export_instruction).toContain("Pomodoro-style timing");
  });

  it("includes correct question IDs in inputs", () => {
    const getAnswer = makeGetAnswer({
      t3_q01: "wave_rider",
      t3_q11: "some_curve",
    });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_work_rhythm");

    expect(signal?.inputs).toContain("t3_q01");
    expect(signal?.inputs).toContain("t3_q11");
    expect(signal?.inputs).not.toContain("t3_q02");
    expect(signal?.inputs).not.toContain("t3_q12");
  });

  it("returns null when fewer than 2 inputs are present", () => {
    const getAnswer = makeGetAnswer({ t3_q01: "sprinter" });

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_work_rhythm");

    expect(signal).toBeUndefined();
  });

  it("returns null when no inputs are present", () => {
    const getAnswer = makeGetAnswer({});

    const signals = detectCompoundSignals(getAnswer);
    const signal = signals.find((s) => s.rule_id === "compound_work_rhythm");

    expect(signal).toBeUndefined();
  });
});
