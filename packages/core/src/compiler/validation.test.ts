/**
 * Sprint 3: Validation Infrastructure
 *
 * Generates sample profiles at different completeness levels,
 * exports to all platforms, and validates structural quality.
 *
 * Real model testing (IFEval) requires manual execution —
 * this tests the programmatic side.
 */

import { describe, it, expect } from "vitest";
import type { PersonaProfile, DimensionValue } from "../schema/types.js";
import {
  collectRules,
  formatForChatGPT,
  formatForClaude,
  formatForClaudeCode,
  formatForCursor,
  formatForOllama,
  type RuleCompilerConfig,
} from "./rules.js";

// ─── Profile Generator ─────────────────────────────────────

function dim(dimension: string, value: string | string[], qid = "q"): DimensionValue {
  return { dimension, value, confidence: 1.0, source: "explicit", question_id: qid };
}

const COMPLETENESS_LEVELS = {
  /** Micro-setup only (4 questions) → ~20% */
  minimal: {
    name: "MinimalUser",
    explicit: {
      "identity.preferred_name": dim("identity.preferred_name", "MinimalUser"),
      "communication.verbosity_preference": dim("communication.verbosity_preference", "concise"),
      "communication.anti_patterns": dim("communication.anti_patterns", ["no_emoji", "no_praise"]),
    },
    completeness: 20,
  },

  /** Micro-setup + Core pack → ~40% */
  basic: {
    name: "BasicUser",
    explicit: {
      "identity.preferred_name": dim("identity.preferred_name", "BasicUser"),
      "primary_use_case": dim("primary_use_case", "general assistant"),
      "communication.verbosity_preference": dim("communication.verbosity_preference", "adaptive"),
      "communication.anti_patterns": dim("communication.anti_patterns", ["no_hedging"]),
      "communication.feedback_style": dim("communication.feedback_style", "balanced"),
      "communication.format_preference": dim("communication.format_preference", "structured"),
      "ai.relationship_model": dim("ai.relationship_model", "advisor"),
      "ai.correction_style": dim("ai.correction_style", "educational"),
    },
    completeness: 40,
  },

  /** Micro-setup + Core + Work → ~60% */
  moderate: {
    name: "ModerateUser",
    explicit: {
      "identity.preferred_name": dim("identity.preferred_name", "ModerateUser"),
      "primary_use_case": dim("primary_use_case", "project management"),
      "communication.verbosity_preference": dim("communication.verbosity_preference", "minimal"),
      "communication.directness": dim("communication.directness", "very_direct"),
      "communication.anti_patterns": dim("communication.anti_patterns", ["no_emoji", "no_praise", "no_hedging", "no_handholding"]),
      "communication.feedback_style": dim("communication.feedback_style", "direct"),
      "communication.format_preference": dim("communication.format_preference", "examples_first"),
      "ai.relationship_model": dim("ai.relationship_model", "expert"),
      "ai.correction_style": dim("ai.correction_style", "immediate"),
      "work.deadline_behavior": dim("work.deadline_behavior", "burst_mode"),
      "work.energy_archetype": dim("work.energy_archetype", "burst"),
      "work.perfectionism": dim("work.perfectionism", "pragmatic"),
      "cognitive.learning_style": dim("cognitive.learning_style", "hands_on"),
      "personality.stress_response": dim("personality.stress_response", "one_step"),
    },
    completeness: 60,
  },

  /** All packs selected → ~85% */
  full: {
    name: "FullUser",
    explicit: {
      "identity.preferred_name": dim("identity.preferred_name", "FullUser"),
      "primary_use_case": dim("primary_use_case", "software development"),
      "communication.verbosity_preference": dim("communication.verbosity_preference", "minimal"),
      "communication.directness": dim("communication.directness", "very_direct"),
      "communication.anti_patterns": dim("communication.anti_patterns", ["no_emoji", "no_praise", "no_hedging", "no_handholding", "no_corporate"]),
      "communication.feedback_style": dim("communication.feedback_style", "direct"),
      "communication.format_preference": dim("communication.format_preference", "examples_first"),
      "ai.relationship_model": dim("ai.relationship_model", "autonomous"),
      "ai.correction_style": dim("ai.correction_style", "immediate"),
      "work.deadline_behavior": dim("work.deadline_behavior", "pressure_driven"),
      "work.energy_archetype": dim("work.energy_archetype", "morning"),
      "work.perfectionism": dim("work.perfectionism", "context_dependent"),
      "cognitive.learning_style": dim("cognitive.learning_style", "hands_on"),
      "personality.stress_response": dim("personality.stress_response", "momentum"),
      "lifestyle.travel_style": dim("lifestyle.travel_style", "spontaneous"),
      "lifestyle.food_openness": dim("lifestyle.food_openness", "adventurous"),
      "lifestyle.social_energy": dim("lifestyle.social_energy", "introvert"),
      "lifestyle.routine_preference": dim("lifestyle.routine_preference", "hybrid"),
      "health.fitness_level": dim("health.fitness_level", "experienced"),
      "health.sleep_pattern": dim("health.sleep_pattern", "variable"),
      "finance.financial_goal": dim("finance.financial_goal", "growth"),
      "finance.spending_style": dim("finance.spending_style", "data_driven"),
      "learning.format_preference": dim("learning.format_preference", "project_based"),
      "learning.time_commitment": dim("learning.time_commitment", "moderate"),
      "expertise.tech_stack": dim("expertise.tech_stack", "TypeScript, React, Node.js"),
      "identity.language": dim("identity.language", "en"),
    },
    completeness: 85,
  },

  /** Maximum profile with scan + all packs → ~95% */
  maximum: {
    name: "MaxUser",
    explicit: {
      "identity.preferred_name": dim("identity.preferred_name", "MaxUser"),
      "primary_use_case": dim("primary_use_case", "full-stack development"),
      "communication.verbosity_preference": dim("communication.verbosity_preference", "minimal"),
      "communication.directness": dim("communication.directness", "very_direct"),
      "communication.anti_patterns": dim("communication.anti_patterns", ["no_emoji", "no_praise", "no_hedging", "no_handholding", "no_corporate", "no_apologies", "no_overwriting"]),
      "communication.feedback_style": dim("communication.feedback_style", "direct"),
      "communication.format_preference": dim("communication.format_preference", "examples_first"),
      "ai.relationship_model": dim("ai.relationship_model", "autonomous"),
      "ai.correction_style": dim("ai.correction_style", "immediate"),
      "work.deadline_behavior": dim("work.deadline_behavior", "burst_mode"),
      "work.energy_archetype": dim("work.energy_archetype", "burst"),
      "work.perfectionism": dim("work.perfectionism", "pragmatic"),
      "cognitive.learning_style": dim("cognitive.learning_style", "hands_on"),
      "personality.stress_response": dim("personality.stress_response", "one_step"),
      "lifestyle.travel_style": dim("lifestyle.travel_style", "flexible_planner"),
      "lifestyle.food_openness": dim("lifestyle.food_openness", "open"),
      "lifestyle.social_energy": dim("lifestyle.social_energy", "ambivert"),
      "lifestyle.routine_preference": dim("lifestyle.routine_preference", "hybrid"),
      "lifestyle.dietary": dim("lifestyle.dietary", ["low_carb"]),
      "health.fitness_level": dim("health.fitness_level", "experienced"),
      "health.sleep_pattern": dim("health.sleep_pattern", "poor_screens"),
      "health.conditions": dim("health.conditions", "none"),
      "finance.financial_goal": dim("finance.financial_goal", "balanced"),
      "finance.spending_style": dim("finance.spending_style", "impulsive"),
      "finance.ai_advice_level": dim("finance.ai_advice_level", "advisory"),
      "learning.format_preference": dim("learning.format_preference", "practice"),
      "learning.current_goals": dim("learning.current_goals", "Rust, system design"),
      "learning.time_commitment": dim("learning.time_commitment", "dedicated"),
      "expertise.tech_stack": dim("expertise.tech_stack", "TypeScript, Svelte, Rust, Supabase"),
      "identity.language": dim("identity.language", "en"),
      "identity.timezone": dim("identity.timezone", "Europe/Warsaw"),
    },
    completeness: 95,
  },
};

