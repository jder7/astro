<script>
  export let id = '';
  export let label = '';
  export let value = '';
  export let badge = '';
  export let alignTop = false;
</script>

<div
  id={id || undefined}
  class={`compact-row${alignTop ? ' items-start' : ''}`}
>
  <div class="space-y-0.5">
    {#if label}<p class="compact-label">{label}</p>{/if}
    {#if value}<p class="compact-value">{value}</p>{/if}
    <slot />
  </div>
  <div class="ml-auto flex items-center gap-2 flex-wrap justify-end text-right">
    {#if badge}<span class="badge">{badge}</span>{/if}
    <slot name="right" />
  </div>
</div>
