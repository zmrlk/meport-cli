/**
 * meport sync — Keep platform exports in sync with profile
 *
 * Auto-writes to file-based platforms (Claude Code, Cursor, Ollama).
 * Copies to clipboard for web platforms (ChatGPT, Claude web).
 *
 * Usage:
 *   meport sync              — sync all file-based platforms
 *   meport sync --copy chatgpt — copy ChatGPT export to clipboard
 *   meport sync --all        — sync files + show clipboard instructions
 */

import { readFile } from "node:fs/promises";
import ora from "ora";
import {
  getRuleCompiler,
  getAvailableRuleCompilers,
  loadPacks,
  collectPackExportRules,
  getAvailablePackIds,
  getAutoSyncTargets,
  getClipboardTargets,
  syncToFile,
  syncToSection,
  type PersonaProfile,
  type PlatformId,
  type SyncResult,
} from "@meport/core";
import {
  GREEN,
  BOLD,
  CYAN,
  DIM,
  RED,
  YELLOW,
} from "../ui/display.js";

interface SyncOptions {
  profile: string;
  copy?: string;
  all?: boolean;
}

export async function syncCommand(options: SyncOptions): Promise<void> {
  // Load profile
  let profileData: PersonaProfile;
  try {
    const raw = await readFile(options.profile, "utf-8");
    profileData = JSON.parse(raw) as PersonaProfile;
  } catch {
    console.log(
      RED("✗ ") + `Could not read profile from ${options.profile}`
    );
    console.log(
      DIM("  Run ") + CYAN("meport profile") + DIM(" first.")
    );
    process.exit(1);
  }

  // Load pack export rules
  const packExportRules = await loadAllPackExportRules();

  // Copy to clipboard mode
  if (options.copy) {
    await copyToClipboard(options.copy, profileData, packExportRules);
    return;
  }

  // Sync all file-based targets
  const targets = getAutoSyncTargets();
  const results: SyncResult[] = [];

  console.log();
  console.log(BOLD("Syncing profile to platforms...\n"));

  for (const target of targets) {
    const compilerId = target.compilerId as PlatformId;
    const available = getAvailableRuleCompilers();

    if (!available.includes(compilerId)) {
      results.push({
        platform: target.platform,
        method: target.method,
        success: false,
        error: "No compiler available",
        action: "skipped",
      });
      continue;
    }

    const compiler = getRuleCompiler(compilerId);
    if ("setPackExportRules" in compiler) {
      (compiler as any).setPackExportRules(packExportRules);
    }

    const compiled = compiler.compile(profileData);

    let result: SyncResult;
    if (target.method === "section") {
      result = await syncToSection(target, compiled.content);
    } else {
      result = await syncToFile(target, compiled.content);
    }

    results.push(result);
  }

  // Display results
  for (const r of results) {
    if (r.success) {
      const icon = r.action === "created" ? "+" : "↻";
      console.log(
        GREEN(`  ${icon} `) +
          BOLD(r.platform) +
          DIM(` → ${r.path}`) +
          DIM(` (${r.action})`)
      );
    } else {
      console.log(
        DIM(`  ○ ${r.platform} — skipped`) +
          (r.error ? DIM(` (${r.error})`) : "")
      );
    }
  }

  const synced = results.filter((r) => r.success).length;
  console.log();

  if (synced > 0) {
    console.log(GREEN("✓ ") + BOLD(`${synced} platform${synced > 1 ? "s" : ""} synced`));
  }

  // Show clipboard targets
  if (options.all) {
    const clipTargets = getClipboardTargets();
    if (clipTargets.length > 0) {
      console.log();
      console.log(DIM("Web platforms (copy manually):"));
      for (const t of clipTargets) {
        console.log(
          DIM("  ") + CYAN(`meport sync --copy ${t.compilerId}`)
        );
      }
    }
  } else {
    console.log(
      DIM("  Web platforms: ") +
        CYAN("meport sync --copy chatgpt") +
        DIM(" or ") +
        CYAN("--copy claude")
    );
  }

  console.log();
}

async function copyToClipboard(
  platform: string,
  profile: PersonaProfile,
  packExportRules: Map<string, string>
): Promise<void> {
  const available = getAvailableRuleCompilers();

  if (!available.includes(platform as PlatformId)) {
    console.log(RED("✗ ") + `Unknown platform: ${platform}`);
    console.log(DIM("  Available: ") + available.join(", "));
    return;
  }

  const compiler = getRuleCompiler(platform as PlatformId);
  if ("setPackExportRules" in compiler) {
    (compiler as any).setPackExportRules(packExportRules);
  }

  const compiled = compiler.compile(profile);

  // Try to copy to clipboard
  try {
    const { execSync } = await import("node:child_process");
    const proc = process.platform === "darwin" ? "pbcopy" : "xclip -selection clipboard";
    execSync(proc, { input: compiled.content, timeout: 3000 });
    console.log();
    console.log(GREEN("✓ ") + BOLD(`${platform} export copied to clipboard!`));
    console.log(DIM(`  ${compiled.charCount} chars`));
    console.log();
    console.log(YELLOW("Paste to:"));
    console.log(DIM("  " + compiled.instructions));
  } catch {
    // Clipboard not available — print content
    console.log();
    console.log(compiled.content);
    console.log();
    console.log(DIM("─".repeat(50)));
    console.log(DIM(`${compiled.charCount} chars — copy the text above.`));
    console.log();
    console.log(YELLOW("Paste to:"));
    console.log(DIM("  " + compiled.instructions));
  }

  console.log();
}

async function loadAllPackExportRules(): Promise<Map<string, string>> {
  try {
    const packs = await loadPacks(getAvailablePackIds());
    return collectPackExportRules(packs);
  } catch {
    return new Map();
  }
}
