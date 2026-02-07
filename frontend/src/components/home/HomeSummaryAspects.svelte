<script>
  import { get } from 'svelte/store';
  import { configStore } from '$lib/state/configStore';
  import { signSymbol, signAbbrev, signName, POINT_ICONS } from '$lib/astro/signs';
  import { aspectColorClass, aspectIcon } from '$lib/astro/aspects';

  export let summary = { sections: [], aspects: [], rawAspects: [] };
  export let mode = 'natal';

  const normalizeLabel = (label) => String(label || '').trim().replace(/\s+/g, '_').toLowerCase();
  const normalizePointKey = (label) => normalizeLabel(label).replace(/_?\([^)]*\)$/, '').replace(/__+/g, '_');

  const iconForLabel = (label) => {
    if (!label) return '✦';
    const key = normalizeLabel(label);
    return POINT_ICONS[key] || POINT_ICONS[key.charAt(0).toUpperCase() + key.slice(1)] || '✦';
  };

  const buildPointIndex = (section) => {
    const map = new Map();
    (section?.points || []).forEach((p) => {
      if (!p?.label) return;
      map.set(normalizeLabel(p.label), p);
    });
    return map;
  };

  const buildPointIndexFromSections = (sections) => {
    const map = new Map();
    (sections || []).forEach((section) => {
      (section?.points || []).forEach((p) => {
        if (!p?.label) return;
        map.set(normalizeLabel(p.label), p);
      });
    });
    return map;
  };

  $: activeSet = new Set((get(configStore).active_points || []).map((p) => normalizeLabel(p)));

  const buildTopAspects = (source, pointIndex) => {
    const enriched = (source || []).map((asp) => {
      const leftLabel =
        asp.left ||
        asp.leftLabel ||
        asp.leftRef ||
        asp.p1_name ||
        asp.first_point ||
        asp.point_a ||
        asp.inner_point ||
        asp.planet_a ||
        '—';
      const rightLabel =
        asp.right ||
        asp.rightLabel ||
        asp.rightRef ||
        asp.p2_name ||
        asp.second_point ||
        asp.point_b ||
        asp.outer_point ||
        asp.planet_b ||
        '—';
      const leftKey = normalizePointKey(leftLabel);
      const rightKey = normalizePointKey(rightLabel);
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
      const icon = aspectIcon(aspectName);
      const iconColor = aspectColorClass(aspectName);
      const leftIcon = iconForLabel(leftLabel);
      const rightIcon = iconForLabel(rightLabel);
      const orbValRaw = Number.isFinite(asp.orb_value)
        ? asp.orb_value
        : Number.isFinite(asp.orb_value_deg)
          ? asp.orb_value_deg
          : Number(String(asp.orb || '').replace('°', ''));
      const orbVal = Number.isFinite(orbValRaw) ? orbValRaw : Infinity;
      const orbText = Number.isFinite(orbValRaw) ? orbValRaw.toFixed(2) : '—';

      const leftText = `${leftIcon} ${leftLabel} (${signSymbol(leftSignRaw)} ${signAbbrev(leftSignRaw)} ${leftDeg})`;
      const rightText = `${rightIcon} ${rightLabel} (${signSymbol(rightSignRaw)} ${signAbbrev(rightSignRaw)} ${rightDeg})`;
      const fullText = `${leftText} in ${aspectName} with ${rightText} - Orb ${orbText}°`;

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

    filtered.sort((a, b) => a.orbVal - b.orbVal);

    return filtered.slice(0, 7);
  };

  $: aspectBlocks = (() => {
    if (mode === 'relationship') {
      const source = summary.aspects?.length ? summary.aspects : summary.rawAspects || [];
      return [
        {
          title: 'Synastry aspects',
          aspects: buildTopAspects(source, buildPointIndexFromSections(summary.sections || [])),
        },
      ];
    }
    const sections = (summary.sections || []).filter((section) => Array.isArray(section.aspects) && section.aspects.length);
    if (sections.length) {
      return sections.map((section) => ({
        title: section?.meta?.title || section?.meta?.contextKey || 'Top aspects',
        aspects: buildTopAspects(section.aspects, buildPointIndex(section)),
      }));
    }
    const fallbackSource = summary.rawAspects || summary.aspects || [];
    return [
      {
        title: 'Top aspects',
        aspects: buildTopAspects(fallbackSource, buildPointIndex((summary.sections || [])[0] || {})),
      },
    ];
  })();
</script>

<div class="border border-slate-800 rounded-2xl p-4 bg-slate-950/40 space-y-2">
  <div class="space-y-3">
    {#each aspectBlocks as block, index}
      <div class="space-y-2">
        <div class="card-row">
          <p class="text-[11px] uppercase tracking-[0.2em] text-cyan-200/80 font-semibold">{block.title}</p>
          <span class="badge">Top {block.aspects.length}</span>
        </div>
        {#if block.aspects.length}
          <div class="space-y-2">
            {#each block.aspects as aspect}
              <div class="flex flex-wrap items-start gap-2 text-sm text-slate-100 min-w-0">
                <span class="text-xs text-slate-400">{aspect.label}</span>
                <span class="font-semibold flex flex-wrap items-center gap-1 min-w-0">
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
      {#if index < aspectBlocks.length - 1}
        <div class="border-t border-slate-800/60"></div>
      {/if}
    {/each}
  </div>
</div>
