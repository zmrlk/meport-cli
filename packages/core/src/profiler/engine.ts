/**
 * Meport Profiling Engine
 *
 * Core loop: loads tiers → presents questions → collects answers →
 * handles follow-ups → tracks meta signals → builds profile
 */

import { v4 as uuidv4 } from "uuid";
import type {
  PersonaProfile,
  QuestionTier,
  Question,
  Answer,
  DimensionValue,
  ProfileMeta,
} from "../schema/types.js";

// ─── Engine Events (for UI integration) ────────────────────

export type EngineEvent =
  | { type: "tier_start"; tier: number; name: string; intro: string }
  | { type: "question"; question: Question; index: number; total: number }
  | {
      type: "tier_complete";
      tier: number;
      headline: string;
      body: string;
    }
  | { type: "profiling_complete"; profile: PersonaProfile }
  | { type: "follow_up"; question: Question; parent_id: string };

export type AnswerInput = {
  value: string | string[] | number | Record<string, string>;
  skipped?: boolean;
};

// ─── Profiling Session ─────────────────────────────────────

export class ProfilingEngine {
  private tiers: QuestionTier[] = [];
  private answers: Map<string, Answer> = new Map();
  private startTime: number = 0;
  private questionStartTime: number = 0;
  private questionsAnswered = 0;
  private questionsSkipped = 0;
  private totalResponseTimeMs = 0;

  // All questions indexed by ID for follow-up resolution
  private questionIndex: Map<string, Question> = new Map();

  // Triggered follow-up IDs
  private pendingFollowups: string[] = [];

  // Deepening support
  private skipDimensions: Set<string>;
  private existingExplicit: Record<string, DimensionValue>;

  constructor(
    tiers: QuestionTier[],
    skipDimensions?: Set<string>,
    existingExplicit?: Record<string, DimensionValue>
  ) {
    this.tiers = tiers;
    this.skipDimensions = skipDimensions ?? new Set();
    this.existingExplicit = existingExplicit ?? {};
    this.startTime = Date.now();

    // Index all questions
    for (const tier of tiers) {
      for (const q of tier.questions) {
        this.questionIndex.set(q.id, q);
      }
    }
  }

  /**
   * Generator-based profiling flow.
   * Yields questions one at a time, receives answers back.
   */
  *run(): Generator<EngineEvent, PersonaProfile, AnswerInput | undefined> {
    for (const tier of this.tiers) {
      yield {
        type: "tier_start",
        tier: tier.tier,
        name: tier.tier_name,
        intro: tier.tier_intro,
      };

      const mainQuestions = tier.questions.filter((q) => !q.is_followup);
      let questionIndex = 0;

      for (const question of mainQuestions) {
        questionIndex++;
        this.questionStartTime = Date.now();

        const input: AnswerInput | undefined = yield {
          type: "question",
          question,
          index: questionIndex,
          total: mainQuestions.length,
        };

        if (input) {
          this.recordAnswer(question, input);

          // Check for triggered follow-ups
          const followups = this.getTriggeredFollowups(question, input);
          for (const followup of followups) {
            this.questionStartTime = Date.now();

            const followupInput: AnswerInput | undefined = yield {
              type: "follow_up",
              question: followup,
              parent_id: question.id,
            };

            if (followupInput) {
              this.recordAnswer(followup, followupInput);
            }
          }
        }
      }

      yield {
        type: "tier_complete",
        tier: tier.tier,
        headline: tier.tier_complete.headline,
        body: tier.tier_complete.body,
      };
    }

    const profile = this.buildProfile();

    yield { type: "profiling_complete", profile };

    return profile;
  }

  /**
   * Non-generator API: process a single answer and get the next question.
   * Better for async UIs (web, Tauri).
   */
  private currentTierIdx = 0;
  private currentQuestionIdx = 0;
  private inFollowups = false;
  private followupQueue: Question[] = [];

