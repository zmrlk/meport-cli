/**
 * meport continue — Resume an interrupted profiling session
 *
 * Loads saved session state and picks up where user left off.
 * Session state is saved automatically when user exits mid-session (Ctrl+C).
 */

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import ora from "ora";
import {
  PackProfilingEngine,
  loadPack,
  loadPacks,
  collectPackExportRules,
  runPackLayer2,
  collectRules,
  compileAllRules,
  type SessionState,
  type PackEngineEvent,
  type PackAnswerInput,
  type PackId,
  type Pack,
} from "@meport/core";
import {
  banner,
  packHeader,
  packComplete,
  packProgress,
  finalSummary,
  GREEN,
  BOLD,
  CYAN,
  DIM,
  RED,
  YELLOW,
} from "../ui/display.js";
import { askPackQuestion, askConfirm } from "../ui/pack-prompts.js";

const SESSION_FILE = ".meport-session.json";

interface ContinueOptions {
  profile: string;
}

export async function continueCommand(options: ContinueOptions): Promise<void> {
  // Try to load saved session
  const sessionPath = join(dirname(options.profile), SESSION_FILE);
  let state: SessionState;

  try {
    const raw = await readFile(sessionPath, "utf-8");
    state = JSON.parse(raw) as SessionState;
  } catch {
    console.log(RED("✗ ") + "No saved session found.");
    console.log(
      DIM("  Start a new session with ") + CYAN("meport profile")
    );
    process.exit(1);
  }

  const ageMs = Date.now() - state.timestamp;
  const ageHours = Math.round(ageMs / (1000 * 60 * 60));

  banner();
  console.log(
    GREEN("✓ ") +
      BOLD("Resuming session") +
      DIM(` (saved ${ageHours}h ago, ${state.questionsAnswered} questions answered)`)
  );
  console.log();

  // Load all needed packs
  const allPackIds: PackId[] = ["micro-setup", "core", ...state.selectedPacks];
  const uniquePackIds = [...new Set(allPackIds)];

  const loadSpinner = ora("Loading packs...").start();
  const allPacks = await loadPacks(uniquePackIds);
  loadSpinner.succeed(`${allPacks.length} packs loaded`);

  // Restore engine
  const { engine, remainingPackIds } = PackProfilingEngine.fromSessionState(
    state,
    allPacks
  );

  if (remainingPackIds.length === 0) {
    console.log(GREEN("✓ ") + "Session was already complete!");
    console.log(DIM("  Export with: ") + CYAN("meport export --all"));
    return;
  }

  console.log(
    DIM(`  Remaining: ${remainingPackIds.join(", ")}`)
  );
  console.log();

  // Run the engine — it will skip already-completed packs
  const gen = engine.run();
  let result = gen.next();

  while (!result.done) {
    const event = result.value as PackEngineEvent;

    switch (event.type) {
      case "pack_start": {
        // Skip if pack already completed
        if (!remainingPackIds.includes(event.pack)) {
          result = gen.next(undefined);
          break;
        }
        packHeader(event.packName, event.intro, event.sensitive, event.privacyNote);
        result = gen.next(undefined);
        break;
      }

      case "question": {
        // Skip if question already answered
        if (engine.getAnswer(event.question.id)) {
          result = gen.next(undefined);
          break;
        }
        const progress = packProgress(event.index, event.total, event.pack);
        const answer = await askPackQuestion(event.question, progress);
        result = gen.next(answer);
        break;
      }

      case "confirm": {
        if (engine.getAnswer(event.question.id)) {
          result = gen.next(undefined);
          break;
        }
        const progress = packProgress(event.index, event.total, event.pack);
        const answer = await askConfirm(
          event.question,
          event.detectedValue,
          event.detectedSource,
          progress
        );
        result = gen.next(answer);
        break;
      }

      case "pack_selection":
        // Already selected — skip
        result = gen.next({ value: state.selectedPacks });
        break;

      case "pack_complete":
        if (remainingPackIds.includes(event.pack)) {
          packComplete(event.pack, event.questionsAnswered);
        }
        result = gen.next(undefined);
        break;

      case "preview_ready":
        // Skip preview on resume
        result = gen.next(undefined);
        break;

      case "profiling_complete": {
        const profile = event.profile;
        const exportRules = event.exportRules;

        // Collect pack export rules
        const allPackExportRules = collectPackExportRules(allPacks);
        for (const [k, v] of exportRules) {
          allPackExportRules.set(k, v);
        }

        // Run inference
        const inferenceSpinner = ora("Running inference...").start();
        const enrichedProfile = runPackLayer2(
          profile,
          engine.getAnswers(),
          allPacks
        );
        inferenceSpinner.succeed("Inference complete");

        // Summary
        const rules = collectRules(enrichedProfile, allPackExportRules);
        finalSummary({
          dimensions: Object.keys(enrichedProfile.explicit).length,
          completeness: enrichedProfile.completeness,
          rules: rules.length,
          packs: uniquePackIds.length,
          compounds: Object.keys(enrichedProfile.compound).length,
        });

        // Save profile
        const saveSpinner = ora("Saving profile...").start();
        await writeFile(
          options.profile,
          JSON.stringify(enrichedProfile, null, 2),
          "utf-8"
        );
        saveSpinner.succeed(`Profile saved to ${CYAN(options.profile)}`);

        // Clean up session file
        try {
          const { unlink } = await import("node:fs/promises");
          await unlink(sessionPath);
        } catch {
          // ignore
        }

        console.log();
        console.log(
          GREEN("✓ ") + BOLD("Done! ") + `Export: ${CYAN("meport export --all")}`
        );
        console.log();

        result = gen.next(undefined);
        break;
      }
    }
  }
}

/**
 * Save session state for later resume.
 * Called from profile-v2 when user interrupts (Ctrl+C).
 */
export async function saveSession(
  engine: PackProfilingEngine,
  profilePath: string
): Promise<void> {
  const sessionPath = join(dirname(profilePath), SESSION_FILE);
  const state = engine.toSessionState();
  await writeFile(sessionPath, JSON.stringify(state, null, 2), "utf-8");
}
