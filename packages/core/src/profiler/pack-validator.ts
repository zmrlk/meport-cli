/**
 * Pack JSON Schema Validator
 *
 * Validates pack files for:
 * - Required fields present
 * - IDs/dimensions/maps_to are English (not translated)
 * - Options have maps_to for select/multi_select
 * - Export rules are present for non-identity options
 * - Translated packs match English structure (same IDs, same dimension count)
 */

import type { Pack, PackQuestion, PackOption } from "./pack-loader.js";

export interface ValidationError {
  pack: string;
  question?: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * Validate a single pack JSON structure.
 */
export function validatePack(pack: Pack): ValidationError[] {
  const errors: ValidationError[] = [];

  // Pack-level required fields
  if (!pack.pack) {
    errors.push({ pack: "unknown", field: "pack", message: "Missing pack ID", severity: "error" });
  }
  if (!pack.pack_name) {
    errors.push({ pack: pack.pack, field: "pack_name", message: "Missing pack name", severity: "error" });
  }
  if (!pack.pack_intro) {
    errors.push({ pack: pack.pack, field: "pack_intro", message: "Missing pack intro", severity: "error" });
  }
  if (typeof pack.required !== "boolean") {
    errors.push({ pack: pack.pack, field: "required", message: "Missing required field", severity: "error" });
  }
  if (typeof pack.sensitive !== "boolean") {
    errors.push({ pack: pack.pack, field: "sensitive", message: "Missing sensitive field", severity: "error" });
  }
  if (!Array.isArray(pack.questions) || pack.questions.length === 0) {
    errors.push({ pack: pack.pack, field: "questions", message: "No questions defined", severity: "error" });
    return errors;
  }

  // Validate each question
  const seenIds = new Set<string>();
  for (const q of pack.questions) {
    errors.push(...validateQuestion(pack.pack, q, seenIds));
  }

  return errors;
}

function validateQuestion(
  packId: string,
  q: PackQuestion,
  seenIds: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!q.id) {
    errors.push({ pack: packId, field: "id", message: "Question missing ID", severity: "error" });
    return errors;
  }

  if (seenIds.has(q.id)) {
    errors.push({ pack: packId, question: q.id, field: "id", message: `Duplicate question ID: ${q.id}`, severity: "error" });
  }
  seenIds.add(q.id);

  if (!q.question) {
    errors.push({ pack: packId, question: q.id, field: "question", message: "Missing question text", severity: "error" });
  }
  if (!q.dimension) {
    errors.push({ pack: packId, question: q.id, field: "dimension", message: "Missing dimension", severity: "error" });
  }
  if (!["select", "multi_select", "open_text", "scale"].includes(q.type)) {
    errors.push({ pack: packId, question: q.id, field: "type", message: `Invalid type: ${q.type}`, severity: "error" });
  }

  // ID must be English (no unicode beyond ASCII)
  if (q.id && !/^[a-z0-9_]+$/.test(q.id)) {
    errors.push({ pack: packId, question: q.id, field: "id", message: "ID must be lowercase English + underscore", severity: "error" });
  }

  // Dimension must be English
  if (q.dimension && !/^[a-z_.]+$/.test(q.dimension)) {
    errors.push({ pack: packId, question: q.id, field: "dimension", message: "Dimension must be lowercase English + dots", severity: "error" });
  }

  // Options validation for select/multi_select
  if ((q.type === "select" || q.type === "multi_select") && q.options) {
    for (const opt of q.options) {
      errors.push(...validateOption(packId, q.id, opt));
    }
  }

  // select/multi_select must have options
  if ((q.type === "select" || q.type === "multi_select") && (!q.options || q.options.length === 0)) {
    errors.push({ pack: packId, question: q.id, field: "options", message: "select/multi_select requires options", severity: "error" });
  }

  return errors;
}

