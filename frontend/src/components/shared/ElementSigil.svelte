<script>
  import { ELEMENT_ICON, POINT_SYMBOLS } from '$lib/astro/signs';

  export let sunElement = '';
  export let moonElement = '';
  export let dayElement = '';
  export let ascElement = '';
  export let dayRulerKey = '';
  export let label = 'Elemental pentagram';
  export let size = 72;
  export let compact = false;
  export let id = '';
  export let className = '';

  const ELEMENT_GRADIENTS = {
    Fire: ['#fb7185', '#f97316'],
    Earth: ['#afebb4ff', '#a16207'],
    Air: ['#7dd3fc', '#22c55e'],
    Water: ['#7dd3fc', '#1519fbff'],
    Default: ['#94a3b8', '#fa10faff'],
  };

  const SPECIAL_GRADIENTS = {
    silver: ['#ff94e3ff', '#cbd5e1'],
    brightGold: ['#fef08a', '#f59e0b'],
    silverViolet: ['#e2e8f0', '#a78bfa'],
    goldViolet: ['#facc15', '#b194f4ff'],
    violetLila: ['#850cf6ff', '#c084fc'],
  };

  let uid = id || `sigil-${Math.random().toString(36).slice(2, 8)}`;
  $: if (id && id !== uid) uid = id;

  const normalizeKey = (value) => String(value || '').trim().toLowerCase();

  $: safeSize = Number.isFinite(Number(size)) ? Number(size) : 72;
  $: center = safeSize / 2;

  $: tally = (() => {
    const counts = {};
    [sunElement, moonElement, dayElement, ascElement].forEach((el) => {
      if (!el) return;
      counts[el] = (counts[el] || 0) + 1;
    });
    return counts;
  })();

  $: hasDuplicate = Object.values(tally).some((count) => count > 1);

  const gradientForElement = (element, fallback) => {
    if (element && ELEMENT_GRADIENTS[element]) return ELEMENT_GRADIENTS[element];
    if (fallback && SPECIAL_GRADIENTS[fallback]) return SPECIAL_GRADIENTS[fallback];
    return ELEMENT_GRADIENTS.Default;
  };

  $: petalStops = {
    sun: gradientForElement(sunElement),
    moon: gradientForElement(moonElement, 'silverViolet'),
    day: gradientForElement(dayElement, 'goldViolet'),
    asc: gradientForElement(ascElement, 'violetLila'),
    spirit: hasDuplicate ? SPECIAL_GRADIENTS.silver : SPECIAL_GRADIENTS.brightGold,
  };

  $: gradients = [
    { id: `${uid}-p1`, stops: petalStops.spirit },
    { id: `${uid}-p2`, stops: petalStops.asc },
    { id: `${uid}-p3`, stops: petalStops.day },
    { id: `${uid}-p4`, stops: petalStops.moon },
    { id: `${uid}-p5`, stops: petalStops.sun },
  ];

  $: isGoldPetal = !hasDuplicate;
  $: centerRadius = isGoldPetal ? safeSize * 0.14 : safeSize * 0.11;
  $: centerStrokeWidth = isGoldPetal ? safeSize * 0.05 : safeSize * 0.015;

  $: basePetal = (() => {
    const tipY = center - safeSize * 0.42;
    const controlUp = center - safeSize * 0.12;
    const spread = safeSize * 0.28;
    const flareY = center + safeSize * 0.18;
    return [
      `M ${center} ${center}`,
      `C ${center - spread} ${controlUp}, ${center - spread * 0.5} ${flareY}, ${center} ${tipY}`,
      `C ${center + spread * 0.5} ${flareY}, ${center + spread} ${controlUp}, ${center} ${center}`,
      'Z',
    ].join(' ');
  })();

  $: rotationOffset = 90;
  $: dayRulerKeyNorm = normalizeKey(dayRulerKey);
  $: dayRulerIcon = POINT_SYMBOLS[dayRulerKeyNorm] || '☉';

  $: angles = [
    { angle: -90, grad: gradients[0].id, icon: '☸' },
    {
      angle: -90 + 72,
      grad: gradients[1].id,
      icon: ELEMENT_ICON[ascElement] || POINT_SYMBOLS.ascendant || '↗',
    },
    {
      angle: -90 + 144,
      grad: gradients[2].id,
      icon: ELEMENT_ICON[dayElement] || POINT_SYMBOLS[dayRulerKeyNorm] || '★',
    },
    { angle: -90 + 216, grad: gradients[3].id, icon: ELEMENT_ICON[moonElement] || '☾' },
    { angle: -90 + 288, grad: gradients[4].id, icon: ELEMENT_ICON[sunElement] || '☉' },
  ];
