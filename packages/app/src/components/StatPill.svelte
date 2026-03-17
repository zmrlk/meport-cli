<script lang="ts">
  interface Props {
    value: string | number;
    label: string;
  }
  let { value, label }: Props = $props();
</script>

<div class="pill">
  <span class="num">{value}</span>
  <span class="lbl">{label}</span>
</div>

<style>
  .pill {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 6px 14px;
    border-radius: var(--radius-lg);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
  }

  .num {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-accent);
    font-variant-numeric: tabular-nums;
  }

  .lbl {
    font-size: var(--text-micro);
    color: var(--color-text-muted);
  }
</style>