function validateOption(
  packId: string,
  questionId: string,
  opt: PackOption
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!opt.value) {
    errors.push({ pack: packId, question: questionId, field: "option.value", message: "Option missing value", severity: "error" });
  }
  if (!opt.label) {
    errors.push({ pack: packId, question: questionId, field: "option.label", message: "Option missing label", severity: "error" });
  }

  // Value must be English
  if (opt.value && !/^[a-z0-9_]+$/.test(opt.value)) {
    errors.push({ pack: packId, question: questionId, field: "option.value", message: `Option value must be English: ${opt.value}`, severity: "error" });
  }

  // maps_to must exist
  if (!opt.maps_to) {
    errors.push({ pack: packId, question: questionId, field: "option.maps_to", message: `Option "${opt.value}" missing maps_to`, severity: "warning" });
  } else {
    // maps_to dimension must be English
    if (!/^[a-z_.]+$/.test(opt.maps_to.dimension)) {
      errors.push({ pack: packId, question: questionId, field: "option.maps_to.dimension", message: "maps_to dimension must be English", severity: "error" });
    }
    // maps_to value must be English
    if (!/^[a-z_/]+$/.test(opt.maps_to.value)) {
      errors.push({ pack: packId, question: questionId, field: "option.maps_to.value", message: `maps_to value must be English: ${opt.maps_to.value}`, severity: "error" });
    }
  }

  return errors;
}

/**
 * Validate that a translated pack matches the English reference.
 * Checks: same IDs, same dimensions, same option values, same question count.
 */
export function validateTranslation(
  english: Pack,
  translated: Pack
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Same pack ID
  if (english.pack !== translated.pack) {
    errors.push({
      pack: translated.pack,
      field: "pack",
      message: `Pack ID mismatch: ${english.pack} vs ${translated.pack}`,
      severity: "error",
    });
  }

  // Same question count
  if (english.questions.length !== translated.questions.length) {
    errors.push({
      pack: translated.pack,
      field: "questions",
      message: `Question count mismatch: ${english.questions.length} vs ${translated.questions.length}`,
      severity: "error",
    });
    return errors;
  }

  // Per-question: same ID, same dimension, same option values
  for (let i = 0; i < english.questions.length; i++) {
    const enQ = english.questions[i];
    const trQ = translated.questions[i];

    if (enQ.id !== trQ.id) {
      errors.push({
        pack: translated.pack,
        question: trQ.id,
        field: "id",
        message: `Question ID mismatch at index ${i}: ${enQ.id} vs ${trQ.id}`,
        severity: "error",
      });
    }

    if (enQ.dimension !== trQ.dimension) {
      errors.push({
        pack: translated.pack,
        question: trQ.id,
        field: "dimension",
        message: `Dimension mismatch: ${enQ.dimension} vs ${trQ.dimension}`,
        severity: "error",
      });
    }

    if (enQ.type !== trQ.type) {
      errors.push({
        pack: translated.pack,
        question: trQ.id,
        field: "type",
        message: `Type mismatch: ${enQ.type} vs ${trQ.type}`,
        severity: "error",
      });
    }

    // Option values must match
    if (enQ.options && trQ.options) {
      if (enQ.options.length !== trQ.options.length) {
        errors.push({
          pack: translated.pack,
          question: trQ.id,
          field: "options",
          message: `Option count mismatch: ${enQ.options.length} vs ${trQ.options.length}`,
          severity: "error",
        });
      } else {
        for (let j = 0; j < enQ.options.length; j++) {
          if (enQ.options[j].value !== trQ.options[j].value) {
            errors.push({
              pack: translated.pack,
              question: trQ.id,
              field: `options[${j}].value`,
              message: `Option value mismatch: ${enQ.options[j].value} vs ${trQ.options[j].value}`,
              severity: "error",
            });
          }

          // Export rules must stay English (identical)
          if (enQ.options[j].export_rule !== trQ.options[j].export_rule) {
            errors.push({
              pack: translated.pack,
              question: trQ.id,
              field: `options[${j}].export_rule`,
              message: `Export rule was translated (must stay English)`,
              severity: "error",
            });
          }
        }
      }
    }
  }

  return errors;
}