function makeValidationProfile(level: keyof typeof COMPLETENESS_LEVELS): PersonaProfile {
  const config = COMPLETENESS_LEVELS[level];
  return {
    schema_version: "1.0",
    profile_type: "personal",
    profile_id: `validation-${level}`,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    meta: {
      tiers_completed: [],
      tiers_skipped: [],
      total_questions_answered: Object.keys(config.explicit).length,
      total_questions_skipped: 0,
      avg_response_time_ms: 5000,
      profiling_duration_ms: 300000,
      profiling_method: "interactive",
      layer3_available: false,
    },
    completeness: config.completeness,
    explicit: config.explicit,
    inferred: {},
    compound: {},
    contradictions: [],
    emergent: [],
  };
}

// Simulated pack export rules for all dimensions
const ALL_PACK_RULES = new Map<string, string>([
  ["communication.verbosity_preference:minimal", "Max 5 lines for simple questions. Go straight to the answer."],
  ["communication.verbosity_preference:concise", "Keep responses concise. Use headers and bullets so I can skim."],
  ["communication.verbosity_preference:adaptive", "IF simple question THEN max 3-5 lines. IF complex topic THEN structured with headers and detail."],
  ["communication.verbosity_preference:detailed", "Include full reasoning and context. I prefer comprehensive answers."],
  ["communication.feedback_style:direct", "When reviewing my work, skip praise. Show me what's broken and how to fix it."],
  ["communication.feedback_style:balanced", "Brief acknowledgment of what works, then focus on what needs fixing."],
  ["communication.feedback_style:supportive", "Start with what's working well, then transition to improvements."],
  ["communication.format_preference:structured", "Use numbered step-by-step lists for instructions. Bullets for everything else."],
  ["communication.format_preference:examples_first", "Code examples and working solutions first. Explain the reasoning after."],
  ["ai.relationship_model:advisor", "When I need to decide: present 2-3 options with trade-offs. I'll choose."],
  ["ai.relationship_model:expert", "Give me your recommendation with clear reasoning. I'll decide whether to follow it."],
  ["ai.relationship_model:autonomous", "For routine decisions, just handle it. Only ask me for big/irreversible choices."],
  ["ai.correction_style:immediate", "If you're wrong, say so immediately. No defending, no excuses. Just correct it."],
  ["ai.correction_style:educational", "When corrected, explain what went wrong and why — so we both learn."],
  ["work.deadline_behavior:burst_mode", "I procrastinate then burst. When I'm in burst mode: break tasks into smallest next steps."],
  ["work.deadline_behavior:pressure_driven", "I work best under pressure. Don't nag about deadlines — help me execute when I'm ready."],
  ["work.energy_archetype:burst", "My energy is unpredictable. Suggest 15-25 min tasks I can grab when motivation hits."],
  ["work.energy_archetype:morning", "My peak focus is morning. Suggest demanding tasks before noon."],
  ["work.perfectionism:pragmatic", "Optimize for speed. Give me the 80% solution fast. I'll refine if needed."],
  ["work.perfectionism:context_dependent", "Match quality to context. Prototypes = fast and scrappy. Production = thorough and tested."],
  ["cognitive.learning_style:hands_on", "I learn by doing. Give me working examples to modify, not theory to read."],
  ["personality.stress_response:one_step", "When I'm overwhelmed: give me ONE tiny next step. Not a list. Just the next thing."],
  ["personality.stress_response:momentum", "When I'm stuck: pick the easiest win and start me on it. Momentum breaks paralysis."],
  ["lifestyle.travel_style:spontaneous", "I'm a spontaneous traveler. Show me deals and quick options, not detailed itineraries."],
  ["lifestyle.travel_style:flexible_planner", "I travel flexibly but check logistics first. Help me evaluate feasibility quickly."],
  ["lifestyle.food_openness:adventurous", "I'm adventurous with food. Suggest new things, unusual cuisines, bold flavors."],
  ["lifestyle.food_openness:open", "I'm open to food suggestions but like some guidance. Recommend with brief context."],
  ["lifestyle.social_energy:introvert", "I recharge alone. Don't suggest social activities when I'm tired."],
  ["lifestyle.social_energy:ambivert", "I prefer small, close gatherings over big social events."],
  ["lifestyle.routine_preference:hybrid", "Structure my work tasks, but keep personal suggestions flexible and spontaneous."],
  ["health.fitness_level:experienced", "I exercise regularly and know what I'm doing. Skip beginner advice — give me advanced tips."],
  ["health.sleep_pattern:variable", "My sleep varies. Don't assume I'm well-rested or exhausted — ask if relevant."],
  ["health.sleep_pattern:poor_screens", "I struggle with late-night screen time. If suggesting evening tasks, remind me to wrap up before 11 PM."],
  ["finance.financial_goal:growth", "I think long-term with money. Frame spending as investment when relevant."],
  ["finance.financial_goal:balanced", "I balance saving and spending. Suggest the best value, not just the cheapest."],
  ["finance.spending_style:data_driven", "I make spending decisions based on data. Help me track and evaluate."],
  ["finance.spending_style:impulsive", "I'm an impulse spender. When I ask about purchases, give me a quick reality check but don't lecture."],
  ["finance.ai_advice_level:advisory", "You can suggest financial moves, but I make all money decisions."],
  ["learning.format_preference:project_based", "I learn by building. Frame learning as 'build X to learn Y', not abstract exercises."],
  ["learning.format_preference:practice", "I learn by practicing. Give me exercises and challenges, not just explanations."],
  ["learning.time_commitment:moderate", "I have 3-5h/week for learning. Suggest structured weekly progress."],
  ["learning.time_commitment:dedicated", "I dedicate 5-10h/week to learning. Suggest intensive study plans."],
]);

