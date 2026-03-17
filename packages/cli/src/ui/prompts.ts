/**
 * CLI Prompt Wrappers
 *
 * Maps Meport question types to Inquirer prompts.
 * ADHD-friendly: short, visual, numbered.
 */

import { select, input, checkbox, number as numInput } from "@inquirer/prompts";
import chalk from "chalk";
import type { Question, AnswerInput } from "@meport/core";
import { DIM, YELLOW } from "./display.js";

export async function askQuestion(
  question: Question,
  progress: string
): Promise<AnswerInput> {
  const prefix = `${progress} `;
  const whyHint = question.why_this_matters
    ? DIM(`  ℹ ${question.why_this_matters}`)
    : "";

  console.log(whyHint);

  switch (question.type) {
    case "select":
    case "scenario":
    case "spectrum":
    case "ranking":
      return askSelect(question, prefix);
    case "multi_select":
      return askMultiSelect(question, prefix);
    case "scale":
      return askScale(question, prefix);
    case "open_text":
      return askOpenText(question, prefix);
    case "matrix":
      return askMatrix(question, prefix);
    default:
      return askOpenText(question, prefix);
  }
}

async function askSelect(
  question: Question,
  prefix: string
): Promise<AnswerInput> {
  if (!question.options?.length) {
    return askOpenText(question, prefix);
  }

  const choices = question.options.map((opt) => ({
    name: opt.label,
    value: opt.value,
  }));

  if (question.skippable) {
    choices.push({
      name: DIM("Skip →"),
      value: "__skip__",
    });
  }

  const answer = await select({
    message: prefix + question.question,
    choices,
  });

  if (answer === "__skip__") {
    return { value: "", skipped: true };
  }

  return { value: answer };
}

async function askMultiSelect(
  question: Question,
  prefix: string
): Promise<AnswerInput> {
  if (!question.options?.length) {
    return askOpenText(question, prefix);
  }

  const choices = question.options.map((opt) => ({
    name: opt.label,
    value: opt.value,
  }));

  const answers = await checkbox({
    message: prefix + question.question,
    choices,
  });

  if (answers.length === 0 && question.skippable) {
    return { value: [], skipped: true };
  }

  return { value: answers };
}

async function askScale(
  question: Question,
  prefix: string
): Promise<AnswerInput> {
  const min = question.scale_min ?? 1;
  const max = question.scale_max ?? 5;
  const labels = question.scale_labels ?? {};

  // Show scale labels
  if (Object.keys(labels).length > 0) {
    for (const [key, label] of Object.entries(labels)) {
      console.log(DIM(`  ${key} = ${label}`));
    }
  }

  const answer = await numInput({
    message:
      prefix +
      question.question +
      DIM(` (${min}-${max})`),
    min,
    max,
  });

  if (answer === undefined && question.skippable) {
    return { value: 0, skipped: true };
  }

  return { value: answer ?? min };
}

async function askOpenText(
  question: Question,
  prefix: string
): Promise<AnswerInput> {
  const answer = await input({
    message: prefix + question.question,
    default: question.skippable ? undefined : undefined,
  });

  if (!answer && question.skippable) {
    return { value: "", skipped: true };
  }

  return { value: answer };
}

async function askMatrix(
  question: Question,
  prefix: string
): Promise<AnswerInput> {
  if (!question.rows?.length || !question.columns?.length) {
    return askOpenText(question, prefix);
  }

  console.log(prefix + question.question);

  const result: Record<string, string> = {};

  for (const row of question.rows) {
    const choices = question.columns.map((col) => ({
      name: col.label,
      value: col.value,
    }));

    const answer = await select({
      message: `  ${row.label}:`,
      choices,
    });

    result[row.id] = answer;
  }

  return { value: result };
}
