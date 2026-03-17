import { describe, it, expect } from "vitest";
import { validatePack, validateTranslation } from "./pack-validator.js";
import { loadPack, getAvailablePackIds } from "./pack-loader.js";
import type { Pack } from "./pack-loader.js";

describe("Pack Validator", () => {
  it("validates a correct pack with no errors", async () => {
    const pack = await loadPack("core");
    expect(pack).not.toBeNull();
    const errors = validatePack(pack!);
    const criticalErrors = errors.filter((e) => e.severity === "error");
    expect(criticalErrors).toEqual([]);
  });

  it("catches missing pack ID", () => {
    const badPack: Pack = {
      pack: "",
      pack_name: "Test",
      pack_intro: "Test",
      required: false,
      sensitive: false,
      questions: [],
    };
    const errors = validatePack(badPack);
    expect(errors.some((e) => e.field === "pack")).toBe(true);
  });

  it("catches missing question fields", () => {
    const badPack: Pack = {
      pack: "test",
      pack_name: "Test",
      pack_intro: "Test",
      required: false,
      sensitive: false,
      questions: [
        {
          id: "",
          pack: "test",
          question: "",
          type: "select",
          dimension: "",
          skippable: true,
          meta_profiling: null,
          why_this_matters: null,
        },
      ],
    };
    const errors = validatePack(badPack);
    expect(errors.filter((e) => e.severity === "error").length).toBeGreaterThan(0);
  });

  it("catches select without options", () => {
    const badPack: Pack = {
      pack: "test",
      pack_name: "Test",
      pack_intro: "Test",
      required: false,
      sensitive: false,
      questions: [
        {
          id: "test_q01",
          pack: "test",
          question: "A question?",
          type: "select",
          dimension: "test.dim",
          skippable: true,
          meta_profiling: null,
          why_this_matters: null,
        },
      ],
    };
    const errors = validatePack(badPack);
    expect(errors.some((e) => e.message.includes("requires options"))).toBe(true);
  });

  it("validates all English packs with zero errors", async () => {
    const packIds = getAvailablePackIds();
    for (const id of packIds) {
      const pack = await loadPack(id);
      expect(pack, `Pack ${id} should load`).not.toBeNull();
      const errors = validatePack(pack!);
      const criticalErrors = errors.filter((e) => e.severity === "error");
      expect(criticalErrors, `Pack ${id} has errors: ${JSON.stringify(criticalErrors)}`).toEqual([]);
    }
  });

  it("validates all Polish packs with zero errors", async () => {
    const packIds = getAvailablePackIds();
    for (const id of packIds) {
      const pack = await loadPack(id, undefined, "pl");
      expect(pack, `Polish pack ${id} should load`).not.toBeNull();
      const errors = validatePack(pack!);
      const criticalErrors = errors.filter((e) => e.severity === "error");
      expect(criticalErrors, `Polish pack ${id} has errors: ${JSON.stringify(criticalErrors)}`).toEqual([]);
    }
  });
});

describe("Translation Validator", () => {
  it("validates Polish packs match English structure", async () => {
    const packIds = getAvailablePackIds();
    for (const id of packIds) {
      const en = await loadPack(id);
      const pl = await loadPack(id, undefined, "pl");
      expect(en).not.toBeNull();
      expect(pl).not.toBeNull();

      const errors = validateTranslation(en!, pl!);
      const criticalErrors = errors.filter((e) => e.severity === "error");
      expect(
        criticalErrors,
        `Polish ${id} translation errors: ${JSON.stringify(criticalErrors, null, 2)}`
      ).toEqual([]);
    }
  });

  it("catches mismatched question count", () => {
    const en: Pack = {
      pack: "test",
      pack_name: "Test",
      pack_intro: "Test",
      required: false,
      sensitive: false,
      questions: [
        { id: "q1", pack: "test", question: "Q1", type: "open_text", dimension: "test.q1", skippable: true, meta_profiling: null, why_this_matters: null },
      ],
    };
    const tr: Pack = {
      pack: "test",
      pack_name: "Test PL",
      pack_intro: "Test PL",
      required: false,
      sensitive: false,
      questions: [], // wrong count
    };
    const errors = validateTranslation(en, tr);
    expect(errors.some((e) => e.message.includes("count mismatch"))).toBe(true);
  });

  it("catches translated export rules", () => {
    const en: Pack = {
      pack: "test",
      pack_name: "Test",
      pack_intro: "Test",
      required: false,
      sensitive: false,
      questions: [{
        id: "q1", pack: "test", question: "Q?", type: "select", dimension: "test.q1",
        skippable: true, meta_profiling: null, why_this_matters: null,
        options: [{ value: "a", label: "Option A", maps_to: { dimension: "test.q1", value: "a" }, export_rule: "Do X." }],
      }],
    };
    const tr: Pack = {
      pack: "test",
      pack_name: "Test PL",
      pack_intro: "Test PL",
      required: false,
      sensitive: false,
      questions: [{
        id: "q1", pack: "test", question: "P?", type: "select", dimension: "test.q1",
        skippable: true, meta_profiling: null, why_this_matters: null,
        options: [{ value: "a", label: "Opcja A", maps_to: { dimension: "test.q1", value: "a" }, export_rule: "Zrob X." }],
      }],
    };
    const errors = validateTranslation(en, tr);
    expect(errors.some((e) => e.message.includes("Export rule was translated"))).toBe(true);
  });
});
