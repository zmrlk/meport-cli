<script lang="ts">
  import Icon from "./Icon.svelte";

  interface Props {
    placeholder?: string;
    onsubmit: (value: string) => void;
  }
  let { placeholder = "", onsubmit }: Props = $props();

  let value = $state("");

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && value.trim()) {
      onsubmit(value.trim());
    }
  }
</script>

<div class="input-wrapper animate-fade-up" style="--delay: 100ms">
  <input
    type="text"
    class="text-input"
    {placeholder}
    bind:value
    onkeydown={handleKeydown}
    autofocus
  />
  {#if value.trim()}
    <button class="submit-btn" onclick={() => onsubmit(value.trim())}>
      <Icon name="enter" size={16} />
    </button>
  {/if}
</div>

<style>
  .input-wrapper {
    width: 100%;
    position: relative;
    display: flex;
    align-items: center;
  }

  .text-input {
    width: 100%;
    padding: 14px 20px;
    padding-right: 48px;
    border-radius: var(--radius-md);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    font-family: var(--font-sans);
    font-size: var(--text-base);
    font-weight: 400;
    outline: none;
    transition: border-color 0.2s ease;
  }

  .text-input::placeholder {
    color: var(--color-text-muted);
  }

  .text-input:focus {
    border-color: var(--color-accent-border);
  }

  .submit-btn {
    position: absolute;
    right: 8px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: var(--color-accent-bg);
    border: 1px solid var(--color-accent-border);
    color: var(--color-accent);
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
  }

  .submit-btn:hover {
    background: oklch(from #29ef82 l c h / 0.12);
  }
</style>
