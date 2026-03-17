<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
    disabled?: boolean;
    href?: string;
    onclick?: (e: MouseEvent) => void;
    class?: string;
    children: Snippet;
  }
  let {
    variant = "secondary",
    size = "md",
    disabled = false,
    href,
    onclick,
    class: className = "",
    children,
  }: Props = $props();
</script>

{#if href}
  <a
    {href}
    class="btn btn-{variant} btn-{size} {className}"
    class:disabled
    target="_blank"
    rel="noopener noreferrer"
  >
    {@render children()}
  </a>
{:else}
  <button
    class="btn btn-{variant} btn-{size} {className}"
    {disabled}
    {onclick}
  >
    {@render children()}
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    font-family: var(--font-sans);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    text-decoration: none;
    white-space: nowrap;
  }

  /* ─── Sizes ─── */
  .btn-sm {
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
  }

  .btn-md {
    padding: 10px 18px;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .btn-lg {
    padding: 14px 24px;
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    font-weight: 600;
  }

  /* ─── Variants ─── */
  .btn-primary {
    background: var(--color-accent);
    color: #080a09;
    border-color: transparent;
    font-weight: 600;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 8px 24px oklch(from #29ef82 l c h / 0.20);
  }

  .btn-secondary {
    background: var(--color-bg-subtle);
    border-color: var(--color-border);
    color: var(--color-text);
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: var(--color-border-hover);
    background: var(--color-bg-hover);
    transform: translateY(-1px);
  }

  .btn-ghost {
    background: none;
    border-color: transparent;
    color: var(--color-text-muted);
  }

  .btn-ghost:hover:not(:disabled) {
    color: var(--color-text-secondary);
    background: var(--color-bg-subtle);
  }

  .btn-danger {
    background: var(--color-bg-subtle);
    border-color: var(--color-border);
    color: var(--color-text-muted);
  }

  .btn-danger:hover:not(:disabled) {
    border-color: var(--color-error-border);
    color: var(--color-error);
    background: var(--color-error-bg);
  }

  /* ─── States ─── */
  .btn:disabled, .btn.disabled {
    opacity: 0.3;
    cursor: default;
    pointer-events: none;
  }

  .btn:active:not(:disabled) {
    transform: translateY(0);
  }
</style>
