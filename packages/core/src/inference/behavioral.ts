/**
 * Layer 2A — Behavioral Signal Detection
 *
 * Observes HOW the user answered (timing, length, patterns)
 * to infer additional dimensions. Fully deterministic, no AI needed.
 */

import type { Answer, InferredValue } from "../schema/types.js";

export interface BehavioralContext {
  answers: Map<string, Answer>;
  openTextAnswers: Map<string, string>; // question_id → text
  skippedQuestionIds: string[];
  totalQuestions: number;
}

interface BehavioralRule {
  signal_id: string;
  evaluate: (ctx: BehavioralContext) => InferredValue | null;
}

// ─── Rules ─────────────────────────────────────────────────

const HEDGE_PHRASES = [
  "maybe",
  "sort of",
  "it depends",
  "i think",
  "i guess",
  "probably",
  "not sure",
  "kind of",
  "perhaps",
  "might be",
  "chyba",
  "może",
  "raczej",
  "nie wiem",
  "trudno powiedzieć",
];

const EMOJI_REGEX = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

const rules: BehavioralRule[] = [
  {
    signal_id: "fast_picker",
    evaluate: (ctx) => {
      const answered = [...ctx.answers.values()].filter((a) => !a.skipped);
      if (answered.length < 20) return null;

      const avg =
        answered.reduce((sum, a) => sum + a.response_time_ms, 0) /
        answered.length;

      if (avg < 3000) {
        return {
          dimension: "meta.decision_speed",
          value: "fast",
          confidence: 0.65,
          source: "behavioral",
          signal_id: "fast_picker",
          override: "flag_only",
        };
      }
      if (avg > 10000) {
        return {
          dimension: "meta.decision_speed",
          value: "deliberate",
          confidence: 0.6,
          source: "behavioral",
          signal_id: "fast_picker",
          override: "flag_only",
        };
      }
      return null;
    },
  },

  {
    signal_id: "verbose_open_text",
    evaluate: (ctx) => {
      const texts = [...ctx.openTextAnswers.values()];
      if (texts.length < 2) return null;

      const avgWords =
        texts.reduce((sum, t) => sum + t.split(/\s+/).length, 0) /
        texts.length;

      if (avgWords > 30) {
        return {
          dimension: "communication.verbosity_preference",
          value: "detailed",
          confidence: 0.6,
          source: "behavioral",
          signal_id: "verbose_open_text",
          override: "secondary",
        };
      }
      if (avgWords < 5) {
        return {
          dimension: "communication.verbosity_preference",
          value: "minimal",
          confidence: 0.55,
          source: "behavioral",
          signal_id: "verbose_open_text",
          override: "secondary",
        };
      }
      return null;
    },
  },

  {
    signal_id: "emoji_in_text",
    evaluate: (ctx) => {
      const texts = [...ctx.openTextAnswers.values()];
      if (texts.length === 0) return null;

      let totalEmoji = 0;
      for (const text of texts) {
        const matches = text.match(EMOJI_REGEX);
        if (matches) totalEmoji += matches.length;
      }

      if (totalEmoji >= 3) {
        return {
          dimension: "communication.emoji_preference",
          value: "frequent",
          confidence: 0.7,
          source: "behavioral",
          signal_id: "emoji_in_text",
          override: "secondary",
        };
      }
      if (totalEmoji === 0 && texts.length >= 3) {
        return {
          dimension: "communication.emoji_preference",
          value: "none",
          confidence: 0.5,
          source: "behavioral",
          signal_id: "emoji_in_text",
          override: "secondary",
        };
      }
      return null;
    },
  },

  {
    signal_id: "skip_pattern_privacy",
    evaluate: (ctx) => {
      const privacyQuestions = [
        "t7_q12",
        "t7_q13",
        "t7_q14",
        "t5_q16",
      ];
      const skippedPrivacy = ctx.skippedQuestionIds.filter((id) =>
        privacyQuestions.includes(id)
      );

      if (skippedPrivacy.length > 0) {
        return {
          dimension: "meta.privacy_sensitivity",
          value: "elevated",
          confidence: 0.6,
          source: "behavioral",
          signal_id: "skip_pattern_privacy",
          override: "flag_only",
        };
      }
      return null;
    },
  },

  {
    signal_id: "hedging_detector",
    evaluate: (ctx) => {
      const texts = [...ctx.openTextAnswers.values()];
      if (texts.length === 0) return null;

      let hedgeCount = 0;
      for (const text of texts) {
        const lower = text.toLowerCase();
        for (const phrase of HEDGE_PHRASES) {
          if (lower.includes(phrase)) {
            hedgeCount++;
            break; // count once per answer
          }
        }
      }

      if (hedgeCount >= 3) {
        return {
          dimension: "cognitive.uncertainty_tolerance",
          value: "high",
          confidence: 0.55,
          source: "behavioral",
          signal_id: "hedging_detector",
          override: "secondary",
        };
      }
      return null;
    },
  },

  {
    signal_id: "high_skip_rate",
    evaluate: (ctx) => {
      if (ctx.totalQuestions < 10) return null;

      const skipRate = ctx.skippedQuestionIds.length / ctx.totalQuestions;

      if (skipRate > 0.3) {
        return {
          dimension: "meta.engagement_level",
          value: "low",
          confidence: 0.5,
          source: "behavioral",
          signal_id: "high_skip_rate",
          override: "flag_only",
        };
      }
      return null;
    },
  },
];

// ─── Engine ────────────────────────────────────────────────

export function detectBehavioralSignals(
  ctx: BehavioralContext
): InferredValue[] {
  const signals: InferredValue[] = [];

  for (const rule of rules) {
    const result = rule.evaluate(ctx);
    if (result) {
      signals.push(result);
    }
  }

  return signals;
}

export function buildBehavioralContext(
  answers: Map<string, Answer>,
  questions: Map<string, { type: string }>
): BehavioralContext {
  const openTextAnswers = new Map<string, string>();
  const skippedQuestionIds: string[] = [];
  let totalQuestions = 0;

  for (const [id, answer] of answers) {
    totalQuestions++;
    if (answer.skipped) {
      skippedQuestionIds.push(id);
      continue;
    }
    const q = questions.get(id);
    if (q?.type === "open_text" && typeof answer.value === "string") {
      openTextAnswers.set(id, answer.value);
    }
  }

  return {
    answers,
    openTextAnswers,
    skippedQuestionIds,
    totalQuestions,
  };
}