</script>

<div
  id={id || undefined}
  class={`sigil-figure${compact ? ' sigil-figure--compact' : ''}${className ? ` ${className}` : ''}`}
  style={`--sigil-size:${safeSize}px;`}
>
  <svg class="element-pentagram" viewBox={`0 0 ${safeSize} ${safeSize}`} role="img" aria-label={label}>
    <defs>
      {#each gradients as gradient}
        <linearGradient id={gradient.id} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color={gradient.stops[0]} />
          <stop offset="100%" stop-color={gradient.stops[1]} />
        </linearGradient>
      {/each}
      <radialGradient id={`${uid}-bg`} cx="50%" cy="45%" r="70%">
        <stop offset="0%" stop-color="rgba(14,165,233,0.28)" />
        <stop offset="100%" stop-color="rgba(99,102,241,0.05)" />
      </radialGradient>
      <filter id={`${uid}-shadow`} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="rgba(14,165,233,0.35)" />
        <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="rgba(12,12,24,0.8)" />
      </filter>
    </defs>

    {#each angles as entry}
      <path
        d={basePetal}
        transform={`rotate(${entry.angle + rotationOffset} ${center} ${center})`}
        fill={`url(#${entry.grad})`}
        stroke="rgba(7, 11, 22, 0.55)"
        stroke-width="1.1"
        opacity="0.94"
      />
    {/each}

    {#each angles as entry}
      {@const rad = (entry.angle * Math.PI) / 180}
      {@const labelR = safeSize * 0.24}
      {@const x = center + Math.cos(rad) * labelR}
      {@const y = center + Math.sin(rad) * labelR}
      <text
        x={x}
        y={y}
        text-anchor="middle"
        font-family="'Space Grotesk','Inter',system-ui"
        font-weight="800"
        font-size={safeSize * 0.11}
        fill="#0b172a"
        opacity="0.9"
        dominant-baseline="middle"
      >
        {entry.icon || '•'}
      </text>
    {/each}

    <circle
      cx={center}
      cy={center}
      r={safeSize * 0.42}
      fill={`url(#${uid}-bg)`}
      stroke={isGoldPetal ? `url(#${gradients[0].id})` : 'rgba(56,189,248,0.18)'}
      stroke-width={isGoldPetal ? safeSize * 0.025 : 1}
      opacity={isGoldPetal ? 0.9 : 1}
    />
    <circle
      cx={center}
      cy={center}
      r={centerRadius}
      fill={`url(#${gradients[0].id})`}
      stroke={isGoldPetal ? `url(#${gradients[0].id})` : 'rgba(255,255,255,0.12)'}
      stroke-width={centerStrokeWidth}
      opacity="0.95"
    />
    <text
      x={center}
      y={center}
      text-anchor="middle"
      font-family="'Space Grotesk','Inter',system-ui"
      font-weight="800"
      font-size={safeSize * 0.13}
      fill="#0b172a"
      dominant-baseline="middle"
    >
      {dayRulerIcon}
    </text>
  </svg>
</div>

<style>
  .sigil-figure {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--sigil-size);
    height: var(--sigil-size);
  }

  .element-pentagram {
    width: 100%;
    height: 100%;
  }
</style>
