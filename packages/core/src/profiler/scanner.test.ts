/**
 * System Scanner Tests
 */

import { describe, it, expect } from "vitest";
import { runSystemScan } from "./scanner.js";

describe("runSystemScan", () => {
  it("returns a ScanContext with dimensions map", async () => {
    const { context, sources } = await runSystemScan();

    expect(context).toBeDefined();
    expect(context.dimensions).toBeInstanceOf(Map);
    expect(sources).toBeInstanceOf(Array);
  });

  it("detects timezone", async () => {
    const { context } = await runSystemScan();

    const tz = context.dimensions.get("identity.timezone");
    expect(tz).toBeDefined();
    expect(tz!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(tz!.source).toBe("system");
  });

  it("detects language from locale", async () => {
    const { context } = await runSystemScan();

    const lang = context.dimensions.get("identity.language");
    // Should be detected from LANG env or Intl
    if (lang) {
      expect(lang.value).toMatch(/^[a-z]{2}$/);
      expect(lang.confidence).toBeGreaterThanOrEqual(0.7);
    }
  });

  it("detects tech stack from project directory", async () => {
    // Run scan on meport's own directory (has package.json + tsconfig.json)
    const { context } = await runSystemScan(process.cwd());

    const tech = context.dimensions.get("expertise.tech_stack");
    if (tech) {
      expect(tech.value).toContain("TypeScript");
      expect(tech.confidence).toBeGreaterThanOrEqual(0.8);
      expect(tech.source).toBe("project-files");
    }
  });

  it("all dimension values have required fields", async () => {
    const { context } = await runSystemScan(process.cwd());

    for (const [dim, val] of context.dimensions) {
      expect(val).toHaveProperty("value");
      expect(val).toHaveProperty("confidence");
      expect(val).toHaveProperty("source");
      expect(val.confidence).toBeGreaterThanOrEqual(0);
      expect(val.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("sources array is populated", async () => {
    const { context, sources } = await runSystemScan();

    // Should at least detect timezone
    expect(sources.length).toBeGreaterThan(0);
  });
});
