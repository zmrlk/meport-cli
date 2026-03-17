/**
 * Browser File Scanner — uses File System Access API
 * Scans folder/file NAMES only (not content) for profiling.
 * Privacy-first: never reads file content without explicit consent.
 */

// Privacy patterns — same as CLI version
const PRIVACY_PATTERNS =
  /password|credential|secret|private|token|\.env|\.ssh|\.aws|\.gnupg|medical|legal|divorce|tax|bank.?statement|credit.?card|payroll|salary|nda|confidential|hipaa|ssn|passport|therapy|prescription|insurance|keychain|\.pem$|\.key$|doctor|hospital|diagnos|psychiatr|psycholog|rehab|addiction|tinder|bumble|hinge|grindr|onlyfans|porn|xxx|adult|dating|escort|payslip|tax.?return|kredyt|po.?yczka|lawyer|court|lawsuit|custody|id_rsa|private.?key|pesel|birth.?cert|substance/i;

export interface ScanResult {
  /** Folder names found (privacy-filtered) */
  folders: string[];
  /** File names found (privacy-filtered, no content) */
  files: string[];
  /** File type distribution */
  fileTypes: Record<string, number>;
  /** Total items scanned */
  totalScanned: number;
  /** Items filtered for privacy */
  privacyFiltered: number;
}

export interface FileToRead {
  name: string;
  handle: FileSystemFileHandle;
}

/**
 * Check if File System Access API is available
 */
export function isFileScanAvailable(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/**
 * Prompt user to pick a directory and scan file/folder names.
 * Returns names only — never reads content.
 * @param maxDepth Maximum directory recursion depth (default: 2)
 */
export async function scanDirectory(maxDepth = 2): Promise<ScanResult> {
  if (!isFileScanAvailable()) {
    throw new Error("File System Access API not available in this browser");
  }

  const dirHandle = await (window as any).showDirectoryPicker({ mode: "read" });

  const folders: string[] = [];
  const files: string[] = [];
  const fileTypes: Record<string, number> = {};
  let totalScanned = 0;
  let privacyFiltered = 0;

  async function walk(handle: FileSystemDirectoryHandle, depth: number, path: string) {
    if (depth > maxDepth) return;

    for await (const entry of (handle as any).values()) {
      totalScanned++;
      const fullPath = path ? `${path}/${entry.name}` : entry.name;

      // Privacy filter
      if (PRIVACY_PATTERNS.test(entry.name)) {
        privacyFiltered++;
        continue;
      }

      if (entry.kind === "directory") {
        // Skip hidden folders and node_modules
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "__pycache__") {
          continue;
        }
        folders.push(fullPath);
        await walk(entry, depth + 1, fullPath);
      } else {
        files.push(fullPath);
        // Track file extensions
        const ext = entry.name.includes(".")
          ? entry.name.split(".").pop()!.toLowerCase()
          : "no_extension";
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      }
    }
  }

  await walk(dirHandle, 0, "");

  return { folders, files, fileTypes, totalScanned, privacyFiltered };
}

/**
 * Prompt user to pick files for AI to read content.
 * Used after scan — user sees what was found and can select files to share.
 */
export async function pickFilesToRead(): Promise<FileToRead[]> {
  if (typeof window === "undefined") return [];

  const handles = await (window as any).showOpenFilePicker({
    multiple: true,
    types: [
      {
        description: "Documents",
        accept: {
          "text/*": [".txt", ".md", ".csv", ".json", ".yaml", ".yml"],
          "application/pdf": [".pdf"],
          "application/json": [".json"],
        },
      },
    ],
  });

  return handles.map((h: FileSystemFileHandle) => ({
    name: h.name,
    handle: h,
  }));
}

/**
 * Read content of a selected file (with user's explicit consent).
 * Truncates to maxChars to avoid sending too much to AI.
 */
export async function readFileContent(handle: FileSystemFileHandle, maxChars = 5000): Promise<string> {
  const file = await handle.getFile();
  const text = await file.text();
  return text.slice(0, maxChars);
}

/**
 * Convert scan results into a text summary for AI analysis.
 * This is what gets sent to the AI enricher — names only, no content.
 */
export function scanResultToText(result: ScanResult): string {
  const lines: string[] = [];

  lines.push(`Scanned: ${result.totalScanned} items (${result.privacyFiltered} privacy-filtered)`);
  lines.push("");

  if (result.folders.length > 0) {
    lines.push("## Folders");
    // Group by top-level
    const topLevel = new Map<string, string[]>();
    for (const f of result.folders) {
      const parts = f.split("/");
      const top = parts[0];
      if (!topLevel.has(top)) topLevel.set(top, []);
      if (parts.length > 1) topLevel.get(top)!.push(parts.slice(1).join("/"));
    }
    for (const [dir, subs] of topLevel) {
      lines.push(`${dir}/`);
      for (const sub of subs.slice(0, 10)) {
        lines.push(`  ${sub}/`);
      }
      if (subs.length > 10) lines.push(`  ... and ${subs.length - 10} more`);
    }
    lines.push("");
  }

  if (Object.keys(result.fileTypes).length > 0) {
    lines.push("## File types");
    const sorted = Object.entries(result.fileTypes).sort((a, b) => b[1] - a[1]);
    for (const [ext, count] of sorted.slice(0, 15)) {
      lines.push(`  .${ext}: ${count} files`);
    }
    lines.push("");
  }

  // Include some notable file names (first 30, for AI to analyze)
  if (result.files.length > 0) {
    lines.push("## Notable files (sample)");
    for (const f of result.files.slice(0, 30)) {
      lines.push(`  ${f}`);
    }
    if (result.files.length > 30) {
      lines.push(`  ... and ${result.files.length - 30} more files`);
    }
  }

  return lines.join("\n");
}
