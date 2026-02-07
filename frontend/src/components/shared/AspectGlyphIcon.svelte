<script>
  import { aspectIcon, aspectColorClass } from '$lib/astro/aspects';

  export let name = '';
  export let size = 18;
  export let className = '';
  export let title = 'Aspect';

  $: glyph = aspectIcon(name);
  $: aspectClass = aspectColorClass(name);
</script>

<svg
  viewBox="0 0 32 32"
  width={size}
  height={size}
  class={`${className} ${aspectClass}`.trim()}
  aria-hidden="true"
  role="img"
>
  <title>{title}</title>
  <text
    x="50%"
    y="50%"
    text-anchor="middle"
    dominant-baseline="central"
    font-size="20"
    fill="currentColor"
    font-family="serif"
  >
    {glyph}
  </text>
</svg>
