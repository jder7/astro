<script>
  export let alt = 'Moon phases';
  export let className = '';
  export let width = 0;
  export let height = 0;
  export let loading = 'lazy';
  export let decoding = 'async';
</script>

<img
  src="/resources/moon-phases.webp"
  {alt}
  {loading}
  {decoding}
  class={className}
  width={width || undefined}
  height={height || undefined}
/>
