<script>
  import { get } from 'svelte/store';
  import { extractAspects, extractSubjects, collectPoints } from '$lib/astro/advanced';
  import { configStore } from '$lib/state/configStore';
  import { POINT_SYMBOLS } from '$lib/astro/signs';

  export let response = null;

  const ASPECT_ICON_MAP = {
    conjunction: '◎',
    sextile: '✺',
    square: '□',
    trine: '△',
    opposition: '☍',
  };

  const normalize = (value) => String(value || '').trim().replace(/\s+/g, '_').toLowerCase();

  $: subjects = extractSubjects(response);
  $: points = collectPoints(subjects.primary || {}).points || {};
  $: active = get(configStore).active_points || [];
  $: activeSet = new Set(active.map(normalize));

  const pickKeys = () => {
    const entries = Object.keys(points || {});
    if (!entries.length) return [];
    if (activeSet.size) return entries.filter((k) => activeSet.has(normalize(k)));
    return entries;
  };

  $: aspectData = extractAspects(response || {});
  $: rawAspects = aspectData.aspects || [];
  $: keys = pickKeys();

  const formatAspect = (entry) => {
    if (!entry) return null;
    const left = normalize(entry.left);
    const right = normalize(entry.right);
    if (!left || !right) return null;
    if (activeSet.size && (!activeSet.has(left) || !activeSet.has(right))) return null;
    const aspectName = (entry.name || entry.aspect || '').toLowerCase();
    const icon = ASPECT_ICON_MAP[aspectName] || '✦';
    const orbVal = Number.isFinite(entry.orb) ? entry.orb : Number.parseFloat(String(entry.orb || '').replace('°', ''));
    return {
      left,
      right,
      icon,
      orb: Number.isFinite(orbVal) ? orbVal : null,
      name: entry.name || entry.aspect || '',
    };
  };

  $: formatted = rawAspects.map(formatAspect).filter(Boolean);
  $: matrixRows = (() => {
    if (!keys.length || !formatted.length) return [];
    const normPair = (a, b) => (a < b ? `${a}__${b}` : `${b}__${a}`);
    const aspectMap = new Map();
    formatted.forEach((asp) => {
      aspectMap.set(normPair(asp.left, asp.right), asp);
    });
    return keys.map((rowKey, rowIdx) => {
      const rowPoint = points[rowKey] || {};
      const cells = keys.map((colKey, colIdx) => {
        if (colIdx === rowIdx) {
          return { type: 'diag', label: rowPoint.name || rowKey, icon: POINT_SYMBOLS[normalize(rowKey)] || '★' };
        }
        const pair = normPair(rowKey, colKey);
        const hit = aspectMap.get(pair);
        if (!hit) return { type: 'empty' };
        if (colIdx < rowIdx) {
          return { type: 'icon', value: hit.icon, title: hit.name };
        }
        return { type: 'orb', value: Number.isFinite(hit.orb) ? `${hit.orb.toFixed(2)}°` : '—', title: hit.name };
      });
      return { rowKey, cells };
    });
  })();
</script>

{#if matrixRows.length}
  <div class="adv-matrix-wrap" id="adv-aspects-matrix">
    <table class="adv-aspect-matrix w-full">
      <tbody>
        {#each matrixRows as row}
          <tr>
            {#each row.cells as cell}
              {#if cell.type === 'diag'}
                <td class="adv-matrix-cell adv-matrix-diag" title={cell.label}>{cell.icon}</td>
              {:else if cell.type === 'icon'}
                <td class="adv-matrix-cell" title={cell.title || ''}>{cell.value}</td>
              {:else if cell.type === 'orb'}
                <td class="adv-matrix-cell adv-matrix-orb" title={cell.title || ''}>{cell.value}</td>
              {:else}
                <td class="adv-matrix-empty"></td>
              {/if}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <p class="text-sm text-slate-400">No aspects returned for the current points.</p>
{/if}

<style>
  .adv-matrix-wrap {
    overflow-x: auto;
  }

  .adv-aspect-matrix {
    border-collapse: collapse;
    min-width: 320px;
  }

  .adv-aspect-matrix td {
    min-width: 48px;
    text-align: center;
    padding: 8px 6px;
    border: 1px solid rgba(51, 65, 85, 0.4);
  }

  .adv-matrix-cell {
    font-weight: 600;
    color: #e2e8f0;
  }

  .adv-matrix-diag {
    background: rgba(148, 163, 184, 0.08);
  }

  .adv-matrix-orb {
    color: #cbd5e1;
    font-variant-numeric: tabular-nums;
  }

  .adv-matrix-empty {
    background: rgba(15, 23, 42, 0.35);
  }
</style>
