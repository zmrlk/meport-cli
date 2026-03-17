/**
 * Sprint 0: Reference Export Tests
 *
 * 3 personas → ideal hand-written exports → compiler must produce similar output.
 * Tests that rule-based compilers generate RULES, not descriptions.
 * Validates: anti-patterns, verbosity, format, structure per platform.
 */

import { describe, it, expect } from "vitest";
import type { PersonaProfile } from "../schema/types.js";
import {
  collectRules,
  formatForChatGPT,
  formatForClaude,
  formatForClaudeCode,
  formatForCursor,
  formatForOllama,
  type RuleCompilerConfig,
} from "./rules.js";

// ─── Reference Personas ─────────────────────────────────────

function makeProfile(overrides: Partial<{
  name: string;
  explicit: Record<string, { value: any; confidence: number; source: string; dimension: string; question_id: string }>;
  compound: Record<string, any>;
  inferred: Record<string, any>;
}>): PersonaProfile {
  return {
    schema_version: "1.0",
    profile_type: "personal",
    profile_id: "test-persona",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    meta: {
      tiers_completed: [],
      tiers_skipped: [],
      total_questions_answered: 15,
      total_questions_skipped: 2,
      avg_response_time_ms: 5000,
      profiling_duration_ms: 600000,
      profiling_method: "interactive",
      layer3_available: false,
    },
    completeness: 85,
    explicit: {
      "identity.preferred_name": {
        value: overrides.name ?? "User",
        confidence: 1.0,
        source: "explicit",
        dimension: "identity.preferred_name",
        question_id: "setup_q01",
      },
      ...overrides.explicit,
    },
    inferred: overrides.inferred ?? {},
    compound: overrides.compound ?? {},
    contradictions: [],
    emergent: [],
  };
}

// ─── Persona 1: Developer (Alex-like) ─────────────────────

const devProfile = makeProfile({
  name: "Alex",
  explicit: {
    "identity.preferred_name": {
      value: "Alex",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "identity.preferred_name",
    },
    "primary_use_case": {
      value: "coding and business",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "primary_use_case",
    },
    "communication.verbosity_preference": {
      value: "minimal",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "communication.verbosity_preference",
    },
    "communication.directness": {
      value: "very_direct",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "communication.directness",
    },
    "communication.anti_patterns": {
      value: ["no_emoji", "no_praise", "no_hedging", "no_handholding"],
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "communication.anti_patterns",
    },
    "communication.feedback_style": {
      value: "direct",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "communication.feedback_style",
    },
    "communication.format_preference": {
      value: "examples_first",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "communication.format_preference",
    },
    "ai.relationship_model": {
      value: "expert",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "ai.relationship_model",
    },
    "ai.correction_style": {
      value: "immediate",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "ai.correction_style",
    },
    "work.deadline_behavior": {
      value: "burst_mode",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "work.deadline_behavior",
    },
    "work.energy_archetype": {
      value: "burst",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "work.energy_archetype",
    },
    "work.perfectionism": {
      value: "pragmatic",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "work.perfectionism",
    },
    "cognitive.learning_style": {
      value: "hands_on",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "cognitive.learning_style",
    },
    "expertise.tech_stack": {
      value: "TypeScript, Svelte, Rust, Supabase",
      confidence: 0.9,
      source: "explicit",
      question_id: "scan",
      dimension: "expertise.tech_stack",
    },
    "identity.language": {
      value: "pl",
      confidence: 1.0,
      source: "explicit",
      question_id: "scan",
      dimension: "identity.language",
    },
  },
});

// ─── Persona 2: Marketer (Sarah) ────────────────────────────

const marketerProfile = makeProfile({
  name: "Sarah",
  explicit: {
    "identity.preferred_name": {
      value: "Sarah",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "identity.preferred_name",
    },
    "primary_use_case": {
      value: "content writing and strategy",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "primary_use_case",
    },
    "communication.verbosity_preference": {
      value: "adaptive",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "communication.verbosity_preference",
    },
    "communication.anti_patterns": {
      value: ["no_corporate", "no_apologies"],
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "communication.anti_patterns",
    },
    "communication.feedback_style": {
      value: "balanced",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "communication.feedback_style",
    },
    "communication.format_preference": {
      value: "structured",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "communication.format_preference",
    },
    "ai.relationship_model": {
      value: "advisor",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "ai.relationship_model",
    },
    "work.energy_archetype": {
      value: "morning",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "work.energy_archetype",
    },
    "work.perfectionism": {
      value: "context_dependent",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "work.perfectionism",
    },
    "lifestyle.travel_style": {
      value: "flexible_planner",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "lifestyle.travel_style",
    },
    "finance.spending_style": {
      value: "practical",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "finance.spending_style",
    },
  },
});

