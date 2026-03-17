<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    color?: "default" | "accent" | "warning" | "purple";
    children: Snippet;
  }
  let { color = "default", children }: Props = $props();
</script>

<h3 class="label label-{color}">
  {@render children()}
</h3>

<style>
  .label {
    font-family: var(--font-mono);
    font-size: var(--text-micro);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    margin: 0;
  }

  .label-accent { color: oklch(from #29ef82 l c h / 0.6); }
  .label-warning { color: oklch(from #f59e0b l c h / 0.6); }
  .label-purple { color: oklch(from #a78bfa l c h / 0.6); }
</style>
