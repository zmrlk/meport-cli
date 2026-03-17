<script lang="ts">
  interface Props {
    current: number;
    total: number;
  }
  let { current, total }: Props = $props();

  let dots = $derived(Array.from({ length: total }, (_, i) => i));
</script>

<div class="dots">
  {#each dots as i}
    <div
      class="dot"
      class:active={i === current - 1}
      class:done={i < current - 1}
    ></div>
  {/each}
</div>

<style>
  .dots {
    display: flex;
    gap: var(--sp-1);
    align-items: center;
    justify-content: center;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-xs);
    background: var(--color-text-ghost);
    transition: all 0.3s var(--ease-out-expo);
  }

  .dot.active {
    width: 20px;
    background: oklch(from #29ef82 l c h / 0.70);
  }

  .dot.done {
    background: oklch(from #29ef82 l c h / 0.30);
  }
</style>
