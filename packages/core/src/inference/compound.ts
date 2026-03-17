/**
 * Layer 2B — Compound Signal Detection
 *
 * Cross-tier pattern matching. Fires AFTER all explicit answers are collected.
 * Produces high-confidence composite insights from multiple dimensions.
 */

import type { CompoundValue, DimensionValue } from "../schema/types.js";

interface CompoundRule {
  rule_id: string;
  name: string;
  evaluate: (
    getAnswer: (questionId: string) => string | undefined
  ) => CompoundValue | null;
}

// ─── Helper ────────────────────────────────────────────────

function countMatching(
  getAnswer: (id: string) => string | undefined,
  checks: Array<{ questionId: string; matchValues: string[] }>
): { matched: number; total: number; inputs: string[] } {
  let matched = 0;
  const inputs: string[] = [];

  for (const check of checks) {
    const val = getAnswer(check.questionId);
    if (val && check.matchValues.includes(val)) {
      matched++;
      inputs.push(check.questionId);
    }
  }

  return { matched, total: checks.length, inputs };
}

function confidenceFromMatches(
  matched: number,
  total: number
): number {
  const ratio = matched / total;
  if (ratio >= 0.7) return 0.9;
  if (ratio >= 0.5) return 0.75;
  if (ratio >= 0.35) return 0.6;
  return 0.5;
}

function strengthFromMatches(matched: number): string {
  if (matched >= 4) return "strong";
  if (matched >= 3) return "moderate";
  if (matched >= 2) return "mild";
  return "none";
}

// ─── Rules ─────────────────────────────────────────────────

