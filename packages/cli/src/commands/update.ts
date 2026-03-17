/**
 * meport update — Quick profile tune-up
 *
 * Re-asks high-impact dimensions, adds new anti-patterns,
 * then re-syncs all exports.
 *
 * Flow: load profile → show current → confirm/change key dims → save → sync
 */

import { readFile, writeFile } from "node:fs/promises";
import ora from "ora";
import { select, checkbox, input } from "@inquirer/prompts";
import {
  loadPacks,
  collectPackExportRules,
  getAvailablePackIds,
  getAutoSyncTargets,
  getRuleCompiler,
  getAvailableRuleCompilers,
  syncToFile,
  syncToSection,
  type PersonaProfile,
  type PlatformId,
} from "@meport/core";
import {
  GREEN,
  BOLD,
  CYAN,
  DIM,
  RED,
  YELLOW,
  BRAND,
} from "../ui/display.js";

interface UpdateOptions {
  profile: string;
}

// ─── Tunable Dimensions ──────────────────────────────────

interface TunableDimension {
  dimension: string;
  label: string;
  options?: { value: string; label: string }[];
  type: "confirm" | "select" | "multi_add";
}

const TUNABLE_DIMENSIONS: TunableDimension[] = [
  {
    dimension: "communication.verbosity_preference",
    label: "Verbosity preference",
    type: "confirm",
    options: [
      { value: "minimal", label: "Minimal — max 5 lines" },
      { value: "balanced", label: "Balanced — context when needed" },
      { value: "detailed", label: "Detailed — full reasoning" },
    ],
  },
  {
    dimension: "communication.directness",
    label: "Directness level",
    type: "confirm",
    options: [
      { value: "very_direct", label: "Very direct — no hedging" },
      { value: "direct", label: "Direct but polite" },
      { value: "diplomatic", label: "Diplomatic — soften feedback" },
    ],
  },
  {
    dimension: "communication.anti_patterns",
    label: "Anti-patterns",
    type: "multi_add",
  },
];

const ALL_ANTI_PATTERNS = [
  { value: "no_emoji", label: "No emoji" },
  { value: "no_praise", label: "No praise ('Great question!')" },
  { value: "no_unsolicited_advice", label: "No unsolicited advice" },
  { value: "no_hedging", label: "No hedging ('I think maybe...')" },
  { value: "no_handholding", label: "No over-explaining basics" },
  { value: "no_overwriting", label: "Answer exactly what was asked" },
  { value: "no_corporate", label: "No corporate jargon" },
  { value: "no_apologies", label: "No excessive apologies" },
];

// ─── Command ─────────────────────────────────────────────

