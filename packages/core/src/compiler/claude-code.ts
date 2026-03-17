/**
 * Claude Code / CLAUDE.md Compiler
 *
 * Short, high-signal format. Placed at top of CLAUDE.md before
 * project-specific instructions. ~800-1200 chars target.
 */

import { BaseCompiler } from "./base.js";
import type {
  PersonaProfile,
  ExportResult,
  ExportCompilerConfig,
  ExportableDimension,
} from "../schema/types.js";

export class ClaudeCodeCompiler extends BaseCompiler {
  readonly config: ExportCompilerConfig = {
    platform: "Claude Code",
    format: "markdown",
    charLimit: 1500, // target ~800, max 1500
    tokenLimit: null,
    priority: "P0",
  };

  compile(profile: PersonaProfile): ExportResult {
    const dims = this.collectDimensions(profile, 0.7);
    const name = this.getName(profile);
    const sections: string[] = [];
    let includedCount = 0;

    sections.push("# User Profile (Meport)\n");

    // ─── Communication ───────────────────────────────────
    const commLines = this.buildBullets(dims, "communication.", 6);
    if (commLines.length > 0) {
      sections.push("## Communication");
      sections.push(...commLines.map((l) => `- ${l}`));
      includedCount += commLines.length;
    }

    // ─── How I work ──────────────────────────────────────
    const workLines: string[] = [];

    const adhd = dims.find((d) => d.dimension === "compound.adhd_pattern");
    const rhythm = dims.find((d) => d.dimension === "compound.work_rhythm");

    if (rhythm?.export_instruction) {
      workLines.push(this.compress(rhythm.export_instruction, 80));
      includedCount++;
    }

    const workDims = dims.filter((d) => d.dimension.startsWith("work."));
    for (const dim of workDims.slice(0, 4)) {
      workLines.push(this.compress(this.dimToLine(dim), 60));
      includedCount++;
    }

    // AI relationship
    const aiDims = dims.filter((d) => d.dimension.startsWith("ai."));
    for (const dim of aiDims.slice(0, 3)) {
      workLines.push(this.compress(this.dimToLine(dim), 60));
      includedCount++;
    }

    if (workLines.length > 0) {
      sections.push("\n## How I work");
      sections.push(...workLines.map((l) => `- ${l}`));
    }

    // ─── Tech ────────────────────────────────────────────
    const techDims = dims.filter((d) => d.dimension.startsWith("expertise."));
    if (techDims.length > 0) {
      sections.push("\n## Tech");
      for (const dim of techDims.slice(0, 3)) {
        sections.push(`- ${dim.value}`);
        includedCount++;
      }
    }

    // ─── Language ────────────────────────────────────────
    const lang = this.getLanguage(profile);
    const pronouns = this.getPronouns(profile);
    const langParts: string[] = [];
    if (lang !== "en") langParts.push(`${lang} primary`);
    if (pronouns) langParts.push(pronouns);
    if (langParts.length > 0) {
      sections.push("\n## Language");
      sections.push(`- ${langParts.join(". ")}.`);
      includedCount++;
    }

    const content = sections.join("\n");

    return this.buildResult(
      content,
      "CLAUDE.md",
      "Add to your project's CLAUDE.md file at the top, before project-specific instructions.",
      dims,
      includedCount
    );
  }

  private buildBullets(
    dims: ExportableDimension[],
    prefix: string,
    max: number
  ): string[] {
    const matching = dims.filter((d) => d.dimension.startsWith(prefix));
    const lines: string[] = [];

    for (const dim of matching.slice(0, max)) {
      const line = this.compress(this.dimToLine(dim), 70);
      if (line) lines.push(line);
    }

    return lines;
  }

  private compress(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    const lastPeriod = text.slice(0, maxLen).lastIndexOf(".");
    return lastPeriod > maxLen * 0.4
      ? text.slice(0, lastPeriod + 1)
      : text.slice(0, maxLen - 1) + ".";
  }
}
