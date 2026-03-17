<script lang="ts">
  import { t } from "../lib/i18n.svelte.js";

  interface Props {
    content: string;
    filename: string;
    instructions: string;
    dimensionsCovered?: number;
    dimensionsOmitted?: number;
    confidence_floor?: number;
  }
  let { content, filename, instructions, dimensionsCovered, dimensionsOmitted, confidence_floor }: Props = $props();

  let lines = $derived(content.split("\n"));
  let copied = $state(false);

  async function copy() {
    await navigator.clipboard.writeText(content);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }
</script>

<div class="preview glass">
  <div class="header">
    <span class="filename">{filename}</span>
  </div>

  <button class="copy-bar" class:copy-bar--copied={copied} onclick={copy}>
    <svg class="copy-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      {#if copied}
        <polyline points="2,8 6,12 14,4" />
      {:else}
        <rect x="5" y="2" width="9" height="11" rx="1.5" />
        <path d="M2 5v9a1.5 1.5 0 001.5 1.5H11" />
      {/if}
    </svg>
    {copied ? t("export.copied") : t("export.copy")}
  </button>

  <div class="instructions">{instructions}</div>

  <div class="code-area">
    <pre class="code"><code>{#each lines as line, i}<span class="line-num">{String(i + 1).padStart(3, " ")}</span>  {line}
{/each}</code></pre>
  </div>

  <div class="footer">
    {#if dimensionsCovered}
      <span class="stat">{dimensionsCovered} dims</span>
      {#if dimensionsOmitted}<span class="stat">-{dimensionsOmitted} omitted</span>{/if}
      {#if confidence_floor}<span class="stat">&ge;{Math.round(confidence_floor * 100)}% conf</span>{/if}
    {/if}
    <span class="char-count">{content.length.toLocaleString()} chars</span>
  </div>
</div>

<style>
  .preview {
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--color-border);
  }

  .filename {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-accent);
  }

  .copy-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    width: 100%;
    padding: var(--sp-3) var(--sp-4);
    border: none;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-hover);
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .copy-bar:hover {
    background: var(--color-bg-active);
    color: var(--color-text);
  }

  .copy-bar--copied {
    background: var(--color-accent-bg);
    border-color: var(--color-accent-border);
    color: var(--color-accent);
  }

  .copy-icon {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }

  .instructions {
    padding: var(--sp-3) var(--sp-4);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    border-bottom: 1px solid var(--color-border);
    line-height: 1.4;
  }

  .code-area {
    flex: 1;
    overflow-y: auto;
    padding: var(--sp-4) 0;
  }

  .code {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: 1.65;
    color: oklch(from #ffffff l c h / 0.60);
    margin: 0;
    padding: 0 var(--sp-4);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .line-num {
    color: var(--color-text-ghost);
    user-select: none;
  }

  .footer {
    padding: var(--sp-2) var(--sp-4);
    border-top: 1px solid var(--color-border);
    display: flex;
    gap: var(--sp-3);
    justify-content: flex-end;
  }

  .stat {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-accent);
    opacity: 0.6;
  }

  .char-count {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-ghost);
    margin-left: auto;
  }
</style>
