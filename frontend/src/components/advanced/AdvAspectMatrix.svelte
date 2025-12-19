<script>
  import { get } from 'svelte/store';
  import { extractAspects, extractSubjects, collectPoints } from '$lib/astro/advanced';
  import { configStore } from '$lib/state/configStore';
  import { POINT_SYMBOLS, signSymbol } from '$lib/astro/signs';
  import { aspectIcon, aspectColorClass } from '$lib/astro/aspects';

  export let response = null;
  export let mode = 'natal';

  const normalize = (value) => String(value || '').trim().replace(/\s+/g, '_').toLowerCase();

  $: subjects = extractSubjects(response, mode);
  $: points = collectPoints(subjects.primary || {}).points || {};
  $: secondaryPoints = collectPoints(subjects.natal || {}).points || {};
  $: active = get(configStore).active_points || [];
  $: activeSet = new Set(active.map(normalize));

  const pickKeys = () => {
    const entries = new Set([
      ...Object.keys(points || {}),
      ...Object.keys(secondaryPoints || {}),
    ]);
    if (!entries.size) return [];
    const arr = Array.from(entries);
    if (activeSet.size) return arr.filter((k) => activeSet.has(normalize(k)));
    return arr;
  };

  $: aspectData = extractAspects(response || {});
  $: console.info('[matrix] aspectData', aspectData);

  const normalizeRelationshipAspect = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    if (!entry.p1_name || !entry.p2_name) return entry;
    return {
      left: `${entry.p1_name}${entry.p1_owner ? ` (${entry.p1_owner})` : ''}`,
      right: `${entry.p2_name}${entry.p2_owner ? ` (${entry.p2_owner})` : ''}`,
      name: entry.aspect || entry.name || 'Aspect',
      aspect: entry.aspect || entry.name || 'Aspect',
      orb: Number.isFinite(entry.orbit) ? entry.orbit : entry.diff,
    };
  };

  $: rawAspects = Array.isArray(aspectData.aspects)
    ? aspectData.aspects
    : Array.isArray(aspectData.aspects?.aspects)
      ? aspectData.aspects.aspects
      : Array.isArray(aspectData.aspects?.active_aspects)
        ? aspectData.aspects.active_aspects
        : [];
  $: console.info('[matrix] rawAspects', rawAspects);

  $: rawSecondaryAspects = Array.isArray(aspectData.natalAspects)
    ? aspectData.natalAspects
    : Array.isArray(aspectData.aspects?.second_subject)
      ? aspectData.aspects.second_subject
      : [];
  $: console.info('[matrix] rawSecondaryAspects', rawSecondaryAspects);
  $: keys = pickKeys();

  const formatAspect = (entry, fallbackOwner) => {
    if (!entry) return null;
    const rel = normalizeRelationshipAspect(entry);
    const leftLabel = rel.left || entry.left;
    const rightLabel = rel.right || entry.right;
    const left = normalize(leftLabel);
    const right = normalize(rightLabel);
    if (!left || !right) return null;
    if (activeSet.size && (!activeSet.has(left) || !activeSet.has(right))) return null;
    const aspectName = rel.name || entry.name || entry.aspect || '';
    const icon = aspectIcon(aspectName);
    const iconClass = aspectColorClass(aspectName);
    const orbValRaw = rel.orb ?? entry.orb;
    const orbVal = Number.isFinite(orbValRaw) ? orbValRaw : Number.parseFloat(String(orbValRaw || '').replace('°', ''));
    return {
      left,
      right,
      icon,
      iconClass,
      orb: Number.isFinite(orbVal) ? orbVal : null,
      name: aspectName,
    };
  };

  $: formatted = rawAspects.map((a) => formatAspect(a)).filter(Boolean);
  $: formattedSecondary = rawSecondaryAspects.map((a) => formatAspect(a, 'secondary')).filter(Boolean);
  $: console.info('[matrix] formatted primary', formatted);
  $: console.info('[matrix] formatted secondary', formattedSecondary);
  $: matrixRows = (() => {
    if (!keys.length || (!formatted.length && !formattedSecondary.length)) return [];
    const normPair = (a, b) => (a < b ? `${a}__${b}` : `${b}__${a}`);
    const aspectMap = new Map();
    formatted.forEach((asp) => {
      aspectMap.set(normPair(asp.left, asp.right), asp);
    });
    const secondaryMap = new Map();
    formattedSecondary.forEach((asp) => {
      secondaryMap.set(normPair(asp.left, asp.right), asp);
    });
    return keys.map((rowKey, rowIdx) => {
      const rowPoint = points[rowKey] || {};
      const rowPointSecondary = secondaryPoints[rowKey] || {};
      const cells = keys.map((colKey, colIdx) => {
        if (colIdx === rowIdx) {
          const diagPrimary = POINT_SYMBOLS[normalize(rowKey)] || signSymbol(rowPoint.sign) || '★';
          const diagSecondary = rowPointSecondary.sign ? signSymbol(rowPointSecondary.sign) : '';
          return {
            type: 'diag',
            label: rowPoint.name || rowKey,
            icon: diagPrimary,
            iconSecondary: diagSecondary,
          };
        }
        const pair = normPair(rowKey, colKey);
        const hit = aspectMap.get(pair);
        const hitSecondary = secondaryMap.get(pair);
        if (!hit && !hitSecondary) return { type: 'empty' };
        if (colIdx < rowIdx) {
          return hit
            ? { type: 'icon', value: hit.icon, title: hit.name, cls: hit.iconClass }
            : { type: 'empty' };
        }
        if (colIdx > rowIdx) {
          if (hitSecondary) {
            return { type: 'icon', value: hitSecondary.icon, title: hitSecondary.name, cls: hitSecondary.iconClass };
          }
          if (!hit) return { type: 'empty' };
          if (mode === 'natal' || mode === 'transit') {
            return { type: 'orb', value: Number.isFinite(hit.orb) ? `${hit.orb.toFixed(2)}°` : '—', title: hit.name };
          }
          return { type: 'empty' };
        }
        // Fallback
        return hit
          ? { type: 'orb', value: Number.isFinite(hit.orb) ? `${hit.orb.toFixed(2)}°` : '—', title: hit.name }
          : { type: 'empty' };
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
                <td class="adv-matrix-cell adv-matrix-diag" title={cell.label}>
                  <div class="flex flex-col items-center gap-1">
                    <span class="text-amber-300">{cell.icon}</span>
                    {#if cell.iconSecondary}
                      <span class="text-sky-300 text-xs">{cell.iconSecondary}</span>
                    {/if}
                  </div>
                </td>
              {:else if cell.type === 'icon'}
                <td class={`adv-matrix-cell ${cell.cls || ''}`} title={cell.title || ''}>{cell.value}</td>
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

{#if formattedSecondary.length && formatted.length}
  <p class="text-xs text-slate-400 mt-2">
    Legend: lower-left = primary/transit; upper-right = secondary/natal; diagonal shows primary (amber) and secondary (sky) signs.
  </p>
{:else if formattedSecondary.length}
  <p class="text-xs text-slate-400 mt-2">Legend: upper-right = secondary/natal aspects; diagonal shows secondary signs.</p>
{:else if formatted.length}
  <p class="text-xs text-slate-400 mt-2">Legend: lower-left = primary aspects; diagonal shows primary signs.</p>
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
