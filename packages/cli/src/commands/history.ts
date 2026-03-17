/**
 * meport history — Profile version history
 *
 * Tracks changes over time. Every refresh/update creates a snapshot.
 * Shows timeline of who you were → who you are now.
 */

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { PersonaProfile } from "@meport/core";
import {
  GREEN,
  BOLD,
  CYAN,
  DIM,
  RED,
  YELLOW,
} from "../ui/display.js";

const HISTORY_DIR = join(homedir(), ".meport", "history");

interface HistoryOptions {
  profile: string;
  lang?: string;
}

/**
 * Save a snapshot of the current profile to history.
 * Called automatically after profile creation, update, or refresh.
 */
export async function saveSnapshot(profilePath: string): Promise<void> {
  try {
    const raw = await readFile(profilePath, "utf-8");
    const profile = JSON.parse(raw) as PersonaProfile;

    await mkdir(HISTORY_DIR, { recursive: true });

    const date = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const dims = Object.keys(profile.explicit).length;
    const filename = `${date}_${dims}dims.json`;

    await writeFile(
      join(HISTORY_DIR, filename),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        completeness: profile.completeness,
        dimensions: dims,
        compounds: Object.keys(profile.compound).length,
        // Store only explicit dimensions (not full profile — saves space)
        explicit: profile.explicit,
      }, null, 2),
      "utf-8"
    );
  } catch {
    // Silent fail — history is optional
  }
}

export async function historyCommand(options: HistoryOptions): Promise<void> {
  const pl = (options.lang ?? "").startsWith("pl") ||
    (!options.lang && (process.env.LANG ?? "").startsWith("pl"));

  console.log(BOLD(pl ? "\n━━━ Historia profilu ━━━\n" : "\n━━━ Profile History ━━━\n"));

  try {
    const files = await readdir(HISTORY_DIR);
    const snapshots = files
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();

    if (snapshots.length === 0) {
      console.log(DIM(pl ? "  Brak historii. Po pierwszym odświeżeniu pojawi się tutaj." : "  No history yet. Will appear after first refresh."));
      return;
    }

    // Show timeline
    for (let i = 0; i < Math.min(snapshots.length, 10); i++) {
      const raw = await readFile(join(HISTORY_DIR, snapshots[i]), "utf-8");
      const snap = JSON.parse(raw);
      const date = new Date(snap.timestamp);
      const dateStr = date.toLocaleDateString(pl ? "pl" : "en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const timeStr = date.toLocaleTimeString(pl ? "pl" : "en", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const icon = i === 0 ? GREEN("●") : DIM("○");
      console.log(
        `  ${icon} ${BOLD(dateStr)} ${DIM(timeStr)} — ${snap.dimensions} ${pl ? "wymiarów" : "dims"}, ${Math.round(snap.completeness)}%`
      );

      // Show diff with previous snapshot
      if (i < snapshots.length - 1) {
        const prevRaw = await readFile(join(HISTORY_DIR, snapshots[i + 1]), "utf-8");
        const prev = JSON.parse(prevRaw);

        const added = Object.keys(snap.explicit).filter((k: string) => !prev.explicit[k]);
        const removed = Object.keys(prev.explicit).filter((k: string) => !snap.explicit[k]);
        const changed = Object.keys(snap.explicit).filter((k: string) => {
          if (!prev.explicit[k]) return false;
          const newVal = JSON.stringify(snap.explicit[k].value);
          const oldVal = JSON.stringify(prev.explicit[k].value);
          return newVal !== oldVal;
        });

        if (added.length > 0) {
          console.log(GREEN(`      +${added.length} ${pl ? "nowych" : "new"}: ${added.slice(0, 3).map((k: string) => k.split(".").pop()).join(", ")}${added.length > 3 ? "..." : ""}`));
        }
        if (changed.length > 0) {
          console.log(YELLOW(`      ~${changed.length} ${pl ? "zmienionych" : "changed"}: ${changed.slice(0, 3).map((k: string) => k.split(".").pop()).join(", ")}${changed.length > 3 ? "..." : ""}`));
        }
        if (removed.length > 0) {
          console.log(RED(`      -${removed.length} ${pl ? "usuniętych" : "removed"}`));
        }
      }
    }

    if (snapshots.length > 10) {
      console.log(DIM(`\n  +${snapshots.length - 10} ${pl ? "starszych wersji" : "older versions"} w ~/.meport/history/`));
    }

    console.log();
  } catch {
    console.log(DIM(pl ? "  Brak historii." : "  No history."));
  }
}
