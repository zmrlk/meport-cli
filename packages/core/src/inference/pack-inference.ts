/**
 * Pack-Based Layer 2 Inference
 *
 * Bridge between PackProfilingEngine answers and the existing
 * inference pipeline. Converts pack answers/questions to the
 * format expected by runLayer2.
 */

import type {
  PersonaProfile,
  Answer,
  Question,
  InferredValue,
} from "../schema/types.js";
import type { Pack, PackQuestion } from "../profiler/pack-loader.js";
import { detectBehavioralSignals, buildBehavioralContext } from "./behavioral.js";
import { detectCompoundSignals } from "./compound.js";
import { detectContradictions } from "./contradictions.js";

/**
 * Run Layer 2 inference using pack-based data.
 * Converts PackAnswer map to Answer map, builds question map from packs.
 */
export function runPackLayer2(
  profile: PersonaProfile,
  packAnswers: Map<string, { question_id: string; value: any; timestamp: number; response_time_ms: number; skipped: boolean; pack: string }>,
  packs: Pack[]
): PersonaProfile {
  // Convert pack answers to Answer format
  const answers = new Map<string, Answer>();
  for (const [id, pa] of packAnswers) {
    answers.set(id, {
      question_id: pa.question_id,
      value: pa.value,
      timestamp: pa.timestamp,
      response_time_ms: pa.response_time_ms,
      skipped: pa.skipped,
    });
  }

  // Build question map from packs
  const questions = new Map<string, Question>();
  for (const pack of packs) {
    for (const pq of pack.questions) {
      questions.set(pq.id, packQuestionToQuestion(pq));
    }
  }

  // 2A: Behavioral signals
  const questionTypeMap = new Map<string, { type: string }>();
  for (const [id, q] of questions) {
    questionTypeMap.set(id, { type: q.type });
  }

  const ctx = buildBehavioralContext(answers, questionTypeMap);
  const behavioralSignals = detectBehavioralSignals(ctx);

  for (const signal of behavioralSignals) {
    profile.inferred[signal.dimension] = signal;
  }

  // 2B: Compound signals
  const getAnswerValue = (questionId: string): string | undefined => {
    const answer = answers.get(questionId);
    if (!answer || answer.skipped) return undefined;

    if (typeof answer.value === "number") {
      return String(answer.value);
    }

    const rawValue = typeof answer.value === "string" ? answer.value : undefined;
    if (!rawValue) return undefined;

    const question = questions.get(questionId);
    if (question?.options) {
      const selectedOption = question.options.find((o) => o.value === rawValue);
      if (selectedOption?.maps_to) {
        return selectedOption.maps_to.value;
      }
    }

    return rawValue;
  };

  const compoundSignals = detectCompoundSignals(getAnswerValue);
  for (const signal of compoundSignals) {
    profile.compound[signal.dimension] = signal;
  }

  // 2C: Contradictions
  const contradictions = detectContradictions(
    profile.explicit,
    profile.inferred
  );
  profile.contradictions = contradictions;

  // 2D: Pack-specific behavioral signals
  const packSignals = detectPackBehavioralSignals(packAnswers);
  for (const signal of packSignals) {
    profile.inferred[signal.dimension] = signal;
  }

  profile.updated_at = new Date().toISOString();
  return profile;
}

/**
 * Pack-specific behavioral signals that use pack metadata.
 * These detect patterns across packs, not just individual answers.
 */
