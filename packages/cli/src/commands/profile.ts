/**
 * meport profile — Interactive profiling session
 *
 * Walks through tiers, collects answers, runs inference,
 * saves profile JSON.
 */

import { writeFile } from "node:fs/promises";
import ora from "ora";
import {
  ProfilingEngine,
  loadQuestionTiers,
  runLayer2,
  type AnswerInput,
  type Question,
} from "@meport/core";
import {
  banner,
  tierHeader,
  tierComplete,
  questionProgress,
  profileSummary,
  GREEN,
  BOLD,
  CYAN,
  DIM,
} from "../ui/display.js";
import { askQuestion } from "../ui/prompts.js";

interface ProfileOptions {
  track: "personal" | "business";
  output: string;
  tier?: string;
}

export async function profileCommand(options: ProfileOptions): Promise<void> {
  banner();

  console.log(
    DIM("Your AI doesn't know you. Let's fix that.\n")
  );

  // Load questions
  const spinner = ora("Loading questions...").start();
  const tiers = await loadQuestionTiers(options.track);
  spinner.succeed(`${tiers.length} tiers loaded`);

  if (tiers.length === 0) {
    console.log("No question tiers found. Check your installation.");
    process.exit(1);
  }

  // Filter to starting tier if specified
  const startTier = options.tier ? parseInt(options.tier, 10) : 0;
  const activeTiers = tiers.filter((t) => t.tier >= startTier);

  // Create engine
  const engine = new ProfilingEngine(activeTiers);

  // Run profiling loop
  const gen = engine.run();
  let result = gen.next();

  while (!result.done) {
    const event = result.value;

    switch (event.type) {
      case "tier_start":
        tierHeader(event.tier, event.name, event.intro);
        result = gen.next(undefined);
        break;

      case "question": {
        const progress = questionProgress(
          event.index,
          event.total,
          (event.question as Question).tier
        );
        const answer = await askQuestion(event.question, progress);
        result = gen.next(answer);
        break;
      }

      case "follow_up": {
        const answer = await askQuestion(event.question, DIM("  ↳"));
        result = gen.next(answer);
        break;
      }

      case "tier_complete":
        tierComplete(event.headline, event.body);
        result = gen.next(undefined);
        break;

      case "profiling_complete": {
        // Run Layer 2 inference
        const inferenceSpinner = ora("Running inference...").start();

        const answers = engine.getAnswers();
        const questionMap = new Map<string, Question>();
        for (const tier of activeTiers) {
          for (const q of tier.questions) {
            questionMap.set(q.id, q);
          }
        }

        const profile = runLayer2(event.profile, answers, questionMap);
        inferenceSpinner.succeed("Inference complete");

        // Show summary
        profileSummary({
          dimensions: Object.keys(profile.explicit).length,
          tiers: profile.meta.tiers_completed.length,
          completeness: profile.completeness,
          compounds: Object.keys(profile.compound).length,
          contradictions: profile.contradictions.length,
        });

        // Save
        const saveSpinner = ora("Saving profile...").start();
        await writeFile(
          options.output,
          JSON.stringify(profile, null, 2),
          "utf-8"
        );
        saveSpinner.succeed(`Profile saved to ${CYAN(options.output)}`);

        console.log();
        console.log(
          GREEN("✓ ") +
            BOLD("Done! ") +
            `Export with: ${CYAN("meport export chatgpt")}`
        );
        console.log(
          DIM("  Or export all: ") + CYAN("meport export --all")
        );
        console.log();

        result = gen.next(undefined);
        break;
      }
    }
  }
}