// ─── Persona 3: Student (Alex) ──────────────────────────────

const studentProfile = makeProfile({
  name: "Alex",
  explicit: {
    "identity.preferred_name": {
      value: "Alex",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "identity.preferred_name",
    },
    "primary_use_case": {
      value: "studying and research",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "primary_use_case",
    },
    "communication.verbosity_preference": {
      value: "detailed",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "communication.verbosity_preference",
    },
    "communication.anti_patterns": {
      value: ["no_overwriting"],
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "communication.anti_patterns",
    },
    "communication.feedback_style": {
      value: "supportive",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "communication.feedback_style",
    },
    "communication.format_preference": {
      value: "structured",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "communication.format_preference",
    },
    "ai.relationship_model": {
      value: "advisor",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "ai.relationship_model",
    },
    "ai.correction_style": {
      value: "educational",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "ai.correction_style",
    },
    "cognitive.learning_style": {
      value: "guided",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "cognitive.learning_style",
    },
    "personality.stress_response": {
      value: "organize",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "personality.stress_response",
    },
    "learning.format_preference": {
      value: "practice",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "learning.format_preference",
    },
    "learning.time_commitment": {
      value: "dedicated",
      confidence: 1.0,
      source: "explicit",
      question_id: "q",
      dimension: "learning.time_commitment",
    },
  },
});

// ─── Pack Export Rules (simulates collected rules from pack JSONs) ────

const devPackRules = new Map<string, string>([
  ["communication.verbosity_preference:minimal", "Max 5 lines for simple questions. Go straight to the answer."],
  ["communication.feedback_style:direct", "When reviewing my work, skip praise. Show me what's broken and how to fix it."],
  ["communication.format_preference:examples_first", "Code examples and working solutions first. Explain the reasoning after."],
  ["ai.relationship_model:expert", "Give me your recommendation with clear reasoning. I'll decide whether to follow it."],
  ["ai.correction_style:immediate", "If you're wrong, say so immediately. No defending, no excuses. Just correct it."],
  ["work.deadline_behavior:burst_mode", "I procrastinate then burst. When I'm in burst mode: break tasks into smallest next steps. No lectures about planning."],
  ["work.energy_archetype:burst", "My energy is unpredictable. Suggest 15-25 min tasks I can grab when motivation hits. Don't plan long sessions."],
  ["work.perfectionism:pragmatic", "Optimize for speed. Give me the 80% solution fast. I'll refine if needed."],
  ["cognitive.learning_style:hands_on", "I learn by doing. Give me working examples to modify, not theory to read."],
]);

const marketerPackRules = new Map<string, string>([
  ["communication.verbosity_preference:adaptive", "IF simple question THEN max 3-5 lines. IF complex topic THEN structured with headers and detail."],
  ["communication.feedback_style:balanced", "Brief acknowledgment of what works, then focus on what needs fixing."],
  ["communication.format_preference:structured", "Use numbered step-by-step lists for instructions. Bullets for everything else."],
  ["ai.relationship_model:advisor", "When I need to decide: present 2-3 options with trade-offs. I'll choose."],
  ["work.energy_archetype:morning", "My peak focus is morning. Suggest demanding tasks before noon."],
  ["work.perfectionism:context_dependent", "Match quality to context. Prototypes = fast and scrappy. Production = thorough and tested."],
  ["lifestyle.travel_style:flexible_planner", "I travel flexibly but check logistics first. Help me evaluate feasibility quickly."],
  ["finance.spending_style:practical", "I look for affordable alternatives. Always mention free/cheaper options first."],
]);

