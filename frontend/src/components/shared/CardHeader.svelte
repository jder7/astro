<script>
  export let id = '';
  export let label = 'Moment';
  export let value = '';
  export let badge = '';
</script>

<div id={id || undefined} class="compact-row items-start">
  <div class="space-y-0.5">
    <p class="compact-label">{label}</p>
    <p class="compact-value">{value}</p>
    <slot name="left" />
  </div>

  <div class="flex-1 min-w-[80px] flex justify-center">
    <slot name="center" />
  </div>

  <div class="ml-auto flex items-center gap-2 flex-wrap justify-end text-right">
    {#if badge}<span class="badge">{badge}</span>{/if}
    <slot name="right" />
  </div>
</div>
