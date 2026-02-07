<script>
  const PHASES = [
    { name: 'New Moon', icon: '🌑' },
    { name: 'Waxing Crescent', icon: '🌒' },
    { name: 'First Quarter', icon: '🌓' },
    { name: 'Waxing Gibbous', icon: '🌔' },
    { name: 'Full Moon', icon: '🌕' },
    { name: 'Waning Gibbous', icon: '🌖' },
    { name: 'Last Quarter', icon: '🌗' },
    { name: 'Waning Crescent', icon: '🌘' },
  ];

  export let summary = { context: {} };
  export let mode = 'natal';
  export let parts = null;
  export let title = '';

  const getLunationInfo = (parts) => {
    if (!parts) return null;
    const { year, month, day, hour = 0, minute = 0 } = parts;
    if ([year, month, day].some((n) => !Number.isFinite(n))) return null;
    const synodic = 29.530588853;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
    const target = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);
    const daysSince = (target - knownNewMoon) / 86400000;
    const normalized = ((daysSince % synodic) + synodic) % synodic;
    const fraction = normalized / synodic;
    const illumination = 0.5 * (1 - Math.cos((normalized / 29.53) * 2 * Math.PI));
    const idx = Math.floor(fraction * 8 + 0.5) % 8;
    const phase = PHASES[idx] || PHASES[0];
    return {
      ...phase,
      fraction,
      illumination,
      ageText: `${normalized.toFixed(1)} / 29.5 days`,
    };
  };

  $: moonParts =
    parts ||
    (mode === 'natal'
      ? summary.context?.birthParts
      : mode === 'relationship'
        ? summary.context?.firstParts || summary.context?.birthParts
        : summary.context?.transitParts || summary.context?.birthParts);
  $: moonInfo = getLunationInfo(moonParts);
  $: moonPercent = moonInfo ? Math.round(Number(moonInfo.illumination ?? moonInfo.fraction ?? 0) * 100) : 0;
  $: isWaning = moonInfo ? moonInfo.fraction > 0.5 : false;
  $: barStyle = `width:${moonPercent}%;background:${
    isWaning ? 'linear-gradient(90deg, #f472b6, #f87171)' : 'linear-gradient(90deg, #38bdf8, #6366f1)'
  }`;
  $: moonTitle = title || (mode === 'relationship' ? 'Moon cycle (Partner A)' : mode === 'natal' ? 'Moon cycle at birth' : 'Moon cycle at moment');
</script>

<div class="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-2">
  <div class="card-row">
    <div class="flex items-center gap-2 min-w-0">
      <span class="text-xl" aria-hidden="true">{moonInfo?.icon || '🌖'}</span>
      <div class="min-w-0">
        <p class="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80 font-semibold">{moonTitle}</p>
        <p class="text-sm text-slate-200 break-words">
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
