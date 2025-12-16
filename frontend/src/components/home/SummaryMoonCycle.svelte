<script>
  export let moonInfo = null;
  export let moonPercent = 0;
  export let isWaning = false;
  export let moonTitle = 'Moon cycle';

  $: barStyle = `width:${moonPercent}%;background:${
    isWaning ? 'linear-gradient(90deg, #f472b6, #f87171)' : 'linear-gradient(90deg, #38bdf8, #6366f1)'
  }`;
</script>

<div class="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-2">
  <div class="flex items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      <span class="text-xl" aria-hidden="true">{moonInfo?.icon || '🌖'}</span>
      <div>
        <p class="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80 font-semibold">{moonTitle}</p>
        <p class="text-sm text-slate-200">
          {moonInfo
            ? `${moonInfo.name} · ${moonInfo.ageText} · ${moonPercent}% illumination`
            : 'Generate a chart to see moon cycle'}
        </p>
      </div>
    </div>
    <span class="badge">{moonPercent}%</span>
  </div>
  <div class="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
    <span class="block h-full rounded-full" style={barStyle}></span>
  </div>
</div>
