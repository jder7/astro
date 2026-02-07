<script>
  export let size = 'min(128px, 30vw)';
</script>

<svg class="education-scroll" viewBox="0 0 220 220" aria-hidden="true" style={`width: ${size}; height: auto;`}>
  <defs>
    <linearGradient id="scroll-gradient" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#f97316" />
    </linearGradient>
  </defs>
  <path
    d="M56 32c24-8 48-8 72 0l36 12c10 3 18 12 18 22v92c0 12-10 22-22 22H90c-20 0-36-16-36-36V32z"
    fill="url(#scroll-gradient)"
    opacity="0.18"
  />
  <path
    d="M56 32c24-8 48-8 72 0l36 12c10 3 18 12 18 22v92c0 12-10 22-22 22H90c-20 0-36-16-36-36V32z"
    stroke="#fbbf24"
    stroke-width="3"
    fill="none"
  />
  <path
    d="M64 54h88M64 74h76M64 94h90M64 114h72"
    stroke="#f59e0b"
    stroke-width="4"
    stroke-linecap="round"
    opacity="0.7"
  />
  <circle cx="54" cy="36" r="10" fill="#f97316" opacity="0.45" />
</svg>
