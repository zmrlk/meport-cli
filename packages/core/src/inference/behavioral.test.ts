import { describe, it, expect } from "vitest";
import {
  buildBehavioralContext,
  detectBehavioralSignals,
} from "./behavioral.js";
import type { Answer } from "../schema/types.js";

// ─── Helpers ───────────────────────────────────────────────

function makeAnswer(
  question_id: string,
  value: string | number,
  response_time_ms = 5000,
  skipped = false
): Answer {
  return { question_id, value, timestamp: 0, response_time_ms, skipped };
}

function makeAnswerMap(answers: Answer[]): Map<string, Answer> {
  return new Map(answers.map((a) => [a.question_id, a]));
}

function makeQuestions(
  entries: Array<{ id: string; type: string }>
): Map<string, { type: string }> {
  return new Map(entries.map((e) => [e.id, { type: e.type }]));
}

// ─── buildBehavioralContext ────────────────────────────────

describe("buildBehavioralContext", () => {
  it("extracts open_text answers into openTextAnswers map", () => {
    const answers = makeAnswerMap([
      makeAnswer("q1", "hello world"),
      makeAnswer("q2", "another text"),
      makeAnswer("q3", "select_value"),
    ]);
    const questions = makeQuestions([
      { id: "q1", type: "open_text" },
      { id: "q2", type: "open_text" },
      { id: "q3", type: "select" },
    ]);

    const ctx = buildBehavioralContext(answers, questions);

    expect(ctx.openTextAnswers.size).toBe(2);
    expect(ctx.openTextAnswers.get("q1")).toBe("hello world");
    expect(ctx.openTextAnswers.get("q2")).toBe("another text");
    expect(ctx.openTextAnswers.has("q3")).toBe(false);
  });

  it("tracks skipped question IDs", () => {
    const answers = makeAnswerMap([
      makeAnswer("q1", "value"),
      { ...makeAnswer("q2", ""), skipped: true },
      { ...makeAnswer("q3", ""), skipped: true },
    ]);
    const questions = makeQuestions([
      { id: "q1", type: "select" },
      { id: "q2", type: "select" },
      { id: "q3", type: "select" },
    ]);

    const ctx = buildBehavioralContext(answers, questions);

    expect(ctx.skippedQuestionIds).toContain("q2");
    expect(ctx.skippedQuestionIds).toContain("q3");
    expect(ctx.skippedQuestionIds).not.toContain("q1");
  });

  it("counts total questions including skipped", () => {
    const answers = makeAnswerMap([
      makeAnswer("q1", "a"),
      makeAnswer("q2", "b"),
      { ...makeAnswer("q3", ""), skipped: true },
    ]);
    const questions = makeQuestions([
      { id: "q1", type: "select" },
      { id: "q2", type: "select" },
      { id: "q3", type: "select" },
    ]);

    const ctx = buildBehavioralContext(answers, questions);

    expect(ctx.totalQuestions).toBe(3);
  });

  it("does not put skipped answers into openTextAnswers", () => {
    const answers = makeAnswerMap([
      { ...makeAnswer("q1", "long text here"), skipped: true },
    ]);
    const questions = makeQuestions([{ id: "q1", type: "open_text" }]);

    const ctx = buildBehavioralContext(answers, questions);

    expect(ctx.openTextAnswers.size).toBe(0);
  });
});

// ─── fast_picker ──────────────────────────────────────────

describe("fast_picker rule", () => {
  function makeAnswers(count: number, responseTimeMs: number): Answer[] {
    return Array.from({ length: count }, (_, i) =>
      makeAnswer(`q${i}`, "value", responseTimeMs)
    );
  }

  it("fires 'fast' when avg response_time_ms < 3000 with 20+ answers", () => {
    const answers = makeAnswerMap(makeAnswers(20, 1500));
    const questions = makeQuestions(
      Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, type: "select" }))
    );
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "fast_picker");
    expect(signal).toBeDefined();
    expect(signal?.value).toBe("fast");
  });

  it("fires 'deliberate' when avg response_time_ms > 10000 with 20+ answers", () => {
    const answers = makeAnswerMap(makeAnswers(20, 12000));
    const questions = makeQuestions(
      Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, type: "select" }))
    );
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "fast_picker");
    expect(signal).toBeDefined();
    expect(signal?.value).toBe("deliberate");
  });

  it("does not fire when fewer than 20 answers", () => {
    const answers = makeAnswerMap(makeAnswers(19, 1000));
    const questions = makeQuestions(
      Array.from({ length: 19 }, (_, i) => ({ id: `q${i}`, type: "select" }))
    );
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "fast_picker");
    expect(signal).toBeUndefined();
  });

  it("does not fire for mid-range response times (3000-10000ms)", () => {
    const answers = makeAnswerMap(makeAnswers(20, 5000));
    const questions = makeQuestions(
      Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, type: "select" }))
    );
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "fast_picker");
    expect(signal).toBeUndefined();
  });
});

