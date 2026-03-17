/**
 * Question Loader
 *
 * Loads question bank JSON files at runtime.
 * Works in Node.js (CLI) and browser (bundled).
 */

import type { QuestionTier } from "../schema/types.js";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Relative to dist/profiler/ → ../../questions/
const QUESTIONS_BASE = join(__dirname, "..", "..", "questions");

const PERSONAL_TIERS = [
  "tier-0-identity",
  "tier-1-communication",
  "tier-2-cognitive",
  "tier-3-work",
  "tier-4-personality",
  "tier-5-neurodivergent",
  "tier-6-expertise",
  "tier-7-life-context",
  "tier-8-ai-relationship",
];

const BUSINESS_TIERS = [
  "tier-b0-company",
  "tier-b1-brand-voice",
  "tier-b2-products",
  "tier-b3-customer",
  "tier-b4-communication",
  "tier-b5-knowledge",
  "tier-b6-competitive",
];

/**
 * Load all question tiers for a track
 */
export async function loadQuestionTiers(
  track: "personal" | "business" = "personal",
  questionsPath?: string
): Promise<QuestionTier[]> {
  const basePath = questionsPath ?? QUESTIONS_BASE;
  const tierFiles = track === "personal" ? PERSONAL_TIERS : BUSINESS_TIERS;
  const subdir = join(basePath, track);

  const tiers: QuestionTier[] = [];

  for (const tierFile of tierFiles) {
    try {
      const filePath = join(subdir, `${tierFile}.json`);
      const content = await readFile(filePath, "utf-8");
      tiers.push(JSON.parse(content) as QuestionTier);
    } catch (err) {
      // Skip missing tiers gracefully
      console.warn(`Warning: Could not load ${tierFile}: ${(err as Error).message}`);
    }
  }

  return tiers;
}

/**
 * Load a single tier by index
 */
export async function loadTier(
  tierIndex: number,
  track: "personal" | "business" = "personal",
  questionsPath?: string
): Promise<QuestionTier | null> {
  const basePath = questionsPath ?? QUESTIONS_BASE;
  const tierFiles = track === "personal" ? PERSONAL_TIERS : BUSINESS_TIERS;

  if (tierIndex < 0 || tierIndex >= tierFiles.length) return null;

  const filePath = join(basePath, track, `${tierFiles[tierIndex]}.json`);

  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as QuestionTier;
  } catch {
    return null;
  }
}

/**
 * Load tiers from pre-bundled data (for browser/Tauri use)
 */
export function loadTiersFromData(data: QuestionTier[]): QuestionTier[] {
  return data;
}
