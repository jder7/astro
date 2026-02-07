<script>
  export let size = 20;
  export let stroke = 'currentColor';
  export let fill = 'none';
  export let className = '';
  export let title = 'Planet ring';
</script>

<svg
  viewBox="0 0 64 64"
  width={size}
  height={size}
  fill={fill}
  stroke={stroke}
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  aria-hidden="true"
  role="img"
>
  <title>{title}</title>
  <circle cx="32" cy="32" r="18" />
  <circle cx="32" cy="32" r="4" fill="none" stroke={stroke} />
  <circle cx="32" cy="14" r="3" fill="none" stroke={stroke} />
  <circle cx="46" cy="20" r="3" fill="none" stroke={stroke} />
  <circle cx="50" cy="34" r="3" fill="none" stroke={stroke} />
  <circle cx="32" cy="50" r="3" fill="none" stroke={stroke} />
  <circle cx="18" cy="44" r="3" fill="none" stroke={stroke} />
  <circle cx="14" cy="28" r="3" fill="none" stroke={stroke} />
</svg>
