/**
 * meport interactive shell — user never "falls out" of the app.
 * After profiling or on `meport` with no args, shows an interactive menu.
 */

import { readFile } from "node:fs/promises";
import { select } from "@inquirer/prompts";
import { GREEN, BOLD, CYAN, DIM, RED } from "../ui/display.js";
import { viewCommand } from "./view.js";
import { exportCommand } from "./export.js";
import { configCommand, loadConfig } from "./config.js";
import { packsListCommand, packsAddCommand } from "./packs.js";
import { editCommand } from "./edit.js";
import { demoCommand } from "./demo.js";
import { refreshCommand } from "./refresh.js";
import { deployCommand } from "./deploy.js";
import { reportCommand } from "./report.js";
import { historyCommand } from "./history.js";
// Dynamic import to avoid circular dependency with profile-v2
const loadProfileV2 = () => import("./profile-v2.js").then(m => m.profileV2Command);
import type { PersonaProfile } from "@meport/core";

interface ShellOptions {
  profile: string;
  lang?: string;
}

export async function shellCommand(options: ShellOptions): Promise<void> {
  const pl = options.lang === "pl" || (!options.lang && (process.env.LANG || "").startsWith("pl"));

  // Check if profile exists
  let hasProfile = false;
  try {
    const raw = await readFile(options.profile, "utf-8");
    const profile = JSON.parse(raw) as PersonaProfile;
    hasProfile = !!profile.schema_version;
  } catch {
    hasProfile = false;
  }

  if (!hasProfile) {
    // ─── First Contact — explain what meport is ─────────
    console.log(
      pl
        ? BOLD("\n  meport") + " — Twoje AI Cię nie zna. Naprawmy to w jednej rozmowie.\n"
        : BOLD("\n  meport") + " — Your AI doesn't know you. Fix that in one conversation.\n"
    );
    console.log(
      pl
        ? DIM("  Przeprowadzę z Tobą rozmowę i wygeneruję spersonalizowane\n  instrukcje dla ChatGPT, Claude, Cursor i innych.\n")
        : DIM("  I'll have a conversation with you and generate personalized\n  instructions for ChatGPT, Claude, Cursor and more.\n")
    );

    // Check if AI is configured
    const config = await loadConfig();
    const hasAI = !!config.ai?.provider;

    if (hasAI) {
      // AI configured — go straight to AI profiling
      const action = await select({
        message: pl ? "Zaczynamy?" : "Ready?",
        choices: [
          { name: pl ? "🚀 Stwórz nowy profil (AI)" : "🚀 Create new profile (AI)", value: "ai" },
          { name: pl ? "📥 Mam już instrukcje — importuj i ulepsz" : "📥 I have instructions — import & upgrade", value: "import" },
          { name: pl ? "📋 Tryb quiz (bez AI)" : "📋 Quiz mode (no AI)", value: "quiz" },
          { name: pl ? "❌ Wyjdź" : "❌ Exit", value: "exit" },
        ],
      });

      if (action === "ai") {
        const { profileAICommand } = await import("./profile-ai.js");
        await profileAICommand({ output: options.profile, lang: options.lang });
        await mainMenu(options, pl);
      } else if (action === "import") {
        const { importCommand } = await import("./import-profile.js");
        await importCommand({ profile: options.profile, lang: options.lang });
      } else if (action === "quiz") {
        const profileV2Command = await loadProfileV2();
        await profileV2Command({ output: options.profile, lang: options.lang });
        await mainMenu(options, pl);
      }
    } else {
      // No AI — offer setup or quiz
      const action = await select({
        message: pl ? "Jak chcesz zacząć?" : "How to start?",
        choices: [
          {
            name: pl
              ? "🧠 Skonfiguruj AI (Claude/OpenAI/Ollama) — najlepsza jakość"
              : "🧠 Set up AI (Claude/OpenAI/Ollama) — best quality",
            value: "config",
          },
          {
            name: pl
              ? "📋 Tryb quiz — bez API key, szybki start"
              : "📋 Quiz mode — no API key, quick start",
            value: "quiz",
          },
          { name: pl ? "❌ Wyjdź" : "❌ Exit", value: "exit" },
        ],
      });

      if (action === "config") {
        await configCommand();
        await shellCommand(options); // restart with AI configured
      } else if (action === "quiz") {
        const profileV2Command = await loadProfileV2();
        await profileV2Command({ output: options.profile, lang: options.lang });
        await mainMenu(options, pl);
      }
    }
    return;
  }

  // Profile exists — show main menu
  await mainMenu(options, pl);
}

