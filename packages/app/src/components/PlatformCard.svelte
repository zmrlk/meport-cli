<script lang="ts">
  import type { PlatformMeta } from "../lib/platforms.js";

  interface Props {
    platform: PlatformMeta;
    selected: boolean;
    onclick: () => void;
  }
  let { platform, selected, onclick }: Props = $props();
</script>

<button class="platform glass" class:selected {onclick}>
  <span class="icon-dot" style="background: {platform.color}"></span>
  <div class="info">
    <span class="name">{platform.name}</span>
    <span class="format">{platform.format}</span>
  </div>
</button>

<style>
  .platform {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-3);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
  }

  .platform:hover {
    border-color: var(--color-border-hover);
    background: var(--color-bg-hover);
  }

  .platform.selected {
    border-color: var(--color-accent-border);
    background: var(--color-accent-bg);
  }

  .icon-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 8px oklch(from var(--color-accent) l c h / 0.15);
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .name {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .format {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
</style>
