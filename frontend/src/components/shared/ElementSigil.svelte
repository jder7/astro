<script>
  import { ElementSigilShape } from '$lib/astro/element-sigil';

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

  $: builder.setOptions({ sunElement, moonElement, dayElement, ascElement, dayRulerKey, size, id });
  $: shape = builder.build();

  $: ({ uid, safeSize, center, gradients, angles, basePetal, rotationOffset, isGoldPetal, centerRadius, centerStrokeWidth, dayRulerIcon } =
    shape);
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
