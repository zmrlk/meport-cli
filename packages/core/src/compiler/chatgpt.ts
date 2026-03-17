/**
 * ChatGPT Custom Instructions Compiler
 *
 * The hardest export — 1,500 char limit. Every character counts.
 * Two fields: "What would you like ChatGPT to know about you?"
 *             "How would you like ChatGPT to respond?"
 */

import { BaseCompiler } from "./base.js";
import type {
  PersonaProfile,
  ExportResult,
  ExportCompilerConfig,
  ExportableDimension,
} from "../schema/types.js";

export class ChatGPTCompiler extends BaseCompiler {
  readonly config: ExportCompilerConfig = {
    platform: "ChatGPT Custom Instructions",
    format: "text",
    charLimit: 1500,
    tokenLimit: null,
    priority: "P0",
  };

  compile(profile: PersonaProfile): ExportResult {
    const dims = this.collectDimensions(profile, 0.7); // higher threshold for tight space
    const name = this.getName(profile);
    const pronouns = this.getPronouns(profile);

    // ─── ABOUT ME section (~300-400 chars) ───────────────
    const aboutParts: string[] = [];

    // Identity line
    const identityParts = [name];
    if (pronouns) identityParts.push(pronouns);
    const age = this.getDimValue(dims, "identity.age_range");
    if (age) identityParts.push(age);
    const role = this.getDimValue(dims, "identity.role");
    if (role) identityParts.push(role);
    aboutParts.push(identityParts.join(", ") + ".");

    // Tech stack
    const techStack = this.getDimValue(dims, "expertise.tech_stack");
    if (techStack) aboutParts.push(`Tech: ${techStack}.`);

    // Language
    const lang = this.getDimValue(dims, "identity.language");
    const codeSwitching = this.getDimValue(dims, "communication.code_switching");
    if (codeSwitching) aboutParts.push(`${codeSwitching}.`);
    else if (lang && lang !== "en") aboutParts.push(`Language: ${lang}.`);

    const aboutMe = "ABOUT ME:\n" + aboutParts.join(" ");

    // ─── HOW TO RESPOND section (~800-1000 chars) ────────
    const howParts: string[] = [];
    let howBudget = (this.config.charLimit ?? 1500) - aboutMe.length - 30; // 30 for headers

    // Communication block (weight 9)
    const commDims = dims.filter((d) => d.dimension.startsWith("communication."));
    for (const dim of commDims.slice(0, 7)) {
      const line = this.compressDim(dim);
      if (line && line.length <= howBudget) {
        howParts.push(`- ${line}`);
        howBudget -= line.length + 3;
      }
    }

    // Work block (compound or individual)
    const workCompound = dims.find(
      (d) => d.dimension === "compound.work_rhythm"
    );
    const adhdCompound = dims.find(
      (d) => d.dimension === "compound.adhd_pattern"
    );

    if (adhdCompound?.export_instruction) {
      const compressed = this.compressInstruction(
        adhdCompound.export_instruction,
        150
      );
      if (compressed.length <= howBudget) {
        howParts.push("", "HOW I WORK:");
        for (const line of compressed.split(". ").filter(Boolean)) {
          howParts.push(`- ${line.endsWith(".") ? line : line + "."}`);
        }
        howBudget -= compressed.length + 20;
      }
    }

    // AI relationship block (weight 8)
    const aiDims = dims.filter((d) => d.dimension.startsWith("ai."));
    if (aiDims.length > 0 && howBudget > 100) {
      howParts.push("", "HOW WE WORK TOGETHER:");
      for (const dim of aiDims.slice(0, 5)) {
        const line = this.compressDim(dim);
        if (line && line.length + 3 <= howBudget) {
          howParts.push(`- ${line}`);
          howBudget -= line.length + 3;
        }
      }
    }

    const howToRespond = "HOW TO RESPOND:\n" + howParts.join("\n");

    const content = aboutMe + "\n\n" + howToRespond;
    const includedCount =
      commDims.slice(0, 7).length +
      aiDims.slice(0, 5).length +
      (adhdCompound ? 1 : 0) +
      aboutParts.length;

    return this.buildResult(
      content,
      "chatgpt-instructions.txt",
      'Copy to ChatGPT → Settings → Personalization → Custom Instructions.\nField 1 "About me": paste the ABOUT ME section.\nField 2 "How to respond": paste the HOW TO RESPOND section.',
      dims,
      Math.min(includedCount, dims.length)
    );
  }

  private getDimValue(
    dims: ExportableDimension[],
    dimension: string
  ): string | undefined {
    const dim = dims.find((d) => d.dimension === dimension);
    return dim ? dim.value : undefined;
  }

  private compressDim(dim: ExportableDimension): string | null {
    if (dim.export_instruction) {
      return this.compressInstruction(dim.export_instruction, 60);
    }

    const shortDimNames: Record<string, string> = {
      verbosity_preference: "Ultra concise",
      directness: "Direct and blunt",
      format_preference: "Bullets over prose",
      emoji_preference: "No emoji",
      filler_tolerance: "No filler",
      praise_tolerance: "Skip praise",
      feedback_style: "Lead with what's broken",
      reasoning_visibility: "Show key decisions only",
      hedging_tolerance: "Give confident answers",
      humor_style: "Dry humor welcome",
    };

    const dimKey = dim.dimension.split(".").pop() ?? "";
    if (shortDimNames[dimKey]) {
      return shortDimNames[dimKey];
    }

    // Readable format: "verbosity preference: minimal" → "Verbosity: minimal"
    const readable = dimKey.replace(/_/g, " ");
    const value = String(dim.value).replace(/_/g, " ");
    return `${readable}: ${value}`;
  }

  private compressInstruction(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    // Truncate at last sentence boundary within limit
    const truncated = text.slice(0, maxLen);
    const lastPeriod = truncated.lastIndexOf(".");
    return lastPeriod > maxLen * 0.5
      ? truncated.slice(0, lastPeriod + 1)
      : truncated + "...";
  }
}
