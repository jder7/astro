<script>
  import { ELEMENT_ICON, POINT_SYMBOLS, signName, signSymbol } from '$lib/astro/signs';

  export let sigil = null;
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

  export let sunSign = '';
  export let moonSign = '';
  export let ascSign = '';
  export let daySign = '';

  let tooltipVisible = false;
  let tooltipTimer = null;

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

  const normalizeKey = (value) => String(value || '').trim().toLowerCase();
  const formatKey = (value) =>
    String(value || '')
      .trim()
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const gradientForElement = (element, fallback) => {
    if (element && ELEMENT_GRADIENTS[element]) return ELEMENT_GRADIENTS[element];
    if (fallback && SPECIAL_GRADIENTS[fallback]) return SPECIAL_GRADIENTS[fallback];
    return ELEMENT_GRADIENTS.Default;
  };

  const buildBasePetal = (safeSize, center) => {
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
  };

  const tallyElements = (...elements) => {
    const counts = {};
    elements.forEach((el) => {
      if (!el) return;
      counts[el] = (counts[el] || 0) + 1;
    });
    return counts;
  };

  class ElementSigilShape {
    constructor(options = {}) {
      this.generatedId = options.id || `sigil-${Math.random().toString(36).slice(2, 8)}`;
      this.setOptions(options);
    }

    setOptions(options = {}) {
      this.sunElement = options.sunElement || '';
      this.moonElement = options.moonElement || '';
      this.dayElement = options.dayElement || '';
      this.ascElement = options.ascElement || '';
      this.dayRulerKey = options.dayRulerKey || '';
      this.size = options.size;
      this.uid = options.id || this.generatedId;
      return this;
    }

    build() {
      const safeSize = Number.isFinite(Number(this.size)) ? Number(this.size) : 72;
      const center = safeSize / 2;

      const tally = tallyElements(this.sunElement, this.moonElement, this.dayElement, this.ascElement);
      const hasDuplicate = Object.values(tally).some((count) => count > 1);

      const petalStops = {
        sun: gradientForElement(this.sunElement),
        moon: gradientForElement(this.moonElement, 'silverViolet'),
        day: gradientForElement(this.dayElement, 'goldViolet'),
        asc: gradientForElement(this.ascElement, 'violetLila'),
        spirit: hasDuplicate ? SPECIAL_GRADIENTS.silver : SPECIAL_GRADIENTS.brightGold,
      };

      const gradients = [
        { id: `${this.uid}-p1`, stops: petalStops.spirit },
        { id: `${this.uid}-p2`, stops: petalStops.asc },
        { id: `${this.uid}-p3`, stops: petalStops.day },
        { id: `${this.uid}-p4`, stops: petalStops.moon },
        { id: `${this.uid}-p5`, stops: petalStops.sun },
      ];

      const isGoldPetal = !hasDuplicate;
      const centerRadius = isGoldPetal ? safeSize * 0.14 : safeSize * 0.11;
      const centerStrokeWidth = isGoldPetal ? safeSize * 0.05 : safeSize * 0.015;

      const basePetal = buildBasePetal(safeSize, center);
      const rotationOffset = 90;
      const dayRulerKeyNorm = normalizeKey(this.dayRulerKey);
      const dayRulerIcon = POINT_SYMBOLS[dayRulerKeyNorm] || '☉';

      const angles = [
        { angle: -90, grad: gradients[0].id, icon: '☸' },
        {
          angle: -90 + 72,
          grad: gradients[1].id,
          icon: ELEMENT_ICON[this.ascElement] || POINT_SYMBOLS.ascendant || '↗',
        },
        {
          angle: -90 + 144,
          grad: gradients[2].id,
          icon: ELEMENT_ICON[this.dayElement] || POINT_SYMBOLS[dayRulerKeyNorm] || '★',
        },
        { angle: -90 + 216, grad: gradients[3].id, icon: ELEMENT_ICON[this.moonElement] || '☾' },
        { angle: -90 + 288, grad: gradients[4].id, icon: ELEMENT_ICON[this.sunElement] || '☉' },
      ];

      return {
        uid: this.uid,
        safeSize,
        center,
        gradients,
        angles,
        basePetal,
        rotationOffset,
        isGoldPetal,
        centerRadius,
        centerStrokeWidth,
        dayRulerIcon,
      };
    }
  }

  const builder = new ElementSigilShape({ id });
  let shape = builder.build();
  let uid = '';
  let safeSize = size;
  let center = 0;
  let gradients = [];
  let angles = [];
  let basePetal = '';
  let rotationOffset = 0;
  let isGoldPetal = false;
  let centerRadius = 0;
  let centerStrokeWidth = 0;
  let dayRulerIcon = '';

  $: resolvedSigil = sigil || {};
  $: resolvedSunElement = resolvedSigil.sunElement ?? resolvedSigil.sun_element ?? sunElement;
  $: resolvedMoonElement = resolvedSigil.moonElement ?? resolvedSigil.moon_element ?? moonElement;
  $: resolvedDayElement = resolvedSigil.dayElement ?? resolvedSigil.day_element ?? dayElement;
  $: resolvedAscElement = resolvedSigil.ascElement ?? resolvedSigil.asc_element ?? ascElement;
  $: resolvedDayRulerKey = resolvedSigil.dayRulerKey ?? resolvedSigil.day_ruler_key ?? dayRulerKey;

  $: resolvedSunSign = resolvedSigil.sunSign ?? resolvedSigil.sun_sign ?? sunSign;
  $: resolvedMoonSign = resolvedSigil.moonSign ?? resolvedSigil.moon_sign ?? moonSign;
  $: resolvedAscSign = resolvedSigil.ascSign ?? resolvedSigil.asc_sign ?? ascSign;
  $: resolvedDaySign = resolvedSigil.daySign ?? resolvedSigil.day_sign ?? daySign;

  $: builder.setOptions({
    sunElement: resolvedSunElement,
    moonElement: resolvedMoonElement,
    dayElement: resolvedDayElement,
    ascElement: resolvedAscElement,
    dayRulerKey: resolvedDayRulerKey,
    size,
    id,
  });
  $: shape = builder.build();

  $: ({ uid, safeSize, center, gradients, angles, basePetal, rotationOffset, isGoldPetal, centerRadius, centerStrokeWidth, dayRulerIcon } =
    shape);

  const formatTooltip = () => {
    const entries = [
      { label: 'Sun', element: resolvedSunElement, sign: resolvedSunSign },
      { label: 'Moon', element: resolvedMoonElement, sign: resolvedMoonSign },
      { label: 'Asc', element: resolvedAscElement, sign: resolvedAscSign },
      {
        label: resolvedDayRulerKey ? `${formatKey(resolvedDayRulerKey)} (Day)` : 'Day',
        element: resolvedDayElement,
        sign: resolvedDaySign,
      },
    ];
    return entries
      .filter((entry) => entry.element || entry.sign)
      .map((entry) => {
        const signLabel = entry.sign ? `${signSymbol(entry.sign)} ${signName(entry.sign)}` : '';
        const elementIcon = entry.element ? ELEMENT_ICON[entry.element] || ELEMENT_ICON.Default : '';
        const elementLabel = entry.element ? `${entry.element} ${elementIcon}` : '';
        const details = [signLabel, elementLabel].filter(Boolean).join(' · ');
        return details ? `${entry.label}: ${details}` : entry.label;
      })
      .join('\n');
  };

  $: tooltip = formatTooltip();

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
</script>

<div
  id={id || undefined}
  class={`relative sigil-figure${compact ? ' sigil-figure--compact' : ''}${className ? ` ${className}` : ''}`}
  style={`--sigil-size:${safeSize}px;`}
  title={tooltip}
  role="button"
  tabindex="0"
  aria-label={label}
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
    <div class="absolute bottom-full left-1/2 mb-2 w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900/95 px-2 py-1 text-[11px] text-slate-100 shadow-lg whitespace-pre-line z-20">
      {tooltip}
    </div>
  {/if}
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