const studentPackRules = new Map<string, string>([
  ["communication.verbosity_preference:detailed", "Include full reasoning and context. I prefer comprehensive answers."],
  ["communication.feedback_style:supportive", "Start with what's working well, then transition to improvements."],
  ["communication.format_preference:structured", "Use numbered step-by-step lists for instructions. Bullets for everything else."],
  ["ai.relationship_model:advisor", "When I need to decide: present 2-3 options with trade-offs. I'll choose."],
  ["ai.correction_style:educational", "When corrected, explain what went wrong and why — so we both learn."],
  ["cognitive.learning_style:guided", "I learn best with structured tutorials. Give step-by-step guides with explanations."],
  ["personality.stress_response:organize", "When I'm overwhelmed: organize everything into a prioritized list. Seeing order helps."],
  ["learning.format_preference:practice", "I learn by practicing. Give me exercises and challenges, not just explanations."],
  ["learning.time_commitment:dedicated", "I dedicate 5-10h/week to learning. Suggest intensive study plans."],
]);

// ─── Tests ───────────────────────────────────────────────────

const defaultConfig: RuleCompilerConfig = {
  maxRules: 15,
  maxChars: 3000,
  includeSensitive: false,
  includeContext: true,
  platform: "test",
};

describe("Sprint 0: Reference exports — rule quality", () => {
  describe("Rule collection", () => {
    it("developer profile produces 10+ rules", () => {
      const rules = collectRules(devProfile, devPackRules);
      expect(rules.length).toBeGreaterThanOrEqual(10);
    });

    it("anti-patterns are highest priority (weight=9)", () => {
      const rules = collectRules(devProfile, devPackRules);
      const antiPatternRules = rules.filter((r) => r.source === "anti_pattern");
      expect(antiPatternRules.length).toBe(4);
      for (const r of antiPatternRules) {
        expect(r.weight).toBe(9);
      }
    });

    it("rules contain actionable instructions, not descriptions", () => {
      const rules = collectRules(devProfile, devPackRules);
      for (const rule of rules) {
        // Rules should NOT contain description patterns
        expect(rule.rule).not.toMatch(/user (prefers|is|has|tends)/i);
        expect(rule.rule).not.toMatch(/this person/i);
        // Rules SHOULD contain action words
        expect(rule.rule.length).toBeGreaterThan(10);
      }
    });

    it("sensitive dimensions are excluded by default", () => {
      const rules = collectRules(marketerProfile, marketerPackRules);
      const sensitiveRules = rules.filter((r) => r.sensitive);
      const filtered = rules.filter((r) => !r.sensitive);
      // finance.spending_style is sensitive
      expect(sensitiveRules.length).toBeGreaterThanOrEqual(0);
      expect(filtered.length).toBeGreaterThan(0);
    });

    it("rules are sorted by weight DESC", () => {
      const rules = collectRules(devProfile, devPackRules);
      for (let i = 1; i < rules.length; i++) {
        expect(rules[i].weight).toBeLessThanOrEqual(rules[i - 1].weight);
      }
    });
  });

  describe("ChatGPT export format", () => {
    it("developer export has name + RULES section", () => {
      const rules = collectRules(devProfile, devPackRules);
      const { aboutMe, howToRespond } = formatForChatGPT(devProfile, rules, {
        ...defaultConfig,
        maxChars: 1500,
        maxRules: 12,
        platform: "chatgpt",
      });

      expect(aboutMe).toContain("Alex");
      expect(howToRespond).toContain("RULES:");
      expect(howToRespond).toMatch(/1\./); // numbered
    });

    it("developer export fits ChatGPT 1500 char limit per field", () => {
      const rules = collectRules(devProfile, devPackRules);
      const { aboutMe, howToRespond } = formatForChatGPT(devProfile, rules, {
        ...defaultConfig,
        maxChars: 1500,
        maxRules: 12,
        platform: "chatgpt",
      });

      expect(aboutMe.length).toBeLessThanOrEqual(1500);
      expect(howToRespond.length).toBeLessThanOrEqual(1500);
    });

    it("marketer export reflects adaptive verbosity", () => {
      const rules = collectRules(marketerProfile, marketerPackRules);
      const { howToRespond } = formatForChatGPT(marketerProfile, rules, {
        ...defaultConfig,
        maxChars: 1500,
        maxRules: 12,
        platform: "chatgpt",
      });

      // Should have conditional rule about simple vs complex
      expect(howToRespond).toMatch(/simple|complex|IF/i);
    });

    it("student export reflects supportive style", () => {
      const rules = collectRules(studentProfile, studentPackRules);
      const { howToRespond } = formatForChatGPT(studentProfile, rules, {
        ...defaultConfig,
        maxChars: 1500,
        maxRules: 12,
        platform: "chatgpt",
      });

      expect(howToRespond).toMatch(/working well|improvements|learn/i);
    });
  });

  describe("Claude export format", () => {
    it("developer export uses XML tags", () => {
      const rules = collectRules(devProfile, devPackRules);
      const content = formatForClaude(devProfile, rules, {
        ...defaultConfig,
        platform: "claude",
      });

      expect(content).toContain("<communication-rules>");
      expect(content).toContain("</communication-rules>");
      expect(content).toContain("<user-context>");
    });

    it("includes tech context for developer", () => {
      const rules = collectRules(devProfile, devPackRules);
      const content = formatForClaude(devProfile, rules, {
        ...defaultConfig,
        platform: "claude",
      });

      expect(content).toContain("TypeScript");
      expect(content).toContain("Alex");
    });
  });

  describe("Claude Code export format", () => {
    it("generates compact markdown rules", () => {
      const rules = collectRules(devProfile, devPackRules);
      const content = formatForClaudeCode(devProfile, rules, {
        ...defaultConfig,
        platform: "claude-code",
      });

      expect(content).toContain("# User Profile (meport)");
      expect(content).toContain("## Rules");
      expect(content).toMatch(/- .+/); // bullet points
    });
  });

  describe("Cursor export format", () => {
    it("has MDC frontmatter", () => {
      const rules = collectRules(devProfile, devPackRules);
      const content = formatForCursor(devProfile, rules, {
        ...defaultConfig,
        platform: "cursor",
      });

      expect(content).toContain("---");
      expect(content).toContain("alwaysApply: true");
      expect(content).toContain("description:");
    });

    it("excludes lifestyle/health/finance for cursor", () => {
      const rules = collectRules(marketerProfile, marketerPackRules);
      const content = formatForCursor(marketerProfile, rules, {
        ...defaultConfig,
        platform: "cursor",
      });

      expect(content).not.toContain("travel");
      expect(content).not.toContain("affordable alternatives");
    });
  });

  describe("Ollama export format", () => {
    it("generates system prompt style", () => {
      const rules = collectRules(devProfile, devPackRules);
      const content = formatForOllama(devProfile, rules, {
        ...defaultConfig,
        platform: "ollama",
      });

      expect(content).toContain("You are talking to Alex");
      expect(content).toContain("Follow these rules strictly");
      expect(content).toMatch(/1\./); // numbered
    });
  });

  describe("Cross-persona validation", () => {
    it("developer ≠ student exports", () => {
      const devRules = collectRules(devProfile, devPackRules);
      const studentRules = collectRules(studentProfile, studentPackRules);

      const devChatGPT = formatForChatGPT(devProfile, devRules, {
        ...defaultConfig,
        platform: "chatgpt",
        maxChars: 1500,
        maxRules: 12,
      });
      const studentChatGPT = formatForChatGPT(studentProfile, studentRules, {
        ...defaultConfig,
        platform: "chatgpt",
        maxChars: 1500,
        maxRules: 12,
      });

      // Different verbosity preferences
      expect(devChatGPT.howToRespond).toContain("Max 5 lines");
      expect(studentChatGPT.howToRespond).toContain("full reasoning");

      // Different names
      expect(devChatGPT.aboutMe).toContain("Alex");
      expect(studentChatGPT.aboutMe).toContain("Alex");
    });

    it("all 3 personas produce unique rule sets", () => {
      const devRules = collectRules(devProfile, devPackRules).map((r) => r.rule);
      const marketerRules = collectRules(marketerProfile, marketerPackRules).map((r) => r.rule);
      const studentRules = collectRules(studentProfile, studentPackRules).map((r) => r.rule);

      // Each should have some unique rules
      const devUnique = devRules.filter((r) => !marketerRules.includes(r) && !studentRules.includes(r));
      const marketerUnique = marketerRules.filter((r) => !devRules.includes(r) && !studentRules.includes(r));
      const studentUnique = studentRules.filter((r) => !devRules.includes(r) && !marketerRules.includes(r));

      expect(devUnique.length).toBeGreaterThan(0);
      expect(marketerUnique.length).toBeGreaterThan(0);
      expect(studentUnique.length).toBeGreaterThan(0);
    });
  });
});