  getNextQuestion(): EngineEvent | null {
    // Follow-ups first
    if (this.followupQueue.length > 0) {
      const followup = this.followupQueue.shift()!;
      this.questionStartTime = Date.now();
      return {
        type: "follow_up",
        question: followup,
        parent_id: followup.parent_question!,
      };
    }

    // Find next main question
    while (this.currentTierIdx < this.tiers.length) {
      const tier = this.tiers[this.currentTierIdx];
      const mainQuestions = tier.questions.filter((q) => !q.is_followup);

      // Check if ALL questions in this tier are skippable — if so, skip entire tier
      if (
        this.currentQuestionIdx === 0 &&
        this.skipDimensions.size > 0 &&
        mainQuestions.length > 0 &&
        mainQuestions.every((q) => this.shouldSkipQuestion(q))
      ) {
        this.currentTierIdx++;
        this.currentQuestionIdx = 0;
        continue;
      }

      if (this.currentQuestionIdx === 0) {
        this.currentQuestionIdx = 1; // advance past tier_start
        return {
          type: "tier_start",
          tier: tier.tier,
          name: tier.tier_name,
          intro: tier.tier_intro,
        };
      }

      if (this.currentQuestionIdx <= mainQuestions.length) {
        const question = mainQuestions[this.currentQuestionIdx - 1];
        if (!question) {
          // Tier complete
          this.currentTierIdx++;
          this.currentQuestionIdx = 0;
          return {
            type: "tier_complete",
            tier: tier.tier,
            headline: tier.tier_complete.headline,
            body: tier.tier_complete.body,
          };
        }

        // Skip questions whose dimensions are already filled
        if (this.shouldSkipQuestion(question)) {
          this.currentQuestionIdx++;
          continue;
        }

        this.questionStartTime = Date.now();
        return {
          type: "question",
          question,
          index: this.currentQuestionIdx,
          total: mainQuestions.length,
        };
      }

      this.currentTierIdx++;
      this.currentQuestionIdx = 0;
    }

    return null; // Profiling complete
  }

  submitAnswer(questionId: string, input: AnswerInput): void {
    const question = this.questionIndex.get(questionId);
    if (!question) return;

    this.recordAnswer(question, input);

    // Queue follow-ups
    const followups = this.getTriggeredFollowups(question, input);
    this.followupQueue.push(...followups);

    // Advance to next main question (if not in follow-ups)
    if (!question.is_followup) {
      this.currentQuestionIdx++;
    }
  }

  // ─── Internal ──────────────────────────────────────────

  private recordAnswer(question: Question, input: AnswerInput): void {
    const responseTime = Date.now() - this.questionStartTime;

    const answer: Answer = {
      question_id: question.id,
      value: input.value,
      timestamp: Date.now() - this.startTime,
      response_time_ms: responseTime,
      skipped: input.skipped ?? false,
    };

    this.answers.set(question.id, answer);

    if (input.skipped) {
      this.questionsSkipped++;
    } else {
      this.questionsAnswered++;
      this.totalResponseTimeMs += responseTime;
    }
  }

  private getTriggeredFollowups(
    question: Question,
    input: AnswerInput
  ): Question[] {
    if (input.skipped || !question.options) return [];

    const selectedValue =
      typeof input.value === "string" ? input.value : undefined;
    if (!selectedValue) return [];

    const selectedOption = question.options.find(
      (o) => o.value === selectedValue
    );
    if (!selectedOption?.triggers) return [];

    return selectedOption.triggers
      .map((id) => this.questionIndex.get(id))
      .filter((q): q is Question => q !== undefined);
  }

  private shouldSkipQuestion(question: Question): boolean {
    if (this.skipDimensions.size === 0) return false;
    // Check question's own dimension (scale, open_text)
    if (question.dimension && this.skipDimensions.has(question.dimension)) return true;
    // Check all option maps_to dimensions (select, scenario, multi_select)
    if (question.options && question.options.length > 0) {
      const optDims = question.options
        .map((o) => o.maps_to?.dimension)
        .filter((d): d is string => Boolean(d));
      if (optDims.length > 0 && optDims.every((d) => this.skipDimensions.has(d))) return true;
    }
    return false;
  }

