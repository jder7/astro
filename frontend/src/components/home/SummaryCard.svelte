<script>
  import SummaryMainPoints from './SummaryMainPoints.svelte';
  import SummaryAspects from './SummaryAspects.svelte';
  import SummaryMoonCycle from './SummaryMoonCycle.svelte';

  export let summary = { sections: [], ranges: [], aspects: [], context: {} };
  export let mode = 'natal';
  export let birthParts = null;
  export let transitParts = null;

  const SIGN_SYMBOLS = {
    aries: '♈︎',
    taurus: '♉︎',
    gemini: '♊︎',
    cancer: '♋︎',
    leo: '♌︎',
    virgo: '♍︎',
    libra: '♎︎',
    scorpio: '♏︎',
    sagittarius: '♐︎',
    capricorn: '♑︎',
    aquarius: '♒︎',
    pisces: '♓︎',
  };

  const POINT_ICONS = {
    Sun: '☉',
    Moon: '🌙',
    Ascendant: '↑',
  };

  const ASPECT_ICONS = {
    conjunction: '☌',
    opposition: '☍',
    square: '□',
    trine: '△',
    sextile: '⚹',
  };

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

  const cleanSign = (sign = '') => sign.trim().toLowerCase();
  const signSymbol = (sign) => SIGN_SYMBOLS[cleanSign(sign)] || '';

  const preferredSection = () => summary.sections?.[0] || null;

  $: mainPoints = (() => {
    const section = preferredSection();
    if (!section?.points) return [];
    const targets = ['Sun', 'Moon', 'Ascendant'];
    const result = [];
    targets.forEach((label) => {
      const point = section.points.find((p) => (p.label || '').toLowerCase() === label.toLowerCase());
      if (point) {
        const sym = signSymbol(point.sign);
        result.push({
          label,
          icon: POINT_ICONS[label] || '★',
          text: `${point.label} · in ${point.sign || '—'} ${sym} · @ ${point.degree || '—'}`,
        });
      }
    });
    return result;
  })();

  $: topAspects = (summary.aspects || []).slice(0, 7).map((asp) => {
    const icon = ASPECT_ICONS[(asp.name || '').toLowerCase()] || '✦';
    const orbText = Number.isFinite(Number(asp.orb)) ? `${Number(asp.orb).toFixed(2)}°` : '—';
    return {
      label: asp.name || 'Aspect',
      text: `${asp.left || '—'} ${icon} ${asp.right || '—'} — Orb ${orbText}`,
    };
  });

  function getLunationInfo(parts) {
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
  }

  $: moonParts = mode === 'natal' ? birthParts : transitParts || birthParts;
  $: moonInfo = getLunationInfo(moonParts);
  $: moonPercent = moonInfo ? Math.round(Number(moonInfo.illumination ?? moonInfo.fraction ?? 0) * 100) : 0;
  $: isWaning = moonInfo ? moonInfo.fraction > 0.5 : false;
  $: barStyle = `width:${moonPercent}%;background:${isWaning ? 'linear-gradient(90deg, #f472b6, #f87171)' : 'linear-gradient(90deg, #38bdf8, #6366f1)'}`;
  $: moonTitle = mode === 'natal' ? 'Moon cycle at birth' : 'Moon cycle at moment';
</script>

<div class="flowbite-card space-y-4" id="summary-card">
  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Summary</p>
      <h2>Highlights</h2>
    </div>
    <div class="flex items-center gap-2">
      {#if summary.context?.birth}
        <span class="badge">Birth: {summary.context.birth}</span>
      {/if}
      {#if summary.context?.transit}
        <span class="badge">Transit: {summary.context.transit}</span>
      {/if}
    </div>
  </div>

  <div class="grid gap-4">
    <SummaryMainPoints {mainPoints} />

    <SummaryAspects {topAspects} />

    <SummaryMoonCycle {moonInfo} {moonPercent} {isWaning} {moonTitle} />
  </div>
</div>
