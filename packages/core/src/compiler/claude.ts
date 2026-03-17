/**
 * Claude Projects Compiler
 *
 * The richest export — ~10k tokens. Full profile with sections,
 * context, and nuance. Markdown format.
 */

import { BaseCompiler } from "./base.js";
import type {
  PersonaProfile,
  ExportResult,
  ExportCompilerConfig,
  ExportableDimension,
} from "../schema/types.js";

export class ClaudeCompiler extends BaseCompiler {
  readonly config: ExportCompilerConfig = {
    platform: "Claude Projects",
    format: "markdown",
    charLimit: null, // ~10k tokens but no hard char limit
    tokenLimit: 10000,
    priority: "P0",
  };

  compile(profile: PersonaProfile): ExportResult {
    const dims = this.collectDimensions(profile, 0.5);
    const name = this.getName(profile);
    const pronouns = this.getPronouns(profile);

    const sections: string[] = [];
    let includedCount = 0;

    // ─── Header ──────────────────────────────────────────
    sections.push(`# About ${name} — Meport Profile\n`);

    // ─── Identity ────────────────────────────────────────
    const identityDims = dims.filter((d) => d.dimension.startsWith("identity."));
    if (identityDims.length > 0) {
      sections.push("## Identity");
      const lines: string[] = [];
      if (pronouns) lines.push(`- **Name:** ${name} (${pronouns})`);
      else lines.push(`- **Name:** ${name}`);

      for (const dim of identityDims) {
        if (dim.dimension === "identity.preferred_name" || dim.dimension === "identity.pronouns") continue;
        lines.push(`- **${this.formatDimName(dim.dimension)}:** ${dim.value}`);
        includedCount++;
      }
      sections.push(lines.join("\n"));
      includedCount += 2; // name + pronouns
    }

    // ─── Communication ───────────────────────────────────
    const commDims = dims.filter((d) => d.dimension.startsWith("communication."));
    if (commDims.length > 0) {
      sections.push("## Communication Preferences\n");

      // Tone & Style sub-group
      const toneDims = commDims.filter((d) =>
        ["verbosity_preference", "directness", "format_preference", "emoji_preference", "filler_tolerance", "humor_style"].some(
          (k) => d.dimension.endsWith(k)
        )
      );
      if (toneDims.length > 0) {
        sections.push("### Tone & Style");
        for (const dim of toneDims) {
          sections.push(`- **${this.formatDimName(dim.dimension)}:** ${this.formatValue(dim)}`);
          includedCount++;
        }
      }

      // Feedback sub-group
      const feedbackDims = commDims.filter((d) =>
        ["feedback_style", "correction_receptivity", "praise_tolerance", "difficult_messages"].some(
          (k) => d.dimension.endsWith(k)
        )
      );
      if (feedbackDims.length > 0) {
        sections.push("\n### Feedback & Corrections");
        for (const dim of feedbackDims) {
          sections.push(`- **${this.formatDimName(dim.dimension)}:** ${this.formatValue(dim)}`);
          includedCount++;
        }
      }

      // Technical communication
      const techDims = commDims.filter(
        (d) => !toneDims.includes(d) && !feedbackDims.includes(d)
      );
      if (techDims.length > 0) {
        sections.push("\n### Technical Communication");
        for (const dim of techDims) {
          sections.push(`- **${this.formatDimName(dim.dimension)}:** ${this.formatValue(dim)}`);
          includedCount++;
        }
      }
    }

    // ─── Cognitive ────────────────────────────────────────
    const cognitiveDims = dims.filter((d) => d.dimension.startsWith("cognitive."));
    const cognitiveCompound = dims.find((d) => d.dimension === "compound.cognitive_style");
    if (cognitiveDims.length > 0 || cognitiveCompound) {
      sections.push("\n## Cognitive Profile\n");
      sections.push("### How " + name + " Thinks");
      for (const dim of cognitiveDims) {
        sections.push(`- **${this.formatDimName(dim.dimension)}:** ${this.formatValue(dim)}`);
        includedCount++;
      }
      if (cognitiveCompound?.export_instruction) {
        sections.push(`\n${cognitiveCompound.export_instruction}`);
        includedCount++;
      }
    }

    // ─── Work Patterns ───────────────────────────────────
    const workDims = dims.filter((d) => d.dimension.startsWith("work."));
    const workCompound = dims.find((d) => d.dimension === "compound.work_rhythm");
    const adhdCompound = dims.find((d) => d.dimension === "compound.adhd_pattern");

    if (workDims.length > 0 || workCompound || adhdCompound) {
      sections.push("\n## Work Patterns\n");

      if (workDims.length > 0) {
        sections.push("### Energy & Rhythm");
        for (const dim of workDims.slice(0, 10)) {
          sections.push(`- **${this.formatDimName(dim.dimension)}:** ${this.formatValue(dim)}`);
          includedCount++;
        }
      }

      if (adhdCompound?.export_instruction) {
        sections.push(
          `\n### ADHD-Associated Patterns (compound signal, confidence ${Math.round(adhdCompound.confidence * 100)}%)`
        );
        sections.push(adhdCompound.export_instruction);
        includedCount++;
      }
    }

    // ─── Personality ─────────────────────────────────────
    const personalityDims = dims.filter((d) => d.dimension.startsWith("personality."));
    if (personalityDims.length > 0) {
      sections.push("\n## Personality & Values\n");
      for (const dim of personalityDims) {
        sections.push(`- **${this.formatDimName(dim.dimension)}:** ${this.formatValue(dim)}`);
        includedCount++;
      }
    }

    // ─── AI Relationship ─────────────────────────────────
    const aiDims = dims.filter((d) => d.dimension.startsWith("ai."));
    if (aiDims.length > 0) {
      sections.push("\n## AI Relationship\n");
      for (const dim of aiDims) {
        sections.push(`- **${this.formatDimName(dim.dimension)}:** ${this.formatValue(dim)}`);
        includedCount++;
      }
    }

    // ─── Expertise ───────────────────────────────────────
    const expertiseDims = dims.filter((d) => d.dimension.startsWith("expertise."));
    if (expertiseDims.length > 0) {
      sections.push("\n## Tech Stack");
      for (const dim of expertiseDims) {
        sections.push(`${dim.value}`);
        includedCount++;
      }
    }

    // ─── Emergent observations ───────────────────────────
    const emergentDims = dims.filter((d) => d.source === "emergent");
    if (emergentDims.length > 0) {
      sections.push("\n## Additional Observations\n");
      for (const dim of emergentDims) {
        sections.push(`- ${dim.export_instruction ?? dim.value}`);
        includedCount++;
      }
    }

    // ─── Contradictions ──────────────────────────────────
    if (profile.contradictions.length > 0) {
      sections.push("\n## Nuances\n");
      for (const c of profile.contradictions) {
        sections.push(`- **Note:** ${c.note}`);
        includedCount++;
      }
    }

    // Footer
    sections.push("\n---");
    sections.push("*Generated by Meport v1.0 — [meport.app](https://meport.app)*");

    const content = sections.join("\n");

    return this.buildResult(
      content,
      "meport-profile.md",
      "Upload to Claude → Projects → Instructions, or paste into a new conversation.",
      dims,
      includedCount
    );
  }

  private formatDimName(dimension: string): string {
    const key = dimension.split(".").pop() ?? dimension;
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private formatValue(dim: ExportableDimension): string {
    if (dim.export_instruction) return dim.export_instruction;

    // Make values more readable
    return String(dim.value)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
