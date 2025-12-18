<script>
  export let patternId = 'generic';
  export let size = 28;
  export let id = '';
  export let className = '';

  const buildMajorAspectIcons = () => {
    const wrap = (key, defs, shapes) => {
      const bgId = `${key}-bg`;
      return `
        <svg viewBox="0 0 88 88" class="adv-pattern-svg" aria-hidden="true" role="img">
          <defs>
            <linearGradient id="${bgId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.32" />
              <stop offset="100%" stop-color="#6366f1" stop-opacity="0.25" />
            </linearGradient>
            ${defs || ''}
          </defs>
          <rect x="2" y="2" width="84" height="84" rx="18" fill="url(#${bgId})" stroke="rgba(56, 189, 248, 0.45)" />
          <rect x="2" y="2" width="84" height="84" rx="18" fill="rgba(7, 12, 24, 0.55)" />
          ${shapes}
        </svg>
      `;
    };

    const generic = wrap(
      'generic',
      '',
      `<circle cx="44" cy="44" r="26" fill="rgba(56, 189, 248, 0.08)" stroke="#38bdf8" stroke-width="2.2" />`
    );

    return {
      generic,
      stellium: wrap(
        'stellium',
        `
          <radialGradient id="stellium-halo" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.7" />
            <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.05" />
          </radialGradient>
          <linearGradient id="stellium-orbit" x1="20%" y1="70%" x2="80%" y2="35%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.6" />
            <stop offset="100%" stop-color="#c084fc" stop-opacity="0.8" />
          </linearGradient>
        `,
        `
          <circle cx="44" cy="44" r="30" fill="url(#stellium-halo)" opacity="0.5" />
          <path d="M18 54c7-10 21-16 34-14 7 1 13 4 17 8" fill="none" stroke="url(#stellium-orbit)" stroke-width="2.6" stroke-linecap="round" />
          <path d="M20 42c6-5 12-8 20-9" fill="none" stroke="rgba(99, 102, 241, 0.5)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="4 4" />
          <g fill="#7dd3fc" stroke="#0ea5e9" stroke-width="1.8">
            <circle cx="32" cy="50" r="6.2" />
            <circle cx="42.5" cy="46" r="7" />
            <circle cx="53.5" cy="48.5" r="5.8" />
          </g>
          <circle cx="46" cy="33" r="3.2" fill="#c084fc" opacity="0.9" />
        `
      ),
      t_square: wrap(
        't_square',
        `
          <linearGradient id="t-square-spine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#f97316" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#ef4444" stop-opacity="0.8" />
          </linearGradient>
        `,
        `
          <circle cx="44" cy="50" r="28" fill="rgba(248, 113, 113, 0.07)" />
          <line x1="22" y1="50" x2="66" y2="50" stroke="#fda4af" stroke-width="2.6" stroke-linecap="round" />
          <line x1="44" y1="22" x2="44" y2="50" stroke="url(#t-square-spine)" stroke-width="3.4" stroke-linecap="round" />
          <circle cx="22" cy="50" r="6" fill="#fef08a" stroke="#facc15" stroke-width="1.8" />
          <circle cx="66" cy="50" r="6" fill="#fef08a" stroke="#facc15" stroke-width="1.8" />
          <circle cx="44" cy="22" r="7" fill="#f97316" stroke="#fb923c" stroke-width="2" />
          <path d="M22 50 L44 22 L66 50" fill="none" stroke="rgba(255, 255, 255, 0.35)" stroke-width="1.4" stroke-dasharray="4 3" />
        `
      ),
      grand_trine: wrap(
        'grand_trine',
        `
          <linearGradient id="grand-trine-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#22d3ee" />
            <stop offset="100%" stop-color="#2dd4bf" />
          </linearGradient>
        `,
        `
          <polygon points="44,16 18,64 70,64" fill="rgba(34, 211, 238, 0.08)" stroke="url(#grand-trine-line)" stroke-width="3" stroke-linejoin="round" />
          <circle cx="44" cy="16" r="6.5" fill="#67e8f9" stroke="#22d3ee" stroke-width="1.8" />
          <circle cx="18" cy="64" r="6" fill="#a5f3fc" stroke="#22d3ee" stroke-width="1.6" />
          <circle cx="70" cy="64" r="6" fill="#a5f3fc" stroke="#22d3ee" stroke-width="1.6" />
          <path d="M30 42 Q44 48 58 42" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.3" stroke-dasharray="5 3" />
        `
      ),
      kite: wrap(
        'kite',
        `
          <linearGradient id="kite-spine" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stop-color="#22d3ee" />
            <stop offset="100%" stop-color="#f472b6" />
          </linearGradient>
          <linearGradient id="kite-wing" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stop-color="#a5f3fc" />
            <stop offset="100%" stop-color="#c084fc" />
          </linearGradient>
        `,
        `
          <polygon points="44,10 70,40 44,76 18,40" fill="rgba(34,211,238,0.08)" stroke="url(#kite-wing)" stroke-width="2.4" stroke-linejoin="round" />
          <line x1="44" y1="10" x2="44" y2="76" stroke="url(#kite-spine)" stroke-width="2.8" stroke-linecap="round" />
          <line x1="18" y1="40" x2="70" y2="40" stroke="rgba(255,255,255,0.35)" stroke-width="1.4" stroke-dasharray="5 3" />
          <line x1="18" y1="40" x2="44" y2="10" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />
          <line x1="18" y1="40" x2="44" y2="76" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />
          <line x1="70" y1="40" x2="44" y2="10" stroke="#c084fc" stroke-width="2" stroke-linecap="round" />
          <line x1="70" y1="40" x2="44" y2="76" stroke="#c084fc" stroke-width="2" stroke-linecap="round" />
          <g fill="#e0f2fe" stroke="#22d3ee" stroke-width="1.5">
            <circle cx="44" cy="10" r="5.4" />
            <circle cx="18" cy="40" r="4.8" />
            <circle cx="70" cy="40" r="4.8" />
            <circle cx="44" cy="76" r="5.4" />
          </g>
          <circle cx="44" cy="40" r="4.6" fill="#f472b6" stroke="#fb7185" stroke-width="1.6" opacity="0.9" />
        `
      ),
      grand_cross: wrap(
        'grand_cross',
        `
          <linearGradient id="grand-cross-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#f87171" />
            <stop offset="100%" stop-color="#fbbf24" />
          </linearGradient>
        `,
        `
          <rect x="20" y="20" width="48" height="48" rx="8" fill="rgba(248, 113, 113, 0.08)" stroke="url(#grand-cross-line)" stroke-width="3" />
          <line x1="44" y1="18" x2="44" y2="70" stroke="#fcd34d" stroke-width="2.4" stroke-linecap="round" />
          <line x1="18" y1="44" x2="70" y2="44" stroke="#fcd34d" stroke-width="2.4" stroke-linecap="round" />
          <line x1="22" y1="22" x2="66" y2="66" stroke="rgba(255,255,255,0.28)" stroke-width="1.4" stroke-dasharray="4 3" />
          <line x1="66" y1="22" x2="22" y2="66" stroke="rgba(255,255,255,0.28)" stroke-width="1.4" stroke-dasharray="4 3" />
          <g fill="#fb7185" stroke="#fecdd3" stroke-width="1.8">
            <circle cx="22" cy="22" r="5.5" />
            <circle cx="66" cy="22" r="5.5" />
            <circle cx="22" cy="66" r="5.5" />
            <circle cx="66" cy="66" r="5.5" />
          </g>
        `
      ),
      grand_sextile: wrap(
        'grand_sextile',
        `
          <linearGradient id="grand-sextile-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#34d399" />
            <stop offset="100%" stop-color="#38bdf8" />
          </linearGradient>
        `,
        `
          <polygon points="44,12 66,24 66,46 44,58 22,46 22,24" fill="rgba(52, 211, 153, 0.08)" stroke="url(#grand-sextile-line)" stroke-width="2.5" stroke-linejoin="round" />
          <polygon points="44,20 60,32 52,52 36,52 28,32" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linejoin="round" />
          <polygon points="44,4 74,24 74,52 44,72 14,52 14,24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.4" stroke-dasharray="4 3" />
          <g fill="#bbf7d0" stroke="#34d399" stroke-width="1.6">
            <circle cx="44" cy="12" r="5" />
            <circle cx="66" cy="24" r="5" />
            <circle cx="66" cy="46" r="5" />
            <circle cx="44" cy="58" r="5" />
            <circle cx="22" cy="46" r="5" />
            <circle cx="22" cy="24" r="5" />
          </g>
        `
      ),
      mystic_rectangle: wrap(
        'mystic_rectangle',
        `
          <linearGradient id="mystic-trine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#22d3ee" />
            <stop offset="100%" stop-color="#c084fc" />
          </linearGradient>
          <linearGradient id="mystic-sextile" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#facc15" />
            <stop offset="100%" stop-color="#fb923c" />
          </linearGradient>
        `,
        `
          <rect x="20" y="22" width="48" height="44" rx="10" fill="rgba(192, 132, 252, 0.08)" stroke="url(#mystic-trine)" stroke-width="2.5" />
          <line x1="20" y1="44" x2="68" y2="44" stroke="rgba(255,255,255,0.28)" stroke-width="1.4" stroke-dasharray="4 3" />
          <line x1="20" y1="22" x2="68" y2="66" stroke="url(#mystic-sextile)" stroke-width="2.2" stroke-linecap="round" />
          <line x1="68" y1="22" x2="20" y2="66" stroke="url(#mystic-sextile)" stroke-width="2.2" stroke-linecap="round" />
          <line x1="20" y1="22" x2="68" y2="22" stroke="url(#mystic-trine)" stroke-width="2.2" stroke-linecap="round" />
          <line x1="20" y1="66" x2="68" y2="66" stroke="url(#mystic-trine)" stroke-width="2.2" stroke-linecap="round" />
          <g fill="#fef3c7" stroke="#facc15" stroke-width="1.6">
            <circle cx="20" cy="22" r="5.2" />
            <circle cx="68" cy="22" r="5.2" />
            <circle cx="68" cy="66" r="5.2" />
            <circle cx="20" cy="66" r="5.2" />
          </g>
        `
      ),
      trapeze: wrap(
        'trapeze',
        `
          <linearGradient id="trapeze-sextile" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#34d399" />
            <stop offset="100%" stop-color="#22d3ee" />
          </linearGradient>
          <linearGradient id="trapeze-opposition" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f472b6" />
            <stop offset="100%" stop-color="#fb7185" />
          </linearGradient>
        `,
        `
          <path d="M20 52 L36 32 L58 30 L70 52 Z" fill="rgba(52, 211, 153, 0.08)" stroke="url(#trapeze-sextile)" stroke-width="2.2" stroke-linejoin="round" />
          <line x1="20" y1="52" x2="70" y2="52" stroke="url(#trapeze-opposition)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="5 3" />
          <path d="M36 32 L58 30" stroke="rgba(255,255,255,0.32)" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="3 3" />
          <g fill="#a7f3d0" stroke="#34d399" stroke-width="1.6">
            <circle cx="20" cy="52" r="5.2" />
            <circle cx="36" cy="32" r="5.2" />
            <circle cx="58" cy="30" r="5.2" />
            <circle cx="70" cy="52" r="5.2" />
          </g>
          <circle cx="45" cy="50" r="6" fill="#fb7185" stroke="#f472b6" stroke-width="1.8" opacity="0.9" />
        `
      ),
    };
  };

  const ICONS = buildMajorAspectIcons();

  const namespaceSvg = (svg, prefix) => {
    if (!prefix) return svg;
    const ids = new Map();
    let result = svg.replace(/id="([^"]+)"/g, (match, value) => {
      const next = `${prefix}-${value}`;
      ids.set(value, next);
      return `id="${next}"`;
    });
    result = result.replace(/url\\(#([^)]+)\\)/g, (match, value) => {
      const next = ids.get(value) || `${prefix}-${value}`;
      return `url(#${next})`;
    });
    return result;
  };

  let uid = id || `major-aspect-${Math.random().toString(36).slice(2, 8)}`;
  $: if (id && id !== uid) uid = id;
  $: safeSize = Number.isFinite(Number(size)) ? Number(size) : 28;
  $: svgRaw = ICONS[patternId] || ICONS.generic;
  $: svgMarkup = namespaceSvg(svgRaw, uid);
</script>

<span class={`major-aspect-icon${className ? ` ${className}` : ''}`} style={`--icon-size:${safeSize}px;`}>
  {@html svgMarkup}
</span>

<style>
  .major-aspect-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--icon-size);
    height: var(--icon-size);
  }

  .major-aspect-icon :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
