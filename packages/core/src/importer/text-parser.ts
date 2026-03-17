/**
 * Parse pasted AI instructions (from ChatGPT, Claude, Cursor, etc.)
 * into profile dimensions. Rule-based extraction — no AI needed.
 */

import type { PersonaProfile, DimensionValue, InferredValue } from "../schema/types.js";

interface ParseResult {
  explicit: Record<string, DimensionValue>;
  inferred: Record<string, InferredValue>;
  exportRules: string[];
  name?: string;
  language?: string;
}

// ─── Pattern matchers ───────────────────────────────────────

const NAME_PATTERNS = [
  /(?:my name is|i'm|i am|name:\s*|nazywam się)\s*([A-ZÀ-Ž][a-zà-ž]+)/i,
  /^([A-ZÀ-Ž][a-zà-ž]+)\s*(?:here|tutaj)/im,
];

const LANGUAGE_PATTERNS: [RegExp, string][] = [
  [/(?:respond|write|answer|speak|communicate)\s+(?:in|po)\s+polsk|po polsku|w języku polskim/i, "pl"],
  [/(?:respond|write|answer)\s+in\s+(?:english|eng)/i, "en"],
  [/(?:respond|write|answer)\s+in\s+(?:german|deutsch)/i, "de"],
  [/(?:respond|write|answer)\s+in\s+(?:spanish|español)/i, "es"],
  [/(?:respond|write|answer)\s+in\s+(?:french|français)/i, "fr"],
];

const ROLE_PATTERNS: [RegExp, string][] = [
  [/\b(?:full[- ]?stack|fullstack)\s*(?:dev|developer|engineer)/i, "fullstack_developer"],
  [/\b(?:front[- ]?end|frontend)\s*(?:dev|developer|engineer)/i, "frontend_developer"],
  [/\b(?:back[- ]?end|backend)\s*(?:dev|developer|engineer)/i, "backend_developer"],
  [/\b(?:software|dev)\s*(?:engineer|developer)/i, "software_developer"],
  [/\b(?:data\s*scientist)/i, "data_scientist"],
  [/\b(?:product\s*manager|PM)\b/i, "product_manager"],
  [/\b(?:designer|UX|UI)/i, "designer"],
  [/\b(?:founder|CEO|entrepreneur)/i, "founder"],
  [/\b(?:student|studying|learner)/i, "student"],
  [/\b(?:writer|copywriter|journalist)/i, "writer"],
  [/\b(?:manager|team lead|tech lead)/i, "manager"],
  [/\b(?:researcher|scientist)/i, "researcher"],
];

const TECH_PATTERNS: [RegExp, string][] = [
  [/\b(?:typescript|ts)\b/i, "TypeScript"],
  [/\b(?:javascript|js)\b/i, "JavaScript"],
  [/\b(?:python|py)\b/i, "Python"],
  [/\b(?:rust)\b/i, "Rust"],
  [/\b(?:go|golang)\b/i, "Go"],
  [/\b(?:react)\b/i, "React"],
  [/\b(?:svelte)\b/i, "Svelte"],
  [/\b(?:vue)\b/i, "Vue"],
  [/\b(?:next\.?js|nextjs)\b/i, "Next.js"],
  [/\b(?:node\.?js|nodejs)\b/i, "Node.js"],
  [/\b(?:swift)\b/i, "Swift"],
  [/\b(?:kotlin)\b/i, "Kotlin"],
  [/\b(?:java)\b(?!\s*script)/i, "Java"],
  [/\b(?:c\+\+|cpp)\b/i, "C++"],
  [/\b(?:c#|csharp|\.net)\b/i, "C#/.NET"],
  [/\b(?:ruby)\b/i, "Ruby"],
  [/\b(?:php)\b/i, "PHP"],
  [/\b(?:sql|postgres|mysql|sqlite)\b/i, "SQL"],
  [/\b(?:docker)\b/i, "Docker"],
  [/\b(?:kubernetes|k8s)\b/i, "Kubernetes"],
  [/\b(?:aws|azure|gcp|cloud)\b/i, "Cloud"],
  [/\b(?:tailwind)\b/i, "Tailwind"],
];

const AGE_PATTERNS = [
  /\b(?:i'm|i am|mam)\s+(\d{1,2})\s*(?:years?\s*old|lat|roku)\b/i,
  /\bage[:\s]+(\d{1,2})\b/i,
  /\b(\d{1,2})\s*(?:y\/?o|years?\s*old)\b/i,
];

const LOCATION_PATTERNS = [
  /\b(?:based in|live in|from|located in|mieszkam w|z)\s+([A-ZÀ-Ž][a-zà-ž]+(?:\s+[A-ZÀ-Ž][a-zà-ž]+)?)\b/i,
  /\blocation[:\s]+([A-ZÀ-Ž][a-zà-ž]+(?:\s+[A-ZÀ-Ž][a-zà-ž]+)?)\b/i,
];

const STYLE_PATTERNS: [RegExp, string, string][] = [
  // [pattern, dimension, value]
  [/\b(?:concise|brief|short|zwięz|krótko)\b/i, "communication.verbosity", "concise"],
  [/\b(?:verbose|detailed|long|szczegół|dokładn)/i, "communication.verbosity", "detailed"],
  [/\b(?:direct|blunt|straight|bezpośredni|wprost)/i, "communication.directness", "blunt"],
  [/\b(?:no.{0,10}emojis?|bez.{0,6}emoji)/i, "communication.emoji_usage", "never"],
  [/\b(?:informal|casual|luźn)/i, "communication.formality", "casual"],
  [/\b(?:formal|professional|profesjonaln)/i, "communication.formality", "formal"],
  [/\b(?:code.{0,5}first|give.{0,5}code|pokaż.{0,5}kod)/i, "communication.code_preference", "code_heavy"],
  [/\b(?:no.{0,10}apolog|nie.{0,6}przepras)/i, "communication.anti_patterns", "no_apologies"],
  [/\b(?:no.{0,10}praise|nie.{0,6}chwal)/i, "communication.anti_patterns", "no_praise"],
  [/\b(?:bullet|point|listy)/i, "communication.formatting", "structured"],
];

// ─── Extractors ─────────────────────────────────────────────

function extractAge(text: string): string | undefined {
  for (const pattern of AGE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const age = parseInt(match[1]);
      if (age >= 13 && age <= 99) {
        if (age < 20) return "teens";
        if (age < 30) return "20s";
        if (age < 40) return "30s";
        if (age < 50) return "40s";
        if (age < 60) return "50s";
        return "60+";
      }
    }
  }
  return undefined;
}

function extractLocation(text: string): string | undefined {
  for (const pattern of LOCATION_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1] && match[1].length > 2) return match[1];
  }
  return undefined;
}

function extractName(text: string): string | undefined {
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function extractLanguage(text: string): string | undefined {
  for (const [pattern, lang] of LANGUAGE_PATTERNS) {
    if (pattern.test(text)) return lang;
  }
  // Heuristic: if >60% of text is Polish characters/words
  const polishWords = text.match(/\b(jest|się|nie|tak|więc|że|już|czy|jak|ale|lub|oraz|tylko|może|bardzo|jest|mam|chcę)\b/gi);
  if (polishWords && polishWords.length > 3) return "pl";
  return undefined;
}

function extractRole(text: string): string | undefined {
  for (const [pattern, role] of ROLE_PATTERNS) {
    if (pattern.test(text)) return role;
  }
  return undefined;
}

function extractTechStack(text: string): string[] {
  const found = new Set<string>();
  for (const [pattern, name] of TECH_PATTERNS) {
    if (pattern.test(text)) found.add(name);
  }
  return [...found];
}

function extractStyleDimensions(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [pattern, dim, value] of STYLE_PATTERNS) {
    if (pattern.test(text)) {
      result[dim] = value;
    }
  }
  return result;
}

function extractRules(text: string): string[] {
  const rules: string[] = [];
  const lines = text.split("\n");
  let hasBullets = false;

  // First pass: extract explicitly bulleted/numbered rules
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 10) continue;
    if (/^(?:\d+[.)]\s*|- |• |\* |→ )/.test(trimmed)) {
      hasBullets = true;
      const rule = trimmed.replace(/^(?:\d+[.)]\s*|- |• |\* |→ )/, "").trim();
      if (rule.length >= 10 && rule.length <= 300) {
        rules.push(rule);
      }
    }
  }

  // Second pass: if no bullets found, treat substantial lines as rules
  // This handles free-form pasted instructions without formatting
  if (!hasBullets) {
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip headings, very short lines, and markdown headers
      if (trimmed.length < 15) continue;
      if (/^#{1,3}\s/.test(trimmed)) continue;
      if (/^[-=]{3,}$/.test(trimmed)) continue;
      if (trimmed.length <= 300) {
        rules.push(trimmed);
      }
    }
  }

  return rules;
}