  private buildProfile(): PersonaProfile {
    const explicit: Record<string, DimensionValue> = {};

    for (const [questionId, answer] of this.answers) {
      if (answer.skipped) continue;

      const question = this.questionIndex.get(questionId);
      if (!question) continue;

      // Direct dimension mapping — handles select, scenario, and any type with options
      const isSelectLike = question.options && question.options.length > 0;
      if (isSelectLike && question.type !== "multi_select") {
        const selected = question.options!.find(
          (o) => o.value === answer.value
        );
        if (selected?.maps_to) {
          explicit[selected.maps_to.dimension] = {
            dimension: selected.maps_to.dimension,
            value: selected.maps_to.value,
            confidence: 1.0,
            source: "explicit",
            question_id: questionId,
          };

          // Handle also_maps_to (don't override if already set by another question)
          if (selected.also_maps_to && !explicit[selected.also_maps_to.dimension]) {
            explicit[selected.also_maps_to.dimension] = {
              dimension: selected.also_maps_to.dimension,
              value: selected.also_maps_to.value,
              confidence: 1.0,
              source: "explicit",
              question_id: questionId,
            };
          }
        }
      } else if (question.type === "multi_select" && Array.isArray(answer.value)) {
        // Multi-select: collect all values
        for (const val of answer.value as string[]) {
          const selected = question.options?.find((o) => o.value === val);
          if (selected?.maps_to) {
            const dim = selected.maps_to.dimension;
            const existing = explicit[dim];
            if (existing && Array.isArray(existing.value)) {
              (existing.value as string[]).push(selected.maps_to.value);
            } else {
              explicit[dim] = {
                dimension: dim,
                value: [selected.maps_to.value],
                confidence: 1.0,
                source: "explicit",
                question_id: questionId,
              };
            }
          }
        }
      } else if (question.type === "scale") {
        explicit[question.dimension] = {
          dimension: question.dimension,
          value: answer.value as number,
          confidence: 1.0,
          source: "explicit",
          question_id: questionId,
        };
      } else if (question.type === "open_text") {
        explicit[question.dimension] = {
          dimension: question.dimension,
          value: answer.value as string,
          confidence: 1.0,
          source: "explicit",
          question_id: questionId,
        };
      } else if (question.type === "matrix" && typeof answer.value === "object" && !Array.isArray(answer.value)) {
        // Matrix: each row maps to its own dimension
        for (const [rowId, colValue] of Object.entries(answer.value as Record<string, string>)) {
          const row = question.rows?.find((r) => r.id === rowId);
          if (row) {
            explicit[row.dimension] = {
              dimension: row.dimension,
              value: colValue,
              confidence: 1.0,
              source: "explicit",
              question_id: questionId,
            };
          }
        }
      }
    }

    // Merge existing dimensions (deepening: new answers override existing ones)
    const mergedExplicit = { ...this.existingExplicit, ...explicit };

    // Layer 2: Infer additional dimensions from explicit answers
    const inferred = inferDimensions(mergedExplicit);

    // Layer 2B: Compound signals from dimension combinations (checks both explicit + inferred)
    const compound = inferCompoundSignals(mergedExplicit, inferred);

    const tiersCompleted = [
      ...new Set(
        [...this.answers.values()]
          .filter((a) => !a.skipped)
          .map((a) => {
            const q = this.questionIndex.get(a.question_id);
            return q?.tier;
          })
          .filter((t): t is number => t !== undefined)
      ),
    ];

    const meta: ProfileMeta = {
      tiers_completed: tiersCompleted,
      tiers_skipped: this.tiers
        .map((t) => t.tier)
        .filter((t) => !tiersCompleted.includes(t)),
      total_questions_answered: this.questionsAnswered,
      total_questions_skipped: this.questionsSkipped,
      avg_response_time_ms:
        this.questionsAnswered > 0
          ? Math.round(this.totalResponseTimeMs / this.questionsAnswered)
          : 0,
      profiling_duration_ms: Date.now() - this.startTime,
      profiling_method: "interactive",
      layer3_available: false,
    };

    return {
      schema_version: "1.0",
      profile_type: "personal",
      profile_id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completeness: this.calculateCompleteness(mergedExplicit),
      explicit: mergedExplicit,
      inferred,
      compound,
      contradictions: [],
      emergent: [],
      meta,
    };
  }

  private calculateCompleteness(
    explicit: Record<string, DimensionValue>
  ): number {
    // Count questions that were available (not skipped) in this session
    let availableQuestions = 0;
    let answeredQuestions = 0;

    for (const tier of this.tiers) {
      const mainQs = tier.questions.filter((q) => !q.is_followup);
      for (const q of mainQs) {
        if (this.shouldSkipQuestion(q)) continue; // already known from previous session
        availableQuestions++;
        const answer = this.answers.get(q.id);
        if (answer && !answer.skipped) answeredQuestions++;
      }
    }

    // If all available questions answered → 100%. Period.
    if (availableQuestions > 0 && answeredQuestions === availableQuestions) {
      return 100;
    }

    // Otherwise: blend question coverage + dimension richness
    const questionScore = availableQuestions > 0
      ? answeredQuestions / availableQuestions
      : 0;

    // Count unique dimensions across all loaded tiers (not hardcoded)
    const allDimensions = new Set<string>();
    for (const tier of this.tiers) {
      for (const q of tier.questions) {
        if (q.dimension) allDimensions.add(q.dimension);
        if (q.options) {
          for (const opt of q.options) {
            if (opt.maps_to?.dimension) allDimensions.add(opt.maps_to.dimension);
            if (opt.also_maps_to?.dimension) allDimensions.add(opt.also_maps_to.dimension);
          }
        }
      }
    }
    const maxExpectedDims = Math.max(allDimensions.size, 20);
    const totalDims = Object.keys(explicit).length;
    const dimScore = Math.min(1, totalDims / maxExpectedDims);

    const raw = questionScore * 0.7 + dimScore * 0.3;
    return Math.min(100, Math.round(raw * 100));
  }

  /**
   * Build profile from answers collected so far.
   * Use for "finish early" — generates a partial profile.
   */
  buildCurrentProfile(): PersonaProfile {
    return this.buildProfile();
  }

  // ─── Accessors ─────────────────────────────────────────

  getAnswers(): Map<string, Answer> {
    return new Map(this.answers);
  }

  getAnswer(questionId: string): Answer | undefined {
    return this.answers.get(questionId);
  }

