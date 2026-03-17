/**
 * meport config — Manage API keys and settings.
 * Stores config in ~/.meport/config.json
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { select, input, password } from "@inquirer/prompts";
import { GREEN, BOLD, CYAN, DIM, RED, YELLOW } from "../ui/display.js";
import type { AIConfig } from "@meport/core";

const CONFIG_DIR = join(homedir(), ".meport");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface MeportConfig {
  ai?: AIConfig;
}

export async function loadConfig(): Promise<MeportConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveConfig(config: MeportConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: "utf-8", mode: 0o600 });
}

export async function configCommand(lang?: string): Promise<void> {
  const config = await loadConfig();
  const pl = (lang ?? "").startsWith("pl") || (!lang && (process.env.LANG ?? "").startsWith("pl"));

  console.log(BOLD("\n⚙️  meport config\n"));

  if (config.ai?.provider) {
    console.log(`  AI: ${GREEN("✓")} ${config.ai.provider} (${config.ai.model ?? "default"})`);
    console.log(`  ${pl ? "Klucz" : "Key"}: ${config.ai.apiKey ? GREEN(pl ? "ustawiony" : "set") : RED(pl ? "brak" : "missing")}`);
  } else {
    console.log(`  AI: ${DIM(pl ? "nie skonfigurowane" : "not configured")}`);
  }
  console.log();

  const action = await select({
    message: pl ? "Co skonfigurować?" : "What to configure?",
    choices: [
      { name: pl ? "🧠 Skonfiguruj AI (Claude / OpenAI / Ollama)" : "🧠 Set up AI (Claude / OpenAI / Ollama)", value: "ai" },
      { name: pl ? "📋 Pokaż konfigurację" : "📋 Show current config", value: "show" },
      { name: pl ? "🗑️  Resetuj" : "🗑️  Reset config", value: "reset" },
      { name: pl ? "✓ Gotowe" : "✓ Done", value: "done" },
    ],
  });

  switch (action) {
    case "ai":
      await configureAI(config, pl);
      break;
    case "show":
      showConfig(config);
      break;
    case "reset":
      await saveConfig({});
      console.log(GREEN(pl ? "  ✓ Konfiguracja zresetowana." : "  ✓ Config reset."));
      break;
    case "done":
      break;
  }
}

async function configureAI(config: MeportConfig, pl = false): Promise<void> {
  const provider = await select({
    message: pl ? "Provider AI:" : "AI provider:",
    choices: [
      {
        name: pl ? "Claude (Anthropic) — najlepsza jakość, płatne" : "Claude (Anthropic) — best quality, paid",
        value: "claude" as const,
      },
      {
        name: pl ? "OpenAI (GPT) — dobra jakość, płatne" : "OpenAI (GPT) — good quality, paid",
        value: "openai" as const,
      },
      {
        name: pl ? "Ollama (lokalne) — za darmo, na Twoim komputerze" : "Ollama (local) — free, runs on your machine",
        value: "ollama" as const,
      },
    ],
  });

  if (provider === "ollama") {
    const url = await input({
      message: "Ollama URL:",
      default: "http://localhost:11434",
    });
    const model = await input({
      message: pl ? "Model:" : "Model:",
      default: "llama3.1",
    });

    config.ai = { provider: "ollama", baseUrl: url, model };
    await saveConfig(config);
    console.log(GREEN(pl ? "\n  ✓ Ollama skonfigurowane. Upewnij się że działa!" : "\n  ✓ Ollama configured. Make sure it's running!"));

    // Test connection
    await testConnection(config, pl);
    return;
  }

  const apiKey = await password({
    message: `${provider === "claude" ? "Anthropic" : "OpenAI"} API key:`,
    mask: "*",
  });

  if (!apiKey.trim()) {
    console.log(RED(pl ? "  ✗ Brak klucza." : "  ✗ No key provided."));
    return;
  }

  const model = await input({
    message: pl ? "Model (Enter = domyślny):" : "Model (Enter for default):",
    default: provider === "claude" ? "claude-sonnet-4-20250514" : "gpt-4o-mini",
  });

  config.ai = { provider, apiKey: apiKey.trim(), model };
  await saveConfig(config);
  console.log(GREEN(pl ? `\n  ✓ ${provider} skonfigurowane.` : `\n  ✓ ${provider} configured.`));

  // Test connection
  await testConnection(config, pl);
}

async function testConnection(config: MeportConfig, pl: boolean): Promise<void> {
  if (!config.ai) return;

  const ora = (await import("ora")).default;
  const spin = ora(pl ? "Testuję połączenie..." : "Testing connection...").start();

  try {
    const { createAIClient } = await import("@meport/core");
    const client = createAIClient(config.ai);
    await client.generate("Say OK");
    spin.succeed(pl ? "Połączenie działa!" : "Connection works!");
  } catch (err: any) {
    spin.fail(pl ? `Błąd: ${err.message}` : `Error: ${err.message}`);
    console.log(DIM(pl ? "  Sprawdź klucz API i spróbuj ponownie." : "  Check your API key and try again."));
  }
}

function showConfig(config: MeportConfig): void {
  console.log(DIM("\n  ~/.meport/config.json:\n"));
  const display = { ...config };
  if (display.ai?.apiKey) {
    display.ai = { ...display.ai, apiKey: display.ai.apiKey.slice(0, 8) + "..." };
  }
  console.log("  " + JSON.stringify(display, null, 2).split("\n").join("\n  "));
  console.log();
}
