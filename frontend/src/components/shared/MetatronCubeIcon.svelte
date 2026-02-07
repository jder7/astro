<script>
  export let size = 18;
  export let stroke = 'currentColor';
  export let fill = 'none';
  export let className = '';
  export let title = "Metatron's Cube";

  const center = 32;
  const radius = 10;
  const ring = [0, 60, 120, 180, 240, 300];
  const toRad = (deg) => (deg * Math.PI) / 180;
  const round = (val) => Math.round(val * 100) / 100;

  const centers = [
    { x: center, y: center },
    ...ring.map((deg) => ({
      x: round(center + radius * Math.cos(toRad(deg))),
      y: round(center + radius * Math.sin(toRad(deg))),
    })),
    ...ring.map((deg) => ({
      x: round(center + radius * 2 * Math.cos(toRad(deg))),
      y: round(center + radius * 2 * Math.sin(toRad(deg))),
    })),
  ];

  const lines = [];
  for (let i = 0; i < centers.length; i += 1) {
    for (let j = i + 1; j < centers.length; j += 1) {
      lines.push({
        x1: centers[i].x,
        y1: centers[i].y,
        x2: centers[j].x,
        y2: centers[j].y,
      });
    }
  }
</script>

<svg
  viewBox="0 0 64 64"
  width={size}
  height={size}
  fill="none"
  stroke={stroke}
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  aria-hidden="true"
  role="img"
>
  <title>{title}</title>
  {#each lines as line}
    <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke-opacity="0.6" />
  {/each}
  {#each centers as pt}
    <circle cx={pt.x} cy={pt.y} r={radius} fill={fill} />
  {/each}
</svg>
