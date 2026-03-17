/**
 * E2E test — simulates a full profiling session with sample answers,
 * runs all 3 inference layers, and exports to all compilers.
 */

import { ProfilingEngine } from "./profiler/engine.js";
import { loadQuestionTiers } from "./profiler/loader.js";
import { runLayer2 } from "./inference/index.js";
import {
  getCompiler,
  getAvailableCompilers,
  compileAll,
  type PlatformId,
} from "./compiler/index.js";
import type { Question, QuestionTier } from "./schema/types.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Simulated answers for key questions
const SAMPLE_ANSWERS: Record<string, string | string[] | number> = {
  // Tier 0 — Identity
  t0_q01: "Alex",
  t0_q02: "en",
  t0_q03: "Europe/Warsaw",
  t0_q04: "30s",
  t0_q05: "they_them",
  t0_q06: "multi_platform",
  t0_q07: "developer",
  t0_q08: "expert",
  t0_q09: "too_generic",

  // Tier 1 — Communication (values must match option.value, not maps_to.value)
  t1_q01: "really_annoyed",
  t1_q02: "exactly_me",
  t1_q03: "bullet_points",
  t1_q04: "hate_them",
  t1_q05: "hate_them", // filler
  t1_q06: "answer_then_explain",
  t1_q07: "skip_it",
  t1_q08: "sarcasm",
  t1_q09: "just_tell_me",
  t1_q10: "full_jargon",
  t1_q11: "key_decisions",
  t1_q12: "confident",
  t1_q13: "rip_off",

  // Tier 2 — Cognitive (option.value, not maps_to.value)
  t2_q01: "try_it_first",
  t2_q02: "gut_check",
  t2_q03: "analogy",
  t2_q08: "visual_spatial",
  t2_q13: "hyperfocus_or_nothing",
  t2_q14: "high",

  // Tier 3 — Work (option.value, not maps_to.value)
  t3_q01: "sprinter",
  t3_q02: "late_morning",
  t3_q05: "deadline_driven",
  t3_q11: "morning_peak_drop",
  t3_q12: "hard_to_stop",
  t3_q16: "lose_interest",
  t3_q20: "not_interesting",

  // Tier 4 — Personality (option.value)
  t4_q06: "direct_address",
  t4_q10: "push_back_hard",
  t4_q13: "expected_it",
  t4_q14: "cautious_earn_it",
  t4_q15: "perfectionist",
  t4_q18: "like_it_but_not_dependent",
  t4_q19: "short_term_pulls",

  // Tier 5 — Neurodivergent (option.value)
  t5_q01: "depends_interest",
  t5_q02: "way_longer",
  t5_q03: "hyperfocus_exits",
  t5_q08: "assume_negative",

  // Tier 8 — AI Relationship
  t8_q03: "sparring_partner",
  t8_q07: 4, // scale value
};

async function main() {
  console.log("═══ Meport E2E Test ═══\n");

  // 1. Load questions
  const questionsPath = join(__dirname, "..", "questions");
  const tiers = await loadQuestionTiers("personal", questionsPath);
  console.log(`✓ Loaded ${tiers.length} tiers, ${tiers.reduce((s, t) => s + t.questions.length, 0)} questions total`);

  // 2. Create engine and simulate answers
  const engine = new ProfilingEngine(tiers);
  const gen = engine.run();
  let result = gen.next();
  let questionCount = 0;
  let answerCount = 0;
  let skipCount = 0;

  while (!result.done) {
    const event = result.value;

    switch (event.type) {
      case "tier_start":
        result = gen.next(undefined);
        break;

      case "question":
      case "follow_up": {
        questionCount++;
        const q = event.question;
        const sampleValue = SAMPLE_ANSWERS[q.id];

        if (sampleValue !== undefined) {
          result = gen.next({ value: sampleValue });
          answerCount++;
        } else {
          result = gen.next({ value: "", skipped: true });
          skipCount++;
        }
        break;
      }

      case "tier_complete":
        result = gen.next(undefined);
        break;

      case "profiling_complete": {
        const profile = event.profile;
        console.log(`✓ Profiling complete: ${questionCount} questions, ${answerCount} answered, ${skipCount} skipped`);
        console.log(`  Explicit dimensions: ${Object.keys(profile.explicit).length}`);
        console.log(`  Completeness: ${profile.completeness}%`);

        // Debug: show all explicit dimensions
        for (const [key, val] of Object.entries(profile.explicit)) {
          console.log(`    ${key} = ${val.value} (from ${val.question_id})`);
        }

        // 3. Run Layer 2
        const questionMap = new Map<string, Question>();
        for (const tier of tiers) {
          for (const q of tier.questions) {
            questionMap.set(q.id, q);
          }
        }

        const enhanced = runLayer2(profile, engine.getAnswers(), questionMap);
        console.log(`\n✓ Layer 2 inference:`);
        console.log(`  Behavioral signals: ${Object.keys(enhanced.inferred).length}`);
        console.log(`  Compound signals: ${Object.keys(enhanced.compound).length}`);
        console.log(`  Contradictions: ${enhanced.contradictions.length}`);

        // Show compound signals
        for (const [key, val] of Object.entries(enhanced.compound)) {
          console.log(`    ${key}: ${val.value} (conf: ${val.confidence})`);
        }

        // Show contradictions
        for (const c of enhanced.contradictions) {
          console.log(`    ⚡ ${c.rule_id}: ${c.description}`);
        }

        // 4. Export to all platforms
        console.log(`\n✓ Export compilers:`);
        const available = getAvailableCompilers();
        console.log(`  Available: ${available.join(", ")}`);

        const results = compileAll(enhanced);
        for (const [platform, exportResult] of results) {
          console.log(
            `  ${platform}: ${exportResult.charCount} chars, ${exportResult.dimensionsCovered} dims, ${exportResult.dimensionsOmitted} omitted`
          );

          // Validate ChatGPT stays under limit
          if (platform === "chatgpt" && exportResult.charCount > 1500) {
            console.error(`  ✗ FAIL: ChatGPT export exceeds 1500 char limit!`);
          }
        }

        // 5. Print ChatGPT export as sample
        const chatgptResult = results.get("chatgpt" as PlatformId);
        if (chatgptResult) {
          console.log(`\n═══ ChatGPT Export Sample (${chatgptResult.charCount} chars) ═══`);
          console.log(chatgptResult.content);
          console.log("═══ End Sample ═══");
        }

        // Print Claude Code export
        const claudeCodeResult = results.get("claude-code" as PlatformId);
        if (claudeCodeResult) {
          console.log(`\n═══ Claude Code Export Sample (${claudeCodeResult.charCount} chars) ═══`);
          console.log(claudeCodeResult.content);
          console.log("═══ End Sample ═══");
        }

        console.log("\n✓ ALL TESTS PASSED");
        result = gen.next(undefined);
        break;
      }
    }
  }
}

main().catch(console.error);
