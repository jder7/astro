<script>
  export let size = 18;
  export let stroke = 'currentColor';
  export let fill = 'none';
  export let className = '';
  export let title = 'Hypercube';

  const outer = [
    { x: 10, y: 18 },
    { x: 40, y: 18 },
    { x: 40, y: 48 },
    { x: 10, y: 48 },
    { x: 22, y: 6 },
    { x: 52, y: 6 },
    { x: 52, y: 36 },
    { x: 22, y: 36 },
  ];

  const inner = [
    { x: 22, y: 28 },
    { x: 38, y: 28 },
    { x: 38, y: 44 },
    { x: 22, y: 44 },
    { x: 30, y: 20 },
    { x: 46, y: 20 },
    { x: 46, y: 36 },
    { x: 30, y: 36 },
  ];

  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];

  const lines = [
    ...edges.map(([a, b]) => ({ a: outer[a], b: outer[b] })),
    ...edges.map(([a, b]) => ({ a: inner[a], b: inner[b] })),
    ...outer.map((pt, idx) => ({ a: pt, b: inner[idx] })),
  ];
</script>

<svg
  viewBox="0 0 64 64"
  width={size}
  height={size}
  fill={fill}
  stroke={stroke}
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  aria-hidden="true"
  role="img"
>
  <title>{title}</title>
  {#each lines as line}
    <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} />
  {/each}
</svg>
