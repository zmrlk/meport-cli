/**
 * Static imports of all personal question tiers.
 * Bundled at build time — no filesystem access needed.
 */
import type { QuestionTier } from "@meport/core/types";

import tier0 from "../../../core/questions/personal/tier-0-identity.json";
import tier1 from "../../../core/questions/personal/tier-1-communication.json";
import tier2 from "../../../core/questions/personal/tier-2-cognitive.json";
import tier3 from "../../../core/questions/personal/tier-3-work.json";
import tier4 from "../../../core/questions/personal/tier-4-personality.json";
import tier5 from "../../../core/questions/personal/tier-5-neurodivergent.json";
import tier6 from "../../../core/questions/personal/tier-6-expertise.json";
import tier7 from "../../../core/questions/personal/tier-7-life-context.json";
import tier8 from "../../../core/questions/personal/tier-8-ai-relationship.json";

export const personalTiers: QuestionTier[] = [
  tier0, tier1, tier2, tier3, tier4, tier5, tier6, tier7, tier8,
] as QuestionTier[];

/** Quick-start tiers (identity + communication + cognitive) ~60 seconds */
export const quickTiers: QuestionTier[] = [tier0, tier1, tier2] as QuestionTier[];

/** AI-mode seed questions — just 5 essential questions, AI enricher handles the rest */
const aiSeedIds = new Set(["t0_q01", "t0_q02", "t0_q06", "t0_q07", "t0_q09"]);
const aiSeedTier: QuestionTier = {
  tier: 0,
  tier_name: "Identity",
  tier_intro: "5 quick questions — AI will figure out the rest from your answers.",
  tier_complete: {
    headline: "Seeds planted.",
    body: "AI is now analyzing your answers to build a deep profile. This is where the magic happens."
  },
  questions: (tier0 as QuestionTier).questions.filter(
    (q: any) => aiSeedIds.has(q.id) || (q.is_followup && q.parent_question && aiSeedIds.has(q.parent_question))
  )
} as QuestionTier;

export const aiTiers: QuestionTier[] = [aiSeedTier];

/** Essential mode — 5 highest-signal questions across tiers, AI infers the rest */
const essentialIds = new Set(["t0_q01", "t0_q06", "t0_q07", "t1_q01", "t1_q09", "t2_q15"]);
const essentialFollowUpParents = new Set(["t0_q07", "t1_q01"]);
const allQuestions = [
  ...(tier0 as QuestionTier).questions,
  ...(tier1 as QuestionTier).questions,
  ...(tier2 as QuestionTier).questions,
];
const essentialTier: QuestionTier = {
  tier: 0,
  tier_name: "Twój profil AI",
  tier_intro: "Kilka kluczowych pytań — AI zbuduje resztę z Twoich odpowiedzi.",
  tier_complete: {
    headline: "Gotowe.",
    body: "AI analizuje Twoje odpowiedzi i buduje pełny profil osobowości."
  },
  questions: allQuestions.filter(
    (q: any) => essentialIds.has(q.id) || (q.is_followup && q.parent_question && essentialFollowUpParents.has(q.parent_question))
  )
} as QuestionTier;

export const essentialTiers: QuestionTier[] = [essentialTier];

/** Tier metadata for display */
export const tierMeta = [
  { tier: 0, emoji: "🪪", name: "Identity", questions: (tier0 as QuestionTier).questions.filter((q: any) => !q.is_followup).length },
  { tier: 1, emoji: "💬", name: "Communication", questions: (tier1 as QuestionTier).questions.filter((q: any) => !q.is_followup).length },
  { tier: 2, emoji: "🧠", name: "Cognitive", questions: (tier2 as QuestionTier).questions.filter((q: any) => !q.is_followup).length },
  { tier: 3, emoji: "⚡", name: "Work", questions: (tier3 as QuestionTier).questions.filter((q: any) => !q.is_followup).length },
  { tier: 4, emoji: "🎭", name: "Personality", questions: (tier4 as QuestionTier).questions.filter((q: any) => !q.is_followup).length },
  { tier: 5, emoji: "🔮", name: "Neurodivergent", questions: (tier5 as QuestionTier).questions.filter((q: any) => !q.is_followup).length },
  { tier: 6, emoji: "🛠", name: "Expertise", questions: (tier6 as QuestionTier).questions.filter((q: any) => !q.is_followup).length },
  { tier: 7, emoji: "🌍", name: "Life Context", questions: (tier7 as QuestionTier).questions.filter((q: any) => !q.is_followup).length },
  { tier: 8, emoji: "🤖", name: "AI Relationship", questions: (tier8 as QuestionTier).questions.filter((q: any) => !q.is_followup).length },
];
