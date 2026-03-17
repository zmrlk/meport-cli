/**
 * meport feedback — Rate how well AI responds with your profile
 *
 * Quick 1-10 rating + optional note.
 * Used to track if exports are actually working and refine rules over time.
 */

import { readFile, writeFile } from "node:fs/promises";
import { select, input } from "@inquirer/prompts";
import {
  type PersonaProfile,
} from "@meport/core";
import {
  GREEN,
  BOLD,
  DIM,
  RED,
} from "../ui/display.js";

interface FeedbackOptions {
  profile: string;
  lang?: string;
}

export async function feedbackCommand(options: FeedbackOptions): Promise<void> {
  const pl = (options.lang ?? "").startsWith("pl") ||
    (!options.lang && (process.env.LANG ?? "").startsWith("pl"));

  let profile: PersonaProfile;
  try {
    const raw = await readFile(options.profile, "utf-8");
    profile = JSON.parse(raw) as PersonaProfile;
  } catch {
    console.log(RED("✗ ") + (pl ? "Brak profilu." : "No profile found."));
    return;
  }

  console.log(
    BOLD(pl ? "\n━━━ Feedback ━━━\n" : "\n━━━ Feedback ━━━\n")
  );
  console.log(
    DIM(pl
      ? "  Jak dobrze AI odpowiada z Twoim profilem?\n"
      : "  How well does AI respond with your profile?\n")
  );

  const score = await select({
    message: pl ? "Ocena:" : "Rating:",
    choices: [
      { name: "10 — " + (pl ? "Idealnie, jakby mnie znał" : "Perfect, like it knows me"), value: 10 },
      { name: "8 — " + (pl ? "Bardzo dobrze, drobne niedociągnięcia" : "Very good, minor issues"), value: 8 },
      { name: "6 — " + (pl ? "OK, ale dużo do poprawy" : "OK but lots to improve"), value: 6 },
      { name: "4 — " + (pl ? "Słabo, nie czuję różnicy" : "Weak, barely different"), value: 4 },
      { name: "2 — " + (pl ? "Ignoruje mój profil" : "Ignores my profile"), value: 2 },
    ],
  });

  let note: string | undefined;
  if (score <= 6) {
    note = await input({
      message: pl ? "Co nie działa? (opcjonalnie)" : "What's not working? (optional)",
    });
    if (!note?.trim()) note = undefined;
  }

  // Save feedback
  if (!profile.meta.feedback_scores) {
    profile.meta.feedback_scores = [];
  }
  profile.meta.feedback_scores.push({
    date: new Date().toISOString(),
    score,
    note: note?.trim(),
  });

  await writeFile(options.profile, JSON.stringify(profile, null, 2), "utf-8");

  // Show trend
  const scores = profile.meta.feedback_scores;
  if (scores.length > 1) {
    const avg = Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length);
    const trend = scores[scores.length - 1].score > scores[scores.length - 2].score ? "📈" : scores[scores.length - 1].score < scores[scores.length - 2].score ? "📉" : "➡️";
    console.log(`\n  ${trend} ${pl ? "Średnia" : "Average"}: ${avg}/10 (${scores.length} ${pl ? "ocen" : "ratings"})`);
  }

  console.log(GREEN("\n  ✓ ") + (pl ? "Zapisane. Dzięki!" : "Saved. Thanks!"));

  if (score <= 4 && note) {
    console.log(
      DIM(pl
        ? "\n  Tip: Uruchom meport deepen żeby pogłębić profil w słabych obszarach."
        : "\n  Tip: Run meport deepen to improve shallow areas.")
    );
  }
  console.log();
}
