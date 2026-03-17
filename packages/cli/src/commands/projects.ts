/**
 * meport projects — Manage tracked projects for multi-deploy
 *
 * Tracks all directories where meport is deployed.
 * `meport deploy --global` pushes to ALL tracked projects at once.
 */

import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { select, input, confirm } from "@inquirer/prompts";
import {
  GREEN,
  BOLD,
  CYAN,
  DIM,
  RED,
} from "../ui/display.js";

const PROJECTS_FILE = join(homedir(), ".meport", "projects.json");

interface ProjectEntry {
  path: string;
  name: string;
  addedAt: string;
  platforms: string[]; // which platforms were deployed here
}

export async function loadProjects(): Promise<ProjectEntry[]> {
  try {
    const raw = await readFile(PROJECTS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveProjects(projects: ProjectEntry[]): Promise<void> {
  await mkdir(join(homedir(), ".meport"), { recursive: true });
  await writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2), "utf-8");
}

export async function addProject(path: string): Promise<void> {
  const projects = await loadProjects();
  const absPath = resolve(path);

  // Check if already tracked
  if (projects.some((p) => p.path === absPath)) {
    return; // silently skip duplicates
  }

  // Try to get project name from package.json or folder name
  let name = absPath.split("/").pop() ?? "unknown";
  try {
    const pkg = JSON.parse(await readFile(join(absPath, "package.json"), "utf-8"));
    if (pkg.name) name = pkg.name;
  } catch {}

  projects.push({
    path: absPath,
    name,
    addedAt: new Date().toISOString(),
    platforms: [],
  });

  await saveProjects(projects);
}

interface ProjectsOptions {
  profile: string;
  lang?: string;
}

export async function projectsCommand(options: ProjectsOptions): Promise<void> {
  const pl = (options.lang ?? "").startsWith("pl") ||
    (!options.lang && (process.env.LANG ?? "").startsWith("pl"));

  const projects = await loadProjects();

  console.log(BOLD(pl ? "\n━━━ Śledzone projekty ━━━\n" : "\n━━━ Tracked Projects ━━━\n"));

  if (projects.length === 0) {
    console.log(DIM(pl
      ? "  Brak śledzonych projektów. Uruchom `meport deploy` w katalogu projektu żeby go dodać."
      : "  No tracked projects. Run `meport deploy` in a project directory to add it."));
    console.log();
  } else {
    for (const p of projects) {
      const exists = await dirExists(p.path);
      const icon = exists ? GREEN("●") : RED("✗");
      console.log(`  ${icon} ${BOLD(p.name)} — ${DIM(p.path)}`);
    }
    console.log();
    console.log(DIM(pl
      ? `  ${projects.length} projektów. Użyj 'meport deploy --global' żeby zaktualizować wszystkie.`
      : `  ${projects.length} projects. Use 'meport deploy --global' to update all.`));
  }

  console.log();

  const action = await select({
    message: pl ? "Co zrobić?" : "What to do?",
    choices: [
      { name: pl ? "➕ Dodaj bieżący katalog" : "➕ Add current directory", value: "add" },
      { name: pl ? "➕ Dodaj inny katalog" : "➕ Add another directory", value: "add_other" },
      ...(projects.length > 0 ? [{ name: pl ? "🗑️  Usuń projekt" : "🗑️  Remove project", value: "remove" }] : []),
      { name: pl ? "✓ Gotowe" : "✓ Done", value: "done" },
    ],
  });

  if (action === "add") {
    await addProject(process.cwd());
    console.log(GREEN("  ✓ ") + process.cwd());
  } else if (action === "add_other") {
    const path = await input({ message: pl ? "Ścieżka:" : "Path:" });
    if (path.trim()) {
      await addProject(path.trim());
      console.log(GREEN("  ✓ ") + path.trim());
    }
  } else if (action === "remove") {
    const toRemove = await select({
      message: pl ? "Który usunąć?" : "Which to remove?",
      choices: projects.map((p) => ({ name: `${p.name} (${p.path})`, value: p.path })),
    });
    const filtered = projects.filter((p) => p.path !== toRemove);
    await saveProjects(filtered);
    console.log(GREEN("  ✓ ") + (pl ? "Usunięto" : "Removed"));
  }
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}
