<script lang="ts">
  import type { Question } from "@meport/core/types";
  import OptionPill from "./OptionPill.svelte";
  import TextInput from "./TextInput.svelte";
  import { getLocale, t } from "../lib/i18n.svelte.js";
  import { translateQuestion } from "../lib/question-translations.js";
  import { detectBrowserContext, getSmartDefault } from "../lib/browser-intelligence.js";

  interface Props {
    question: Question;
    animating: boolean;
    onAnswer: (value: string | string[]) => void;
    onSkip: () => void;
  }
  let { question, animating, onAnswer, onSkip }: Props = $props();

  let locale = $derived(getLocale());

  // Apply translations
  let translated = $derived(translateQuestion(question.id, locale, question));

  // Browser intelligence
  const browserCtx = detectBrowserContext();
  let smartDefault = $derived(getSmartDefault(question.id, browserCtx));

  let multiSelected = $state<string[]>([]);

  function handleSelect(value: string) {
    onAnswer(value);
  }

  function handleMultiSelect(value: string) {
    if (multiSelected.includes(value)) {
      multiSelected = multiSelected.filter(v => v !== value);
    } else {
      multiSelected = [...multiSelected, value];
    }
  }

  function submitMulti() {
    if (multiSelected.length > 0) {
      onAnswer(multiSelected);
      multiSelected = [];
    }
  }

  // Reset multi-select when question changes
  $effect(() => {
    question; // dependency
    multiSelected = [];
  });

  let showHint = $state(false);
  $effect(() => {
    question; // dependency
    showHint = false;
    const timer = setTimeout(() => { showHint = true; }, 2000);
    return () => clearTimeout(timer);
  });
</script>

<div class="card-wrapper" class:exiting={animating}>
  <div class="card glass">
    <!-- Tier badge -->
    <span class="tier-badge">
      {t(`tier.name.${question.tier}`) !== `tier.name.${question.tier}` ? t(`tier.name.${question.tier}`) : question.tier_name}
    </span>

    <!-- Question text -->
    <h2 class="question">{translated.question}</h2>

    <!-- Why this matters hint -->
    {#if showHint && translated.why_this_matters}
      <p class="hint animate-fade-in">{translated.why_this_matters}</p>
    {/if}

    <!-- Answer area -->
    <div class="answers">
      {#if question.type === "open_text"}
        <TextInput
          placeholder={smartDefault?.placeholder || translated.placeholder || (locale === "pl" ? "Wpisz odpowiedź..." : "Type your answer...")}
          onsubmit={(v) => onAnswer(v)}
        />

      {:else if question.type === "multi_select" && translated.options}
        {#each translated.options as opt, i}
          <OptionPill
            label={opt.label}
            value={opt.value}
            selected={multiSelected.includes(opt.value)}
            suggested={smartDefault?.suggest === opt.value}
            delay={i * 60}
            onclick={handleMultiSelect}
          />
        {/each}
        {#if multiSelected.length > 0}
          <button class="submit-multi animate-fade-in" onclick={submitMulti}>
            {t("profiling.continue_multi", { count: multiSelected.length })}
          </button>
        {/if}

      {:else if translated.options}
        {#each translated.options as opt, i}
          <OptionPill
            label={opt.label}
            value={opt.value}
            suggested={smartDefault?.suggest === opt.value}
            delay={i * 60}
            onclick={handleSelect}
          />
        {/each}
      {/if}
    </div>

    <!-- Skip -->
    {#if question.skippable}
      <button class="skip" onclick={onSkip}>{t("profiling.skip")}</button>
    {/if}
  </div>
</div>

<style>
  .card-wrapper {
    animation: card-enter 0.4s var(--ease-out-expo) both;
  }

  .card-wrapper.exiting {
    animation: card-exit 0.25s ease-in both;
  }

  .card {
    max-width: 420px;
    width: 100%;
    padding: var(--sp-8) var(--sp-6) var(--sp-6);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.35),
                inset 0 1px 0 oklch(from #ffffff l c h / 0.04);
  }

  .tier-badge {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: var(--sp-4);
  }

  .question {
    font-size: var(--text-lg);
    font-weight: 400;
    color: oklch(from #ffffff l c h / 0.75);
    text-align: center;
    line-height: 1.5;
    margin: 0 0 var(--sp-6) 0;
    max-width: 360px;
  }

  .answers {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }

  .hint {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-align: center;
    margin: calc(-1 * var(--sp-3)) 0 var(--sp-4);
    max-width: 300px;
    line-height: 1.4;
  }

  .skip {
    margin-top: var(--sp-4);
    background: none;
    border: none;
    color: var(--color-text-ghost);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    cursor: pointer;
    padding: var(--sp-1) var(--sp-3);
    transition: color 0.2s;
  }

  .skip:hover {
    color: var(--color-text-muted);
  }

  .submit-multi {
    margin-top: var(--sp-2);
    padding: var(--sp-2) var(--sp-4);
    border-radius: var(--radius-md);
    background: var(--color-accent-bg);
    border: 1px solid var(--color-accent-border);
    color: var(--color-accent);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .submit-multi:hover {
    background: oklch(from #29ef82 l c h / 0.12);
  }
</style>
