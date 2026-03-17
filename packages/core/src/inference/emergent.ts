/**
 * Layer 3 — Emergent AI Observations
 *
 * Requires user's API key (Claude, OpenAI, or Ollama).
 * Generates 5-15 emergent observations from the full answer set.
 * Optional — profiles work without this layer.
 */

import type {
  PersonaProfile,
  EmergentObservation,
  CompoundValue,
  Answer,
} from "../schema/types.js";

export interface Layer3Config {
  provider: "claude" | "openai" | "ollama";
  apiKey?: string;
  model?: string;
  baseUrl?: string; // for Ollama
}

export interface AIClient {
  generate(prompt: string): Promise<string>;
}

const PROMPT_TEMPLATE = `You are analyzing a person's AI personalization profile. Your job: find patterns, insights, and non-obvious signals that simple rules miss.

## Rules:
1. Each observation must reference 2+ specific data points as evidence
2. Confidence: 0.3-0.7 (these are inferences, not facts)
3. NEVER diagnose, label, or pathologize
4. Focus on what changes how AI should BEHAVE with this person
5. Flag contradictions — where data points conflict
6. Use the person's own language, not clinical terms
7. Maximum 12 observations. Quality > quantity.
8. export_instruction must be an ACTION RULE ("Do X when Y"), not a description

## Output: JSON array
[
  {
    "observation_id": "emergent_001",
    "category": "personality_pattern" | "cognitive_pattern" | "behavioral_pattern" | "compound_signal" | "contradiction" | "hidden_strength" | "risk_flag",
    "title": "Short name (3-5 words)",
    "observation": "2-3 sentences max. Plain language.",
    "evidence": ["dimension_key:value", "dimension_key:value"],
    "confidence": 0.65,
    "export_instruction": "One actionable rule for AI. Start with verb."
  }
]

## Person's profile data (answers + detected context):
{FULL_ANSWERS_JSON}

## Auto-detected context (from system/file scan):
{SCAN_CONTEXT_JSON}

## Layer 2 compound signals already found (don't repeat these):
{COMPOUND_SIGNALS_JSON}

Generate observations that ADD value beyond what's already captured. Think about:
- Cross-domain patterns (e.g. work style + communication = specific AI behavior)
- Hidden strengths the person might not see
- Risk flags (burnout signals, overcommitment, isolation)
- Contradictions worth surfacing
- How their context (occupation, tools, life stage) should shape AI behavior`;

export async function runLayer3(
  profile: PersonaProfile,
  answers: Map<string, Answer>,
  aiClient: AIClient,
  scanContext?: Record<string, string>
): Promise<EmergentObservation[]> {
  // Build the answer map for the prompt
  const answerObj: Record<string, unknown> = {};
  for (const [id, answer] of answers) {
    if (!answer.skipped) {
      answerObj[id] = answer.value;
    }
  }

  // Include explicit dimensions too (from intro + scan)
  for (const [key, val] of Object.entries(profile.explicit)) {
    if (!answerObj[key]) {
      answerObj[key] = val.value;
    }
  }

  const prompt = PROMPT_TEMPLATE.replace(
    "{FULL_ANSWERS_JSON}",
    JSON.stringify(answerObj, null, 2)
  ).replace(
    "{SCAN_CONTEXT_JSON}",
    JSON.stringify(scanContext ?? {}, null, 2)
  ).replace(
    "{COMPOUND_SIGNALS_JSON}",
    JSON.stringify(Object.values(profile.compound), null, 2)
  );

  const response = await aiClient.generate(prompt);

  // Parse the response — expect a JSON array
  const observations = parseObservations(response);

  // All start as pending_review
  for (const obs of observations) {
    obs.status = "pending_review";
  }

  return observations;
}

function parseObservations(response: string): EmergentObservation[] {
  // Try to extract JSON array from the response
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item: unknown) =>
          typeof item === "object" &&
          item !== null &&
          "observation_id" in item
      )
      .map(
        (item: Record<string, unknown>, i: number): EmergentObservation => ({
          observation_id:
            (item.observation_id as string) ?? `emergent_${String(i + 1).padStart(3, "0")}`,
          category: validateCategory(item.category as string),
          title: (item.title as string) ?? "Unnamed observation",
          observation: (item.observation as string) ?? "",
          evidence: Array.isArray(item.evidence)
            ? (item.evidence as string[])
            : [],
          confidence: Math.min(
            0.7,
            Math.max(0.3, (item.confidence as number) ?? 0.5)
          ),
          export_instruction: (item.export_instruction as string) ?? "",
          status: "pending_review",
        })
      );
  } catch {
    return [];
  }
}

function validateCategory(
  cat: string
): EmergentObservation["category"] {
  const valid: EmergentObservation["category"][] = [
    "personality_pattern",
    "cognitive_pattern",
    "behavioral_pattern",
    "compound_signal",
    "contradiction",
    "hidden_strength",
    "risk_flag",
  ];
  return valid.includes(cat as EmergentObservation["category"])
    ? (cat as EmergentObservation["category"])
    : "compound_signal";
}
