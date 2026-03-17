<script lang="ts">
  import { t } from "../lib/i18n.svelte.js";

  interface Props {
    tier: number;
    headline: string;
    body: string;
    kind?: "start" | "complete";
    onContinue: () => void;
  }
  let { tier, headline, body, kind = "complete", onContinue }: Props = $props();

  // Auto-advance after 2.5 seconds — enough to read, not enough to bore
  $effect(() => {
    const timer = setTimeout(onContinue, 2500);
    return () => clearTimeout(timer);
  });

  let tierLabel = $derived(
    kind === "start"
      ? t("tier.start_label", { tier: String(tier) })
      : t("tier.complete_label", { tier: String(tier) })
  );
</script>

<button class="transition-card animate-card-enter" onclick={onContinue}>
  <div class="accent-bar"></div>
  <div class="content">
    <span class="tier-label">{tierLabel}</span>
    <h2 class="headline">{headline}</h2>
    <p class="body">{body}</p>
    <span class="continue">{t("tier.tap_continue")}</span>
  </div>
</button>

<style>
  .transition-card {
    max-width: 420px;
    width: 100%;
    border-radius: var(--radius-lg);
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    overflow: hidden;
    cursor: pointer;
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.35);
    transition: border-color 0.2s;
    padding: 0;
    text-align: left;
    font: inherit;
    color: inherit;
  }

  .transition-card:hover {
    border-color: var(--color-border-hover);
  }

  .accent-bar {
    height: 3px;
    background: linear-gradient(90deg, var(--color-accent), var(--color-accent-cyan));
  }

  .content {
    padding: var(--sp-8) var(--sp-6);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-3);
  }

  .tier-label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-accent);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .headline {
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--color-text);
    margin: 0;
  }

  .body {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
    max-width: 320px;
  }

  .continue {
    font-size: var(--text-xs);
    color: var(--color-text-ghost);
    margin-top: var(--sp-2);
  }
</style>
