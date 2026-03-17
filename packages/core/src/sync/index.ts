/**
 * Sync Module — Keep exports in sync with profile
 *
 * `meport sync` regenerates all exports from current profile
 * and writes them to platform config locations.
 */

export {
  SYNC_TARGETS,
  getAutoSyncTargets,
  getClipboardTargets,
  syncToFile,
  syncToSection,
  type SyncTarget,
  type SyncResult,
} from "./targets.js";
