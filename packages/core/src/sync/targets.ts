/**
 * Sync Targets — Platform-specific file locations
 *
 * Maps platforms to their config file paths.
 * Auto-sync for file-based (Claude Code, Cursor, Ollama).
 * Clipboard for web-based (ChatGPT, Claude web).
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile, stat, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// ─── Sync Target Definition ─────────────────────────────

export interface SyncTarget {
  platform: string;
  method: "file" | "clipboard" | "section";
  /** For file/section: where to write */
  getPath: () => string;
  /** For section: markers to find/replace the meport block */
  sectionMarkers?: { start: string; end: string };
  /** Compiler ID to use */
  compilerId: string;
}

// ─── Target Registry ─────────────────────────────────────

export const SYNC_TARGETS: SyncTarget[] = [
  {
    platform: "Claude Code",
    method: "section",
    getPath: () => {
      // Look for CLAUDE.md in cwd first, then home
      return join(process.cwd(), "CLAUDE.md");
    },
    sectionMarkers: {
      start: "<!-- meport:start -->",
      end: "<!-- meport:end -->",
    },
    compilerId: "claude-code",
  },
  {
    platform: "Cursor",
    method: "file",
    getPath: () => join(process.cwd(), ".cursor", "rules", "meport.mdc"),
    compilerId: "cursor",
  },
  {
    platform: "Ollama",
    method: "file",
    getPath: () => join(homedir(), ".ollama", "meport-system.txt"),
    compilerId: "ollama",
  },
  {
    platform: "ChatGPT",
    method: "clipboard",
    getPath: () => "",
    compilerId: "chatgpt",
  },
  {
    platform: "Claude",
    method: "clipboard",
    getPath: () => "",
    compilerId: "claude",
  },
];

// ─── Sync Operations ────────────────────────────────────

export interface SyncResult {
  platform: string;
  method: "file" | "clipboard" | "section";
  path?: string;
  success: boolean;
  error?: string;
  action: "created" | "updated" | "skipped" | "clipboard";
}

/**
 * Write compiled content to a file target.
 * Creates directories as needed.
 */
export async function syncToFile(
  target: SyncTarget,
  content: string
): Promise<SyncResult> {
  const path = target.getPath();

  try {
    await mkdir(dirname(path), { recursive: true });

    let action: "created" | "updated" = "created";
    try {
      await stat(path);
      action = "updated";
    } catch {
      // File doesn't exist yet
    }

    await writeFile(path, content, "utf-8");

    return {
      platform: target.platform,
      method: "file",
      path,
      success: true,
      action,
    };
  } catch (err) {
    return {
      platform: target.platform,
      method: "file",
      path,
      success: false,
      error: (err as Error).message,
      action: "skipped",
    };
  }
}

/**
 * Write compiled content into a section of an existing file.
 * Uses markers to find/replace the meport block.
 * If file doesn't exist, creates it with the section.
 * If markers don't exist, appends the section.
 */
export async function syncToSection(
  target: SyncTarget,
  content: string
): Promise<SyncResult> {
  const path = target.getPath();
  const markers = target.sectionMarkers!;
  const wrappedContent = `${markers.start}\n${content}\n${markers.end}`;

  try {
    let existingContent: string;
    let action: "created" | "updated" = "created";

    try {
      existingContent = await readFile(path, "utf-8");
      action = "updated";
    } catch {
      // File doesn't exist — create with section
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, wrappedContent + "\n", "utf-8");
      return {
        platform: target.platform,
        method: "section",
        path,
        success: true,
        action: "created",
      };
    }

    // Check if markers exist
    const startIdx = existingContent.indexOf(markers.start);
    const endIdx = existingContent.indexOf(markers.end);

    let newContent: string;
    if (startIdx !== -1 && endIdx !== -1) {
      // Replace existing section
      newContent =
        existingContent.substring(0, startIdx) +
        wrappedContent +
        existingContent.substring(endIdx + markers.end.length);
    } else {
      // Append section
      newContent = existingContent.trimEnd() + "\n\n" + wrappedContent + "\n";
    }

    await writeFile(path, newContent, "utf-8");

    return {
      platform: target.platform,
      method: "section",
      path,
      success: true,
      action,
    };
  } catch (err) {
    return {
      platform: target.platform,
      method: "section",
      path,
      success: false,
      error: (err as Error).message,
      action: "skipped",
    };
  }
}

/**
 * Get all auto-syncable targets (file-based only).
 */
export function getAutoSyncTargets(): SyncTarget[] {
  return SYNC_TARGETS.filter(
    (t) => t.method === "file" || t.method === "section"
  );
}

/**
 * Get clipboard targets.
 */
export function getClipboardTargets(): SyncTarget[] {
  return SYNC_TARGETS.filter((t) => t.method === "clipboard");
}
