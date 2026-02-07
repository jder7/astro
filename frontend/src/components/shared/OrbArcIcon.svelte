<script>
  export let size = 20;
  export let stroke = 'currentColor';
  export let fill = 'none';
  export let className = '';
  export let title = 'Orb arc';
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
  <path d="M12 44a20 20 0 0 1 40 0" stroke-dasharray="4 6" />
  <circle cx="18" cy="36" r="3" fill={stroke} stroke="none" />
  <circle cx="32" cy="32" r="3" fill={stroke} stroke="none" />
  <circle cx="46" cy="36" r="3" fill={stroke} stroke="none" />
</svg>
