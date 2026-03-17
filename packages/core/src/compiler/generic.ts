/**
 * Generic System Prompt Compiler
 *
 * Fallback for any LLM API, Open WebUI, LM Studio, Jan.ai, etc.
 * Plain text, ~1500-3000 chars target.
 */

import { BaseCompiler } from "./base.js";
import type {
  PersonaProfile,
  ExportResult,
  ExportCompilerConfig,
  ExportableDimension,
} from "../schema/types.js";

export class GenericCompiler extends BaseCompiler {
  readonly config: ExportCompilerConfig = {
    platform: "Generic System Prompt",
    format: "text",
    charLimit: null,
    tokenLimit: null,
    priority: "P0",
  };

  compile(profile: PersonaProfile): ExportResult {
    const dims = this.collectDimensions(profile, 0.5);
    const name = this.getName(profile);
    const pronouns = this.getPronouns(profile);
    const sections: string[] = [];
    let includedCount = 0;

    // ─── Header ──────────────────────────────────────────
    const headerParts = [name];
    if (pronouns) headerParts.push(`(${pronouns})`);
    const age = dims.find((d) => d.dimension === "identity.age_range");
    if (age) headerParts.push(age.value);
    const role = dims.find((d) => d.dimension === "identity.role");
    if (role) headerParts.push(role.value);

    sections.push("# User Profile\n");
    sections.push(`You are talking to ${headerParts.join(", ")}.\n`);
    includedCount += headerParts.length;

    // ─── Communication ───────────────────────────────────
    const commDims = dims.filter((d) => d.dimension.startsWith("communication."));
    if (commDims.length > 0) {
      sections.push("## Communication");
      for (const dim of commDims) {
        sections.push(`- ${this.dimToLine(dim)}`);
        includedCount++;
      }
    }

    // ─── Cognitive ───────────────────────────────────────
    const cogDims = dims.filter((d) => d.dimension.startsWith("cognitive."));
    const cogCompound = dims.find((d) => d.dimension === "compound.cognitive_style");
    if (cogDims.length > 0 || cogCompound) {
      sections.push("\n## Cognitive Style");
      for (const dim of cogDims) {
        sections.push(`- ${this.dimToLine(dim)}`);
        includedCount++;
      }
      if (cogCompound?.export_instruction) {
        sections.push(`- ${cogCompound.export_instruction}`);
        includedCount++;
      }
    }

    // ─── Work ────────────────────────────────────────────
    const workDims = dims.filter((d) => d.dimension.startsWith("work."));
    const adhd = dims.find((d) => d.dimension === "compound.adhd_pattern");
    const rhythm = dims.find((d) => d.dimension === "compound.work_rhythm");

    if (workDims.length > 0 || adhd || rhythm) {
      sections.push("\n## Work Patterns");
      for (const dim of workDims.slice(0, 8)) {
        sections.push(`- ${this.dimToLine(dim)}`);
        includedCount++;
      }
      if (adhd?.export_instruction) {
        sections.push(`- ${adhd.export_instruction}`);
        includedCount++;
      }
      if (rhythm?.export_instruction) {
        sections.push(`- ${rhythm.export_instruction}`);
        includedCount++;
      }
    }

    // ─── AI Relationship ─────────────────────────────────
    const aiDims = dims.filter((d) => d.dimension.startsWith("ai."));
    if (aiDims.length > 0) {
      sections.push("\n## AI Relationship");
      for (const dim of aiDims) {
        sections.push(`- ${this.dimToLine(dim)}`);
        includedCount++;
      }
    }

    // ─── Tech ────────────────────────────────────────────
    const techDims = dims.filter((d) => d.dimension.startsWith("expertise."));
    if (techDims.length > 0) {
      sections.push(
        "\n## Tech: " +
          techDims.map((d) => d.value).join(", ")
      );
      includedCount += techDims.length;
    }

    const content = sections.join("\n");

    return this.buildResult(
      content,
      "system-prompt.txt",
      "Paste as the system prompt in any LLM API, Open WebUI, LM Studio, Jan.ai, or similar.",
      dims,
      includedCount
    );
  }
}