  getAnswerValue(questionId: string): string | undefined {
    const answer = this.answers.get(questionId);
    if (!answer || answer.skipped) return undefined;
    return typeof answer.value === "string" ? answer.value : undefined;
  }
}

// ─── Inference Engine ─────────────────────────────────────
// Rule-based inference: explicit dimensions → inferred dimensions
// Each rule checks conditions on explicit values and produces new dimensions.

import type { InferredValue, CompoundValue } from "../schema/types.js";

interface InferenceRule {
  id: string;
  /** Dimensions required (at least one must exist) */
  requires: string[];
  /** Check if this rule applies given explicit values */
  condition: (get: (dim: string) => string | undefined) => boolean;
  /** Produce inferred dimensions */
  infer: (get: (dim: string) => string | undefined) => Array<{
    dimension: string;
    value: string;
    confidence: number;
    override: "secondary" | "primary" | "flag_only";
  }>;
}

const INFERENCE_RULES: InferenceRule[] = [
  // ─── From role ───
  {
    id: "role_founder_infer",
    requires: ["identity.professional_role"],
    condition: (get) => get("identity.professional_role") === "founder",
    infer: () => [
      { dimension: "work.decision_style", value: "autonomous", confidence: 0.8, override: "secondary" },
      { dimension: "work.context_switching", value: "frequent", confidence: 0.85, override: "secondary" },
      { dimension: "work.feedback_style", value: "direct_actionable", confidence: 0.75, override: "secondary" },
    ],
  },
  {
    id: "role_developer_infer",
    requires: ["identity.professional_role"],
    condition: (get) => ["developer", "engineer", "programmer"].includes(get("identity.professional_role") ?? ""),
    infer: () => [
      { dimension: "communication.code_preference", value: "code_over_prose", confidence: 0.85, override: "secondary" },
      { dimension: "work.learning_style", value: "by_building", confidence: 0.75, override: "secondary" },
    ],
  },
  {
    id: "role_manager_infer",
    requires: ["identity.professional_role"],
    condition: (get) => ["manager", "team_lead", "director", "cto", "ceo"].includes(get("identity.professional_role") ?? ""),
    infer: () => [
      { dimension: "communication.summary_preference", value: "executive_summary", confidence: 0.8, override: "secondary" },
      { dimension: "work.delegation_style", value: "outcome_focused", confidence: 0.7, override: "secondary" },
    ],
  },
  {
    id: "role_student_infer",
    requires: ["identity.professional_role"],
    condition: (get) => ["student", "learner"].includes(get("identity.professional_role") ?? ""),
    infer: () => [
      { dimension: "communication.explanation_depth", value: "thorough_with_examples", confidence: 0.8, override: "secondary" },
      { dimension: "work.learning_style", value: "guided_practice", confidence: 0.75, override: "secondary" },
    ],
  },
  {
    id: "role_creative_infer",
    requires: ["identity.professional_role"],
    condition: (get) => ["designer", "writer", "artist", "creative", "marketer", "content_creator"].includes(get("identity.professional_role") ?? ""),
    infer: () => [
      { dimension: "communication.inspiration_style", value: "examples_and_references", confidence: 0.75, override: "secondary" },
      { dimension: "work.iteration_preference", value: "rapid_drafts", confidence: 0.7, override: "secondary" },
    ],
  },

  // ─── From tech comfort ───
  {
    id: "tech_expert_infer",
    requires: ["identity.tech_comfort"],
    condition: (get) => get("identity.tech_comfort") === "expert",
    infer: () => [
      { dimension: "communication.jargon_level", value: "full_technical", confidence: 0.9, override: "primary" },
      { dimension: "communication.explanation_depth", value: "skip_basics", confidence: 0.85, override: "primary" },
      { dimension: "work.automation_preference", value: "automate_everything", confidence: 0.7, override: "secondary" },
    ],
  },
  {
    id: "tech_technical_infer",
    requires: ["identity.tech_comfort"],
    condition: (get) => ["technical", "advanced"].includes(get("identity.tech_comfort") ?? ""),
    infer: () => [
      { dimension: "communication.jargon_level", value: "full_technical", confidence: 0.8, override: "secondary" },
      { dimension: "communication.explanation_depth", value: "skip_basics", confidence: 0.75, override: "secondary" },
    ],
  },
  {
    id: "tech_beginner_infer",
    requires: ["identity.tech_comfort"],
    condition: (get) => ["beginner", "non_technical"].includes(get("identity.tech_comfort") ?? ""),
    infer: () => [
      { dimension: "communication.jargon_level", value: "plain_language", confidence: 0.9, override: "primary" },
      { dimension: "communication.explanation_depth", value: "step_by_step", confidence: 0.85, override: "primary" },
      { dimension: "communication.visual_aids", value: "prefer_screenshots", confidence: 0.7, override: "secondary" },
    ],
  },

  // ─── From communication preferences ───
  {
    id: "direct_tone_infer",
    requires: ["communication.tone_preference"],
    condition: (get) => get("communication.tone_preference") === "direct",
    infer: () => [
      { dimension: "communication.hedge_words", value: "avoid", confidence: 0.8, override: "secondary" },
      { dimension: "communication.pleasantries", value: "skip", confidence: 0.75, override: "secondary" },
    ],
  },
  {
    id: "concise_detail_infer",
    requires: ["communication.detail_level"],
    condition: (get) => get("communication.detail_level") === "concise",
    infer: () => [
      { dimension: "communication.response_length", value: "short", confidence: 0.85, override: "primary" },
      { dimension: "communication.list_format", value: "bullets_over_prose", confidence: 0.7, override: "secondary" },
    ],
  },
  {
    id: "detailed_detail_infer",
    requires: ["communication.detail_level"],
    condition: (get) => get("communication.detail_level") === "thorough",
    infer: () => [
      { dimension: "communication.response_length", value: "comprehensive", confidence: 0.8, override: "secondary" },
      { dimension: "communication.examples_preference", value: "include_examples", confidence: 0.75, override: "secondary" },
    ],
  },

  // ─── From frustration ───
  {
    id: "frustration_verbosity_infer",
    requires: ["identity.ai_frustration"],
    condition: (get) => get("identity.ai_frustration") === "verbosity",
    infer: () => [
      { dimension: "communication.response_length", value: "short", confidence: 0.9, override: "primary" },
      { dimension: "communication.preamble", value: "never", confidence: 0.85, override: "primary" },
      { dimension: "communication.answer_first", value: "always", confidence: 0.9, override: "primary" },
    ],
  },
  {
    id: "frustration_generic_infer",
    requires: ["identity.ai_frustration"],
    condition: (get) => ["generic_output", "generic"].includes(get("identity.ai_frustration") ?? ""),
    infer: () => [
      { dimension: "communication.personalization", value: "always_use_context", confidence: 0.85, override: "primary" },
      { dimension: "communication.generic_avoidance", value: "reference_my_situation", confidence: 0.8, override: "primary" },
    ],
  },
  {
    id: "frustration_context_loss_infer",
    requires: ["identity.ai_frustration"],
    condition: (get) => get("identity.ai_frustration") === "context_loss",
    infer: () => [
      { dimension: "communication.continuity", value: "reference_earlier_messages", confidence: 0.85, override: "primary" },
    ],
  },
  {
    id: "frustration_hallucination_infer",
    requires: ["identity.ai_frustration"],
    condition: (get) => get("identity.ai_frustration") === "hallucinations",
    infer: () => [
      { dimension: "communication.uncertainty_marking", value: "always_flag", confidence: 0.9, override: "primary" },
      { dimension: "communication.source_citing", value: "when_factual", confidence: 0.75, override: "secondary" },
    ],
  },

  // ─── From use case ───
  {
    id: "use_case_coding_infer",
    requires: ["identity.primary_use_case"],
    condition: (get) => ["coding", "local_llm"].includes(get("identity.primary_use_case") ?? ""),
    infer: () => [
      { dimension: "communication.code_preference", value: "code_over_prose", confidence: 0.8, override: "secondary" },
      { dimension: "communication.explanation_style", value: "comments_in_code", confidence: 0.7, override: "secondary" },
    ],
  },
  {
    id: "use_case_multi_infer",
    requires: ["identity.primary_use_case"],
    condition: (get) => get("identity.primary_use_case") === "multi_platform",
    infer: () => [
      { dimension: "work.versatility", value: "cross_domain", confidence: 0.75, override: "secondary" },
    ],
  },

  // ─── From work style ───
  {
    id: "big_picture_infer",
    requires: ["work.task_approach"],
    condition: (get) => get("work.task_approach") === "big_picture_first",
    infer: () => [
      { dimension: "communication.structure_preference", value: "overview_then_details", confidence: 0.8, override: "secondary" },
      { dimension: "work.planning_style", value: "top_down", confidence: 0.7, override: "secondary" },
    ],
  },
  {
    id: "step_by_step_infer",
    requires: ["work.task_approach"],
    condition: (get) => get("work.task_approach") === "step_by_step",
    infer: () => [
      { dimension: "communication.structure_preference", value: "sequential_steps", confidence: 0.8, override: "secondary" },
      { dimension: "work.planning_style", value: "bottom_up", confidence: 0.7, override: "secondary" },
    ],
  },

  // ─── From age range ───
  {
    id: "age_gen_z_infer",
    requires: ["identity.age_range"],
    condition: (get) => ["18_24", "under_18"].includes(get("identity.age_range") ?? ""),
    infer: () => [
      { dimension: "communication.formality", value: "casual", confidence: 0.65, override: "secondary" },
    ],
  },

  // ─── From directness ───
  {
    id: "blunt_directness_infer",
    requires: ["communication.directness"],
    condition: (get) => get("communication.directness") === "blunt",
    infer: () => [
      { dimension: "communication.preamble", value: "never", confidence: 0.85, override: "primary" },
      { dimension: "communication.filler_tolerance", value: "zero", confidence: 0.8, override: "secondary" },
    ],
  },

  // ─── From learning style (tier 2) ───
  {
    id: "learning_experiential_infer",
    requires: ["cognitive.learning_style"],
    condition: (get) => get("cognitive.learning_style") === "experiential",
    infer: () => [
      { dimension: "work.learning_style", value: "by_building", confidence: 0.8, override: "secondary" },
      { dimension: "communication.examples_preference", value: "include_examples", confidence: 0.75, override: "secondary" },
    ],
  },
  {
    id: "learning_structured_infer",
    requires: ["cognitive.learning_style"],
    condition: (get) => get("cognitive.learning_style") === "structured_first",
    infer: () => [
      { dimension: "communication.structure_preference", value: "sequential_steps", confidence: 0.8, override: "secondary" },
    ],
  },

  // ─── From format preference (tier 1) ───
  {
    id: "format_bullets_infer",
    requires: ["communication.format_preference"],
    condition: (get) => get("communication.format_preference") === "bullets",
    infer: () => [
      { dimension: "communication.list_format", value: "bullets_over_prose", confidence: 0.85, override: "secondary" },
    ],
  },
  {
    id: "format_code_infer",
    requires: ["communication.format_preference"],
    condition: (get) => get("communication.format_preference") === "code",
    infer: () => [
      { dimension: "communication.code_preference", value: "code_over_prose", confidence: 0.85, override: "secondary" },
    ],
  },

  // ─── From attention pattern (tier 2) ───
  {
    id: "attention_hyperfocus_infer",
    requires: ["cognitive.attention_pattern"],
    condition: (get) => ["hyperfocus_or_nothing", "hyperfocus"].includes(get("cognitive.attention_pattern") ?? ""),
    infer: () => [
      { dimension: "neurodivergent.hyperfocus", value: "frequent", confidence: 0.75, override: "secondary" },
    ],
  },

  // ─── From verbosity preference ───
  {
    id: "verbosity_minimal_infer",
    requires: ["communication.verbosity_preference"],
    condition: (get) => get("communication.verbosity_preference") === "minimal",
    infer: () => [
      { dimension: "communication.preamble", value: "never", confidence: 0.9, override: "primary" },
      { dimension: "communication.answer_first", value: "always", confidence: 0.85, override: "primary" },
      { dimension: "communication.response_length", value: "short", confidence: 0.85, override: "primary" },
    ],
  },
  {
    id: "verbosity_concise_infer",
    requires: ["communication.verbosity_preference"],
    condition: (get) => get("communication.verbosity_preference") === "concise",
    infer: () => [
      { dimension: "communication.answer_first", value: "always", confidence: 0.8, override: "secondary" },
      { dimension: "communication.response_length", value: "short", confidence: 0.75, override: "secondary" },
    ],
  },

  // ─── From use case: dev_tools ───
  {
    id: "use_case_dev_tools_infer",
    requires: ["identity.primary_use_case"],
    condition: (get) => get("identity.primary_use_case") === "dev_tools",
    infer: () => [
      { dimension: "communication.code_preference", value: "code_over_prose", confidence: 0.85, override: "secondary" },
      { dimension: "identity.tech_comfort", value: "advanced", confidence: 0.7, override: "secondary" },
    ],
  },

  // ─── From feedback style ───
  {
    id: "feedback_critical_infer",
    requires: ["communication.feedback_style"],
    condition: (get) => get("communication.feedback_style") === "critical_first",
    infer: () => [
      { dimension: "work.feedback_style", value: "direct_actionable", confidence: 0.8, override: "secondary" },
    ],
  },

  // ─── From knowledge worker role ───
  {
    id: "role_knowledge_worker_infer",
    requires: ["identity.professional_role"],
    condition: (get) => get("identity.professional_role") === "knowledge_worker",
    infer: () => [
      { dimension: "communication.source_citing", value: "when_factual", confidence: 0.7, override: "secondary" },
      { dimension: "communication.examples_preference", value: "include_examples", confidence: 0.7, override: "secondary" },
    ],
  },

  // ─── Additional founder inferences ───
  {
    id: "founder_planning_infer",
    requires: ["identity.professional_role"],
    condition: (get) => get("identity.professional_role") === "founder",
    infer: () => [
      { dimension: "work.planning_style", value: "strategic", confidence: 0.75, override: "secondary" },
      { dimension: "communication.summary_preference", value: "executive_summary", confidence: 0.7, override: "secondary" },
      { dimension: "work.delegation_style", value: "outcome_focused", confidence: 0.7, override: "secondary" },
    ],
  },

  // ─── Additional tech comfort inferences ───
  {
    id: "tech_automation_infer",
    requires: ["identity.tech_comfort"],
    condition: (get) => ["technical", "advanced", "expert"].includes(get("identity.tech_comfort") ?? ""),
    infer: () => [
      { dimension: "work.automation_preference", value: "automate_everything", confidence: 0.7, override: "secondary" },
    ],
  },

  // ─── From verbosity frustration: extra inferences ───
  {
    id: "frustration_verbosity_extra_infer",
    requires: ["identity.ai_frustration"],
    condition: (get) => get("identity.ai_frustration") === "verbosity",
    infer: () => [
      { dimension: "communication.pleasantries", value: "skip", confidence: 0.8, override: "secondary" },
      { dimension: "communication.filler_tolerance", value: "zero", confidence: 0.8, override: "secondary" },
      { dimension: "communication.hedge_words", value: "avoid", confidence: 0.75, override: "secondary" },
    ],
  },

  // ─── From age range ───
  {
    id: "age_30s_infer",
    requires: ["identity.age_range"],
    condition: (get) => ["25_29", "30_39"].includes(get("identity.age_range") ?? ""),
    infer: () => [
      { dimension: "communication.formality", value: "professional_casual", confidence: 0.6, override: "secondary" },
    ],
  },

  // ─── From dev_tools use case: extra inferences ───
  {
    id: "use_case_dev_extra_infer",
    requires: ["identity.primary_use_case"],
    condition: (get) => get("identity.primary_use_case") === "dev_tools",
    infer: () => [
      { dimension: "communication.format_preference", value: "structured", confidence: 0.7, override: "secondary" },
      { dimension: "communication.examples_preference", value: "include_examples", confidence: 0.7, override: "secondary" },
    ],
  },

  // ─── Founder + dev_tools combined role infer ───
  {
    id: "founder_tech_infer",
    requires: ["identity.professional_role", "identity.primary_use_case"],
    condition: (get) => get("identity.professional_role") === "founder" && get("identity.primary_use_case") === "dev_tools",
    infer: () => [
      { dimension: "work.versatility", value: "cross_domain", confidence: 0.75, override: "secondary" },
      { dimension: "communication.code_switching", value: "tech_and_business", confidence: 0.7, override: "secondary" },
    ],
  },
];

