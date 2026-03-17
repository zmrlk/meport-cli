/**
 * Pack-Based Layer 2 Inference Tests
 */

import { describe, it, expect } from "vitest";
import { runPackLayer2 } from "./pack-inference.js";
import type { PersonaProfile } from "../schema/types.js";
import type { Pack } from "../profiler/pack-loader.js";

function makeEmptyProfile(): PersonaProfile {
  return {
    schema_version: "1.0",
    profile_type: "personal",
    profile_id: "test",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completeness: 50,
    explicit: {},
    inferred: {},
    compound: {},
    contradictions: [],
    emergent: [],
    meta: {
      tiers_completed: [],
      tiers_skipped: [],
      total_questions_answered: 0,
      total_questions_skipped: 0,
      avg_response_time_ms: 0,
      profiling_duration_ms: 0,
      profiling_method: "interactive",
      layer3_available: false,
    },
  };
}

const testPack: Pack = {
  pack: "work",
  pack_name: "Work",
  pack_intro: "Work questions",
  required: false,
  sensitive: false,
  questions: [
    {
      id: "w1",
      pack: "work",
      question: "Deadline?",
      type: "select",
      dimension: "work.deadline",
      skippable: true,
      meta_profiling: null,
      why_this_matters: null,
      options: [
        { value: "pressure", label: "Pressure", maps_to: { dimension: "work.deadline", value: "pressure_driven" } },
      ],
    },
    {
      id: "w2",
      pack: "work",
      question: "Energy?",
      type: "open_text",
      dimension: "work.energy",
      skippable: true,
      meta_profiling: null,
      why_this_matters: null,
    },
  ],
};

describe("runPackLayer2", () => {
  it("returns profile with updated_at", () => {
    const profile = makeEmptyProfile();
    const answers = new Map();

    const result = runPackLayer2(profile, answers, [testPack]);
    expect(result.updated_at).toBeDefined();
  });

  it("detects quick responder from fast pack answers", () => {
    const profile = makeEmptyProfile();
    const answers = new Map();

    // Create many fast answers
    for (let i = 0; i < 10; i++) {
      answers.set(`q${i}`, {
        question_id: `q${i}`,
        value: "test",
        timestamp: i * 2000,
        response_time_ms: 2000, // 2 seconds — fast
        skipped: false,
        pack: "work",
      });
    }

    const result = runPackLayer2(profile, answers, [testPack]);

    const speed = result.inferred["behavioral.response_speed"];
    if (speed) {
      expect(speed.value).toBe("quick_responder");
      expect(speed.confidence).toBeGreaterThan(0.5);
    }
  });

  it("detects deliberate responder from slow answers", () => {
    const profile = makeEmptyProfile();
    const answers = new Map();

    for (let i = 0; i < 8; i++) {
      answers.set(`q${i}`, {
        question_id: `q${i}`,
        value: "test",
        timestamp: i * 15000,
        response_time_ms: 15000, // 15 seconds — slow
        skipped: false,
        pack: "work",
      });
    }

    const result = runPackLayer2(profile, answers, [testPack]);

    const speed = result.inferred["behavioral.response_speed"];
    if (speed) {
      expect(speed.value).toBe("deliberate_responder");
    }
  });

  it("detects high skip pattern in a pack", () => {
    const profile = makeEmptyProfile();
    const answers = new Map();

    // 4 answers in health pack, 3 skipped
    for (let i = 0; i < 4; i++) {
      answers.set(`h${i}`, {
        question_id: `h${i}`,
        value: "",
        timestamp: i * 3000,
        response_time_ms: 1000,
        skipped: i > 0, // skip 3 out of 4
        pack: "health",
      });
    }

    const result = runPackLayer2(profile, answers, [testPack]);

    const skipPattern = result.inferred["behavioral.skip_pattern.health"];
    expect(skipPattern).toBeDefined();
    expect(skipPattern?.value).toBe("high_skip");
  });

  it("detects sensitive pack avoidance", () => {
    const profile = makeEmptyProfile();
    const answers = new Map();

    // ALL health questions skipped
    for (let i = 0; i < 3; i++) {
      answers.set(`health_q${i}`, {
        question_id: `health_q${i}`,
        value: "",
        timestamp: i * 1000,
        response_time_ms: 500,
        skipped: true,
        pack: "health",
      });
    }

    const result = runPackLayer2(profile, answers, [testPack]);

    const privacy = result.inferred["meta.privacy_sensitivity"];
    expect(privacy).toBeDefined();
    expect(privacy?.value).toBe("elevated");
  });

  it("does not crash with empty answers", () => {
    const profile = makeEmptyProfile();
    const result = runPackLayer2(profile, new Map(), [testPack]);
    expect(result).toBeDefined();
    expect(result.contradictions).toEqual([]);
  });
});
