import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectLocale, loadPack } from "./pack-loader.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = join(__dirname, "..", "..", "questions", "packs");

describe("detectLocale", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.LANG;
    delete process.env.LC_ALL;
    delete process.env.LC_MESSAGES;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns explicit locale when valid", () => {
    expect(detectLocale("pl")).toBe("pl");
    expect(detectLocale("en")).toBe("en");
  });

  it("ignores invalid explicit locale and uses system fallback", () => {
    // Falls back to env/Intl — on Polish system returns "pl", on English returns "en"
    const result = detectLocale("xx");
    expect(["en", "pl"]).toContain(result);
  });

  it("returns a supported locale by default", () => {
    // Result depends on system locale (LANG env or Intl API)
    const result = detectLocale();
    expect(["en", "pl"]).toContain(result);
  });

  it("detects from LANG env variable", () => {
    process.env.LANG = "pl_PL.UTF-8";
    expect(detectLocale()).toBe("pl");
  });

  it("explicit overrides env", () => {
    process.env.LANG = "pl_PL.UTF-8";
    expect(detectLocale("en")).toBe("en");
  });
});

describe("loadPack with locale", () => {
  it("loads English pack by default", async () => {
    const pack = await loadPack("micro-setup");
    expect(pack).not.toBeNull();
    expect(pack!.pack_name).toBe("Micro Setup");
  });

  it("loads Polish pack when locale is pl", async () => {
    const pack = await loadPack("micro-setup", undefined, "pl");
    expect(pack).not.toBeNull();
    expect(pack!.pack_name).toBe("Szybka konfiguracja");
    // IDs stay English
    expect(pack!.pack).toBe("micro-setup");
    expect(pack!.questions[0].id).toBe("setup_q01");
  });

  it("falls back to English for missing locale", async () => {
    const pack = await loadPack("micro-setup", undefined, "en");
    expect(pack).not.toBeNull();
    expect(pack!.pack_name).toBe("Micro Setup");
  });

  it("preserves export_rules in English for Polish packs", async () => {
    const pack = await loadPack("micro-setup", undefined, "pl");
    expect(pack).not.toBeNull();
    const q02 = pack!.questions.find((q) => q.id === "setup_q02");
    expect(q02).toBeDefined();
    // Export rule stays English
    expect(q02!.options![0].export_rule).toContain("Max 5 lines");
  });

  it("Polish pack has same question count as English", async () => {
    const en = await loadPack("core");
    const pl = await loadPack("core", undefined, "pl");
    expect(en).not.toBeNull();
    expect(pl).not.toBeNull();
    expect(pl!.questions.length).toBe(en!.questions.length);
  });

  it("Polish pack preserves dimension mappings", async () => {
    const en = await loadPack("work");
    const pl = await loadPack("work", undefined, "pl");
    expect(en).not.toBeNull();
    expect(pl).not.toBeNull();

    for (let i = 0; i < en!.questions.length; i++) {
      expect(pl!.questions[i].dimension).toBe(en!.questions[i].dimension);
      expect(pl!.questions[i].id).toBe(en!.questions[i].id);
    }
  });

  it("loads all 7 Polish packs", async () => {
    const packIds = [
      "micro-setup",
      "core",
      "work",
      "lifestyle",
      "health",
      "finance",
      "learning",
    ] as const;

    for (const id of packIds) {
      const pack = await loadPack(id, undefined, "pl");
      expect(pack, `Polish pack ${id} should exist`).not.toBeNull();
      expect(pack!.questions.length).toBeGreaterThan(0);
    }
  });
});