export async function updateCommand(options: UpdateOptions): Promise<void> {
  // Load profile
  let profile: PersonaProfile;
  try {
    const raw = await readFile(options.profile, "utf-8");
    profile = JSON.parse(raw) as PersonaProfile;
  } catch {
    console.log(RED("✗ ") + `No profile at ${options.profile}`);
    console.log(DIM("  Run ") + CYAN("meport profile") + DIM(" first."));
    process.exit(1);
  }

  // Show profile age
  const ageMs = Date.now() - new Date(profile.updated_at).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  console.log();
  console.log(BRAND("━━━ Quick Tune-up ━━━"));
  console.log(
    DIM(`  Profile last updated ${ageDays} day${ageDays !== 1 ? "s" : ""} ago`)
  );
  console.log();

  let changed = false;
  let questionNum = 0;

  for (const dim of TUNABLE_DIMENSIONS) {
    const current = profile.explicit[dim.dimension];

    if (dim.type === "confirm" && dim.options && current) {
      questionNum++;
      const currentLabel =
        dim.options.find((o) => o.value === current.value)?.label ??
        String(current.value);

      const choices = [
        {
          name: GREEN("✓ ") + currentLabel + DIM(" (keep)"),
          value: "__keep__",
        },
        ...dim.options
          .filter((o) => o.value !== current.value)
          .map((o) => ({ name: o.label, value: o.value })),
      ];

      const answer = await select({
        message: DIM(`[${questionNum}] `) + dim.label + DIM(` — currently: ${currentLabel}`),
        choices,
      });

      if (answer !== "__keep__") {
        profile.explicit[dim.dimension] = {
          ...current,
          value: answer,
          updated_at: new Date().toISOString(),
        } as any;
        changed = true;
      }
    } else if (dim.type === "multi_add") {
      questionNum++;

      const currentValues = Array.isArray(current?.value)
        ? (current.value as string[])
        : [];

      // Show currently active
      if (currentValues.length > 0) {
        const labels = currentValues
          .map(
            (v) =>
              ALL_ANTI_PATTERNS.find((ap) => ap.value === v)?.label ?? v
          )
          .join(", ");
        console.log(DIM(`  Current: ${labels}`));
      }

      // Only show options not already selected
      const availableOptions = ALL_ANTI_PATTERNS.filter(
        (ap) => !currentValues.includes(ap.value)
      );

      if (availableOptions.length > 0) {
        const newSelections = await checkbox({
          message:
            DIM(`[${questionNum}] `) + "Add anti-patterns?" + DIM(" (optional)"),
          choices: availableOptions.map((o) => ({
            name: o.label,
            value: o.value,
          })),
        });

        if (newSelections.length > 0) {
          const merged = [...currentValues, ...newSelections];
          profile.explicit[dim.dimension] = {
            dimension: dim.dimension,
            value: merged,
            confidence: 1.0,
            source: "explicit",
            question_id: "update",
          };
          changed = true;
        }
      } else {
        console.log(DIM("  All anti-patterns already selected."));
      }
    }
  }

  // Ask about name change
  questionNum++;
  const currentName = profile.explicit["identity.preferred_name"]?.value;
  if (currentName) {
    const nameAnswer = await input({
      message:
        DIM(`[${questionNum}] `) +
        `Name: ${BOLD(String(currentName))}` +
        DIM(" (press Enter to keep)"),
      default: String(currentName),
    });

    if (nameAnswer !== String(currentName)) {
      profile.explicit["identity.preferred_name"] = {
        dimension: "identity.preferred_name",
        value: nameAnswer,
        confidence: 1.0,
        source: "explicit",
        question_id: "update",
      };
      changed = true;
    }
  }

  if (!changed) {
    console.log();
    console.log(GREEN("✓ ") + "No changes — profile is up to date.");
    console.log();
    return;
  }

  // Save updated profile
  profile.updated_at = new Date().toISOString();
  const saveSpinner = ora("Saving profile...").start();
  await writeFile(options.profile, JSON.stringify(profile, null, 2), "utf-8");
  saveSpinner.succeed("Profile updated");

  // Re-sync exports
  const syncSpinner = ora("Re-syncing exports...").start();
  const packExportRules = await loadAllPackExportRules();
  const targets = getAutoSyncTargets();
  let synced = 0;

  for (const target of targets) {
    const compilerId = target.compilerId as PlatformId;
    const available = getAvailableRuleCompilers();
    if (!available.includes(compilerId)) continue;

    const compiler = getRuleCompiler(compilerId);
    if ("setPackExportRules" in compiler) {
      (compiler as any).setPackExportRules(packExportRules);
    }

    const compiled = compiler.compile(profile);

    const result =
      target.method === "section"
        ? await syncToSection(target, compiled.content)
        : await syncToFile(target, compiled.content);

    if (result.success) synced++;
  }

  if (synced > 0) {
    syncSpinner.succeed(`Re-synced ${synced} platform${synced > 1 ? "s" : ""}`);
  } else {
    syncSpinner.succeed("Profile saved (no file-based platforms to sync)");
  }

  console.log();
  console.log(
    GREEN("✓ ") + BOLD("Done!") + DIM(" Web platforms: ") + CYAN("meport sync --copy chatgpt")
  );
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