// ─── Main parser ────────────────────────────────────────────

export function parseInstructions(text: string, _platform: string = "other"): ParseResult {
  const explicit: Record<string, DimensionValue> = {};
  const inferred: Record<string, InferredValue> = {};

  const name = extractName(text);
  const language = extractLanguage(text);
  const role = extractRole(text);
  const age = extractAge(text);
  const location = extractLocation(text);
  const techStack = extractTechStack(text);
  const styleDims = extractStyleDimensions(text);
  const exportRules = extractRules(text);

  // Build explicit dimensions
  if (name) {
    explicit["identity.preferred_name"] = {
      dimension: "identity.preferred_name",
      value: name,
      confidence: 1.0,
      source: "explicit",
      question_id: "import_text",
    };
  }

  if (language) {
    explicit["identity.language"] = {
      dimension: "identity.language",
      value: language,
      confidence: 1.0,
      source: "explicit",
      question_id: "import_text",
    };
  }

  if (role) {
    explicit["identity.professional_role"] = {
      dimension: "identity.professional_role",
      value: role,
      confidence: 1.0,
      source: "explicit",
      question_id: "import_text",
    };
  }

  if (age) {
    explicit["identity.age_range"] = {
      dimension: "identity.age_range",
      value: age,
      confidence: 1.0,
      source: "explicit",
      question_id: "import_text",
    };
  }

  if (location) {
    explicit["identity.location"] = {
      dimension: "identity.location",
      value: location,
      confidence: 1.0,
      source: "explicit",
      question_id: "import_text",
    };
  }

  if (techStack.length > 0) {
    explicit["expertise.tech_stack"] = {
      dimension: "expertise.tech_stack",
      value: techStack.join(", "),
      confidence: 1.0,
      source: "explicit",
      question_id: "import_text",
    };
  }

  // Build inferred dimensions from style patterns
  for (const [dim, value] of Object.entries(styleDims)) {
    inferred[dim] = {
      dimension: dim,
      value,
      confidence: 0.7,
      source: "behavioral",
      signal_id: "import_text_style",
      override: "secondary",
    };
  }

  return { explicit, inferred, exportRules, name, language };
}