function inferDimensions(
  explicit: Record<string, DimensionValue>
): Record<string, InferredValue> {
  const inferred: Record<string, InferredValue> = {};

  const get = (dim: string): string | undefined => {
    const val = explicit[dim];
    if (!val) return undefined;
    return typeof val.value === "string" ? val.value : String(val.value);
  };

  for (const rule of INFERENCE_RULES) {
    // Check if at least one required dimension exists
    const hasRequired = rule.requires.some((dim) => explicit[dim] !== undefined);
    if (!hasRequired) continue;

    if (!rule.condition(get)) continue;

    const results = rule.infer(get);
    for (const r of results) {
      // Don't override explicit dimensions
      if (explicit[r.dimension]) continue;
      // Don't override higher-confidence inferences
      if (inferred[r.dimension] && inferred[r.dimension].confidence >= r.confidence) continue;

      inferred[r.dimension] = {
        dimension: r.dimension,
        value: r.value,
        confidence: r.confidence,
        source: "compound",
        signal_id: rule.id,
        override: r.override,
      };
    }
  }

  return inferred;
}

// ─── Compound Signals ─────────────────────────────────────
// Multi-dimension combinations that produce actionable export instructions.

interface CompoundRule {
  id: string;
  requires: string[];
  condition: (get: (dim: string) => string | undefined) => boolean;
  produce: (get: (dim: string) => string | undefined) => {
    dimension: string;
    value: string;
    export_instruction: string;
  } | null;
}

