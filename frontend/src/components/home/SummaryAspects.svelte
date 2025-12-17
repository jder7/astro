<script>
  import { signSymbol, signAbbrev, signName } from '$lib/astro/signs';

  export let summary = { sections: [], aspects: [], rawAspects: [] };

  const ASPECT_ICONS = {
    conjunction: '☌',
    opposition: '☍',
    square: '□',
    trine: '△',
    sextile: '⚹',
  };

  const POINT_ICONS = {
    Sun: '☉',
    Moon: '🌙',
    Ascendant: '↑',
    Mercury: '☿',
    Venus: '♀',
    Mars: '♂️',
    Jupiter: '♃',
    Saturn: '♄',
    Uranus: '♅',
    Neptune: '♆',
    Pluto: '♇',
  };

  const iconForLabel = (label) => {
    if (!label) return '✦';
    const key = label.trim();
    return POINT_ICONS[key] || POINT_ICONS[key.charAt(0).toUpperCase() + key.slice(1)] || '✦';
  };

  $: pointIndex = (() => {
    const map = new Map();
    (summary.sections || []).forEach((section) => {
      (section.points || []).forEach((p) => {
        if (!p?.label) return;
        map.set(p.label.toLowerCase(), p);
      });
    });
    return map;
  })();

  $: topAspects = (() => {
    const source = summary.rawAspects || summary.aspects || [];
    const enriched = (source || []).map((asp) => {
      const leftLabel = asp.left || '—';
      const rightLabel = asp.right || '—';
      const leftPoint = pointIndex.get(leftLabel.toLowerCase());
      const rightPoint = pointIndex.get(rightLabel.toLowerCase());
      const leftSignRaw = leftPoint?.sign || asp.left_sign || leftLabel;
      const rightSignRaw = rightPoint?.sign || asp.right_sign || rightLabel;
      const leftSign = signName(leftSignRaw);
      const rightSign = signName(rightSignRaw);
      const leftDeg = leftPoint?.degree || asp.left_degree || '—';
      const rightDeg = rightPoint?.degree || asp.right_degree || '—';
      const aspectName = asp.name || asp.aspect || 'Aspect';
      const icon = ASPECT_ICONS[(aspectName || '').toLowerCase()] || '✦';
      const leftIcon = iconForLabel(leftLabel);
      const rightIcon = iconForLabel(rightLabel);
      const orbValRaw = Number.isFinite(asp.orb_value) ? asp.orb_value : Number(String(asp.orb || '').replace('°', ''));
      const orbVal = Number.isFinite(orbValRaw) ? orbValRaw : Infinity;
      const orbText = Number.isFinite(orbValRaw) ? orbValRaw.toFixed(2) : '—';

      const text = `${leftIcon} ${leftLabel} (${signSymbol(leftSignRaw)} ${signAbbrev(leftSignRaw)} ${leftDeg}) in ${icon} ${aspectName} with ${rightIcon} ${rightLabel} (${signSymbol(rightSignRaw)} ${signAbbrev(rightSignRaw)} ${rightDeg}) - Orb ${orbText}°`;

      console.info('[summary] aspect', {
        aspect: aspectName,
        left: leftLabel,
        right: rightLabel,
        orb: orbText,
        text,
      });

      return {
        label: aspectName,
        text,
        involvesSun:
          (leftLabel && leftLabel.toLowerCase().includes('sun')) ||
          (rightLabel && rightLabel.toLowerCase().includes('sun')),
        orbVal,
      };
    });

    enriched.sort((a, b) => {
      if (a.involvesSun !== b.involvesSun) return a.involvesSun ? -1 : 1;
      return a.orbVal - b.orbVal;
    });

    return enriched.slice(0, 7);
  })();
</script>

<div class="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-2">
  <div class="flex items-center justify-between">
    <p class="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80 font-semibold">Top aspects</p>
    <span class="badge">{topAspects.length}</span>
  </div>
  {#if topAspects.length}
    <div class="space-y-2">
      {#each topAspects as aspect}
        <div class="flex items-center gap-2 text-sm text-slate-100">
          <span class="text-xs text-slate-400">{aspect.label}</span>
          <span class="font-semibold">{aspect.text}</span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-slate-400">Generate a chart to see the top 7 aspects.</p>
  {/if}
</div>
