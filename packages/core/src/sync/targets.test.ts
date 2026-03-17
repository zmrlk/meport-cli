/**
 * Sync Targets Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  syncToFile,
  syncToSection,
  getAutoSyncTargets,
  getClipboardTargets,
  SYNC_TARGETS,
  type SyncTarget,
} from "./targets.js";

const TEST_DIR = join(tmpdir(), "meport-sync-test-" + Date.now());

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("SYNC_TARGETS", () => {
  it("has targets for all major platforms", () => {
    const platforms = SYNC_TARGETS.map((t) => t.platform);
    expect(platforms).toContain("Claude Code");
    expect(platforms).toContain("Cursor");
    expect(platforms).toContain("Ollama");
    expect(platforms).toContain("ChatGPT");
    expect(platforms).toContain("Claude");
  });

  it("file-based targets have paths", () => {
    const fileTargets = SYNC_TARGETS.filter(
      (t) => t.method === "file" || t.method === "section"
    );
    for (const t of fileTargets) {
      expect(t.getPath()).toBeTruthy();
    }
  });
});

describe("getAutoSyncTargets", () => {
  it("returns only file-based and section targets", () => {
    const targets = getAutoSyncTargets();
    for (const t of targets) {
      expect(["file", "section"]).toContain(t.method);
    }
  });
});

describe("getClipboardTargets", () => {
  it("returns clipboard targets", () => {
    const targets = getClipboardTargets();
    for (const t of targets) {
      expect(t.method).toBe("clipboard");
    }
    expect(targets.length).toBeGreaterThan(0);
  });
});

describe("syncToFile", () => {
  it("creates new file", async () => {
    const target: SyncTarget = {
      platform: "Test",
      method: "file",
      getPath: () => join(TEST_DIR, "test-output.txt"),
      compilerId: "test",
    };

    const result = await syncToFile(target, "test content");

    expect(result.success).toBe(true);
    expect(result.action).toBe("created");
    expect(result.path).toBe(join(TEST_DIR, "test-output.txt"));

    const content = await readFile(join(TEST_DIR, "test-output.txt"), "utf-8");
    expect(content).toBe("test content");
  });

  it("updates existing file", async () => {
    const path = join(TEST_DIR, "existing.txt");
    await writeFile(path, "old content", "utf-8");

    const target: SyncTarget = {
      platform: "Test",
      method: "file",
      getPath: () => path,
      compilerId: "test",
    };

    const result = await syncToFile(target, "new content");

    expect(result.success).toBe(true);
    expect(result.action).toBe("updated");

    const content = await readFile(path, "utf-8");
    expect(content).toBe("new content");
  });

  it("creates nested directories", async () => {
    const target: SyncTarget = {
      platform: "Test",
      method: "file",
      getPath: () => join(TEST_DIR, "deep", "nested", "file.txt"),
      compilerId: "test",
    };

    const result = await syncToFile(target, "nested content");
    expect(result.success).toBe(true);
  });
});

describe("syncToSection", () => {
  it("creates file with section if not exists", async () => {
    const target: SyncTarget = {
      platform: "Test",
      method: "section",
      getPath: () => join(TEST_DIR, "new-claude.md"),
      sectionMarkers: { start: "<!-- meport:start -->", end: "<!-- meport:end -->" },
      compilerId: "test",
    };

    const result = await syncToSection(target, "# My Profile\n- Rule 1");
    expect(result.success).toBe(true);
    expect(result.action).toBe("created");

    const content = await readFile(join(TEST_DIR, "new-claude.md"), "utf-8");
    expect(content).toContain("<!-- meport:start -->");
    expect(content).toContain("# My Profile");
    expect(content).toContain("<!-- meport:end -->");
  });

  it("replaces existing section", async () => {
    const path = join(TEST_DIR, "existing-claude.md");
    await writeFile(
      path,
      "# Project\n\nSome content\n\n<!-- meport:start -->\nold profile\n<!-- meport:end -->\n\nMore content\n",
      "utf-8"
    );

    const target: SyncTarget = {
      platform: "Test",
      method: "section",
      getPath: () => path,
      sectionMarkers: { start: "<!-- meport:start -->", end: "<!-- meport:end -->" },
      compilerId: "test",
    };

    const result = await syncToSection(target, "new profile");
    expect(result.success).toBe(true);
    expect(result.action).toBe("updated");

    const content = await readFile(path, "utf-8");
    expect(content).toContain("# Project");
    expect(content).toContain("new profile");
    expect(content).not.toContain("old profile");
    expect(content).toContain("More content");
  });

  it("appends section to existing file without markers", async () => {
    const path = join(TEST_DIR, "plain-claude.md");
    await writeFile(path, "# My Project\n\nSome rules here.", "utf-8");

    const target: SyncTarget = {
      platform: "Test",
      method: "section",
      getPath: () => path,
      sectionMarkers: { start: "<!-- meport:start -->", end: "<!-- meport:end -->" },
      compilerId: "test",
    };

    const result = await syncToSection(target, "appended profile");
    expect(result.success).toBe(true);

    const content = await readFile(path, "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("appended profile");
    expect(content).toContain("<!-- meport:start -->");
  });
});