// ─── verbose_open_text ────────────────────────────────────

describe("verbose_open_text rule", () => {
  it("fires 'detailed' when avg word count > 30 with 2+ open_text answers", () => {
    const longText = Array(35).fill("word").join(" "); // 35 words
    const answers = makeAnswerMap([
      makeAnswer("q1", longText),
      makeAnswer("q2", longText),
    ]);
    const questions = makeQuestions([
      { id: "q1", type: "open_text" },
      { id: "q2", type: "open_text" },
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "verbose_open_text");
    expect(signal).toBeDefined();
    expect(signal?.value).toBe("detailed");
  });

  it("fires 'minimal' when avg word count < 5 with 2+ open_text answers", () => {
    const shortText = "ok sure";
    const answers = makeAnswerMap([
      makeAnswer("q1", shortText),
      makeAnswer("q2", "yes"),
    ]);
    const questions = makeQuestions([
      { id: "q1", type: "open_text" },
      { id: "q2", type: "open_text" },
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "verbose_open_text");
    expect(signal).toBeDefined();
    expect(signal?.value).toBe("minimal");
  });

  it("does not fire when fewer than 2 open_text answers", () => {
    const longText = Array(40).fill("word").join(" ");
    const answers = makeAnswerMap([makeAnswer("q1", longText)]);
    const questions = makeQuestions([{ id: "q1", type: "open_text" }]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "verbose_open_text");
    expect(signal).toBeUndefined();
  });

  it("does not fire for moderate word counts (5-30 words)", () => {
    const moderateText = Array(15).fill("word").join(" "); // 15 words
    const answers = makeAnswerMap([
      makeAnswer("q1", moderateText),
      makeAnswer("q2", moderateText),
    ]);
    const questions = makeQuestions([
      { id: "q1", type: "open_text" },
      { id: "q2", type: "open_text" },
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "verbose_open_text");
    expect(signal).toBeUndefined();
  });
});

// ─── emoji_in_text ────────────────────────────────────────

describe("emoji_in_text rule", () => {
  it("fires 'frequent' when 3 or more emoji found across texts", () => {
    const answers = makeAnswerMap([
      makeAnswer("q1", "I love this 😊"),
      makeAnswer("q2", "Great work 🎉 and more 🔥"),
    ]);
    const questions = makeQuestions([
      { id: "q1", type: "open_text" },
      { id: "q2", type: "open_text" },
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "emoji_in_text");
    expect(signal).toBeDefined();
    expect(signal?.value).toBe("frequent");
  });

  it("fires 'none' when 0 emoji and 3+ text answers", () => {
    const answers = makeAnswerMap([
      makeAnswer("q1", "plain text answer"),
      makeAnswer("q2", "another plain answer"),
      makeAnswer("q3", "third plain answer"),
    ]);
    const questions = makeQuestions([
      { id: "q1", type: "open_text" },
      { id: "q2", type: "open_text" },
      { id: "q3", type: "open_text" },
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "emoji_in_text");
    expect(signal).toBeDefined();
    expect(signal?.value).toBe("none");
  });

  it("does not fire when fewer than 3 texts and no emoji", () => {
    const answers = makeAnswerMap([
      makeAnswer("q1", "plain text"),
      makeAnswer("q2", "more plain text"),
    ]);
    const questions = makeQuestions([
      { id: "q1", type: "open_text" },
      { id: "q2", type: "open_text" },
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "emoji_in_text");
    expect(signal).toBeUndefined();
  });

  it("does not fire when there are no open_text answers", () => {
    const answers = makeAnswerMap([makeAnswer("q1", "select_value")]);
    const questions = makeQuestions([{ id: "q1", type: "select" }]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "emoji_in_text");
    expect(signal).toBeUndefined();
  });
});

// ─── skip_pattern_privacy ─────────────────────────────────

describe("skip_pattern_privacy rule", () => {
  it("fires when a privacy-sensitive question is skipped", () => {
    const answers = makeAnswerMap([
      { ...makeAnswer("t7_q12", ""), skipped: true },
      makeAnswer("q2", "normal"),
    ]);
    const questions = makeQuestions([
      { id: "t7_q12", type: "select" },
      { id: "q2", type: "select" },
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "skip_pattern_privacy");
    expect(signal).toBeDefined();
    expect(signal?.value).toBe("elevated");
  });

  it("fires for all four privacy question IDs", () => {
    const privacyIds = ["t7_q12", "t7_q13", "t7_q14", "t5_q16"];

    for (const id of privacyIds) {
      const answers = makeAnswerMap([
        { ...makeAnswer(id, ""), skipped: true },
      ]);
      const questions = makeQuestions([{ id, type: "select" }]);
      const ctx = buildBehavioralContext(answers, questions);
      const signals = detectBehavioralSignals(ctx);

      const signal = signals.find(
        (s) => s.signal_id === "skip_pattern_privacy"
      );
      expect(signal).toBeDefined();
    }
  });

  it("does not fire when only non-privacy questions are skipped", () => {
    const answers = makeAnswerMap([
      { ...makeAnswer("t1_q01", ""), skipped: true },
      { ...makeAnswer("t2_q05", ""), skipped: true },
    ]);
    const questions = makeQuestions([
      { id: "t1_q01", type: "select" },
      { id: "t2_q05", type: "select" },
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "skip_pattern_privacy");
    expect(signal).toBeUndefined();
  });
});

// ─── hedging_detector ─────────────────────────────────────

describe("hedging_detector rule", () => {
  it("fires when 3 or more answers contain hedge phrases", () => {
    const answers = makeAnswerMap([
      makeAnswer("q1", "maybe I would do that"),
      makeAnswer("q2", "i think it depends on the situation"),
      makeAnswer("q3", "probably not the best approach"),
    ]);
    const questions = makeQuestions([
      { id: "q1", type: "open_text" },
      { id: "q2", type: "open_text" },
      { id: "q3", type: "open_text" },
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "hedging_detector");
    expect(signal).toBeDefined();
    expect(signal?.value).toBe("high");
  });

  it("fires with Polish hedge phrases", () => {
    const answers = makeAnswerMap([
      makeAnswer("q1", "chyba tak"),
      makeAnswer("q2", "może to dobry pomysł"),
      makeAnswer("q3", "raczej nie wiem"),
    ]);
    const questions = makeQuestions([
      { id: "q1", type: "open_text" },
      { id: "q2", type: "open_text" },
      { id: "q3", type: "open_text" },
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "hedging_detector");
    expect(signal).toBeDefined();
    expect(signal?.value).toBe("high");
  });

  it("does not fire when fewer than 3 answers contain hedge phrases", () => {
    const answers = makeAnswerMap([
      makeAnswer("q1", "maybe this is right"),
      makeAnswer("q2", "definitely yes absolutely"),
      makeAnswer("q3", "clear and certain answer"),
    ]);
    const questions = makeQuestions([
      { id: "q1", type: "open_text" },
      { id: "q2", type: "open_text" },
      { id: "q3", type: "open_text" },
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "hedging_detector");
    expect(signal).toBeUndefined();
  });

  it("counts at most one hedge per answer (multiple hedges in one answer = count 1)", () => {
    // Two answers with multiple hedges each — should only count as 2, not 4
    const answers = makeAnswerMap([
      makeAnswer("q1", "maybe perhaps sort of kind of"),
      makeAnswer("q2", "i think i guess probably"),
    ]);
    const questions = makeQuestions([
      { id: "q1", type: "open_text" },
      { id: "q2", type: "open_text" },
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "hedging_detector");
    expect(signal).toBeUndefined(); // only 2 answers hedged, needs 3
  });
});

// ─── high_skip_rate ──────────────────────────────────────

describe("high_skip_rate rule", () => {
  it("fires 'low' engagement when skip rate > 30% with 10+ total questions", () => {
    // 4 skipped out of 10 = 40% skip rate
    const answers = makeAnswerMap([
      ...Array.from({ length: 4 }, (_, i) => ({
        ...makeAnswer(`skip${i}`, ""),
        skipped: true,
      })),
      ...Array.from({ length: 6 }, (_, i) => makeAnswer(`ans${i}`, "value")),
    ]);
    const questions = makeQuestions([
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `skip${i}`,
        type: "select",
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `ans${i}`,
        type: "select",
      })),
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "high_skip_rate");
    expect(signal).toBeDefined();
    expect(signal?.value).toBe("low");
  });

  it("does not fire when total questions is fewer than 10", () => {
    // 4 skipped out of 9 = 44% but < 10 total
    const answers = makeAnswerMap([
      ...Array.from({ length: 4 }, (_, i) => ({
        ...makeAnswer(`skip${i}`, ""),
        skipped: true,
      })),
      ...Array.from({ length: 5 }, (_, i) => makeAnswer(`ans${i}`, "value")),
    ]);
    const questions = makeQuestions([
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `skip${i}`,
        type: "select",
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `ans${i}`,
        type: "select",
      })),
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "high_skip_rate");
    expect(signal).toBeUndefined();
  });

  it("does not fire when skip rate is at or below 30%", () => {
    // 3 skipped out of 10 = exactly 30% — does NOT exceed threshold
    const answers = makeAnswerMap([
      ...Array.from({ length: 3 }, (_, i) => ({
        ...makeAnswer(`skip${i}`, ""),
        skipped: true,
      })),
      ...Array.from({ length: 7 }, (_, i) => makeAnswer(`ans${i}`, "value")),
    ]);
    const questions = makeQuestions([
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `skip${i}`,
        type: "select",
      })),
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `ans${i}`,
        type: "select",
      })),
    ]);
    const ctx = buildBehavioralContext(answers, questions);
    const signals = detectBehavioralSignals(ctx);

    const signal = signals.find((s) => s.signal_id === "high_skip_rate");
    expect(signal).toBeUndefined();
  });
});
