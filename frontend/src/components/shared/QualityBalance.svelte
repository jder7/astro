<script>
  import { configStore } from '$lib/state/configStore';
  import { collectPoints } from '$lib/astro/advanced';
  import { QUALITY_ICON } from '$lib/astro/signs';

  export let subject = null;
  export let size = 56;
  export let title = 'Quality balance';
  export let activePoints = null;

  const QUALITIES = ['Cardinal', 'Fixed', 'Mutable'];
  const QUALITY_HEX = {
    Cardinal: '#22d3ee',
    Fixed: '#f0abfc',
    Mutable: '#34d399',
    Default: '#94a3b8',
  };

  let counts = QUALITIES.reduce((acc, quality) => ({ ...acc, [quality]: 0 }), {});
  let totalPoints = 0;
  let tooltipVisible = false;
  let tooltipTimer = null;

  const normalizePointKey = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

  const normalizeQuality = (value) => {
    const clean = String(value || '').trim().toLowerCase();
    if (!clean) return '';
    if (clean === 'cardinal') return 'Cardinal';
    if (clean === 'fixed') return 'Fixed';
    if (clean === 'mutable') return 'Mutable';
    return '';
  };

  const buildPercentages = (counts, total) => {
    const result = Object.fromEntries(QUALITIES.map((q) => [q, 0]));
    if (!total) return result;
    const raw = QUALITIES.map((quality, index) => {
      const value = (counts[quality] || 0) / total * 100;
      const floored = Math.floor(value);
      return { quality, index, value, floored, remainder: value - floored };
    });
    let remaining = 100 - raw.reduce((sum, entry) => sum + entry.floored, 0);
    raw.sort((a, b) => (b.remainder - a.remainder) || (a.index - b.index));
    for (let i = 0; i < remaining; i += 1) {
      raw[i % raw.length].floored += 1;
    }
    raw.forEach((entry) => {
      result[entry.quality] = entry.floored;
    });
    return result;
  };

  const polarToCartesian = (cx, cy, radius, angle) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  const describeArc = (cx, cy, radius, startAngle, endAngle) => {
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} L ${cx} ${cy} Z`;
  };

  const showTooltip = (autoHide = false) => {
    tooltipVisible = true;
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
    if (autoHide) {
      tooltipTimer = setTimeout(() => {
        tooltipVisible = false;
        tooltipTimer = null;
      }, 2400);
    }
  };

  const hideTooltip = () => {
    tooltipVisible = false;
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
  };

  const toggleTooltip = () => {
    if (tooltipVisible) hideTooltip();
    else showTooltip(true);
  };

  $: safeSize = Number.isFinite(Number(size)) ? Number(size) : 56;
  $: radius = safeSize / 2 - 2;
  $: sliceRadius = Math.max(1, radius - Math.max(2, Math.round(safeSize * 0.08)));
  $: center = safeSize / 2;
  $: gap = Math.max(1, Math.round(safeSize * 0.035));
  $: resolvedActivePoints =
    Array.isArray(activePoints) && activePoints.length ? activePoints : $configStore?.active_points || [];
  $: pointsMap = collectPoints(subject || {}).points || {};
  $: subjectPointsRaw = subject?.points || subject?.chart?.points || {};
  $: subjectPointsMap = (() => {
    if (!subjectPointsRaw || typeof subjectPointsRaw !== 'object') return {};
    const entries = Object.entries(subjectPointsRaw).map(([key, value]) => [normalizePointKey(key), value]);
    return Object.fromEntries(entries);
  })();
  const resolvePoint = (key) => {
    const norm = normalizePointKey(key);
    return (
      pointsMap[key] ||
      pointsMap[norm] ||
      subject?.[key] ||
      subject?.[norm] ||
      subjectPointsRaw?.[key] ||
      subjectPointsRaw?.[norm] ||
      subjectPointsMap[norm] ||
      null
    );
  };

  $: {
    const nextCounts = QUALITIES.reduce((acc, quality) => ({ ...acc, [quality]: 0 }), {});
    let total = 0;
    resolvedActivePoints.forEach((key) => {
      const point = resolvePoint(key);
      const quality = normalizeQuality(point?.quality || point?.quality_name || point?.quality_type);
      if (!quality) return;
      nextCounts[quality] = (nextCounts[quality] || 0) + 1;
      total += 1;
    });
    counts = nextCounts;
    totalPoints = total;
  }

  $: percentages = buildPercentages(counts, totalPoints);
  $: segments = (() => {
    const items = [];
    let currentAngle = -90;
    QUALITIES.forEach((quality) => {
      const percent = percentages[quality] || 0;
      if (!percent) return;
      const slice = (percent / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + slice;
      const midAngle = (startAngle + endAngle) / 2;
      const offset = percent === 100 ? 0 : gap;
      const offsetPoint = polarToCartesian(0, 0, offset, midAngle);
      const iconPoint = polarToCartesian(center, center, sliceRadius * 0.6, midAngle);
      items.push({
        quality,
        percent,
        startAngle,
        endAngle,
        offsetX: offsetPoint.x,
        offsetY: offsetPoint.y,
        iconX: iconPoint.x,
        iconY: iconPoint.y,
        color: QUALITY_HEX[quality] || QUALITY_HEX.Default,
        icon: QUALITY_ICON[quality] || '',
      });
      currentAngle = endAngle;
    });
    return items;
  })();

  $: tooltip = (() => {
    const lines = [title];
    QUALITIES.forEach((quality) => {
      const icon = QUALITY_ICON[quality] || '';
      const percent = percentages[quality] ?? 0;
      lines.push(`${icon} ${quality}: ${percent}%`);
    });
    return lines.filter(Boolean).join('\n');
  })();
</script>

<div
  class="relative flex flex-col items-center gap-1"
  title={tooltip}
  role="button"
  tabindex="0"
  aria-label={title}
  on:mouseenter={() => showTooltip(false)}
  on:mouseleave={hideTooltip}
  on:focus={() => showTooltip(false)}
  on:blur={hideTooltip}
  on:click={toggleTooltip}
  on:keydown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTooltip();
    }
  }}
>
  {#if tooltipVisible}
    <div class="absolute bottom-full left-1/2 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900/95 px-2 py-1 text-[11px] text-slate-100 shadow-lg whitespace-pre-line z-20">
      {tooltip}
    </div>
  {/if}
  <svg width={safeSize} height={safeSize} viewBox={`0 0 ${safeSize} ${safeSize}`} role="img" aria-label={title}>
    <circle cx={center} cy={center} r={radius} fill="rgba(15,23,42,0.7)" stroke="rgba(30,41,59,1)" stroke-width="1.5" />
    {#if segments.length === 1 && segments[0]?.percent === 100}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill={segments[0].color}
        fill-opacity="0.3"
        stroke={segments[0].color}
        stroke-width="1"
      />
    {:else}
      {#each segments as segment}
        <g transform={`translate(${segment.offsetX} ${segment.offsetY})`}>
          <path
            d={describeArc(center, center, sliceRadius, segment.startAngle, segment.endAngle)}
            fill={segment.color}
            fill-opacity="0.3"
          />
        </g>
        {#if segment.percent >= 10}
          <text
            x={segment.iconX + segment.offsetX}
            y={segment.iconY + segment.offsetY}
            text-anchor="middle"
            dominant-baseline="central"
            font-size={Math.max(8, Math.round(safeSize * 0.16))}
            fill="rgba(226,232,240,0.9)"
          >
            {segment.icon}
          </text>
        {/if}
      {/each}
    {/if}
  </svg>
</div>
