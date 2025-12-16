<script>
  import { getTheme } from '$lib/theme';

  export let eyebrow = '';
  export let title = '';
  export let description = '';
  export let badge = '';
  export let page = 'home';

  $: theme = getTheme(page);
</script>

<header class="page-shell pt-8 pb-10">
  <div class="glass-card p-8 lg:p-10 space-y-4 relative overflow-hidden">
    <div class={`absolute inset-0 pointer-events-none gradient-overlay ${page}`}></div>
    <div class="relative space-y-3">
      {#if eyebrow}
        <p class={`section-title ${theme.kicker}`}>{eyebrow}</p>
      {/if}
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="space-y-2">
          <h1 class="section-heading">{title}</h1>
          <p class="text-slate-300 max-w-3xl leading-relaxed">{description}</p>
        </div>
        {#if badge}
          <span class="badge accent-badge">{badge}</span>
        {/if}
      </div>
    </div>
  </div>
</header>
