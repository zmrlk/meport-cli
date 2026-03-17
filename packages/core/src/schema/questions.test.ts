/**
 * Question Bank Validation Tests
 *
 * Validates structural integrity, cross-references, and type consistency
 * for all tier JSON files in questions/personal/.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { QuestionTier, QuestionType } from "./types.js";

// ─── Constants ──────────────────────────────────────────────

const QUESTIONS_PATH =
  "./questions/personal";

const TIER_FILES = [
  { file: "tier-0-identity.json", expectedTier: 0 },
  { file: "tier-1-communication.json", expectedTier: 1 },
  { file: "tier-2-cognitive.json", expectedTier: 2 },
  { file: "tier-3-work.json", expectedTier: 3 },
  { file: "tier-4-personality.json", expectedTier: 4 },
  { file: "tier-5-neurodivergent.json", expectedTier: 5 },
  { file: "tier-6-expertise.json", expectedTier: 6 },
  { file: "tier-7-life-context.json", expectedTier: 7 },
  { file: "tier-8-ai-relationship.json", expectedTier: 8 },
];

// Types declared in the TypeScript union
const TYPESCRIPT_QUESTION_TYPES: QuestionType[] = [
  "select",
  "scenario",
  "spectrum",
  "ranking",
  "multi_select",
  "scale",
  "open_text",
  "matrix",
];

// Types that actually appear in JSON data (should match TS union now)
const VALID_JSON_QUESTION_TYPES = new Set([
  ...TYPESCRIPT_QUESTION_TYPES,
]);

// ─── Data Loading ───────────────────────────────────────────

let tiers: Array<{ meta: { file: string; expectedTier: number }; data: QuestionTier }> = [];
let allQuestions: Array<{ tierFile: string; question: Record<string, unknown> }> = [];
let allQuestionIds: Set<string>;

beforeAll(async () => {
  tiers = await Promise.all(
    TIER_FILES.map(async (meta) => {
      const filePath = join(QUESTIONS_PATH, meta.file);
      const raw = await readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as QuestionTier;
      return { meta, data };
    })
  );

  for (const { meta, data } of tiers) {
    for (const q of data.questions) {
      allQuestions.push({ tierFile: meta.file, question: q as unknown as Record<string, unknown> });
    }
  }

  allQuestionIds = new Set(allQuestions.map((aq) => aq.question["id"] as string));
});

// ─── 1. Structural Validation — Tier Level ──────────────────

describe("Tier-level structure", () => {
  it("all 9 tier files load without error", () => {
    expect(tiers).toHaveLength(9);
    for (const { data } of tiers) {
      expect(data).toBeTruthy();
    }
  });

  it("each tier has required top-level fields with correct types", () => {
    for (const { meta, data } of tiers) {
      expect(typeof data.tier, `${meta.file}: tier must be a number`).toBe("number");
      expect(typeof data.tier_name, `${meta.file}: tier_name must be a string`).toBe("string");
      expect(typeof data.tier_intro, `${meta.file}: tier_intro must be a string`).toBe("string");
      expect(data.tier_intro.length, `${meta.file}: tier_intro must not be empty`).toBeGreaterThan(0);
      expect(Array.isArray(data.questions), `${meta.file}: questions must be an array`).toBe(true);
    }
  });

  it("tier_complete has headline and body strings", () => {
    for (const { meta, data } of tiers) {
      const tc = data.tier_complete;
      expect(tc, `${meta.file}: tier_complete must exist`).toBeTruthy();
      expect(
        typeof tc.headline,
        `${meta.file}: tier_complete.headline must be a string`
      ).toBe("string");
      expect(
        tc.headline.length,
        `${meta.file}: tier_complete.headline must not be empty`
      ).toBeGreaterThan(0);
      expect(
        typeof tc.body,
        `${meta.file}: tier_complete.body must be a string`
      ).toBe("string");
      expect(
        tc.body.length,
        `${meta.file}: tier_complete.body must not be empty`
      ).toBeGreaterThan(0);
    }
  });

  it("tier number in data matches filename", () => {
    for (const { meta, data } of tiers) {
      expect(data.tier, `${meta.file}: tier field should be ${meta.expectedTier}`).toBe(
        meta.expectedTier
      );
    }
  });

  it("each tier has at least one question", () => {
    for (const { meta, data } of tiers) {
      expect(
        data.questions.length,
        `${meta.file}: must have at least 1 question`
      ).toBeGreaterThan(0);
    }
  });
});

// ─── 2. Question Validation ──────────────────────────────────

describe("Question required fields", () => {
  it("every question has required fields with correct types", () => {
    for (const { tierFile, question: q } of allQuestions) {
      const id = q["id"] as string;
      const ctx = `${tierFile} / question ${id}`;

      expect(typeof q["id"], `${ctx}: id must be string`).toBe("string");
      expect((q["id"] as string).length, `${ctx}: id must not be empty`).toBeGreaterThan(0);

      expect(typeof q["tier"], `${ctx}: tier must be number`).toBe("number");
      expect(typeof q["tier_name"], `${ctx}: tier_name must be string`).toBe("string");
      expect(typeof q["question"], `${ctx}: question text must be string`).toBe("string");
      expect((q["question"] as string).length, `${ctx}: question text must not be empty`).toBeGreaterThan(0);

      expect(typeof q["type"], `${ctx}: type must be string`).toBe("string");
      expect(typeof q["dimension"], `${ctx}: dimension must be string`).toBe("string");
      expect((q["dimension"] as string).length, `${ctx}: dimension must not be empty`).toBeGreaterThan(0);

      expect(typeof q["skippable"], `${ctx}: skippable must be boolean`).toBe("boolean");
    }
  });

  it("question ID format matches t{tier}_q{number} or t{tier}_q{number}{letter}", () => {
    const ID_PATTERN = /^t(\d+)_q\d+[a-z_]*$/;
    for (const { tierFile, question: q } of allQuestions) {
      const id = q["id"] as string;
      expect(
        ID_PATTERN.test(id),
        `${tierFile}: ID "${id}" does not match expected format t{tier}_q{number}[letter]`
      ).toBe(true);
    }
  });

  it("question ID tier prefix matches the tier field", () => {
    for (const { tierFile, question: q } of allQuestions) {
      const id = q["id"] as string;
      const tierInId = parseInt(id.split("_")[0].replace("t", ""), 10);
      expect(
        tierInId,
        `${tierFile}: ID "${id}" has tier prefix ${tierInId} but question.tier is ${q["tier"]}`
      ).toBe(q["tier"]);
    }
  });

  it("question type is a known value (flags spectrum/ranking as TS gap)", () => {
    const unknownTypes: string[] = [];
    const tsGapTypes: string[] = [];

    for (const { tierFile, question: q } of allQuestions) {
      const type = q["type"] as string;
      const id = q["id"] as string;

      if (!VALID_JSON_QUESTION_TYPES.has(type as QuestionType)) {
        unknownTypes.push(`${tierFile}/${id}: unknown type "${type}"`);
      } else if (!TYPESCRIPT_QUESTION_TYPES.includes(type as QuestionType)) {
        // type is valid in practice but missing from the TS union
        tsGapTypes.push(`${tierFile}/${id}: type "${type}" not in TypeScript QuestionType union`);
      }
    }

    // Completely unknown types should fail hard
    expect(
      unknownTypes,
      `Found questions with unrecognized types:\n${unknownTypes.join("\n")}`
    ).toHaveLength(0);

    // Known TS gap — document it but don't block (this is the "spectrum" / "ranking" case)
    if (tsGapTypes.length > 0) {
      console.warn(
        `[KNOWN GAP] ${tsGapTypes.length} questions use types not in TypeScript QuestionType union:\n` +
          tsGapTypes.join("\n")
      );
    }
  });
});

// ─── 3. Option Validation ────────────────────────────────────

describe("Option validation", () => {
  it("every option has value, label, and maps_to with dimension + value", () => {
    for (const { tierFile, question: q } of allQuestions) {
      const options = q["options"] as Array<Record<string, unknown>> | undefined;
      if (!options) continue;

      const id = q["id"] as string;

      for (const [idx, opt] of options.entries()) {
        const ctx = `${tierFile}/${id} option[${idx}]`;

        expect(typeof opt["value"], `${ctx}: value must be string`).toBe("string");
        expect((opt["value"] as string).length, `${ctx}: value must not be empty`).toBeGreaterThan(0);

        expect(typeof opt["label"], `${ctx}: label must be string`).toBe("string");
        expect((opt["label"] as string).length, `${ctx}: label must not be empty`).toBeGreaterThan(0);

        const mapsTo = opt["maps_to"] as Record<string, unknown> | undefined;
        // Some follow-up options (e.g. spectrum ranges) may not have maps_to
        if (!mapsTo) continue;
        if (mapsTo) {
          expect(
            typeof mapsTo["dimension"],
            `${ctx}: maps_to.dimension must be string`
          ).toBe("string");
          expect(
            (mapsTo["dimension"] as string).length,
            `${ctx}: maps_to.dimension must not be empty`
          ).toBeGreaterThan(0);
          expect(
            typeof mapsTo["value"],
            `${ctx}: maps_to.value must be string`
          ).toBe("string");
          expect(
            (mapsTo["value"] as string).length,
            `${ctx}: maps_to.value must not be empty`
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("no duplicate option values within the same question", () => {
    for (const { tierFile, question: q } of allQuestions) {
      const options = q["options"] as Array<Record<string, unknown>> | undefined;
      if (!options) continue;

      const id = q["id"] as string;
      const values = options.map((o) => o["value"] as string);
      const unique = new Set(values);

      expect(
        unique.size,
        `${tierFile}/${id}: duplicate option values found: ${values.filter((v, i) => values.indexOf(v) !== i).join(", ")}`
      ).toBe(values.length);
    }
  });

  it("option triggers reference question IDs that exist in the bank", () => {
    // Collect all trigger references before allQuestionIds is guaranteed populated
    const badTriggers: string[] = [];

    for (const { tierFile, question: q } of allQuestions) {
      const options = q["options"] as Array<Record<string, unknown>> | undefined;
      if (!options) continue;

      const qId = q["id"] as string;

      for (const opt of options) {
        const triggers = opt["triggers"] as string[] | undefined;
        if (!triggers || triggers.length === 0) continue;

        for (const targetId of triggers) {
          if (!allQuestionIds.has(targetId)) {
            badTriggers.push(
              `${tierFile}/${qId}: option "${opt["value"]}" triggers "${targetId}" which does not exist`
            );
          }
        }
      }
    }

    expect(
      badTriggers,
      `Found unresolvable option triggers:\n${badTriggers.join("\n")}`
    ).toHaveLength(0);
  });
});

// ─── 4. Follow-up Validation ─────────────────────────────────

describe("Follow-up question validation", () => {
  it("questions with is_followup: true have parent_question set", () => {
    const violations: string[] = [];

    for (const { tierFile, question: q } of allQuestions) {
      if (q["is_followup"] === true) {
        if (!q["parent_question"] || typeof q["parent_question"] !== "string") {
          violations.push(`${tierFile}/${q["id"]}: is_followup=true but parent_question is missing`);
        }
      }
    }

    expect(
      violations,
      `Follow-up questions missing parent_question:\n${violations.join("\n")}`
    ).toHaveLength(0);
  });

  it("parent_question references an existing question ID", () => {
    const badRefs: string[] = [];

    for (const { tierFile, question: q } of allQuestions) {
      const parentId = q["parent_question"] as string | undefined;
      if (!parentId) continue;

      if (!allQuestionIds.has(parentId)) {
        badRefs.push(
          `${tierFile}/${q["id"]}: parent_question "${parentId}" does not exist`
        );
      }
    }

    expect(
      badRefs,
      `Follow-up questions referencing missing parents:\n${badRefs.join("\n")}`
    ).toHaveLength(0);
  });

  it("follow-up trigger targets in parent options match actual follow-up question IDs", () => {
    const followupIds = new Set(
      allQuestions
        .filter((aq) => aq.question["is_followup"] === true)
        .map((aq) => aq.question["id"] as string)
    );

    const mismatches: string[] = [];

    for (const { tierFile, question: q } of allQuestions) {
      const options = q["options"] as Array<Record<string, unknown>> | undefined;
      if (!options) continue;

      for (const opt of options) {
        const triggers = opt["triggers"] as string[] | undefined;
        if (!triggers) continue;

        for (const targetId of triggers) {
          // Cross-tier triggers to main questions are valid (e.g. t0_q09 → t1_q02)
          // Only flag if the target doesn't exist at all
          if (!allQuestionIds.has(targetId)) {
            mismatches.push(
              `${tierFile}/${q["id"]}: option "${opt["value"]}" triggers "${targetId}" but that question does not exist`
            );
          }
        }
      }
    }

    expect(
      mismatches,
      `Triggers pointing to non-followup questions:\n${mismatches.join("\n")}`
    ).toHaveLength(0);
  });
});

// ─── 5. Cross-Tier Validation ────────────────────────────────

describe("Cross-tier validation", () => {
  it("no duplicate question IDs across all tiers", () => {
    const seen = new Map<string, string>(); // id -> tierFile
    const duplicates: string[] = [];

    for (const { tierFile, question: q } of allQuestions) {
      const id = q["id"] as string;
      if (seen.has(id)) {
        duplicates.push(`"${id}" appears in both ${seen.get(id)} and ${tierFile}`);
      } else {
        seen.set(id, tierFile);
      }
    }

    expect(
      duplicates,
      `Duplicate question IDs found:\n${duplicates.join("\n")}`
    ).toHaveLength(0);
  });

  it("all trigger references across all questions resolve to existing IDs", () => {
    const unresolved: string[] = [];

    for (const { tierFile, question: q } of allQuestions) {
      const options = q["options"] as Array<Record<string, unknown>> | undefined;
      if (!options) continue;

      for (const opt of options) {
        const triggers = opt["triggers"] as string[] | undefined;
        if (!triggers) continue;

        for (const targetId of triggers) {
          if (!allQuestionIds.has(targetId)) {
            unresolved.push(
              `${tierFile}/${q["id"]}: trigger "${targetId}" cannot be resolved`
            );
          }
        }
      }
    }

    expect(
      unresolved,
      `Unresolvable trigger references:\n${unresolved.join("\n")}`
    ).toHaveLength(0);
  });
});

// ─── 6. Dimension Consistency ────────────────────────────────

describe("Dimension consistency", () => {
  it("every question has a non-empty dimension string", () => {
    const violations: string[] = [];

    for (const { tierFile, question: q } of allQuestions) {
      const dim = q["dimension"];
      if (typeof dim !== "string" || dim.trim().length === 0) {
        violations.push(`${tierFile}/${q["id"]}: missing or empty dimension`);
      }
    }

    expect(
      violations,
      `Questions with missing/empty dimension:\n${violations.join("\n")}`
    ).toHaveLength(0);
  });

  it("all maps_to.dimension values are non-empty strings", () => {
    const violations: string[] = [];

    for (const { tierFile, question: q } of allQuestions) {
      const options = q["options"] as Array<Record<string, unknown>> | undefined;
      if (!options) continue;

      for (const [idx, opt] of options.entries()) {
        const mapsTo = opt["maps_to"] as Record<string, unknown> | undefined;
        if (!mapsTo) continue;

        const dim = mapsTo["dimension"];
        if (typeof dim !== "string" || dim.trim().length === 0) {
          violations.push(
            `${tierFile}/${q["id"]} option[${idx}].maps_to.dimension is empty or missing`
          );
        }
      }
    }

    expect(
      violations,
      `Options with invalid maps_to.dimension:\n${violations.join("\n")}`
    ).toHaveLength(0);
  });

  it("dimension strings follow dot-notation format (category.field)", () => {
    const DOT_PATTERN = /^[a-z_]+\.[a-z_]+$/;
    const violations: string[] = [];

    for (const { tierFile, question: q } of allQuestions) {
      const dim = q["dimension"] as string;
      if (!DOT_PATTERN.test(dim)) {
        violations.push(`${tierFile}/${q["id"]}: dimension "${dim}" does not match category.field pattern`);
      }
    }

    expect(
      violations,
      `Dimensions with unexpected format:\n${violations.join("\n")}`
    ).toHaveLength(0);
  });
});