const COMPOUND_RULES: CompoundRule[] = [
  {
    id: "expert_concise_combo",
    requires: ["identity.tech_comfort", "communication.response_length"],
    condition: (get) => ["expert", "advanced", "technical"].includes(get("identity.tech_comfort") ?? "") && get("communication.response_length") === "short",
    produce: () => ({
      dimension: "compound.communication_mode",
      value: "expert_concise",
      export_instruction: "I'm a technical expert who values brevity. Skip explanations I'd already know. Give me the answer, the command, the code — not the tutorial.",
    }),
  },
  {
    id: "direct_frustration_combo",
    requires: ["identity.ai_frustration"],
    condition: (get) => get("identity.ai_frustration") === "verbosity",
    produce: () => ({
      dimension: "compound.directness",
      value: "maximum_directness",
      export_instruction: "NEVER start with 'Great question!' or 'Sure, I can help with that.' Just answer. No preamble, no filler, no trailing pleasantries.",
    }),
  },
  {
    id: "founder_big_picture_combo",
    requires: ["identity.professional_role", "work.task_approach"],
    condition: (get) => get("identity.professional_role") === "founder" && get("work.task_approach") === "big_picture_first",
    produce: () => ({
      dimension: "compound.strategic_thinking",
      value: "strategic_founder",
      export_instruction: "I'm a founder who thinks in systems. When I ask about a problem, start with the strategic view — what matters and why — then zoom into tactics if I ask.",
    }),
  },
  {
    id: "tech_beginner_detailed_combo",
    requires: ["identity.tech_comfort", "communication.detail_level"],
    condition: (get) => ["beginner", "non_technical"].includes(get("identity.tech_comfort") ?? "") && get("communication.detail_level") === "thorough",
    produce: () => ({
      dimension: "compound.guidance_mode",
      value: "patient_teacher",
      export_instruction: "I'm not technical but want to understand. Explain things step by step with real-world analogies. Check if I'm following before moving on.",
    }),
  },
  {
    id: "developer_code_first_combo",
    requires: ["identity.professional_role", "identity.tech_comfort"],
    condition: (get) => ["developer", "engineer", "programmer"].includes(get("identity.professional_role") ?? "") && get("identity.tech_comfort") === "expert",
    produce: () => ({
      dimension: "compound.code_communication",
      value: "code_first",
      export_instruction: "Show code first, explain after. I read code faster than prose. Use comments for context, not separate paragraphs.",
    }),
  },
  {
    id: "founder_concise_combo",
    requires: ["identity.professional_role", "identity.ai_frustration"],
    condition: (get) => get("identity.professional_role") === "founder" && ["verbosity", "generic_output"].includes(get("identity.ai_frustration") ?? ""),
    produce: (get) => ({
      dimension: "compound.founder_brevity",
      value: "founder_concise",
      export_instruction: get("identity.ai_frustration") === "verbosity"
        ? "I'm a founder who values brevity. Give me decisions and trade-offs, not background. Lead with the recommendation."
        : "I'm a founder. ALWAYS reference my specific business context. Generic advice is useless.",
    }),
  },
  {
    id: "dev_tools_founder_combo",
    requires: ["identity.primary_use_case", "identity.professional_role"],
    condition: (get) => get("identity.primary_use_case") === "dev_tools" && get("identity.professional_role") === "founder",
    produce: () => ({
      dimension: "compound.technical_founder",
      value: "technical_founder",
      export_instruction: "I'm a technical founder. I code and make business decisions. When discussing code, be technical. When discussing strategy, be concise and decisive.",
    }),
  },
  {
    id: "experiential_expert_combo",
    requires: ["cognitive.learning_style", "identity.tech_comfort"],
    condition: (get) => get("cognitive.learning_style") === "experiential" && ["expert", "advanced", "technical"].includes(get("identity.tech_comfort") ?? ""),
    produce: () => ({
      dimension: "compound.learning_mode",
      value: "expert_experiential",
      export_instruction: "Show working code, not explanations. I learn by running things. Skip theory unless I ask.",
    }),
  },
  {
    id: "analytical_direct_combo",
    requires: ["cognitive.decision_style", "communication.directness"],
    condition: (get) => get("cognitive.decision_style") === "analytical" && ["blunt", "direct"].includes(get("communication.directness") ?? ""),
    produce: () => ({
      dimension: "compound.analytical_directness",
      value: "analytical_direct",
      export_instruction: "Show your reasoning chain. Be definitive — no hedging. When presenting options, include clear trade-offs.",
    }),
  },
  {
    id: "context_loss_continuity_combo",
    requires: ["identity.ai_frustration"],
    condition: (get) => get("identity.ai_frustration") === "context_loss",
    produce: () => ({
      dimension: "compound.continuity_demand",
      value: "high_continuity",
      export_instruction: "ALWAYS reference earlier context. Never make me repeat information I've already provided. Build on previous messages.",
    }),
  },
];

function inferCompoundSignals(
  explicit: Record<string, DimensionValue>,
  inferred?: Record<string, InferredValue>
): Record<string, CompoundValue> {
  const compound: Record<string, CompoundValue> = {};

  // Compound rules check BOTH explicit AND inferred dimensions
  const get = (dim: string): string | undefined => {
    const explicitVal = explicit[dim];
    if (explicitVal) return typeof explicitVal.value === "string" ? explicitVal.value : String(explicitVal.value);
    const inferredVal = inferred?.[dim];
    if (inferredVal) return typeof inferredVal.value === "string" ? inferredVal.value : String(inferredVal.value);
    return undefined;
  };

  for (const rule of COMPOUND_RULES) {
    const hasAll = rule.requires.every((dim) => explicit[dim] !== undefined || inferred?.[dim] !== undefined);
    if (!hasAll) continue;
    if (!rule.condition(get)) continue;

    const result = rule.produce(get);
    if (!result) continue;

    compound[result.dimension] = {
      dimension: result.dimension,
      value: result.value,
      confidence: 0.85,
      rule_id: rule.id,
      inputs: rule.requires,
      export_instruction: result.export_instruction,
    };
  }

  return compound;
}
