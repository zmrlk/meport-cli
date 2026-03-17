<script lang="ts">
  import { t } from "../lib/i18n.svelte.js";
  import Icon from "./Icon.svelte";

  interface Props {
    text: string;
  }
  let { text }: Props = $props();

  let copied = $state(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }
</script>

<button class="copy-btn" class:copied onclick={copy}>
  <Icon name={copied ? "check" : "copy"} size={14} />
  {copied ? t("copy.copied") : t("copy.copy")}
</button>

<style>
  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    background: var(--color-bg-hover);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .copy-btn:hover {
    background: var(--color-bg-active);
    color: var(--color-text);
  }

  .copy-btn.copied {
    background: var(--color-accent-bg);
    border-color: var(--color-accent-border);
    color: var(--color-accent);
  }
</style>