/**
 * Create a partial profile from parsed instructions.
 * Can be merged with existing profile or used standalone.
 */
export function instructionsToProfile(text: string, platform: string = "other"): PersonaProfile {
  const parsed = parseInstructions(text, platform);

  return {
    schema_version: "1.0",
    profile_type: "personal",
    profile_id: crypto.randomUUID?.() ?? `import-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completeness: Math.min(100, Object.keys(parsed.explicit).length * 8 + Object.keys(parsed.inferred).length * 4),
    explicit: parsed.explicit,
    inferred: parsed.inferred,
    compound: {},
    contradictions: [],
    emergent: [],
    synthesis: parsed.exportRules.length > 0 ? {
      narrative: "",
      exportRules: parsed.exportRules,
    } : undefined,
    meta: {
      tiers_completed: [],
      tiers_skipped: [],
      total_questions_answered: 0,
      total_questions_skipped: 0,
      avg_response_time_ms: 0,
      profiling_duration_ms: 0,
      profiling_method: "file_scan",
      layer3_available: false,
    },
  };
}

/**
 * Merge an imported profile into an existing profile.
 * Imported data fills gaps but doesn't overwrite existing.
 */
export function mergeImportedProfile(existing: PersonaProfile, imported: PersonaProfile): PersonaProfile {
  const merged = { ...existing, updated_at: new Date().toISOString() };

  // Fill explicit gaps
  for (const [key, val] of Object.entries(imported.explicit)) {
    if (!merged.explicit[key]) {
      merged.explicit[key] = val;
    }
  }

  // Fill inferred gaps
  for (const [key, val] of Object.entries(imported.inferred)) {
    if (!merged.inferred[key]) {
      merged.inferred[key] = val;
    }
  }

  // Merge export rules (append unique)
  if (imported.synthesis?.exportRules && imported.synthesis.exportRules.length > 0) {
    const existingRules = merged.synthesis?.exportRules ?? [];
    const newRules = imported.synthesis.exportRules.filter(r =>
      !existingRules.some(e => e.toLowerCase().trim() === r.toLowerCase().trim())
    );
    merged.synthesis = {
      ...merged.synthesis,
      narrative: merged.synthesis?.narrative ?? "",
      exportRules: [...existingRules, ...newRules],
    };
  }

  // Recalculate completeness
  const totalDims = Object.keys(merged.explicit).length
    + Object.keys(merged.inferred).length
    + Object.keys(merged.compound).length;
  merged.completeness = Math.min(100, Math.round((totalDims / 80) * 100));

  return merged;
}
