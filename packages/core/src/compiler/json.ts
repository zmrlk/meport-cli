/**
 * Meport JSON Compiler
 *
 * Canonical export format — the full profile with all layers,
 * confidence scores, and metadata. For developer integration
 * and backup/import.
 */

import { BaseCompiler } from "./base.js";
import type {
  PersonaProfile,
  ExportResult,
  ExportCompilerConfig,
} from "../schema/types.js";

export class JsonCompiler extends BaseCompiler {
  readonly config: ExportCompilerConfig = {
    platform: "Meport JSON",
    format: "json",
    charLimit: null,
    tokenLimit: null,
    priority: "P0",
  };

  compile(profile: PersonaProfile): ExportResult {
    const content = JSON.stringify(profile, null, 2);

    return this.buildResult(
      content,
      "meport-profile.json",
      "Import into any Meport-compatible tool, or use as a developer integration format.",
      this.collectDimensions(profile),
      Object.keys(profile.explicit).length +
        Object.keys(profile.inferred).length +
        Object.keys(profile.compound).length +
        profile.emergent.filter(
          (e) => e.status === "accepted" || e.status === "edited"
        ).length
    );
  }
}
