/**
 * meport profile --ai — AI-first profiling
 *
 * SCAN FIRST. QUESTIONS FOR GAPS ONLY.
 *
 * 1. Consent (1 question)
 * 2. Scan system + folders (names only)
 * 3. AI analyzes names → shows what it found
 * 4. Offer to read specific files
 * 5. AI interview — ONLY about what it couldn't detect
 * 6. Summary + export
 */

import { writeFile, mkdir, readFile, stat, readdir } from "node:fs/promises";
import { join, dirname, extname, basename } from "node:path";
import { homedir, tmpdir } from "node:os";
import { execSync } from "node:child_process";
import ora from "ora";
import { select, input, confirm, checkbox } from "@inquirer/prompts";
import {
  AIInterviewer,
  createAIClient,
  runSystemScan,
  collectPackExportRules,
  collectRules,
  compileAllRules,
  loadPacks,
  getAvailablePackIds,
  type AIConfig,
} from "@meport/core";
import {
  banner,
  completenessBar,
  GREEN,
  BOLD,
  CYAN,
  DIM,
  RED,
  YELLOW,
} from "../ui/display.js";
import { loadConfig } from "./config.js";
import { shellCommand } from "./shell.js";

// Privacy exclusion patterns — NEVER send these names to AI providers
// Default: always filtered. Future flag: --privacy off would bypass filterSensitive().
// Categories: auth, medical/health, dating/adult, financial, legal, identity, substance
const PRIVACY_PATTERNS =
  /password|credential|secret|private|token|\.env|\.ssh|\.aws|\.gnupg|\.pgp|medical|legal|divorce|tax|bank.?statement|credit.?card|payroll|salary|nda|confidential|classified|hipaa|ssn|passport|drivers?.?licen|social.?security|therapy|prescription|insurance|will\.pdf|testament|keychain|\.pem$|\.key$|doctor|hospital|diagnos|psychiatr|psycholog|rehab|addiction|narcotics|aa.?meeting|tinder|bumble|hinge|grindr|onlyfans|porn|xxx|adult|dating|escort|payslip|pay.?slip|tax.?return|kredyt|po.?yczka|invoice.*\d|faktura.*\d|lawyer|court|lawsuit|custody|id_rsa|private.?key|\.p12|\.pfx|pesel|birth.?cert|substance/i;

/**
 * Remove any item whose name matches privacy patterns.
 * Applied to ALL scanner outputs before they are included in scan results.
 *
 * Future flag note: pass `privacyOff = true` to bypass when --privacy off is implemented.
 */
function filterSensitive(items: string[], privacyOff = false): string[] {
  // --privacy off: return as-is (not yet exposed as a CLI flag — see TODO below)
  // TODO: wire `privacyOff` to a top-level `options.privacy !== "off"` check
  if (privacyOff) return items;
  return items.filter((item) => !PRIVACY_PATTERNS.test(item));
}

interface ProfileAIOptions {
  output: string;
  lang?: string;
  scan?: string[];
}