function detectPackBehavioralSignals(
  packAnswers: Map<string, { question_id: string; value: any; timestamp: number; response_time_ms: number; skipped: boolean; pack: string }>
): InferredValue[] {
  const signals: InferredValue[] = [];
  const answers = [...packAnswers.values()];

  if (answers.length < 3) return signals;

  // 1. Response speed pattern
  const nonSkipped = answers.filter((a) => !a.skipped);
  if (nonSkipped.length >= 3) {
    const avgResponseMs =
      nonSkipped.reduce((sum, a) => sum + a.response_time_ms, 0) /
      nonSkipped.length;

    if (avgResponseMs < 4000) {
      signals.push({
        dimension: "behavioral.response_speed",
        value: "quick_responder",
        confidence: Math.min(0.8, 0.5 + nonSkipped.length * 0.03),
        source: "behavioral",
        signal_id: "pack_response_speed",
        override: "secondary",
      });
    } else if (avgResponseMs > 12000) {
      signals.push({
        dimension: "behavioral.response_speed",
        value: "deliberate_responder",
        confidence: Math.min(0.75, 0.5 + nonSkipped.length * 0.025),
        source: "behavioral",
        signal_id: "pack_response_speed",
        override: "secondary",
      });
    }
  }

  // 2. Skip pattern — which packs get skipped most
  const packSkips = new Map<string, { total: number; skipped: number }>();
  for (const a of answers) {
    const entry = packSkips.get(a.pack) ?? { total: 0, skipped: 0 };
    entry.total++;
    if (a.skipped) entry.skipped++;
    packSkips.set(a.pack, entry);
  }

  for (const [pack, stats] of packSkips) {
    if (stats.total >= 3 && stats.skipped / stats.total > 0.5) {
      signals.push({
        dimension: `behavioral.skip_pattern.${pack}`,
        value: "high_skip",
        confidence: 0.6,
        source: "behavioral",
        signal_id: `pack_skip_${pack}`,
        override: "flag_only",
      });
    }
  }

  // 3. Sensitive pack avoidance — skipping ALL questions in health/finance
  const sensitivePacks = ["health", "finance"];
  for (const pack of sensitivePacks) {
    const packStats = packSkips.get(pack);
    if (packStats && packStats.total > 0 && packStats.skipped === packStats.total) {
      signals.push({
        dimension: "meta.privacy_sensitivity",
        value: "elevated",
        confidence: 0.7,
        source: "behavioral",
        signal_id: `sensitive_pack_avoidance_${pack}`,
        override: "flag_only",
      });
    }
  }

  // 4. ADHD pattern detection (silent — from answer combinations)
  // Signals: burst mode + impulsive spending + poor sleep/screens + inconsistent fitness
  const adhdSignals: string[] = [];
  for (const a of answers) {
    const val = typeof a.value === "string" ? a.value : "";
    if (val === "panic_power" || val === "burst") adhdSignals.push("burst");
    if (val === "go_anyway") adhdSignals.push("impulsive");
    if (val === "phone_scroll") adhdSignals.push("screen_addicted");
    if (val === "on_off") adhdSignals.push("inconsistent");
    if (val === "no_prep") adhdSignals.push("no_planning");
    if (val === "avoid") adhdSignals.push("avoidant");
  }

  if (adhdSignals.length >= 3) {
    signals.push({
      dimension: "neurodivergent.adhd_pattern",
      value: adhdSignals.length >= 4 ? "strong_indicators" : "some_indicators",
      confidence: Math.min(0.8, 0.4 + adhdSignals.length * 0.1),
      source: "behavioral",
      signal_id: "adhd_pattern",
      override: "secondary",
    });

    // Add ADHD-adapted export rule as inferred dimension
    signals.push({
      dimension: "neurodivergent.adhd_adaptations",
      value: "Tasks max 15-25 min. One priority visible at a time. No long lists. Celebrate small wins.",
      confidence: Math.min(0.75, 0.35 + adhdSignals.length * 0.1),
      source: "compound",
      signal_id: "adhd_adaptations",
      override: "secondary",
    });
  }

  return signals;
}

/**
 * Convert PackQuestion to legacy Question format for compound rule matching.
 */
function packQuestionToQuestion(pq: PackQuestion): Question {
  return {
    id: pq.id,
    tier: 0,
    tier_name: pq.pack,
    question: pq.question,
    type: pq.type as any,
    dimension: pq.dimension,
    skippable: pq.skippable,
    meta_profiling: pq.meta_profiling,
    why_this_matters: pq.why_this_matters,
    options: pq.options?.map((o) => ({
      value: o.value,
      label: o.label,
      maps_to: o.maps_to,
    })),
  };
}
