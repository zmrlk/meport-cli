/**
 * Quick verification: 9 quick-mode answers → rich profile output
 * Run: npx tsx verify-rich-output.ts
 */

import { ProfilingEngine } from "./src/profiler/engine.js";
import { collectRules, formatForClaude, formatForChatGPT } from "./src/compiler/rules.js";
import type { QuestionTier } from "./src/schema/types.js";
import { readFileSync } from "fs";

// Load tier 0 questions
const tier0: QuestionTier = JSON.parse(
  readFileSync("./questions/personal/tier-0-identity.json", "utf-8")
);

const engine = new ProfilingEngine([tier0]);

// Simulate answering all 9 main questions
const answers: Record<string, string> = {
  t0_q01: "Alex",                    // name
  t0_q02: "en",                      // language
  t0_q03: "europe_central",          // timezone
  t0_q04: "30_39",                   // age
  t0_q05: "he",                      // pronouns
  t0_q06: "dev_tools",               // use case → also_maps_to tech_comfort: advanced
  t0_q07: "founder",                 // role → also_maps_to decision_style: autonomous
  t0_q08: "7_9",                     // tech comfort
  t0_q09: "too_verbose",             // frustration → also_maps_to response_length: short
};

// Feed answers
let event = engine.getNextQuestion();
while (event) {
  if (event.type === "question" || event.type === "follow_up") {
    const qId = event.question.id;
    const answer = answers[qId];
    if (answer) {
      engine.submitAnswer(qId, { value: answer });
    } else {
      engine.submitAnswer(qId, { value: "", skipped: true });
    }
  }
  event = engine.getNextQuestion();
}

const profile = engine.buildCurrentProfile();

// Collect rules
const rules = collectRules(profile);

// Generate exports
const claude = formatForClaude(profile, rules, {
  maxRules: 30,
  maxChars: 4000,
  includeSensitive: false,
  includeContext: true,
  platform: "claude",
});

const chatgpt = formatForChatGPT(profile, rules, {
  maxRules: 25,
  maxChars: 1600,
  includeSensitive: false,
  includeContext: true,
  platform: "chatgpt",
});

// Report
console.log("=== PROFILE STATS ===");
console.log(`Explicit dimensions: ${Object.keys(profile.explicit).length}`);
console.log(`Inferred dimensions: ${Object.keys(profile.inferred).length}`);
console.log(`Compound signals:    ${Object.keys(profile.compound).length}`);
console.log(`Total dimensions:    ${Object.keys(profile.explicit).length + Object.keys(profile.inferred).length + Object.keys(profile.compound).length}`);
console.log(`Completeness:        ${profile.completeness}%`);
console.log(`Rules generated:     ${rules.length}`);
console.log();

console.log("=== CLAUDE EXPORT ===");
console.log(`Chars: ${claude.length}`);
console.log(claude);
console.log();

console.log("=== CHATGPT EXPORT ===");
console.log(`About Me chars: ${chatgpt.aboutMe.length}`);
console.log(`How To Respond chars: ${chatgpt.howToRespond.length}`);
console.log(chatgpt.howToRespond);
console.log();

// Verification checks
const checks = [
  { name: "Explicit ≥ 14", pass: Object.keys(profile.explicit).length >= 14 },
  { name: "Inferred ≥ 15", pass: Object.keys(profile.inferred).length >= 15 },
  { name: "Compound ≥ 3", pass: Object.keys(profile.compound).length >= 3 },
  { name: "Completeness = 100%", pass: profile.completeness === 100 },
  { name: "Claude export ≥ 2000 chars", pass: claude.length >= 2000 },
  { name: "Rules ≥ 18", pass: rules.length >= 18 },
  { name: "ChatGPT howToRespond ≥ 1500 chars", pass: chatgpt.howToRespond.length >= 1500 },
  { name: "Name shows correctly", pass: claude.includes("Alex") },
  { name: "No catch-all rules", pass: !rules.some(r => r.rule.match(/^Communication preference — /)) },
];

console.log("=== VERIFICATION ===");
let allPass = true;
for (const check of checks) {
  const status = check.pass ? "✅" : "❌";
  console.log(`${status} ${check.name}`);
  if (!check.pass) allPass = false;
}
console.log();
console.log(allPass ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED");

// Show explicit dims
console.log("\n=== EXPLICIT DIMENSIONS ===");
for (const [dim, val] of Object.entries(profile.explicit)) {
  console.log(`  ${dim}: ${val.value}`);
}

// Show inferred dims
console.log("\n=== INFERRED DIMENSIONS ===");
for (const [dim, val] of Object.entries(profile.inferred)) {
  console.log(`  ${dim}: ${val.value} (from ${val.signal_id}, conf ${val.confidence})`);
}

// Show compound signals
console.log("\n=== COMPOUND SIGNALS ===");
for (const [dim, val] of Object.entries(profile.compound)) {
  console.log(`  ${dim}: ${val.value}`);
  console.log(`    → ${val.export_instruction}`);
}
