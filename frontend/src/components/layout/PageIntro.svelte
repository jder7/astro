<script>
  export let eyebrow = '';
  export let title = '';
  export let description = '';
  export let badge = '';
</script>

<header class="page-shell pt-8 pb-10">
  <div class="glass-card p-8 lg:p-10 space-y-4 relative overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-indigo-500/5 to-emerald-400/10 pointer-events-none"></div>
    <div class="relative space-y-3">
      {#if eyebrow}
        <p class="section-title text-cyan-200/80">{eyebrow}</p>
      {/if}
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="space-y-2">
          <h1 class="section-heading">{title}</h1>
          <p class="text-slate-300 max-w-3xl leading-relaxed">{description}</p>
        </div>
        {#if badge}
          <span class="badge">{badge}</span>
        {/if}
      </div>
    </div>
  </div>
</header>
