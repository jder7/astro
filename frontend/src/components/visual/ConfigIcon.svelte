<script>
  const BASE_SIZE = 24;

  export let size = 18;
  export let strokeWidth = 1.8;
  export let className = '';

  $: resolvedSize = Number.isFinite(Number(size)) ? Number(size) : BASE_SIZE;
  $: viewBox = `0 0 ${resolvedSize} ${resolvedSize}`;
  $: scale = resolvedSize / BASE_SIZE;
</script>

<svg
  aria-hidden="true"
  width={resolvedSize}
  height={resolvedSize}
  viewBox={viewBox}
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  class={className}
>
  <g transform={`scale(${scale} ${scale})`}>
    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M7 12h10M10 18h4" />
  </g>
</svg>