const rules: CompoundRule[] = [
  {
    rule_id: "compound_adhd",
    name: "ADHD Pattern",
    evaluate: (getAnswer) => {
      const result = countMatching(getAnswer, [
        // Legacy tier IDs
        {
          questionId: "t5_q01",
          matchValues: [
            "deadline_activated",
            "initiation_blocked",
            "interest_gated",
          ],
        },
        {
          questionId: "t5_q02",
          matchValues: ["impaired", "severely_impaired"],
        },
        {
          questionId: "t5_q03",
          matchValues: ["moderate", "intense"],
        },
        {
          questionId: "t2_q13",
          matchValues: ["hyperfocus_or_nothing", "divergent_drift"],
        },
        {
          questionId: "t3_q05",
          matchValues: ["deadline_driven", "stress_paralysis"],
        },
        {
          questionId: "t3_q16",
          matchValues: ["novelty_seeker", "perfectionist"],
        },
        {
          questionId: "t3_q20",
          matchValues: ["boredom", "overwhelm"],
        },
        {
          questionId: "t4_q19",
          matchValues: ["low", "rationalized_impulsivity"],
        },
        // Pack dimension keys (AI interview + pack-based profiles)
        {
          questionId: "work.deadline_behavior",
          matchValues: ["pressure_thrive", "panic_power"],
        },
        {
          questionId: "work_q01",
          matchValues: ["pressure_thrive", "panic_power"],
        },
        {
          questionId: "work.energy_archetype",
          matchValues: ["burst"],
        },
        {
          questionId: "work_q02",
          matchValues: ["burst"],
        },
        {
          questionId: "cognitive.attention_span",
          matchValues: ["short", "variable"],
        },
        {
          questionId: "work_q12",
          matchValues: ["short", "variable"],
        },
        {
          questionId: "work.breaks_pattern",
          matchValues: ["marathon"],
        },
        {
          questionId: "work_q13",
          matchValues: ["marathon"],
        },
        {
          questionId: "personality.stress_response",
          matchValues: ["one_step", "momentum"],
        },
        {
          questionId: "work_q05",
          matchValues: ["smallest_step", "just_start"],
        },
      ]);

      if (result.matched < 2) return null;

      const strength = strengthFromMatches(result.matched);
      // Confidence based on matched count alone — adding more cross-system
      // checks shouldn't penalize confidence when many signals fire.
      const confidence =
        result.matched >= 6 ? 0.9
        : result.matched >= 4 ? 0.75
        : result.matched >= 3 ? 0.6
        : 0.5;

      return {
        dimension: "compound.adhd_pattern",
        value: strength,
        confidence,
        rule_id: "compound_adhd",
        inputs: result.inputs,
        export_instruction:
          strength === "strong"
            ? "User shows ADHD-associated patterns. IF presenting a task or plan THEN break into 15-25 min chunks. Lead with the interesting part. One priority at a time. Use visible progress markers (1/5, 2/5...). IF task feels overwhelming THEN suggest the smallest possible first step."
            : strength === "moderate"
              ? "IF presenting tasks THEN keep chunks short (15-25 min). Lead with what's interesting, not what's first. Visible progress helps."
              : "IF task list is long THEN break into clear steps. Keep each step focused.",
      };
    },
  },

  {
    rule_id: "compound_directness",
    name: "Directness Profile",
    evaluate: (getAnswer) => {
      const directValues: Record<string, string[]> = {
        // Dimension keys — checked first (primary lookup for AI interview + pack profiles)
        "communication.directness": ["very_direct", "direct"],
        "communication.feedback_style": ["skip_praise", "brief_then_fix"],
        // Legacy tier IDs — fallbacks
        t1_q02: ["blunt", "direct"],
        t1_q09: ["critical_first", "direct_balanced"],
        t1_q13: ["direct"],
        t4_q06: ["direct", "reflective_then_direct"],
        // Pack question IDs — fallbacks when dimension keys absent
        setup_q02: ["frustrated", "annoyed"],
        core_q01: ["skip_praise", "brief_then_fix"],
      };

      const result = countMatching(
        getAnswer,
        Object.entries(directValues).map(([questionId, matchValues]) => ({
          questionId,
          matchValues,
        }))
      );

      if (result.matched < 2) return null;

      // "very_high" when 4+ directness signals fire (covers both old and new IDs)
      const veryDirect = result.matched >= 4;
      return {
        dimension: "compound.directness",
        value: veryDirect ? "very_high" : "high",
        confidence: veryDirect ? 0.95 : 0.8,
        rule_id: "compound_directness",
        inputs: result.inputs,
        export_instruction: veryDirect
          ? "IF reviewing my work THEN skip praise, show the bug and the fix. IF explaining THEN lead with the conclusion, then support. Never cushion bad news. No preamble."
          : "IF giving feedback THEN lead with the issue, not the context. Be straightforward but not abrupt.",
      };
    },
  },

  {
    rule_id: "compound_autonomy",
    name: "Autonomy Profile",
    evaluate: (getAnswer) => {
      const result = countMatching(getAnswer, [
        // Legacy tier IDs
        {
          questionId: "t4_q10",
          matchValues: ["challenging", "autonomous"],
        },
        { questionId: "t4_q18", matchValues: ["low"] },
        {
          questionId: "t8_q03",
          matchValues: ["tool", "sparring_partner"],
        },
        { questionId: "t8_q07", matchValues: ["1", "2"] },
        // Pack dimension keys
        {
          questionId: "ai.relationship_model",
          matchValues: ["autonomous", "expert"],
        },
        {
          questionId: "core_q03",
          matchValues: ["just_do_it", "recommend"],
        },
        {
          questionId: "personality.confidence_style",
          matchValues: ["experimenter", "researcher"],
        },
        {
          questionId: "work_q08",
          matchValues: ["try", "research"],
        },
      ]);

      if (result.matched < 2) return null;

      const veryHigh = result.matched >= 3;
      return {
        dimension: "compound.autonomy",
        value: veryHigh ? "very_high" : "high",
        // Fixed confidence — not ratio-based so adding cross-system checks
        // doesn't deflate confidence when core signals fire.
        confidence: veryHigh ? 0.9 : 0.7,
        rule_id: "compound_autonomy",
        inputs: result.inputs,
        export_instruction: veryHigh
          ? "IF I ask a question THEN give the answer directly, don't ask clarifying questions first. IF presenting options THEN show trade-offs and let me choose. Never hand-hold or patronize."
          : "IF I need help THEN present options with trade-offs rather than a single directive. Respect my judgment.",
      };
    },
  },

  {
    rule_id: "compound_anxiety",
    name: "Anxiety-Adjacent Pattern",
    evaluate: (getAnswer) => {
      const result = countMatching(getAnswer, [
        { questionId: "t4_q13", matchValues: ["expected_it"] },
        {
          questionId: "t4_q14",
          matchValues: ["low", "conditional"],
        },
        { questionId: "t4_q15", matchValues: ["high"] },
        {
          questionId: "t5_q08",
          matchValues: ["elevated", "high"],
        },
      ]);

      if (result.matched < 3) return null;

      return {
        dimension: "compound.anxiety_pattern",
        value: "elevated",
        confidence: 0.7,
        rule_id: "compound_anxiety",
        inputs: result.inputs,
        export_instruction:
          "IF giving estimates or predictions THEN add honest uncertainty ranges. IF delivering bad news THEN be factual, not dramatic. Don't overpromise. Frame setbacks as solvable, not catastrophic.",
      };
    },
  },

  {
    rule_id: "compound_cognitive_style",
    name: "Cognitive Teaching Profile",
    evaluate: (getAnswer) => {
      // Legacy tier IDs
      const learning = getAnswer("t2_q01");
      const decision = getAnswer("t2_q02");
      const abstraction = getAnswer("t2_q03");
      const mentalModel = getAnswer("t2_q08");

      // Pack dimension keys (AI interview + pack-based profiles)
      const learningStyle = getAnswer("cognitive.learning_style") ?? getAnswer("work_q03");
      const decisionStyle = getAnswer("cognitive.decision_style") ?? getAnswer("work_q11");

      const legacyIds = ["t2_q01", "t2_q02", "t2_q03", "t2_q08"].filter(
        (id) => getAnswer(id) !== undefined
      );
      const packIds: string[] = [];
      if (getAnswer("cognitive.learning_style") !== undefined) packIds.push("cognitive.learning_style");
      else if (getAnswer("work_q03") !== undefined) packIds.push("work_q03");
      if (getAnswer("cognitive.decision_style") !== undefined) packIds.push("cognitive.decision_style");
      else if (getAnswer("work_q11") !== undefined) packIds.push("work_q11");

      const inputs = [...legacyIds, ...packIds];

      if (inputs.length < 2) return null;

      // Build a composite instruction
      const parts: string[] = [];

      // Legacy learning style values
      if (learning === "experiential") parts.push("learn by doing");
      if (learning === "theoretical") parts.push("theory first, then apply");
      if (learning === "observational") parts.push("watch first, then try");

      // Pack learning style values
      if (learningStyle === "hands_on") parts.push("learn by doing");
      if (learningStyle === "guided") parts.push("prefers structured tutorials and step-by-step guides");
      if (learningStyle === "conceptual") parts.push("theory first, then apply");
      if (learningStyle === "collaborative") parts.push("learns best interactively");

      // Legacy decision values
      if (decision === "intuitive")
        parts.push("give gut recommendation first");
      if (decision === "analytical")
        parts.push("provide data and analysis");
      if (decision === "consensus")
        parts.push("consider multiple perspectives");

      // Pack decision style values
      if (decisionStyle === "analytical") parts.push("provide data and analysis");
      if (decisionStyle === "intuitive") parts.push("give gut recommendation first");
      if (decisionStyle === "consensus") parts.push("consider multiple perspectives");
      if (decisionStyle === "rapid") parts.push("decide fast with clear recommendation");

      // Legacy abstraction and mental model values
      if (abstraction === "concrete")
        parts.push("use concrete examples and analogies");
      if (abstraction === "abstract")
        parts.push("use frameworks and models");
      if (mentalModel === "visual_spatial")
        parts.push("use diagrams and spatial language");
      if (mentalModel === "verbal_linguistic")
        parts.push("explain in words");
      if (mentalModel === "logical_sequential")
        parts.push("use step-by-step logic");

      // Deduplicate parts
      const uniqueParts = [...new Set(parts)];

      // Resolve contradictions: if conflicting styles present, keep first match
      const contradictions: [string, string][] = [
        ["learn by doing", "theory first, then apply"],
        ["give gut recommendation first", "provide data and analysis"],
        ["use concrete examples and analogies", "use frameworks and models"],
      ];

      for (const [a, b] of contradictions) {
        if (uniqueParts.includes(a) && uniqueParts.includes(b)) {
          // Keep whichever appeared first (from the profile answers order)
          const idxA = uniqueParts.indexOf(a);
          const idxB = uniqueParts.indexOf(b);
          uniqueParts.splice(Math.max(idxA, idxB), 1);
        }
      }

      return {
        dimension: "compound.cognitive_style",
        value: "computed",
        confidence: 0.9,
        rule_id: "compound_cognitive_style",
        inputs,
        export_instruction: `User's cognitive profile: ${uniqueParts.join(". ")}.`,
      };
    },
  },

  {
    rule_id: "compound_work_rhythm",
    name: "Optimal Work Schedule",
    evaluate: (getAnswer) => {
      // Legacy tier IDs
      const energy = getAnswer("t3_q01");
      const peak = getAnswer("t3_q02");
      const curve = getAnswer("t3_q11");
      const breaks = getAnswer("t3_q12");

      // Pack dimension keys (AI interview + pack-based profiles)
      const energyArchetype = getAnswer("work.energy_archetype") ?? getAnswer("work_q02");
      const breaksPattern = getAnswer("work.breaks_pattern") ?? getAnswer("work_q13");

      const legacyIds = ["t3_q01", "t3_q02", "t3_q11", "t3_q12"].filter(
        (id) => getAnswer(id) !== undefined
      );
      const packIds: string[] = [];
      if (getAnswer("work.energy_archetype") !== undefined) packIds.push("work.energy_archetype");
      else if (getAnswer("work_q02") !== undefined) packIds.push("work_q02");
      if (getAnswer("work.breaks_pattern") !== undefined) packIds.push("work.breaks_pattern");
      else if (getAnswer("work_q13") !== undefined) packIds.push("work_q13");

      const inputs = [...legacyIds, ...packIds];

      if (inputs.length < 2) return null;

      const parts: string[] = [];

      // Legacy energy values
      if (energy === "sprinter")
        parts.push("Works in deep bursts, then done");
      if (energy === "marathoner")
        parts.push("Steady pace throughout the day");
      if (energy === "wave_rider")
        parts.push("Energy comes in waves, ride them");

      // Pack energy archetype values
      if (energyArchetype === "morning") parts.push("Peak: early morning");
      if (energyArchetype === "afternoon") parts.push("Peak: afternoon");
      if (energyArchetype === "night") parts.push("Peak: evening/night");
      if (energyArchetype === "burst") parts.push("Works in bursts when inspiration hits");

      // Legacy peak values
      if (peak === "early_morning") parts.push("Peak: early morning");
      if (peak === "late_morning") parts.push("Peak: late morning (9-12)");
      if (peak === "afternoon") parts.push("Peak: afternoon");
      if (peak === "evening") parts.push("Peak: evening/night");

      // Legacy breaks values
      if (breaks === "all_or_nothing")
        parts.push("No micro-breaks — either deep focus or crash");
      if (breaks === "regular")
        parts.push("Needs regular breaks to sustain");
      if (breaks === "pomodoro") parts.push("Pomodoro-style timing");

      // Pack breaks pattern values
      if (breaksPattern === "pomodoro") parts.push("Pomodoro-style timing");
      if (breaksPattern === "marathon") parts.push("Works in long stretches then crashes");
      if (breaksPattern === "random") parts.push("Takes breaks randomly");
      if (breaksPattern === "none") parts.push("No scheduled breaks — works until done");

      // Deduplicate parts
      const uniqueParts = [...new Set(parts)];

      return {
        dimension: "compound.work_rhythm",
        value: "computed",
        confidence: 0.85,
        rule_id: "compound_work_rhythm",
        inputs,
        export_instruction: `Work rhythm: ${uniqueParts.join(". ")}.`,
      };
    },
  },

  // ─── Pack-based compound rules ──────────────────────────

  // Direct + Expert + Burst → "Power User" profile
  {
    rule_id: "compound_power_user",
    name: "Power User Pattern",
    evaluate: (getAnswer) => {
      const result = countMatching(getAnswer, [
        // Dimension keys — primary lookup
        { questionId: "communication.directness", matchValues: ["very_direct"] }, // minimal verbosity
        { questionId: "expertise.level", matchValues: ["expert", "senior"] }, // expert level
        { questionId: "ai.relationship_model", matchValues: ["autonomous", "expert"] }, // autonomous AI use
        { questionId: "work.deadline_behavior", matchValues: ["pressure_thrive", "panic_power"] }, // burst/pressure
        { questionId: "communication.feedback_style", matchValues: ["skip_praise", "brief_then_fix"] }, // no praise
        // Pack question IDs — fallbacks
        { questionId: "setup_q02", matchValues: ["frustrated"] }, // minimal verbosity
        { questionId: "work_q01", matchValues: ["pressure_thrive", "panic_power"] }, // burst/pressure
        { questionId: "work_q04", matchValues: ["speed"] }, // pragmatic
        { questionId: "work_q07", matchValues: ["expert"] }, // expert level
        { questionId: "core_q01", matchValues: ["skip_praise"] }, // no praise
      ]);

      if (result.matched < 3) return null;

      return {
        dimension: "compound.power_user",
        value: result.matched >= 4 ? "strong" : "moderate",
        confidence: confidenceFromMatches(result.matched, result.total),
        rule_id: "compound_power_user",
        inputs: result.inputs,
        export_instruction: result.matched >= 4
          ? "Power user. Skip ALL explanations unless asked. Lead with code/solution. Never hand-hold. Match my speed — if I'm moving fast, keep up."
          : "IF topic is routine THEN give the answer, skip the explanation. IF topic is novel THEN brief context is OK but lead with the solution.",
      };
    },
  },

  // Supportive + Beginner + Avoider → "Gentle Guide" profile
  {
    rule_id: "compound_needs_guidance",
    name: "Needs Gentle Guidance",
    evaluate: (getAnswer) => {
      const result = countMatching(getAnswer, [
        { questionId: "setup_q02", matchValues: ["likes_detail", "conditional"] },
        { questionId: "core_q01", matchValues: ["appreciate_first"] }, // supportive feedback
        { questionId: "work_q07", matchValues: ["beginner"] }, // beginner
        { questionId: "work_q08", matchValues: ["avoid", "ask"] }, // uncertain
        { questionId: "work_q01", matchValues: ["overwhelm"] }, // overwhelm under pressure
      ]);

      if (result.matched < 3) return null;

      return {
        dimension: "compound.needs_guidance",
        value: "yes",
        confidence: confidenceFromMatches(result.matched, result.total),
        rule_id: "compound_needs_guidance",
        inputs: result.inputs,
        export_instruction: "IF presenting a complex task THEN break it into numbered steps, max 3 at a time. Start with encouragement. Recommend ONE path, not options. IF I seem stuck THEN suggest the smallest next action.",
      };
    },
  },

  // Freedom + Burst + Impulsive → "Free Spirit" profile
  {
    rule_id: "compound_free_spirit",
    name: "Free Spirit Pattern",
    evaluate: (getAnswer) => {
      const result = countMatching(getAnswer, [
        { questionId: "story_q04", matchValues: ["freedom"] }, // motivated by freedom
        { questionId: "work_q01", matchValues: ["panic_power", "pressure_thrive"] }, // burst
        { questionId: "lifestyle_q01", matchValues: ["already_packing"] }, // spontaneous
        { questionId: "lifestyle_q04", matchValues: ["no_prep"] }, // no planning
      ]);

      if (result.matched < 3) return null;

      return {
        dimension: "compound.free_spirit",
        value: "yes",
        confidence: confidenceFromMatches(result.matched, result.total),
        rule_id: "compound_free_spirit",
        inputs: result.inputs,
        export_instruction: "IF planning or scheduling THEN suggest loosely, don't lock in times. Present options as adventures, not obligations. IF I resist structure THEN respect it — offer a single next step instead.",
      };
    },
  },
];

// ─── Engine ────────────────────────────────────────────────

export function detectCompoundSignals(
  getAnswerValue: (questionId: string) => string | undefined
): CompoundValue[] {
  const signals: CompoundValue[] = [];

  for (const rule of rules) {
    const result = rule.evaluate(getAnswerValue);
    if (result) {
      signals.push(result);
    }
  }

  return signals;
}
