<script>
  import { get } from 'svelte/store';
  import { configStore } from '$lib/state/configStore';
  import { signSymbol, signAbbrev, signName, POINT_ICONS } from '$lib/astro/signs';

  export let summary = { sections: [], aspects: [], rawAspects: [] };

  const ASPECT_ICONS = {
    conjunction: '☌',
    opposition: '☍',
    square: '□',
    trine: '△',
    sextile: '⚹',
  };

  const normalizeLabel = (label) => String(label || '').trim().replace(/\s+/g, '_').toLowerCase();

  const iconForLabel = (label) => {
    if (!label) return '✦';
    const key = normalizeLabel(label);
    return POINT_ICONS[key] || POINT_ICONS[key.charAt(0).toUpperCase() + key.slice(1)] || '✦';
  };

  $: pointIndex = (() => {
    const map = new Map();
    (summary.sections || []).forEach((section) => {
      (section.points || []).forEach((p) => {
        if (!p?.label) return;
        map.set(normalizeLabel(p.label), p);
      });
    });
    return map;
  })();

  $: activeSet = new Set((get(configStore).active_points || []).map((p) => normalizeLabel(p)));

  $: topAspects = (() => {
    const source = summary.rawAspects || summary.aspects || [];
    const enriched = (source || []).map((asp) => {
      const leftLabel = asp.left || '—';
      const rightLabel = asp.right || '—';
      const leftKey = normalizeLabel(leftLabel);
      const rightKey = normalizeLabel(rightLabel);
      const leftPoint = pointIndex.get(leftKey);
      const rightPoint = pointIndex.get(rightKey);
      if (activeSet.size && (!activeSet.has(leftKey) || !activeSet.has(rightKey))) return null;
      const leftSignRaw = leftPoint?.sign || asp.left_sign || leftLabel;
      const rightSignRaw = rightPoint?.sign || asp.right_sign || rightLabel;
      const leftSign = signName(leftSignRaw);
      const rightSign = signName(rightSignRaw);
      const leftDeg = leftPoint?.degree || asp.left_degree || '—';
      const rightDeg = rightPoint?.degree || asp.right_degree || '—';
      const aspectName = asp.name || asp.aspect || 'Aspect';
      const aspectKey = (aspectName || '').toLowerCase();
      const icon = ASPECT_ICONS[aspectKey] || '✦';
      const iconColor = aspectKey === 'opposition' || aspectKey === 'square' ? 'text-rose-400' : 'text-emerald-300';
      const leftIcon = iconForLabel(leftLabel);
      const rightIcon = iconForLabel(rightLabel);
      const orbValRaw = Number.isFinite(asp.orb_value) ? asp.orb_value : Number(String(asp.orb || '').replace('°', ''));
      const orbVal = Number.isFinite(orbValRaw) ? orbValRaw : Infinity;
      const orbText = Number.isFinite(orbValRaw) ? orbValRaw.toFixed(2) : '—';

      const leftText = `${leftIcon} ${leftLabel} (${signSymbol(leftSignRaw)} ${signAbbrev(leftSignRaw)} ${leftDeg})`;
      const rightText = `${rightIcon} ${rightLabel} (${signSymbol(rightSignRaw)} ${signAbbrev(rightSignRaw)} ${rightDeg})`;
      const fullText = `${leftText} in ${aspectName} with ${rightText} - Orb ${orbText}°`;

      console.info('[summary] aspect', {
        aspect: aspectName,
        left: leftLabel,
        right: rightLabel,
        orb: orbText,
        text: fullText,
      });

      return {
        label: aspectName,
        text: fullText,
        leftText,
        rightText,
        icon,
        iconColor,
        involvesSun:
          (leftLabel && leftLabel.toLowerCase().includes('sun')) ||
          (rightLabel && rightLabel.toLowerCase().includes('sun')),
        orbVal,
      };
    });

    const filtered = enriched.filter(Boolean);

    filtered.sort((a, b) => {
      if (a.involvesSun !== b.involvesSun) return a.involvesSun ? -1 : 1;
      return a.orbVal - b.orbVal;
    });

    return filtered.slice(0, 7);
  })();
</script>

<div class="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-2">
  <div class="flex items-center justify-between">
    <p class="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80 font-semibold">Top aspects</p>
    <span class="badge">Top {topAspects.length}</span>
  </div>
  {#if topAspects.length}
    <div class="space-y-2">
      {#each topAspects as aspect}
        <div class="flex items-center gap-2 text-sm text-slate-100">
          <span class="text-xs text-slate-400">{aspect.label}</span>
          <span class="font-semibold flex flex-wrap items-center gap-1">
            <span>{aspect.leftText}</span>
            <span>in</span>
            <span class={aspect.iconColor}>{aspect.icon}</span>
            <span>{aspect.label}</span>
            <span>with</span>
            <span>{aspect.rightText}</span>
            <span>- Orb {aspect.orbVal === Infinity ? '—' : aspect.orbVal.toFixed(2)}°</span>
          </span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-slate-400">Generate a chart to see the top 7 aspects.</p>
  {/if}
</div>
