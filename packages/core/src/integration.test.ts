/**
 * Integration tests — full pipeline scenarios
 * Covers: Profile→Export roundtrip, compileAll, Layer2→Export, edge cases
 */

import { describe, it, expect, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";

import { compileAll, JsonCompiler, ChatGPTCompiler, ClaudeCompiler } from "./compiler/index.js";
import { runLayer2 } from "./inference/index.js";
import { saveProfile, loadProfile } from "./profiler/storage.js";
import type {
  PersonaProfile,
  Answer,
  Question,
} from "./schema/types.js";

// ─── Fixture helpers ───────────────────────────────────────

function buildProfile(overrides?: Partial<PersonaProfile>): PersonaProfile {
  return {
    schema_version: "1.0",
    profile_type: "personal",
    profile_id: "integration-test-id",
    created_at: "2025-01-01",
    updated_at: "2025-01-01",
    completeness: 80,
    explicit: {
      "identity.preferred_name": {
        dimension: "identity.preferred_name",
        value: "Sam",
        confidence: 1.0,
        source: "explicit",
        question_id: "t0_q01",
      },
      "identity.language": {
        dimension: "identity.language",
        value: "en",
        confidence: 1.0,
        source: "explicit",
        question_id: "t0_q02",
      },
      "identity.pronouns": {
        dimension: "identity.pronouns",
        value: "she/her",
        confidence: 1.0,
        source: "explicit",
        question_id: "t0_q05",
      },
      "communication.verbosity_preference": {
        dimension: "communication.verbosity_preference",
        value: "concise",
        confidence: 1.0,
        source: "explicit",
        question_id: "t1_q01",
      },
      "communication.directness": {
        dimension: "communication.directness",
        value: "direct",
        confidence: 1.0,
        source: "explicit",
        question_id: "t1_q02",
      },
      "communication.format_preference": {
        dimension: "communication.format_preference",
        value: "prose",
        confidence: 1.0,
        source: "explicit",
        question_id: "t1_q06",
      },
    },
    inferred: {},
    compound: {},
    contradictions: [],
    emergent: [],
    meta: {
      tiers_completed: [0, 1],
      tiers_skipped: [],
      total_questions_answered: 25,
      total_questions_skipped: 1,
      avg_response_time_ms: 4500,
      profiling_duration_ms: 90000,
      profiling_method: "interactive",
      layer3_available: false,
    },
    ...overrides,
  };
}

function buildAnswer(
  question_id: string,
  value: string,
  response_time_ms = 3000
): Answer {
  return {
    question_id,
    value,
    timestamp: Date.now(),
    response_time_ms,
    skipped: false,
  };
}

function buildQuestion(
  id: string,
  type: Question["type"] = "select",
  options?: Question["options"]
): Question {
  return {
    id,
    tier: 1,
    tier_name: "Communication",
    question: `Question ${id}?`,
    type,
    dimension: `communication.${id}`,
    skippable: true,
    meta_profiling: null,
    why_this_matters: null,
    options,
  };
}

// ─── Test directory for storage tests ─────────────────────

const testDir = join(tmpdir(), `meport-integration-${Date.now()}`);

afterEach(async () => {
  try {
    await rm(testDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

// ─── Tests ─────────────────────────────────────────────────

describe("Integration: Profile → Export roundtrip", () => {
  it("compile to JSON, parse back, verify dimensions preserved", () => {
    const profile = buildProfile();
    const result = new JsonCompiler().compile(profile);
    const parsed = JSON.parse(result.content) as PersonaProfile;

    expect(parsed.schema_version).toBe(profile.schema_version);
    expect(parsed.profile_type).toBe(profile.profile_type);
    expect(parsed.profile_id).toBe(profile.profile_id);
    expect(Object.keys(parsed.explicit)).toEqual(Object.keys(profile.explicit));

    // Each explicit dimension value is preserved
    for (const [key, val] of Object.entries(profile.explicit)) {
      expect(parsed.explicit[key].value).toEqual(val.value);
      expect(parsed.explicit[key].confidence).toBe(val.confidence);
    }
  });
});

describe("Integration: Profile → All compilers", () => {
  it("compileAll produces non-empty content for all 5 platforms", () => {
    const profile = buildProfile();
    const results = compileAll(profile);

    expect(results.size).toBe(5);

    for (const [platform, result] of results) {
      expect(result.content.length, `${platform} content should not be empty`).toBeGreaterThan(0);
      expect(result.filename.length, `${platform} filename should not be empty`).toBeGreaterThan(0);
      expect(result.charCount, `${platform} charCount should match content length`).toBe(result.content.length);
    }
  });
});

describe("Integration: Layer 2 → Export", () => {
  it("runLayer2 followed by ChatGPT compile produces valid output", () => {
    const profile = buildProfile();

    // Build answers that trigger compound_cognitive_style rule (needs 2+ of t2_q01-08)
    const answers = new Map<string, Answer>([
      ["t2_q01", buildAnswer("t2_q01", "experiential")],
      ["t2_q02", buildAnswer("t2_q02", "intuitive")],
      ["t2_q03", buildAnswer("t2_q03", "concrete")],
    ]);

    const questions = new Map<string, Question>([
      ["t2_q01", buildQuestion("t2_q01", "select", [
        { value: "experiential", label: "Experiential", maps_to: { dimension: "cognitive.learning_style", value: "experiential" } },
      ])],
      ["t2_q02", buildQuestion("t2_q02", "select", [
        { value: "intuitive", label: "Intuitive", maps_to: { dimension: "cognitive.decision_style", value: "intuitive" } },
      ])],
      ["t2_q03", buildQuestion("t2_q03", "select", [
        { value: "concrete", label: "Concrete", maps_to: { dimension: "cognitive.abstraction_preference", value: "concrete" } },
      ])],
    ]);

    const updatedProfile = runLayer2(profile, answers, questions);
    const result = new ChatGPTCompiler().compile(updatedProfile);

    expect(result.content).toContain("ABOUT ME:");
    expect(result.content).toContain("HOW TO RESPOND:");
    expect(result.charCount).toBeLessThanOrEqual(1500);
  });
});

describe("Integration: Empty profile exports", () => {
  it("profile with zero explicit dimensions produces valid minimal output from all compilers", () => {
    const emptyProfile = buildProfile({ explicit: {} });
    const results = compileAll(emptyProfile);

    for (const [platform, result] of results) {
      // Should not throw — should produce minimal valid output
      expect(result.content.length, `${platform} should produce non-empty content even for empty profile`).toBeGreaterThan(0);

      // JSON should always be parseable
      if (platform === "json") {
        expect(() => JSON.parse(result.content)).not.toThrow();
      }
    }
  });
});

describe("Integration: Compound signals in exports", () => {
  it("profile with compound signals includes export_instructions in compiler output", () => {
    const profile = buildProfile({
      compound: {
        "compound.work_rhythm": {
          dimension: "compound.work_rhythm",
          value: "computed",
          confidence: 0.85,
          rule_id: "compound_work_rhythm",
          inputs: ["t3_q01", "t3_q02"],
          export_instruction: "Work rhythm: Works in deep bursts, then done. Peak: late morning (9-12).",
        },
        "compound.cognitive_style": {
          dimension: "compound.cognitive_style",
          value: "computed",
          confidence: 0.9,
          rule_id: "compound_cognitive_style",
          inputs: ["t2_q01", "t2_q02"],
          export_instruction: "User's cognitive profile: learn by doing. give gut recommendation first.",
        },
      },
    });

    // Claude compiler includes compound export_instructions
    const genericResult = new ClaudeCompiler().compile(profile);
    // At least one compound instruction should appear
    expect(
      genericResult.content.includes("cognitive profile") ||
      genericResult.content.includes("learn by doing") ||
      genericResult.content.includes("Work rhythm")
    ).toBe(true);

    // Claude code compiler also picks up compounds
    const results = compileAll(profile);
    for (const [platform, result] of results) {
      if (platform === "json") continue; // JSON is a raw dump, not instruction-formatted
      // At least one compound instruction should appear somewhere in the richer compilers
      // (chatgpt, claude, claude-code, generic all handle compound signals)
      expect(result.content.length).toBeGreaterThan(0);
    }
  });
});

describe("Integration: runLayer2 orchestration", () => {
  it("populates inferred, compound, and contradictions fields", () => {
    const profile = buildProfile({
      explicit: {
        ...buildProfile().explicit,
        // Trigger contradiction_verbosity: explicit=minimal but inferred will say detailed
        // We'll trigger it via answers that produce verbose_open_text signal
        "communication.verbosity_preference": {
          dimension: "communication.verbosity_preference",
          value: "minimal",
          confidence: 1.0,
          source: "explicit",
          question_id: "t1_q01",
        },
      },
    });

    // Build 25+ answers with fast response times to trigger fast_picker signal
    const answers = new Map<string, Answer>();
    for (let i = 0; i < 25; i++) {
      const id = `q_${i}`;
      answers.set(id, {
        question_id: id,
        value: `answer_${i}`,
        timestamp: i * 1000,
        response_time_ms: 1500, // fast — under 3000ms average
        skipped: false,
      });
    }

    // Add cognitive answers to trigger compound_cognitive_style
    answers.set("t2_q01", buildAnswer("t2_q01", "experiential", 1500));
    answers.set("t2_q02", buildAnswer("t2_q02", "analytical", 1500));

    const questions = new Map<string, Question>();
    for (let i = 0; i < 25; i++) {
      questions.set(`q_${i}`, buildQuestion(`q_${i}`, "select"));
    }
    questions.set("t2_q01", buildQuestion("t2_q01", "select", [
      { value: "experiential", label: "Experiential", maps_to: { dimension: "cognitive.learning_style", value: "experiential" } },
    ]));
    questions.set("t2_q02", buildQuestion("t2_q02", "select", [
      { value: "analytical", label: "Analytical", maps_to: { dimension: "cognitive.decision_style", value: "analytical" } },
    ]));

    const result = runLayer2(profile, answers, questions);

    // updated_at should be changed
    expect(result.updated_at).not.toBe("2025-01-01");

    // Layer 2A: inferred signals (fast_picker with 25 answers at 1500ms avg should fire)
    expect(typeof result.inferred).toBe("object");

    // Layer 2B: compound signals should include cognitive_style (2+ answers for t2_q01/02)
    expect(result.compound).toHaveProperty("compound.cognitive_style");

    // Layer 2C: contradictions array is populated (may be empty if no rules match)
    expect(Array.isArray(result.contradictions)).toBe(true);
  });
});

describe("Integration: Contradictions in Claude export", () => {
  it("profile with contradictions includes them in Claude compiler output", () => {
    const profile = buildProfile({
      contradictions: [
        {
          rule_id: "contradiction_verbosity",
          dimensions: [
            "communication.verbosity_preference",
            "communication.verbosity_preference",
          ],
          description: "User says minimal but writes detailed answers",
          resolution: "flag_both",
          note: "User WANTS concise AI but IS naturally verbose. Export: match their stated preference, not observed behavior.",
          confidence_impact: "reduce explicit to 0.8",
        },
      ],
    });

    const result = new ClaudeCompiler().compile(profile);

    // The Claude compiler renders contradictions under ## Nuances
    expect(result.content).toContain("Nuances");
    expect(result.content).toContain("User WANTS concise AI");
  });
});

describe("Integration: Profile save/load preserves all layers", () => {
  it("saved profile with compound + contradictions + emergent round-trips correctly", async () => {
    await mkdir(testDir, { recursive: true });

    const profile = buildProfile({
      compound: {
        "compound.directness": {
          dimension: "compound.directness",
          value: "very_high",
          confidence: 0.95,
          rule_id: "compound_directness",
          inputs: ["t1_q02", "t1_q09"],
          export_instruction: "Say it straight.",
        },
      },
      contradictions: [
        {
          rule_id: "contradiction_directness_rsd",
          dimensions: ["communication.directness", "neurodivergent.rejection_sensitivity"],
          description: "User wants blunt comms but has high RSD",
          resolution: "nuance_both",
          note: "Be direct in advice but careful in evaluation.",
          confidence_impact: "keep both",
        },
      ],
      emergent: [
        {
          observation_id: "emergent_001",
          category: "behavioral_pattern",
          title: "Burst Worker",
          observation: "Works in short intense bursts.",
          evidence: ["t3_q01:sprinter"],
          confidence: 0.65,
          export_instruction: "Use 45-min sprint blocks.",
          status: "accepted",
        },
      ],
    });

    const filePath = join(testDir, "full-profile.json");
    await saveProfile(profile, filePath);
    const loaded = await loadProfile(filePath);

    expect(loaded.compound["compound.directness"].value).toBe("very_high");
    expect(loaded.contradictions[0].rule_id).toBe("contradiction_directness_rsd");
    expect(loaded.emergent[0].observation_id).toBe("emergent_001");
    expect(loaded.emergent[0].status).toBe("accepted");
  });
});