export async function profileAICommand(options: ProfileAIOptions): Promise<void> {
  banner();

  const pl = (options.lang ?? "").startsWith("pl") ||
    (!options.lang && (process.env.LANG ?? "").startsWith("pl"));

  const config = await loadConfig();
  if (!config.ai?.provider) {
    console.log(RED(pl ? "\n  Brak konfiguracji AI. Uruchom: meport config" : "\n  No AI configured. Run: meport config"));
    return;
  }

  const client = createAIClient(config.ai as AIConfig);
  const provider = config.ai.provider;
  const providerLabel = provider === "ollama" ? "Ollama (lokalne)" : provider;
  const isLocal = provider === "ollama";
  const langForce = pl ? "\n\nKRYTYCZNE: Odpowiedz WYŁĄCZNIE po polsku. Każde słowo po polsku. NIE przełączaj na angielski." : "";

  // Collected dimensions
  const knownDims: Record<string, string> = {};

  console.log(
    pl
      ? DIM("Zbuduję Twój profil AI. Zaczynam od przejrzenia Twojego komputera.\n")
      : DIM("I'll build your AI profile. Starting by looking at your computer.\n")
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 1: CONSENT — before ANY scanning
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Explain what we'll do (bOS principle: explain before you act)
  console.log(
    pl
      ? `  ${BOLD("CO:")} Przejrzę nazwy plików i folderów (nie treści)\n  ${BOLD("GDZIE:")} Desktop, Documents, Downloads, aplikacje\n  ${BOLD("PO CO:")} żeby zrozumieć czym się zajmujesz\n`
      : `  ${BOLD("WHAT:")} I'll look at file and folder names (not content)\n  ${BOLD("WHERE:")} Desktop, Documents, Downloads, apps\n  ${BOLD("WHY:")} to understand what you do\n`
  );

  const scanChoice = await select({
    message: pl ? "Mogę?" : "May I?",
    choices: [
      {
        name: pl ? "📁 Tak, sprawdź" : "📁 Yes, go ahead",
        value: "full",
      },
      {
        name: pl ? "⏭️  Nie — sam opowiem" : "⏭️  No — I'll tell you myself",
        value: "skip",
      },
    ],
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 2: SCAN (if consent given)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (scanChoice === "full") {
    // 2a. System scan (silent, instant)
    const { context: sysCtx } = await runSystemScan(process.cwd());
    for (const [k, v] of sysCtx.dimensions) {
      if (!k.startsWith("_")) knownDims[k] = v.value;
    }

    // 2b. Folder scan (names only)
    const home = homedir();
    const dirs = [
      { path: join(home, "Desktop"), label: "Desktop" },
      { path: join(home, "Documents"), label: "Documents" },
      { path: join(home, "Downloads"), label: "Downloads" },
    ];

    const scanSpin = ora(pl ? "Przeglądam Twój komputer..." : "Looking at your computer...").start();

    const folderContents: Record<string, string[]> = {};
    for (const dir of dirs) {
      try {
        const entries = await scanFolderRecursive(dir.path, 2);
        folderContents[dir.label] = entries;
      } catch {
        folderContents[dir.label] = [];
      }
    }

    // Applications (no cap — apps are high signal)
    try {
      const apps = await readdir("/Applications");
      folderContents["Apps"] = filterSensitive(
        apps
          .filter((a) => a.endsWith(".app"))
          .map((a) => a.replace(".app", ""))
      );
    } catch {}

    // Dock — pinned apps (what they use MOST)
    try {

      const dockRaw = execSync("defaults read com.apple.dock persistent-apps 2>/dev/null", { encoding: "utf-8" });
      const dockApps = filterSensitive(
        [...dockRaw.matchAll(/"file-label"\s*=\s*"?([^";]+)"?/g)]
          .map((m) => m[1].replace(/\\U[\da-fA-F]{4}/g, "").trim())
          .filter((a) => a.length > 1)
      );
      if (dockApps.length > 0) {
        folderContents["Dock (pinned)"] = dockApps;
      }
    } catch {}

    // Login items — auto-start apps
    try {

      const loginRaw = execSync("osascript -e 'tell application \"System Events\" to get the name of every login item' 2>/dev/null", { encoding: "utf-8" });
      const loginItems = filterSensitive(loginRaw.trim().split(", ").filter((i) => i.length > 1));
      if (loginItems.length > 0) {
        folderContents["Auto-start"] = loginItems;
      }
    } catch {}

    // Homebrew — installed tools
    try {

      const brewFormula = filterSensitive(execSync("brew list --formula 2>/dev/null", { encoding: "utf-8" }).trim().split("\n").filter(Boolean));
      const brewCask = filterSensitive(execSync("brew list --cask 2>/dev/null", { encoding: "utf-8" }).trim().split("\n").filter(Boolean));
      if (brewFormula.length > 0) {
        folderContents["Homebrew (CLI tools)"] = brewFormula;
      }
      if (brewCask.length > 0) {
        folderContents["Homebrew (GUI apps)"] = brewCask;
      }
    } catch {}

    // npm globals
    try {

      const npmRaw = execSync("npm list -g --depth=0 2>/dev/null", { encoding: "utf-8" });
      const npmPkgs = filterSensitive([...npmRaw.matchAll(/[├└]── (.+?)@/g)].map((m) => m[1]));
      if (npmPkgs.length > 0) {
        folderContents["npm (global)"] = npmPkgs;
      }
    } catch {}

    // Browser bookmarks (Chrome, Edge — JSON format, cross-platform)
    const bookmarkPaths = [
      join(home, "Library", "Application Support", "Google", "Chrome", "Default", "Bookmarks"), // macOS Chrome
      join(home, "Library", "Application Support", "Microsoft Edge", "Default", "Bookmarks"), // macOS Edge
      join(home, "AppData", "Local", "Google", "Chrome", "User Data", "Default", "Bookmarks"), // Windows Chrome
      join(home, "AppData", "Local", "Microsoft", "Edge", "User Data", "Default", "Bookmarks"), // Windows Edge
      join(home, ".config", "google-chrome", "Default", "Bookmarks"), // Linux Chrome
    ];

    for (const bPath of bookmarkPaths) {
      try {
        const raw = await readFile(bPath, "utf-8");
        const bookmarks = JSON.parse(raw);
        const urls: string[] = [];

        // Recursive extract bookmark names + URLs + folder structure
        const bookmarkFolders: string[] = [];
        const extract = (node: any, depth = 0) => {
          if (node.type === "folder" && node.name && depth > 0) {
            bookmarkFolders.push(`📁 ${node.name}`);
          }
          if (node.type === "url") {
            if (node.name) urls.push(node.name);
            // Extract domain for tool/service detection
            if (node.url) {
              try {
                const domain = new URL(node.url).hostname.replace("www.", "");
                urls.push(`[${domain}]`);
              } catch {}
            }
          }
          if (node.children) {
            for (const child of node.children) extract(child, depth + 1);
          }
        };

        if (bookmarks.roots) {
          for (const root of Object.values(bookmarks.roots)) {
            extract(root);
          }
        }

        if (urls.length > 0) {
          const browser = bPath.includes("Chrome") ? "Chrome" : "Edge";
          // Include folder names (high signal) + bookmark names + domains — filter sensitive before sending
          const combined = filterSensitive([...bookmarkFolders, ...urls]);
          folderContents[`Bookmarks (${browser})`] = combined.slice(0, 80);
        }
        break; // Found one browser, enough
      } catch {}
    }

    // Windows-specific: installed programs (if on Windows)
    if (process.platform === "win32") {
      try {
  
        const winApps = execSync("powershell -command \"Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Select-Object DisplayName | ConvertTo-Json\"", { encoding: "utf-8", timeout: 5000 });
        const parsed = JSON.parse(winApps);
        const appNames = filterSensitive(
          (Array.isArray(parsed) ? parsed : [parsed])
            .map((a: any) => a.DisplayName)
            .filter(Boolean)
        ).slice(0, 40);
        if (appNames.length > 0) {
          folderContents["Installed Programs"] = appNames;
        }
      } catch {}

      // Windows taskbar
      try {
        const taskbarPath = join(home, "AppData", "Roaming", "Microsoft", "Internet Explorer", "Quick Launch", "User Pinned", "TaskBar");
        const taskbar = await readdir(taskbarPath);
        const pinnedApps = filterSensitive(
          taskbar.filter((f) => f.endsWith(".lnk")).map((f) => f.replace(".lnk", ""))
        );
        if (pinnedApps.length > 0) {
          folderContents["Taskbar (pinned)"] = pinnedApps;
        }
      } catch {}
    }

    // ── macOS: Recently modified files (last 7 days, high signal)
    if (process.platform === "darwin") {
      try {
        const recentRaw = execSync(
          `mdfind 'kMDItemContentModificationDate >= $time.today(-7)' -onlyin ~ 2>/dev/null | head -100`,
          { encoding: "utf-8", timeout: 5000 }
        );
        const recentFiles = filterSensitive(
          recentRaw.trim().split("\n")
            .map((p) => p.replace(homedir() + "/", "~/"))
            .filter((p) => !p.includes("/Library/") && !p.includes("/node_modules/") && !p.includes("/."))
        ).slice(0, 40);
        if (recentFiles.length > 0) {
          folderContents["Recently modified (7d)"] = recentFiles;
        }
      } catch {}

      // Recently used apps (from CoreServices)
      try {
        const recentAppsRaw = execSync(
          `mdfind 'kMDItemLastUsedDate >= $time.today(-14)' -onlyin /Applications 2>/dev/null`,
          { encoding: "utf-8", timeout: 5000 }
        );
        const recentApps = filterSensitive(
          recentAppsRaw.trim().split("\n")
            .filter((p) => p.endsWith(".app"))
            .map((p) => basename(p).replace(".app", ""))
            .filter(Boolean)
        );
        if (recentApps.length > 0) {
          folderContents["Recently used apps (14d)"] = recentApps;
        }
      } catch {}
    }

    // ── Shell history — top commands reveal expertise
    try {
      const histPaths = [join(home, ".zsh_history"), join(home, ".bash_history")];
      for (const hp of histPaths) {
        try {
          const histRaw = await readFile(hp, "utf-8");
          const cmdCounts = new Map<string, number>();
          for (const line of histRaw.split("\n")) {
            // zsh history format: ": timestamp:0;command" or just "command"
            const cmd = line.replace(/^:\s*\d+:\d+;/, "").trim().split(/\s+/)[0];
            if (cmd && cmd.length > 1 && !cmd.startsWith("#")) {
              cmdCounts.set(cmd, (cmdCounts.get(cmd) || 0) + 1);
            }
          }
          const topCmds = filterSensitive(
            [...cmdCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 50)
              .map(([cmd, count]) => `${cmd} (${count}x)`)
          ).slice(0, 30);
          if (topCmds.length > 0) {
            folderContents["Shell history (top commands)"] = topCmds;
            break;
          }
        } catch {}
      }
    } catch {}

    // ── VS Code / Cursor extensions — precise tech stack
    for (const [editor, cmd] of [["VS Code", "code"], ["Cursor", "cursor"]] as const) {
      try {
        const exts = filterSensitive(
          execSync(`${cmd} --list-extensions 2>/dev/null`, { encoding: "utf-8", timeout: 5000 })
            .trim().split("\n").filter(Boolean)
        );
        if (exts.length > 0) {
          folderContents[`${editor} extensions`] = exts;
        }
      } catch {}
    }

    // ── Docker images — backend stack
    try {
      const dockerRaw = execSync("docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null", { encoding: "utf-8", timeout: 5000 });
      const images = filterSensitive(
        dockerRaw.trim().split("\n")
          .filter((i) => i && !i.startsWith("<none>") && !i.includes("sha256"))
      ).slice(0, 20);
      if (images.length > 0) {
        folderContents["Docker images"] = images;
      }
    } catch {}

    // ── Safari bookmarks (macOS default browser)
    if (process.platform === "darwin") {
      try {
        const safariPlist = join(home, "Library", "Safari", "Bookmarks.plist");
        const safariJson = execSync(`plutil -convert json -o - "${safariPlist}" 2>/dev/null`, { encoding: "utf-8", timeout: 5000 });
        const safariData = JSON.parse(safariJson);
        const safariUrls: string[] = [];
        const extractSafari = (node: any) => {
          if (node.URLString) {
            try {
              const domain = new URL(node.URLString).hostname.replace("www.", "");
              safariUrls.push(`[${domain}]`);
            } catch {}
          }
          if (node.URIDictionary?.title) safariUrls.push(node.URIDictionary.title);
          if (node.Children) for (const child of node.Children) extractSafari(child);
        };
        extractSafari(safariData);
        if (safariUrls.length > 0 && !folderContents["Bookmarks (Chrome)"] && !folderContents["Bookmarks (Edge)"]) {
          folderContents["Bookmarks (Safari)"] = filterSensitive([...new Set(safariUrls)]).slice(0, 80);
        }
      } catch {}
    }

    // ── Python packages — data science / ML signal
    try {
      const pipRaw = execSync("pip3 list --format=freeze 2>/dev/null | head -40", { encoding: "utf-8", timeout: 5000 });
      const pipPkgs = pipRaw.trim().split("\n")
        .map((l) => l.split("==")[0])
        .filter((p) => p && !p.startsWith("pip") && !p.startsWith("setup"));
      if (pipPkgs.length > 5) {
        folderContents["Python packages"] = pipPkgs;
      }
    } catch {}

    // ── SSH config — infrastructure / DevOps signals
    try {
      const sshConfig = await readFile(join(home, ".ssh", "config"), "utf-8");
      const hosts = filterSensitive(
        [...sshConfig.matchAll(/^Host\s+(.+)/gm)]
          .map((m) => m[1].trim())
          .filter((h) => h !== "*" && !h.includes(" "))
      );
      if (hosts.length > 0) {
        folderContents["SSH hosts"] = hosts;
      }
    } catch {}

    // ── Git repos — GitHub username, orgs, project names
    const gitRepos: string[] = [];
    for (const dir of dirs) {
      try {
        const topEntries = await readdir(dir.path, { withFileTypes: true });
        for (const entry of topEntries) {
          if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
          try {
            const gitConfig = await readFile(join(dir.path, entry.name, ".git", "config"), "utf-8");
            const remoteMatch = gitConfig.match(/url\s*=\s*(?:https?:\/\/[^/]+\/|git@[^:]+:)(.+?)(?:\.git)?$/m);
            if (remoteMatch) {
              gitRepos.push(`${entry.name} → ${remoteMatch[1]}`);
            } else {
              gitRepos.push(`${entry.name} (local only)`);
            }
          } catch {}
        }
      } catch {}
    }
    if (gitRepos.length > 0) {
      folderContents["Git repositories"] = filterSensitive(gitRepos);
    }

    // ── System preferences — power user signals
    if (process.platform === "darwin") {
      const sysPrefs: string[] = [];
      try {
        const darkMode = execSync("defaults read -g AppleInterfaceStyle 2>/dev/null", { encoding: "utf-8" }).trim();
        if (darkMode) sysPrefs.push(`Theme: ${darkMode}`);
      } catch { sysPrefs.push("Theme: Light"); }
      try {
        const keyRepeat = execSync("defaults read -g KeyRepeat 2>/dev/null", { encoding: "utf-8" }).trim();
        if (parseInt(keyRepeat) <= 2) sysPrefs.push("Fast key repeat (power user)");
      } catch {}
      try {
        const showExts = execSync("defaults read NSGlobalDomain AppleShowAllExtensions 2>/dev/null", { encoding: "utf-8" }).trim();
        if (showExts === "1") sysPrefs.push("Shows file extensions (power user)");
      } catch {}
      try {
        const dockSize = execSync("defaults read com.apple.dock tilesize 2>/dev/null", { encoding: "utf-8" }).trim();
        const dockAuto = execSync("defaults read com.apple.dock autohide 2>/dev/null", { encoding: "utf-8" }).trim();
        if (dockAuto === "1") sysPrefs.push("Dock: auto-hide");
        if (parseInt(dockSize) < 40) sysPrefs.push("Dock: small tiles");
      } catch {}
      if (sysPrefs.length > 0) {
        folderContents["System preferences"] = sysPrefs;
      }
    }

    // ── Cloud storage — ecosystem signals
    const cloudDirs = [
      { path: join(home, "Dropbox"), label: "Dropbox" },
      { path: join(home, "OneDrive"), label: "OneDrive" },
      { path: join(home, "Google Drive"), label: "Google Drive" },
      { path: join(home, "Library", "CloudStorage"), label: "iCloud" },
    ];
    const cloudFound: string[] = [];
    for (const cd of cloudDirs) {
      try {
        await stat(cd.path);
        cloudFound.push(cd.label);
      } catch {}
    }
    if (cloudFound.length > 0) {
      folderContents["Cloud storage"] = cloudFound;
    }

    // ── Obsidian vaults — knowledge worker signal
    try {
      const obsidianConfig = join(home, "Library", "Application Support", "obsidian", "obsidian.json");
      const obsRaw = await readFile(obsidianConfig, "utf-8");
      const obsData = JSON.parse(obsRaw);
      if (obsData.vaults) {
        const vaultNames = filterSensitive(
          Object.values(obsData.vaults as Record<string, any>)
            .map((v: any) => v.path ? basename(v.path) : null)
            .filter(Boolean) as string[]
        );
        if (vaultNames.length > 0) {
          folderContents["Obsidian vaults"] = vaultNames;
        }
      }
    } catch {}

    // ── Fonts — designer vs developer signal
    try {
      const userFonts = await readdir(join(home, "Library", "Fonts"));
      const fontCount = userFonts.length;
      const interestingFonts = userFonts
        .filter((f) => /fira|jetbrains|source.code|roboto|proxima|inter|sf.pro|comic.sans|monospace/i.test(f))
        .slice(0, 10);
      const fontSummary = [`${fontCount} custom fonts installed`];
      if (interestingFonts.length > 0) fontSummary.push(...interestingFonts);
      folderContents["Fonts"] = fontSummary;
    } catch {}

    // ── Detect project structures in Desktop/Documents subfolders
    const projectSignals: string[] = [];
    const projectFiles = ["package.json", "Cargo.toml", "go.mod", "requirements.txt", "pyproject.toml", "Gemfile", "pom.xml", ".git"];
    for (const dir of dirs) {
      try {
        const topEntries = await readdir(dir.path, { withFileTypes: true });
        for (const entry of topEntries) {
          if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
          const subPath = join(dir.path, entry.name);
          try {
            const subEntries = await readdir(subPath);
            for (const pf of projectFiles) {
              if (subEntries.includes(pf)) {
                projectSignals.push(`${dir.label}/${entry.name} [${pf}]`);
                break;
              }
            }
          } catch {}
        }
      } catch {}
    }
    if (projectSignals.length > 0) {
      folderContents["Projects detected"] = filterSensitive(projectSignals);
    }

    // ── Git commit time analysis — reveals TRUE work schedule
    const commitHours = new Array(24).fill(0);
    let totalCommits = 0;
    const weekendCommits = { count: 0, total: 0 };
    for (const dir of dirs) {
      try {
        const topEntries = await readdir(dir.path, { withFileTypes: true });
        for (const entry of topEntries) {
          if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
          const gitDir = join(dir.path, entry.name, ".git");
          try {
            await stat(gitDir);
            const logRaw = execSync(
              `git -C "${join(dir.path, entry.name)}" log --format='%ai' --since='3 months ago' -200 2>/dev/null`,
              { encoding: "utf-8", timeout: 5000 }
            );
            for (const line of logRaw.trim().split("\n")) {
              if (!line) continue;
              const match = line.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
              if (match) {
                const hour = parseInt(match[4]);
                commitHours[hour]++;
                totalCommits++;
                const date = new Date(`${match[1]}-${match[2]}-${match[3]}`);
                const day = date.getDay();
                weekendCommits.total++;
                if (day === 0 || day === 6) weekendCommits.count++;
              }
            }
          } catch {}
        }
      } catch {}
    }
    if (totalCommits > 10) {
      const peakHour = commitHours.indexOf(Math.max(...commitHours));
      const earlyBird = commitHours.slice(5, 10).reduce((a, b) => a + b, 0);
      const nightOwl = commitHours.slice(20, 24).reduce((a, b) => a + b, 0) + commitHours.slice(0, 5).reduce((a, b) => a + b, 0);
      const workHours = commitHours.slice(9, 18).reduce((a, b) => a + b, 0);

      const pattern: string[] = [];
      pattern.push(`${totalCommits} commits analyzed (last 3 months)`);
      pattern.push(`Peak hour: ${peakHour}:00`);
      if (earlyBird > totalCommits * 0.3) pattern.push("Early bird pattern");
      else if (nightOwl > totalCommits * 0.2) pattern.push("Night owl pattern");
      if (weekendCommits.count > weekendCommits.total * 0.15) pattern.push(`Weekend worker (${Math.round(weekendCommits.count / weekendCommits.total * 100)}% on weekends)`);

      // Distribution summary
      const morningPct = Math.round(commitHours.slice(6, 12).reduce((a, b) => a + b, 0) / totalCommits * 100);
      const afternoonPct = Math.round(commitHours.slice(12, 18).reduce((a, b) => a + b, 0) / totalCommits * 100);
      const eveningPct = Math.round(commitHours.slice(18, 24).reduce((a, b) => a + b, 0) / totalCommits * 100);
      pattern.push(`Morning ${morningPct}% | Afternoon ${afternoonPct}% | Evening ${eveningPct}%`);

      folderContents["Work schedule (from git)"] = pattern;
    }

    // ── App usage time (macOS Screen Time) — ground truth about what they ACTUALLY use
    if (process.platform === "darwin") {
      try {
        // Query Knowledge store for app usage in last 7 days
        const knowledgeDb = join(home, "Library", "Application Support", "Knowledge", "knowledgeC.db");
        const usageRaw = execSync(
          `sqlite3 "${knowledgeDb}" "SELECT ZOBJECT.ZVALUESTRING, SUM(ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE)/60 AS minutes FROM ZOBJECT WHERE ZSTREAMNAME = '/app/usage' AND ZOBJECT.ZSTARTDATE > (strftime('%s','now','-7 days') - 978307200) GROUP BY ZOBJECT.ZVALUESTRING ORDER BY minutes DESC LIMIT 20;" 2>/dev/null`,
          { encoding: "utf-8", timeout: 5000 }
        );
        const appUsage = filterSensitive(
          usageRaw.trim().split("\n")
            .filter(Boolean)
            .map((line) => {
              const [app, mins] = line.split("|");
              const appName = app?.split(".")?.pop() ?? app;
              const hours = Math.round(parseInt(mins ?? "0") / 60);
              return hours > 0 ? `${appName} (${hours}h/week)` : `${appName} (<1h)`;
            })
        ).slice(0, 15);
        if (appUsage.length > 0) {
          folderContents["Screen Time (actual usage)"] = appUsage;
        }
      } catch {}
    }

    // ── Calendar accounts — work vs personal patterns
    if (process.platform === "darwin") {
      try {
        const calDir = join(home, "Library", "Calendars");
        const calEntries = await readdir(calDir);
        const calAccounts: string[] = [];
        for (const entry of calEntries) {
          if (entry.endsWith(".caldav") || entry.endsWith(".exchange")) {
            const infoPath = join(calDir, entry, "Info.plist");
            try {
              const info = execSync(`plutil -convert json -o - "${infoPath}" 2>/dev/null`, { encoding: "utf-8", timeout: 3000 });
              const parsed = JSON.parse(info);
              if (parsed.Title) calAccounts.push(parsed.Title);
            } catch {}
          }
        }
        if (calAccounts.length > 0) {
          folderContents["Calendar accounts"] = filterSensitive(calAccounts);
        }
      } catch {}
    }

    // ── Browser history (Chrome) — what they VISIT, not just bookmark
    try {
      const chromeHistoryPaths = [
        join(home, "Library", "Application Support", "Google", "Chrome", "Default", "History"),
        join(home, "AppData", "Local", "Google", "Chrome", "User Data", "Default", "History"),
        join(home, ".config", "google-chrome", "Default", "History"),
      ];
      for (const histPath of chromeHistoryPaths) {
        try {
          // Copy the locked DB to temp, then query
          const tmpPath = join(tmpdir(), "meport-chrome-hist.db");
          execSync(`cp "${histPath}" "${tmpPath}" 2>/dev/null`, { timeout: 3000 });
          const histRaw = execSync(
            `sqlite3 "${tmpPath}" "SELECT url FROM urls ORDER BY visit_count DESC LIMIT 100;" 2>/dev/null`,
            { encoding: "utf-8", timeout: 5000 }
          );
          execSync(`rm -f "${tmpPath}" 2>/dev/null`, { timeout: 2000 });

          // Extract domains and count
          const domainCounts = new Map<string, number>();
          for (const url of histRaw.trim().split("\n")) {
            try {
              const domain = new URL(url).hostname.replace("www.", "");
              if (domain) {
                domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
              }
            } catch {}
          }

          const topDomains = filterSensitive(
            [...domainCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 40)
              .map(([domain, count]) => `${domain} (${count}x)`)
          ).slice(0, 25);

          if (topDomains.length > 0) {
            folderContents["Browser history (top sites)"] = topDomains;
          }
          break;
        } catch {}
      }
    } catch {}

    // ── Writing voice samples — detect communication style from actual writing
    const writingSamples: string[] = [];
    const writingFilePatterns = /readme|notes|about|bio|opis|notatki|plan|idea|draft|szkic|summary/i;
    const codePatterns = /^(import |const |function |class |export |from |require|#include|package |using )/m;
    for (const dir of dirs) {
      if (writingSamples.length >= 3) break;
      try {
        const entries = await readdir(dir.path);
        for (const entry of entries) {
          if (writingSamples.length >= 3) break;
          const ext = extname(entry).toLowerCase();
          if ((ext === ".md" || ext === ".txt") && writingFilePatterns.test(entry) && !PRIVACY_PATTERNS.test(entry)) {
            try {
              const content = await readFile(join(dir.path, entry), "utf-8");
              // Skip code files
              if (codePatterns.test(content)) continue;
              // Take first 500 chars of actual prose
              const prose = content.slice(0, 500).trim();
              if (prose.length > 50) {
                writingSamples.push(`[${entry}]: "${prose.slice(0, 200)}..."`);
              }
            } catch {}
          }
        }
      } catch {}
    }
    if (writingSamples.length > 0) {
      folderContents["Writing samples (style detection)"] = writingSamples;
    }

    const totalFiles = Object.values(folderContents).reduce((a, b) => a + b.length, 0);
    scanSpin.succeed(
      pl ? `${totalFiles} elementów przejrzanych` : `${totalFiles} items scanned`
    );
    console.log();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: AI ANALYZES NAMES → shows what it understood
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const aiSpin = ora(pl ? "🧠 Analizuję co widzę..." : "🧠 Analyzing what I see...").start();

    const systemInfo = Object.entries(knownDims)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    try {
      // Build full scan data for AI — include ALL sources
      const scanSections: string[] = [];
      for (const [label, items] of Object.entries(folderContents)) {
        if (items.length > 0) {
          scanSections.push(`### ${label}\n${items.join("\n")}`);
        }
      }

      const analysisResponse = await client.generate(
        `You are meport — an AI that builds deep profiles of people by analyzing their computer.

You have scanned this person's FOLDER STRUCTURE (recursive, 2 levels deep), FILE NAMES, INSTALLED APPS, PINNED DOCK APPS, HOMEBREW PACKAGES, BROWSER BOOKMARKS (with domains), RECENTLY MODIFIED FILES, and DETECTED PROJECTS. You have NOT read file content — only names, paths, and metadata.

System info:
${systemInfo || "none detected"}

${scanSections.join("\n\n")}

## Your task
Build a RICH, DETAILED analysis organized into sections. Think like a detective — every file name, folder name, app, bookmark domain, recently modified file, and project structure tells a story.

Key signals to look for:
- **Folder structure**: subfolders reveal project organization and work relationships (e.g. "Desktop/ClientX/" + "Documents/Contract-ClientX.pdf" = work relationship)
- **Recently modified files**: show current focus and active projects
- **Bookmark domains**: reveal services, tools, interests (e.g. figma.com = design, github.com = code)
- **Bookmark folders**: organized categories reveal interests and priorities
- **Projects detected**: package.json/Cargo.toml/go.mod reveal tech stack per project
- **Dock + recently used apps**: what they use DAILY vs what's just installed
- **Homebrew packages**: developer tools, CLI habits, system preferences
- **File dates**: recent activity patterns

Cross-reference clues. Be specific about WHAT you see and WHY you think it means something.

## Inference Framework — INFER these from evidence:
- **ROLE**: employee / freelancer / founder / student / hybrid
- **SENIORITY**: junior / mid / senior / lead / executive (from tool complexity, project count, org patterns)
- **WORK_STYLE**: solo / small team / manager / corporate (from collaboration tools, project structure)
- **LIFE_STAGE**: student / early career / mid career / established / transitioning
- **TECH_DEPTH**: dabbler / competent / expert / polyglot (from language count, tool diversity, shell history)
- **ORGANIZATION**: chaotic / messy / functional / organized / obsessive (from folder structure, file naming)
- **CREATIVE_VS_ANALYTICAL**: from tool mix (Figma+Canva = creative, Excel+Python = analytical, both = hybrid)

## Absence Analysis — what's MISSING is as informative as what's present:
- No code editors = not a developer
- No design tools = not a designer
- No spreadsheets = not data-oriented
- No collaboration tools (Slack, Teams) = solo worker or very small team
- No cloud storage = local-only worker
- Empty Desktop = organized or new computer
- 500+ files in Downloads = doesn't clean up (ADHD signal?)

## Meta-patterns — look at the SHAPE of data:
- Many small projects vs few large ones = exploration vs depth
- Clean folder names vs messy = organization level
- Recent files heavily in one area = current obsession/focus
- Apps installed but not in "recently used" = aspirational tools
- Multiple browsers = power user or testing

## Output STRICT JSON:
{
  "sections": [
    {
      "icon": "👤",
      "title": "${pl ? "Kim jesteś" : "Who you are"}",
      "findings": ["Name: X (from folder/git)", "Based in: Y (from timezone)"],
      "confidence": "high"
    },
    {
      "icon": "💼",
      "title": "${pl ? "Praca — co widzę" : "Work — what I see"}",
      "findings": ["Finding 1 with EVIDENCE (from folder X)", "Finding 2 (file Y suggests...)"],
      "confidence": "medium",
      "questions": ["Is X your client or employer?", "What is B4?"]
    },
    {
      "icon": "🛠️",
      "title": "${pl ? "Narzędzia" : "Tools"}",
      "findings": ["Design: app1, app2", "Code: app3, app4", "AI: app5, app6"],
      "confidence": "high"
    },
    {
      "icon": "📁",
      "title": "${pl ? "Ciekawe rzeczy" : "Interesting findings"}",
      "findings": ["Folder X suggests...", "File Y could mean..."],
      "confidence": "low",
      "questions": ["What is this about?"]
    }
  ],
  "dimensions": {
    "identity.preferred_name": "name if found",
    "context.occupation": "inferred occupation",
    "context.industry": "inferred industry",
    "expertise.tools_design": "design tools",
    "expertise.tools_code": "code tools",
    "expertise.tools_ai": "AI tools",
    "expertise.tools_office": "office tools",
    "expertise.tech_stack": "tech from project files",
    "context.projects": "visible projects/clients",
    "context.possible_employer": "company name if visible",
    "lifestyle.gaming": "games if detected",
    "lifestyle.hobbies": "hobbies if visible",
    "context.role_type": "employee/freelancer/founder/student",
    "context.seniority": "junior/mid/senior/lead",
    "work.style": "solo/team/manager",
    "personality.organization_level": "messy/functional/organized",
    "context.current_obsession": "what they're focused on THIS WEEK from recent files",
    "context.aspirational_tools": "tools installed but not recently used",
    "ai.dream_interaction": "what type of AI interaction would be ideal based on their tools, workflow, and tech level"
  },
  "interesting_files": ["file1.ext", "file2.ext"],
  "interesting_files_reasons": {"file1.ext": "why interesting", "file2.ext": "reason"},
  "open_questions": ["Things you noticed but can't determine from names alone"]
}

${pl ? "WRITE ALL FINDINGS IN POLISH." : "Write findings in English."}
Be SPECIFIC — don't say "you seem technical", say "You have Docker, DBeaver and VS Code — you work with databases and containers."
Cross-reference: if Desktop has "ClientX" folders AND Documents has "Contract-ClientX" → strong evidence of work relationship.
Include EVERYTHING interesting — even small clues (games, personal files, subscriptions).
Only include dimensions you're reasonably confident about.${langForce}`
      );

      aiSpin.succeed(pl ? "Przeanalizowałem Twój komputer" : "Computer analyzed");

      const analysis = parseJSON(analysisResponse);

      // Show rich structured analysis
      if (analysis.sections) {
        console.log();
        for (const section of analysis.sections) {
          console.log(`  ${section.icon || "📌"} ${BOLD(section.title)}`);
          if (section.findings) {
            for (const finding of section.findings) {
              console.log(`    ${finding}`);
            }
          }
          if (section.questions) {
            for (const q of section.questions) {
              console.log(`    ${YELLOW("?")} ${DIM(q)}`);
            }
          }
          console.log();
        }
      } else if (analysis.summary) {
        console.log();
        console.log(CYAN("  " + analysis.summary));
        console.log();
      }

      // Merge dimensions
      if (analysis.dimensions) {
        for (const [k, v] of Object.entries(analysis.dimensions)) {
          if (v && typeof v === "string" && v.length > 0 && v !== "none" && v !== "unknown" && v !== "not detected") {
            knownDims[k] = v;
          }
        }
      }

      // Show open questions from analysis
      if (analysis.open_questions && analysis.open_questions.length > 0) {
        console.log(BOLD(pl ? "  ❓ Chciałbym się upewnić:\n" : "  ❓ I'd like to verify:\n"));
        for (const q of analysis.open_questions) {
          console.log(`    ${DIM(q)}`);
        }
        console.log();
      }

      // Verify — let user react, correct, add context
      const reaction = await select({
        message: pl ? "Co myślisz?" : "What do you think?",
        choices: [
          { name: pl ? "✅ Zgadza się!" : "✅ Looks right!", value: "correct" },
          { name: pl ? "✏️  Prawie — poprawię kilka rzeczy" : "✏️  Almost — let me fix a few things", value: "fix" },
          { name: pl ? "❌ Nie bardzo — opowiem sam" : "❌ Not really — I'll tell you myself", value: "manual" },
        ],
      });

      if (reaction === "fix" || reaction === "manual") {
        const fix = await input({
          message: pl
            ? "Powiedz mi — co jest inaczej? Co do czego służy? (pisz swobodnie)"
            : "Tell me — what's different? What is what? (write freely)",
        });
        if (fix.trim()) {
          knownDims["context.user_corrections"] = fix.trim();
          // This will be fed to the AI interviewer as important context
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP 4: OFFER TO READ SPECIFIC FILES
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      const interestingFiles = (analysis.interesting_files as string[]) || [];
      const fileReasons = (analysis.interesting_files_reasons as Record<string, string>) || {};

      if (interestingFiles.length > 0) {
        // Find actual file paths
        const foundFiles: { name: string; path: string; reason: string }[] = [];
        for (const fileName of interestingFiles) {
          if (PRIVACY_PATTERNS.test(fileName)) continue;
          for (const dir of dirs) {
            const fullPath = join(dir.path, fileName);
            try {
              const s = await stat(fullPath);
              if (s.size < 512 * 1024) { // 512KB max
                foundFiles.push({
                  name: fileName,
                  path: fullPath,
                  reason: fileReasons[fileName] || "",
                });
                break;
              }
            } catch {}
          }
        }

        if (foundFiles.length > 0) {
          console.log(
            pl
              ? DIM("\n  Znalazłem pliki które mogłyby powiedzieć mi więcej:\n")
              : DIM("\n  Found files that could tell me more:\n")
          );
          for (const f of foundFiles) {
            console.log(`    ${BOLD(f.name)} ${f.reason ? DIM("— " + f.reason) : ""}`);
          }
          console.log();

          if (!isLocal) {
            console.log(
              YELLOW(pl
                ? `    ⚠ Treść plików zostanie wysłana do ${providerLabel}.\n`
                : `    ⚠ File content will be sent to ${providerLabel}.\n`)
            );
          }

          const readChoice = await confirm({
            message: pl
              ? "Przeczytać te pliki?"
              : "Read these files?",
            default: false,
          });

          if (readChoice) {
            const filesData: { name: string; content: string }[] = [];
            for (const f of foundFiles) {
              try {
                const content = await readFile(f.path, "utf-8");
                filesData.push({ name: f.name, content });
              } catch {}
            }

            if (filesData.length > 0) {
              // We'll pass these to the interviewer later
              // For now, store a flag
              knownDims["_files_read"] = filesData.map((f) => f.name).join(", ");

              // Quick AI analysis of file content
              const readSpin = ora(pl ? "🧠 Czytam..." : "🧠 Reading...").start();

              try {
                const fileAnalysis = await client.generate(
                  `Analyze these files about ${knownDims["identity.preferred_name"] || "this person"}. Extract useful profile information.

${filesData.map((f) => `### ${f.name}\n\`\`\`\n${f.content.slice(0, 3000)}\n\`\`\``).join("\n\n")}

Output JSON:
{
  "summary": "1-2 sentence summary of what you learned from the files. ${pl ? "PO POLSKU." : ""}",
  "dimensions": {
    "dimension.key": "value"
  }
}${langForce}`
                );

                readSpin.succeed(pl ? "Przeczytałem" : "Read");

                const fileParsed = parseJSON(fileAnalysis);
                if (fileParsed.summary) {
                  console.log(CYAN("\n  " + fileParsed.summary + "\n"));
                }
                if (fileParsed.dimensions) {
                  for (const [k, v] of Object.entries(fileParsed.dimensions)) {
                    if (v && typeof v === "string" && v.length > 0) {
                      knownDims[k] = v;
                    }
                  }
                }
              } catch (err: any) {
                readSpin.warn(err.message);
              }
            }
          }
        }
      }

      // Show what AI still needs to ask
      const questionsNeeded = (analysis.open_questions as string[]) || [];
      if (questionsNeeded.length > 0) {
        console.log(
          DIM(pl
            ? `\n  Zostało mi kilka pytań o: ${questionsNeeded.slice(0, 3).join(", ")}\n`
            : `\n  Still need to ask about: ${questionsNeeded.slice(0, 3).join(", ")}\n`)
        );
      }

    } catch (err: any) {
      aiSpin.warn(err.message);
      // Scan failed — we still have system dims, continue to interview
    }

  } else {
    // NO SCAN — ask name only, rest in interview
    const nameInput = await input({
      message: pl ? "Jak masz na imię?" : "What's your name?",
    });
    knownDims["identity.preferred_name"] = nameInput.trim() || "User";
  }

  console.log();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 4b: ANTI-PATTERNS (quick checkbox — critical for export quality)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // One quick checkbox before the interview — high-impact, 5 seconds

  const antiPatterns = await checkbox({
    message: pl ? "Czego AI NIGDY nie powinno robić z Tobą?" : "What should AI NEVER do with you?",
    choices: [
      { name: pl ? "Używać emoji" : "Use emoji", value: "no_emoji" },
      { name: pl ? "Zaczynać od 'Świetne pytanie!'" : "Start with 'Great question!'", value: "no_praise" },
      { name: pl ? "Lać wodę / hedgować" : "Hedge / be overly cautious", value: "no_hedging" },
      { name: pl ? "Traktować jak początkującego" : "Assume I need hand-holding", value: "no_handholding" },
      { name: pl ? "Pisać więcej niż pytałem" : "Write more than asked", value: "no_overwriting" },
      { name: pl ? "Przepraszać nadmiernie" : "Apologize excessively", value: "no_apologies" },
      { name: pl ? "Używać korporacyjnego języka" : "Use corporate language", value: "no_corporate" },
    ],
  });

  if (antiPatterns.length > 0) {
    knownDims["communication.anti_patterns"] = JSON.stringify(antiPatterns);
  }

  console.log();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 5: AI INTERVIEW — ONLY about gaps
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const dimCount = Object.keys(knownDims).filter((k) => !k.startsWith("_")).length;
  const maxRounds = dimCount > 8 ? 6 : dimCount > 4 ? 8 : 12;

  console.log(
    BOLD(pl
      ? `━━━ ${dimCount > 5 ? "Kilka pytań o to czego nie wiem" : "Poznajmy się"} ━━━\n`
      : `━━━ ${dimCount > 5 ? "A few questions about what I don't know" : "Getting to know you"} ━━━\n`)
  );
  console.log(DIM(pl ? "  /koniec = zakończ wcześniej\n" : "  /done = finish early\n"));

  const interviewer = new AIInterviewer({
    client,
    locale: pl ? "pl" : "en",
    knownDimensions: knownDims,
    maxRounds,
  });

  // Ctrl+C handler — save progress
  const sigintHandler = async () => {
    console.log("\n");
    const s = ora(pl ? "Zapisuję postęp..." : "Saving progress...").start();
    try {
      const partialProfile = interviewer.buildProfile();
      await writeFile(options.output, JSON.stringify(partialProfile, null, 2), "utf-8");
      s.succeed(pl
        ? `Postęp zapisany w ${options.output}. Uruchom ponownie żeby kontynuować.`
        : `Progress saved to ${options.output}. Run again to continue.`);
    } catch {
      s.fail(pl ? "Nie udało się zapisać" : "Could not save");
    }
    process.exit(0);
  };
  process.on("SIGINT", sigintHandler);

  const phaseLabels = pl
    ? ["", "Start", "Historia", "Jak pracujesz", "Kontekst", "Podsumowanie"]
    : ["", "Start", "Your story", "How you work", "Context", "Summary"];

  let round = await interviewer.start();

  // Show progress
  const showProg = (phase: number, depth: number) => {
    const f = Math.round(Math.min(100, Math.max(0, depth)) / 5);
    const e = 20 - f;
    console.log(DIM(`  [${GREEN("█".repeat(f))}${DIM("░".repeat(e))}] ${phase}/5 — ${phaseLabels[phase] || ""} (${depth}%)`));
  };

  showProg(round.phase, round.depth);
  console.log();
  console.log(CYAN("  meport: ") + round.aiMessage);
  console.log();

  while (!round.complete) {
    const userInput = await input({ message: "›" });
    if (!userInput.trim()) {
      console.log(DIM(pl ? "  Wpisz coś, lub /koniec żeby zakończyć" : "  Type something, or /done to finish"));
      continue;
    }
    if (userInput.trim().toLowerCase() === "/done" || userInput.trim().toLowerCase() === "/koniec") break;

    const spin = ora({ text: DIM("..."), spinner: "dots" }).start();
    try {
      round = await interviewer.respond(userInput);
      spin.stop();
      showProg(round.phase, round.depth);

      // Show latest export rule
      const rules = interviewer.getExportRules();
      const latest = [...rules.values()].pop();
      if (latest && rules.size % 2 === 0) {
        console.log(DIM(`    → ${latest}`));
      }

      console.log();
      console.log(CYAN("  meport: ") + round.aiMessage);
      console.log();
    } catch (err: any) {
      spin.fail("AI error: " + err.message);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 6: BUILD + EXPORT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Save interview transcript for debugging
  try {
    const transcript = interviewer.getTranscript();
    const transcriptDir = join(homedir(), ".meport");
    await mkdir(transcriptDir, { recursive: true });
    await writeFile(
      join(transcriptDir, "last-interview.json"),
      JSON.stringify(transcript, null, 2),
      "utf-8"
    );
  } catch {}

  const buildSpin = ora(pl ? "Buduję profil..." : "Building profile...").start();
  const profile = interviewer.buildProfile();
  const exportRules = interviewer.getExportRules();

  let packRules = new Map<string, string>();
  try {
    const packs = await loadPacks(getAvailablePackIds());
    packRules = collectPackExportRules(packs);
  } catch {}
  for (const [k, v] of exportRules) packRules.set(k, v);

  const rules = collectRules(profile, packRules);
  buildSpin.succeed(
    `${Object.keys(profile.explicit).length} ${pl ? "wymiarów" : "dims"}, ${rules.length} ${pl ? "reguł" : "rules"}`
  );

  // Show profile
  console.log(BOLD(pl ? "\n━━━ Twój profil ━━━\n" : "\n━━━ Your profile ━━━\n"));

  const groups = new Map<string, [string, any][]>();
  for (const [key, val] of Object.entries(profile.explicit)) {
    const cat = key.split(".")[0];
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push([key, val]);
  }
  for (const [cat, dims] of groups) {
    console.log(`  ${BOLD(cat)}`);
    for (const [key, val] of dims) {
      const label = key.split(".").pop()?.replace(/_/g, " ") ?? key;
      const v = Array.isArray(val.value) ? val.value.join(", ") : String(val.value);
      console.log(`    ${DIM(label + ":")} ${v}`);
    }
    console.log();
  }

  // Show rules
  console.log(BOLD(pl ? "━━━ Reguły dla AI ━━━\n" : "━━━ AI Rules ━━━\n"));
  for (let i = 0; i < Math.min(rules.length, 10); i++) {
    console.log(`  ${GREEN(`${i + 1}.`)} ${rules[i].rule}`);
  }
  if (rules.length > 10) console.log(DIM(`  +${rules.length - 10} more`));
  console.log();
  console.log(`  ${completenessBar(profile.completeness)}`);

  // Confirm
  const ok = await confirm({
    message: pl ? "Eksportować?" : "Export?",
    default: true,
  });
  if (!ok) {
    const fix = await input({ message: pl ? "Co zmienić?" : "What to fix?" });
    if (fix.trim()) packRules.set("custom", fix.trim());
  }

  // Save + export
  const { recomputeProfile } = await import("@meport/core");
  recomputeProfile(profile);
  await writeFile(options.output, JSON.stringify(profile, null, 2), "utf-8");
  const { saveSnapshot } = await import("./history.js");
  await saveSnapshot(options.output);
  console.log(GREEN("  ✓ ") + CYAN(options.output));

  const exportDir = join(dirname(options.output), "meport-exports");
  try {
    const results = compileAllRules(profile, packRules);
    await mkdir(exportDir, { recursive: true });
    for (const [, res] of results) {
      await writeFile(join(exportDir, res.filename), res.content, "utf-8");
    }
    console.log(GREEN("  ✓ ") + `${results.size} platforms → ${CYAN(exportDir + "/")}`);

    for (const [platform, res] of results) {
      console.log(`    ${GREEN("✓")} ${platform} → ${res.filename}`);
    }

    // Clipboard
    const chatgpt = results.get("chatgpt" as any);
    if (chatgpt) {
      const { copyToClipboard } = await import("../utils/clipboard.js");
      if (copyToClipboard(chatgpt.content)) {
        console.log(GREEN("\n  📋 ") + (pl
          ? "ChatGPT w schowku! Wklej: Settings → Personalization"
          : "ChatGPT copied! Paste: Settings → Personalization"));
      }
    }
  } catch {}

  // Instructions
  console.log(BOLD(pl ? "\n━━━ Jak użyć ━━━\n" : "\n━━━ How to use ━━━\n"));
  console.log(pl
    ? `  ${CYAN("ChatGPT")} → Już w schowku! Settings → Personalization → Wklej`
    : `  ${CYAN("ChatGPT")} → Already copied! Settings → Personalization → Paste`);
  console.log(pl
    ? `  ${CYAN("Claude")}  → ${exportDir}/meport-profile.md → Projects → Instructions`
    : `  ${CYAN("Claude")}  → ${exportDir}/meport-profile.md → Projects → Instructions`);
  console.log(pl
    ? `  ${CYAN("Cursor")} → ${exportDir}/meport.mdc → root projektu`
    : `  ${CYAN("Cursor")} → ${exportDir}/meport.mdc → project root`);
  console.log();
  console.log(GREEN("✓ ") + BOLD(pl ? "Gotowe!" : "Done!"));
  console.log();

  // Clean up Ctrl+C handler
  process.removeListener("SIGINT", sigintHandler);

  // Auto-deploy offer (Rule of 3: profile → deploy → done)
  const wantDeploy = await confirm({
    message: pl
      ? "Wdrożyć do projektów? (Cursor, Claude Code, Copilot...)"
      : "Deploy to projects? (Cursor, Claude Code, Copilot...)",
    default: true,
  });

  if (wantDeploy) {
    const { deployCommand } = await import("./deploy.js");
    await deployCommand({ profile: options.output, lang: options.lang, all: true });
  }

  // Go to shell menu
  await shellCommand({ profile: options.output, lang: options.lang });
}

/**
 * Recursively scan folder names (not content) up to given depth.
 * Returns entries with relative paths to show folder structure.
 * E.g. ["project-B4/", "project-B4/assets/", "ClientX/", "ClientX/Contract.pdf", "notes.md"]
 */
async function scanFolderRecursive(
  dirPath: string,
  maxDepth: number,
  prefix = "",
  depth = 0
): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (PRIVACY_PATTERNS.test(entry.name)) continue;
      // Skip heavy dirs that pollute results
      if (["node_modules", ".git", "__pycache__", ".next", "dist", "build", ".cache", "target"].includes(entry.name)) continue;

      const relativeName = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        results.push(relativeName + "/");
        if (depth < maxDepth) {
          const sub = await scanFolderRecursive(
            join(dirPath, entry.name),
            maxDepth,
            relativeName,
            depth + 1
          );
          results.push(...sub);
        }
      } else {
        results.push(relativeName);
      }
    }
  } catch {}
  return results.slice(0, 150); // Cap per top-level folder
}

function parseJSON(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return { summary: text };
}