async function mainMenu(options: ShellOptions, pl: boolean): Promise<void> {
  while (true) {
    const config = await loadConfig();
    const hasAI = !!config.ai?.provider;

    console.log();
    const action = await select({
      message: pl ? "meport — co dalej?" : "meport — what next?",
      choices: [
        { name: pl ? "👁️  Zobacz profil" : "👁️  View profile", value: "view" },
        { name: pl ? "✏️  Edytuj profil" : "✏️  Edit profile", value: "edit" },
        { name: pl ? "🔄 Odśwież profil" : "🔄 Refresh profile", value: "refresh" },
        { name: pl ? "🔬 Demo: Przed vs Po" : "🔬 Demo: Before vs After", value: "demo" },
        { name: pl ? "📊 Me Report" : "📊 Me Report", value: "report" },
        { name: pl ? "📅 Historia zmian" : "📅 Change history", value: "history" },
        { name: pl ? "🪪 Karta osobowości" : "🪪 Personality card", value: "card" },
        { name: pl ? "🚀 Deploy (wgraj do Cursor, Copilot, Claude Code...)" : "🚀 Deploy (push to Cursor, Copilot, Claude Code...)", value: "deploy" },
        { name: pl ? "📦 Eksportuj do plików" : "📦 Export to files", value: "export" },
        { name: pl ? "📋 Zarządzaj pakietami" : "📋 Manage packs", value: "packs" },
        {
          name: hasAI
            ? (pl ? "🧠 AI analiza (skonfigurowane)" : "🧠 AI analysis (configured)")
            : (pl ? "🧠 AI analiza (wymaga konfiguracji)" : "🧠 AI analysis (needs setup)"),
          value: "ai",
        },
        { name: pl ? "⚙️  Ustawienia" : "⚙️  Settings", value: "config" },
        { name: pl ? "❌ Wyjdź" : "❌ Exit", value: "exit" },
      ],
    });

    switch (action) {
      case "view":
        await viewCommand({ profile: options.profile });
        break;

      case "edit":
        await editCommand({ profile: options.profile });
        break;

      case "refresh":
        await refreshCommand({ profile: options.profile, lang: options.lang });
        break;

      case "demo":
        await demoCommand({ profile: options.profile });
        break;

      case "report":
        await reportCommand({ profile: options.profile, lang: options.lang });
        break;

      case "history":
        await historyCommand({ profile: options.profile, lang: options.lang });
        break;

      case "card":
        const { cardCommand } = await import("./card.js");
        await cardCommand({ profile: options.profile });
        break;

      case "deploy":
        await deployCommand({ profile: options.profile, lang: options.lang });
        break;

      case "export":
        await exportCommand("", {
          profile: options.profile,
          all: true,
        });
        break;

      case "packs":
        await packsListCommand({ profile: options.profile });
        const packAction = await select({
          message: pl ? "Co zrobić?" : "What to do?",
          choices: [
            { name: pl ? "Dodaj pakiet" : "Add a pack", value: "add" },
            { name: pl ? "Wróć" : "Back", value: "back" },
          ],
        });
        if (packAction === "add") {
          const packId = await select({
            message: pl ? "Który pakiet?" : "Which pack?",
            choices: [
              { name: "Context (job, location, tools)", value: "context" },
              { name: "Work (energy, deadlines)", value: "work" },
              { name: "Lifestyle (travel, food, routine)", value: "lifestyle" },
              { name: "Health (fitness, sleep)", value: "health" },
              { name: "Finance (money style)", value: "finance" },
              { name: "Learning (study style)", value: "learning" },
            ],
          });
          await packsAddCommand(packId, { profile: options.profile, lang: options.lang });
        }
        break;

      case "ai":
        if (!hasAI) {
          console.log(
            pl
              ? DIM("\n  Najpierw skonfiguruj AI — potrzebujesz klucza API.\n")
              : DIM("\n  Configure AI first — you need an API key.\n")
          );
          await configCommand();
        } else {
          await runAIAnalysis(options.profile, pl);
        }
        break;

      case "config":
        await configCommand();
        break;

      case "exit":
        console.log(pl ? "\n👋 Do zobaczenia!\n" : "\n👋 See you!\n");
        return;
    }
  }
}

async function runAIAnalysis(profilePath: string, pl: boolean): Promise<void> {
  const ora = (await import("ora")).default;

  // Dynamic imports to avoid loading AI deps when not needed
  const { createAIClient, runLayer3 } = await import("@meport/core");
  const { loadConfig } = await import("./config.js");
  const { readFile, writeFile } = await import("node:fs/promises");

  const config = await loadConfig();
  if (!config.ai) {
    console.log(RED("  No AI configured. Run config first."));
    return;
  }

  const raw = await readFile(profilePath, "utf-8");
  const profile = JSON.parse(raw) as PersonaProfile;

  const client = createAIClient(config.ai);

  const spinner = ora(
    pl ? "🧠 AI analizuje Twoje odpowiedzi..." : "🧠 AI analyzing your answers..."
  ).start();

  try {
    // Build answer map from profile explicit dimensions
    const answers = new Map<string, any>();
    for (const [key, val] of Object.entries(profile.explicit)) {
      answers.set(key, {
        question_id: key,
        value: val.value,
        skipped: false,
        timestamp: 0,
        response_time_ms: 0,
      });
    }

    const observations = await runLayer3(profile, answers, client);
    spinner.succeed(
      pl
        ? `${observations.length} obserwacji AI`
        : `${observations.length} AI observations`
    );

    // Show observations
    console.log();
    for (const obs of observations) {
      const icon = {
        personality_pattern: "🎭",
        cognitive_pattern: "🧩",
        behavioral_pattern: "⚡",
        compound_signal: "🔗",
        contradiction: "⚠️",
        hidden_strength: "💎",
        risk_flag: "🚩",
      }[obs.category] ?? "📌";

      console.log(`  ${icon} ${BOLD(obs.title)} ${DIM(`(${Math.round(obs.confidence * 100)}%)`)}`);
      console.log(`     ${obs.observation}`);
      if (obs.export_instruction) {
        console.log(`     ${CYAN("→")} ${DIM(obs.export_instruction)}`);
      }
      console.log();
    }

    // Save to profile
    profile.emergent = observations;
    profile.meta.layer3_available = true;
    await writeFile(profilePath, JSON.stringify(profile, null, 2), "utf-8");
    console.log(GREEN("  ✓ ") + (pl ? "Obserwacje zapisane w profilu." : "Observations saved to profile."));

  } catch (err: any) {
    spinner.fail(
      pl ? "Błąd AI" : "AI error"
    );
    console.log(RED(`  ${err.message}`));
    console.log(DIM(pl ? "  Sprawdź klucz API w: meport config" : "  Check API key in: meport config"));
  }
}