const defaultConfig: RuleCompilerConfig = {
  maxRules: 15,
  maxChars: 3000,
  includeSensitive: false,
  includeContext: true,
  platform: "test",
};

// ─── Tests ───────────────────────────────────────────────────

describe("Sprint 3: Validation infrastructure", () => {
  describe("Profile generation at all completeness levels", () => {
    for (const level of Object.keys(COMPLETENESS_LEVELS) as Array<keyof typeof COMPLETENESS_LEVELS>) {
      it(`generates valid ${level} profile`, () => {
        const profile = makeValidationProfile(level);
        expect(profile.schema_version).toBe("1.0");
        expect(profile.explicit["identity.preferred_name"]).toBeDefined();
        expect(Object.keys(profile.explicit).length).toBeGreaterThan(0);
      });
    }
  });

  describe("Rule count scales with completeness", () => {
    it("more complete profiles produce more rules", () => {
      const minRules = collectRules(makeValidationProfile("minimal"), ALL_PACK_RULES);
      const basicRules = collectRules(makeValidationProfile("basic"), ALL_PACK_RULES);
      const fullRules = collectRules(makeValidationProfile("full"), ALL_PACK_RULES);
      const maxRules = collectRules(makeValidationProfile("maximum"), ALL_PACK_RULES);

      // Baseline rules bridge the gap for thin profiles, so minimal may equal basic
      expect(minRules.length).toBeLessThanOrEqual(basicRules.length);
      expect(basicRules.length).toBeLessThanOrEqual(fullRules.length);
      expect(fullRules.length).toBeLessThanOrEqual(maxRules.length);
    });
  });

  describe("All profiles export to all platforms without errors", () => {
    for (const level of Object.keys(COMPLETENESS_LEVELS) as Array<keyof typeof COMPLETENESS_LEVELS>) {
      it(`${level} profile exports to ChatGPT`, () => {
        const profile = makeValidationProfile(level);
        const rules = collectRules(profile, ALL_PACK_RULES);
        const result = formatForChatGPT(profile, rules, {
          ...defaultConfig, maxChars: 1500, maxRules: 12, platform: "chatgpt",
        });
        expect(result.aboutMe.length).toBeGreaterThan(0);
        expect(result.aboutMe.length).toBeLessThanOrEqual(1500);
        expect(result.howToRespond.length).toBeGreaterThan(0);
      });

      it(`${level} profile exports to Claude`, () => {
        const profile = makeValidationProfile(level);
        const rules = collectRules(profile, ALL_PACK_RULES);
        const content = formatForClaude(profile, rules, { ...defaultConfig, platform: "claude" });
        expect(content).toContain("<communication-rules>");
        expect(content.length).toBeGreaterThan(50);
      });

      it(`${level} profile exports to Claude Code`, () => {
        const profile = makeValidationProfile(level);
        const rules = collectRules(profile, ALL_PACK_RULES);
        const content = formatForClaudeCode(profile, rules, { ...defaultConfig, platform: "claude-code" });
        expect(content).toContain("## Rules");
      });

      it(`${level} profile exports to Cursor`, () => {
        const profile = makeValidationProfile(level);
        const rules = collectRules(profile, ALL_PACK_RULES);
        const content = formatForCursor(profile, rules, { ...defaultConfig, platform: "cursor" });
        expect(content).toContain("alwaysApply: true");
      });

      it(`${level} profile exports to Ollama`, () => {
        const profile = makeValidationProfile(level);
        const rules = collectRules(profile, ALL_PACK_RULES);
        const content = formatForOllama(profile, rules, { ...defaultConfig, platform: "ollama" });
        expect(content).toContain("Follow these rules strictly");
      });
    }
  });

  describe("Export quality checks", () => {
    it("maximum profile ChatGPT export stays under 3000 chars total", () => {
      const profile = makeValidationProfile("maximum");
      const rules = collectRules(profile, ALL_PACK_RULES);
      const { aboutMe, howToRespond } = formatForChatGPT(profile, rules, {
        ...defaultConfig, maxChars: 1500, maxRules: 12, platform: "chatgpt",
      });
      expect(aboutMe.length + howToRespond.length).toBeLessThan(3000);
    });

    it("exports never contain description-style language", () => {
      for (const level of ["full", "maximum"] as const) {
        const profile = makeValidationProfile(level);
        const rules = collectRules(profile, ALL_PACK_RULES);

        for (const rule of rules) {
          expect(rule.rule).not.toMatch(/user (prefers|is a|has a|tends to)/i);
          expect(rule.rule).not.toMatch(/this (person|user|individual)/i);
        }
      }
    });

    it("anti-patterns always appear in exports", () => {
      const profile = makeValidationProfile("maximum");
      const rules = collectRules(profile, ALL_PACK_RULES);

      const antiPatternCount = rules.filter((r) => r.source === "anti_pattern").length;
      const profileAntiPatterns = profile.explicit["communication.anti_patterns"]?.value;

      expect(antiPatternCount).toBe(
        Array.isArray(profileAntiPatterns) ? profileAntiPatterns.length : 0
      );
    });

    it("minimal profile still produces useful output", () => {
      const profile = makeValidationProfile("minimal");
      const rules = collectRules(profile, ALL_PACK_RULES);

      // Even minimal should have verbosity + anti-patterns
      expect(rules.length).toBeGreaterThanOrEqual(3);

      const chatGPT = formatForChatGPT(profile, rules, {
        ...defaultConfig, maxChars: 1500, maxRules: 12, platform: "chatgpt",
      });
      expect(chatGPT.howToRespond).toContain("RULES:");
    });
  });
});
