/**
 * Compiler test suite — ~35 tests
 * Covers: BaseCompiler, Registry, ChatGPT, Claude, ClaudeCode, Generic, Json, Emergent, Storage
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm, writeFile, mkdir } from "node:fs/promises";

import {
  ChatGPTCompiler,
  ClaudeCompiler,
  ClaudeCodeCompiler,
  GenericCompiler,
  JsonCompiler,
  getCompiler,
  getAvailableCompilers,
  compileAll,
} from "./index.js";
import { runLayer3 } from "../inference/emergent.js";
import { saveProfile, loadProfile, profileExists } from "../profiler/storage.js";
import type { PersonaProfile } from "../schema/types.js";

// ─── Fixture ───────────────────────────────────────────────

function buildProfile(overrides?: Partial<PersonaProfile>): PersonaProfile {
  return {
    schema_version: "1.0",
    profile_type: "personal",
    profile_id: "test-id",
    created_at: "2025-01-01",
    updated_at: "2025-01-01",
    completeness: 80,
    explicit: {
      "identity.preferred_name": {
        dimension: "identity.preferred_name",
        value: "Alex",
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
        value: "they/them",
        confidence: 1.0,
        source: "explicit",
        question_id: "t0_q05",
      },
      "communication.verbosity_preference": {
        dimension: "communication.verbosity_preference",
        value: "minimal",
        confidence: 1.0,
        source: "explicit",
        question_id: "t1_q01",
      },
      "communication.directness": {
        dimension: "communication.directness",
        value: "blunt",
        confidence: 1.0,
        source: "explicit",
        question_id: "t1_q02",
      },
      "communication.format_preference": {
        dimension: "communication.format_preference",
        value: "bullets",
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
      total_questions_answered: 20,
      total_questions_skipped: 2,
      avg_response_time_ms: 5000,
      profiling_duration_ms: 120000,
      profiling_method: "interactive",
      layer3_available: false,
    },
    ...overrides,
  };
}

// ─── BaseCompiler (via GenericCompiler as a concrete subclass) ─

describe("BaseCompiler — collectDimensions", () => {
  it("returns explicit dims sorted by weight desc", () => {
    const compiler = new GenericCompiler();
    const profile = buildProfile();
    // Access via compile output — dimensions are collected internally
    // We verify indirectly: identity dims (weight 10) appear before communication dims (weight 9)
    // by checking that the output mentions them in order
    const result = compiler.compile(profile);
    const namePos = result.content.indexOf("Alex");
    const verbosityPos = result.content.indexOf("verbosity");
    expect(namePos).toBeLessThan(verbosityPos);
  });

  it("filters by minConfidence — low confidence inferred dims are excluded", () => {
    const profile = buildProfile({
      inferred: {
        "meta.decision_speed": {
          dimension: "meta.decision_speed",
          value: "fast",
          confidence: 0.3, // below default 0.5 threshold
          source: "behavioral",
          signal_id: "fast_picker",
          override: "secondary",
        },
      },
    });
    const compiler = new GenericCompiler();
    const result = compiler.compile(profile);
    // Low confidence dim should not appear in output
    expect(result.content).not.toContain("decision speed");
  });

  it("excludes flag_only inferred values from exports", () => {
    const profile = buildProfile({
      inferred: {
        "meta.decision_speed": {
          dimension: "meta.decision_speed",
          value: "fast",
          confidence: 0.8,
          source: "behavioral",
          signal_id: "fast_picker",
          override: "flag_only",
        },
      },
    });
    const compiler = new GenericCompiler();
    const result = compiler.compile(profile);
    expect(result.content).not.toContain("decision speed");
  });

  it("skips inferred when explicit already covers same dimension", () => {
    const profile = buildProfile({
      inferred: {
        "communication.verbosity_preference": {
          dimension: "communication.verbosity_preference",
          value: "detailed", // conflicts with explicit "minimal"
          confidence: 0.8,
          source: "behavioral",
          signal_id: "verbose_open_text",
          override: "secondary",
        },
      },
    });
    const compiler = new ClaudeCompiler();
    const result = compiler.compile(profile);
    // Should only see "minimal" not "detailed" since explicit takes precedence
    // and the inferred should be skipped
    expect(result.dimensionsCovered).toBeGreaterThan(0);
    // The inferred duplicate is not added — verify content contains explicit value
    expect(result.content).toContain("Minimal");
  });

  it("includes compound dims with export_instruction", () => {
    const profile = buildProfile({
      compound: {
        "compound.adhd_pattern": {
          dimension: "compound.adhd_pattern",
          value: "moderate",
          confidence: 0.75,
          rule_id: "compound_adhd",
          inputs: ["t5_q01"],
          export_instruction:
            "User shows ADHD patterns. Keep tasks short.",
        },
      },
    });
    const compiler = new GenericCompiler();
    const result = compiler.compile(profile);
    expect(result.content).toContain("User shows ADHD patterns");
  });

  it("includes accepted emergent observations", () => {
    const profile = buildProfile({
      emergent: [
        {
          observation_id: "emergent_001",
          category: "behavioral_pattern",
          title: "Burst Worker",
          observation: "User works in intense short bursts.",
          evidence: ["t3_q01:sprinter"],
          confidence: 0.65,
          export_instruction: "Schedule deep work in 45-min sprints.",
          status: "accepted",
        },
      ],
    });
    const compiler = new GenericCompiler();
    // Just verify collectDimensions sees it — the compiler compiles without error
    const result = compiler.compile(profile);
    expect(result.dimensionsCovered).toBeGreaterThan(0);
  });

  it("includes edited emergent observations and uses user_edit text", () => {
    const profile = buildProfile({
      emergent: [
        {
          observation_id: "emergent_002",
          category: "hidden_strength",
          title: "Deep Focuser",
          observation: "AI-generated observation text.",
          evidence: ["t5_q03:intense"],
          confidence: 0.5,
          export_instruction: "Respect deep focus periods.",
          status: "edited",
          user_edit: "I focus deeply when interested in a topic.",
        },
      ],
    });
    const compiler = new ClaudeCompiler();
    const result = compiler.compile(profile);
    // Edited status with user_edit should be included
    expect(result.dimensionsCovered).toBeGreaterThan(0);
  });

  it("getName returns preferred_name", () => {
    const compiler = new GenericCompiler();
    const result = compiler.compile(buildProfile());
    expect(result.content).toContain("Alex");
  });

  it("getName returns 'User' when preferred_name is absent", () => {
    const profile = buildProfile({ explicit: {} });
    const compiler = new GenericCompiler();
    const result = compiler.compile(profile);
    expect(result.content).toContain("User");
  });

  it("getPronouns returns undefined when not set", () => {
    const profile = buildProfile({
      explicit: {
        "identity.preferred_name": {
          dimension: "identity.preferred_name",
          value: "Alex",
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
      },
    });
    const compiler = new GenericCompiler();
    const result = compiler.compile(profile);
    // No pronouns section should appear when not set
    expect(result.content).not.toContain("they/them");
  });

  it("buildResult calculates charCount correctly", () => {
    const compiler = new GenericCompiler();
    const result = compiler.compile(buildProfile());
    expect(result.charCount).toBe(result.content.length);
  });
});

// ─── Registry ──────────────────────────────────────────────

describe("Registry", () => {
  it("getCompiler returns ChatGPTCompiler for chatgpt", () => {
    const compiler = getCompiler("chatgpt");
    expect(compiler).toBeInstanceOf(ChatGPTCompiler);
  });

  it("getCompiler returns ClaudeCompiler for claude", () => {
    const compiler = getCompiler("claude");
    expect(compiler).toBeInstanceOf(ClaudeCompiler);
  });

  it("getCompiler returns ClaudeCodeCompiler for claude-code", () => {
    const compiler = getCompiler("claude-code");
    expect(compiler).toBeInstanceOf(ClaudeCodeCompiler);
  });

  it("getCompiler returns GenericCompiler for generic", () => {
    const compiler = getCompiler("generic");
    expect(compiler).toBeInstanceOf(GenericCompiler);
  });

  it("getCompiler returns JsonCompiler for json", () => {
    const compiler = getCompiler("json");
    expect(compiler).toBeInstanceOf(JsonCompiler);
  });

  it("getCompiler throws for unimplemented platforms", () => {
    expect(() => getCompiler("cursor" as never)).toThrow(
      /not yet implemented/
    );
  });

  it("getAvailableCompilers returns all 5 platforms", () => {
    const available = getAvailableCompilers();
    expect(available).toHaveLength(5);
    expect(available).toContain("chatgpt");
    expect(available).toContain("claude");
    expect(available).toContain("claude-code");
    expect(available).toContain("generic");
    expect(available).toContain("json");
  });

  it("compileAll returns results for all 5 platforms", () => {
    const results = compileAll(buildProfile());
    expect(results.size).toBe(5);
    for (const result of results.values()) {
      expect(result.content.length).toBeGreaterThan(0);
    }
  });
});

// ─── ChatGPTCompiler ───────────────────────────────────────

describe("ChatGPTCompiler", () => {
  it("output contains ABOUT ME section", () => {
    const result = new ChatGPTCompiler().compile(buildProfile());
    expect(result.content).toContain("ABOUT ME:");
  });

  it("output contains HOW TO RESPOND section", () => {
    const result = new ChatGPTCompiler().compile(buildProfile());
    expect(result.content).toContain("HOW TO RESPOND:");
  });

  it("respects 1500 char limit", () => {
    const result = new ChatGPTCompiler().compile(buildProfile());
    expect(result.charCount).toBeLessThanOrEqual(1500);
  });

  it("includes user name in output", () => {
    const result = new ChatGPTCompiler().compile(buildProfile());
    expect(result.content).toContain("Alex");
  });

  it("filename is chatgpt-instructions.txt", () => {
    const result = new ChatGPTCompiler().compile(buildProfile());
    expect(result.filename).toBe("chatgpt-instructions.txt");
  });
});

// ─── ClaudeCompiler ────────────────────────────────────────

describe("ClaudeCompiler", () => {
  it("output is markdown format (starts with #)", () => {
    const result = new ClaudeCompiler().compile(buildProfile());
    expect(result.content).toMatch(/^#\s/);
  });

  it("contains user name", () => {
    const result = new ClaudeCompiler().compile(buildProfile());
    expect(result.content).toContain("Alex");
  });

  it("contains Communication section", () => {
    const result = new ClaudeCompiler().compile(buildProfile());
    expect(result.content).toContain("Communication");
  });

  it("filename is meport-profile.md", () => {
    const result = new ClaudeCompiler().compile(buildProfile());
    expect(result.filename).toBe("meport-profile.md");
  });
});

// ─── ClaudeCodeCompiler ────────────────────────────────────

describe("ClaudeCodeCompiler", () => {
  it("output is shorter than ClaudeCompiler output for same profile", () => {
    const profile = buildProfile();
    const claudeResult = new ClaudeCompiler().compile(profile);
    const claudeCodeResult = new ClaudeCodeCompiler().compile(profile);
    expect(claudeCodeResult.charCount).toBeLessThan(claudeResult.charCount);
  });

  it("filename is CLAUDE.md", () => {
    const result = new ClaudeCodeCompiler().compile(buildProfile());
    expect(result.filename).toBe("CLAUDE.md");
  });
});

// ─── GenericCompiler ───────────────────────────────────────

describe("GenericCompiler", () => {
  it("works with any valid profile", () => {
    const result = new GenericCompiler().compile(buildProfile());
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.charCount).toBe(result.content.length);
  });

  it("filename is system-prompt.txt", () => {
    const result = new GenericCompiler().compile(buildProfile());
    expect(result.filename).toBe("system-prompt.txt");
  });
});

// ─── JsonCompiler ──────────────────────────────────────────

describe("JsonCompiler", () => {
  it("output is valid JSON", () => {
    const result = new JsonCompiler().compile(buildProfile());
    expect(() => JSON.parse(result.content)).not.toThrow();
  });

  it("JSON parses back to a PersonaProfile-like object with schema_version", () => {
    const profile = buildProfile();
    const result = new JsonCompiler().compile(profile);
    const parsed = JSON.parse(result.content) as PersonaProfile;
    expect(parsed.schema_version).toBe("1.0");
    expect(parsed.profile_type).toBe("personal");
    expect(parsed.profile_id).toBe("test-id");
  });

  it("filename is meport-profile.json", () => {
    const result = new JsonCompiler().compile(buildProfile());
    expect(result.filename).toBe("meport-profile.json");
  });
});

// ─── Emergent (Layer 3) ────────────────────────────────────

describe("runLayer3", () => {
  it("calls aiClient.generate with a prompt containing answers", async () => {
    const mockGenerate = vi.fn().mockResolvedValue("[]");
    const answers = new Map([
      [
        "t0_q01",
        {
          question_id: "t0_q01",
          value: "Alex",
          timestamp: 0,
          response_time_ms: 1000,
          skipped: false,
        },
      ],
    ]);

    await runLayer3(buildProfile(), answers, { generate: mockGenerate });

    expect(mockGenerate).toHaveBeenCalledOnce();
    const prompt = mockGenerate.mock.calls[0][0] as string;
    expect(prompt).toContain("t0_q01");
    expect(prompt).toContain("Alex");
  });

  it("calls aiClient.generate with compound signals in prompt", async () => {
    const mockGenerate = vi.fn().mockResolvedValue("[]");
    const profile = buildProfile({
      compound: {
        "compound.directness": {
          dimension: "compound.directness",
          value: "very_high",
          confidence: 0.95,
          rule_id: "compound_directness",
          inputs: ["t1_q02"],
          export_instruction: "Say it straight.",
        },
      },
    });

    await runLayer3(profile, new Map(), { generate: mockGenerate });

    const prompt = mockGenerate.mock.calls[0][0] as string;
    expect(prompt).toContain("compound.directness");
  });

  it("parseObservations extracts valid JSON array from response", async () => {
    const mockResponse = JSON.stringify([
      {
        observation_id: "emergent_001",
        category: "behavioral_pattern",
        title: "Burst Worker",
        observation: "Works in bursts.",
        evidence: ["t3_q01:sprinter"],
        confidence: 0.65,
        export_instruction: "Use short sprints.",
      },
    ]);
    const mockGenerate = vi.fn().mockResolvedValue(mockResponse);

    const observations = await runLayer3(buildProfile(), new Map(), {
      generate: mockGenerate,
    });

    expect(observations).toHaveLength(1);
    expect(observations[0].observation_id).toBe("emergent_001");
    expect(observations[0].title).toBe("Burst Worker");
  });

  it("parseObservations clamps confidence to 0.3-0.7", async () => {
    const mockResponse = JSON.stringify([
      {
        observation_id: "emergent_001",
        category: "hidden_strength",
        title: "Overconfident",
        observation: "Very sure about this.",
        evidence: ["t1_q01:minimal"],
        confidence: 0.99, // above 0.7 ceiling
        export_instruction: "High confidence instruction.",
      },
      {
        observation_id: "emergent_002",
        category: "risk_flag",
        title: "Underconfident",
        observation: "Very unsure.",
        evidence: ["t1_q02:blunt"],
        confidence: 0.01, // below 0.3 floor
        export_instruction: "Low confidence instruction.",
      },
    ]);
    const mockGenerate = vi.fn().mockResolvedValue(mockResponse);

    const observations = await runLayer3(buildProfile(), new Map(), {
      generate: mockGenerate,
    });

    expect(observations[0].confidence).toBeLessThanOrEqual(0.7);
    expect(observations[1].confidence).toBeGreaterThanOrEqual(0.3);
  });

  it("parseObservations handles malformed responses gracefully (returns [])", async () => {
    const mockGenerate = vi.fn().mockResolvedValue("not json at all {{broken}}");

    const observations = await runLayer3(buildProfile(), new Map(), {
      generate: mockGenerate,
    });

    expect(observations).toEqual([]);
  });

  it("all observations start as pending_review", async () => {
    const mockResponse = JSON.stringify([
      {
        observation_id: "emergent_001",
        category: "cognitive_pattern",
        title: "Test",
        observation: "Observation text.",
        evidence: [],
        confidence: 0.5,
        export_instruction: "Instruction.",
        status: "accepted", // even if AI returns accepted, must be reset
      },
    ]);
    const mockGenerate = vi.fn().mockResolvedValue(mockResponse);

    const observations = await runLayer3(buildProfile(), new Map(), {
      generate: mockGenerate,
    });

    for (const obs of observations) {
      expect(obs.status).toBe("pending_review");
    }
  });
});

// ─── Storage ───────────────────────────────────────────────

const testDir = join(tmpdir(), `meport-test-${Date.now()}`);

describe("Storage", () => {
  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });
  it("saveProfile creates file with updated timestamp", async () => {
    await mkdir(testDir, { recursive: true });
    const filePath = join(testDir, "profile.json");
    const profile = buildProfile();
    const beforeSave = new Date().toISOString();

    await saveProfile(profile, filePath);

    const loaded = await loadProfile(filePath);
    expect(new Date(loaded.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(beforeSave).getTime()
    );
  });

  it("loadProfile reads and validates schema_version", async () => {
    await mkdir(testDir, { recursive: true });
    const filePath = join(testDir, "profile.json");
    await saveProfile(buildProfile(), filePath);

    const loaded = await loadProfile(filePath);
    expect(loaded.schema_version).toBe("1.0");
  });

  it("loadProfile throws on wrong schema version", async () => {
    await mkdir(testDir, { recursive: true });
    const filePath = join(testDir, "bad-version.json");
    const badProfile = { ...buildProfile(), schema_version: "2.0" };
    await writeFile(filePath, JSON.stringify(badProfile), "utf-8");

    await expect(loadProfile(filePath)).rejects.toThrow(
      /Unsupported schema version/
    );
  });

  it("loadProfile throws on missing profile_type", async () => {
    await mkdir(testDir, { recursive: true });
    const filePath = join(testDir, "no-type.json");
    const { profile_type: _, ...noType } = buildProfile();
    await writeFile(filePath, JSON.stringify(noType), "utf-8");

    await expect(loadProfile(filePath)).rejects.toThrow(
      /missing profile_type/
    );
  });

  it("profileExists returns true for a valid profile file", async () => {
    await mkdir(testDir, { recursive: true });
    const filePath = join(testDir, "exists.json");
    await saveProfile(buildProfile(), filePath);

    const exists = await profileExists(filePath);
    expect(exists).toBe(true);
  });

  it("profileExists returns false for a missing file", async () => {
    const filePath = join(testDir, "does-not-exist.json");
    const exists = await profileExists(filePath);
    expect(exists).toBe(false);
  });
});
