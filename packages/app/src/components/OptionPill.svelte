<script lang="ts">
  import Icon from "./Icon.svelte";

  interface Props {
    label: string;
    value: string;
    selected?: boolean;
    suggested?: boolean;
    delay?: number;
    onclick: (value: string) => void;
  }
  let { label, value, selected = false, suggested = false, delay = 0, onclick }: Props = $props();
</script>

<button
  class="pill animate-fade-up"
  class:selected
  class:suggested={suggested && !selected}
  style="--delay: {delay}ms"
  onclick={() => onclick(value)}
>
  {#if selected}
    <span class="check"><Icon name="check" size={14} /></span>
  {:else if suggested}
    <span class="suggest-dot"></span>
  {/if}
  <span class="label">{label}</span>
  {#if suggested && !selected}
    <span class="suggest-tag">wykryto</span>
  {/if}
</button>

<style>
  .pill {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--radius-md);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 400;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .pill:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-border-hover);
    color: var(--color-text);
  }

  .pill.selected {
    background: var(--color-accent-bg);
    border-color: var(--color-accent-border);
    color: var(--color-accent);
  }

  .pill.suggested {
    border-color: oklch(from #29ef82 l c h / 0.25);
    background: oklch(from #29ef82 l c h / 0.04);
  }

  .check {
    color: var(--color-accent);
    display: flex;
    align-items: center;
  }

  .suggest-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-accent);
    opacity: 0.6;
    flex-shrink: 0;
  }

  .suggest-tag {
    font-family: var(--font-mono);
    font-size: var(--text-micro);
    color: var(--color-accent);
    opacity: 0.6;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .label {
    flex: 1;
  }
</style>
