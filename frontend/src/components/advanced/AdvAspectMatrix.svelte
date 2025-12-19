<script>
  import { get } from 'svelte/store';
  import { extractAspects, extractSubjects, collectPoints } from '$lib/astro/advanced';
  import { configStore } from '$lib/state/configStore';
  import { POINT_SYMBOLS, signSymbol } from '$lib/astro/signs';
  import { aspectIcon, aspectColorClass } from '$lib/astro/aspects';

  export let response = null;
  export let mode = 'natal';

  const normalize = (value) => String(value || '').trim().replace(/\s+/g, '_').toLowerCase();
  const stripOwner = (value) => String(value || '').replace(/\s*\([^)]*\)\s*/g, '').trim();

  $: subjects = extractSubjects(response, mode);
  $: aspectData = extractAspects(response || {});
  $: subject1 = aspectData.subject1 || { aspects: [], majorAspects: [], name: 'Subject 1' };
  $: subject2 = aspectData.subject2 || { aspects: [], majorAspects: [], name: 'Subject 2' };
  $: synastry = aspectData.synastry || { aspects: [], majorAspects: [] };

  $: primarySubject = response?.subject || response?.snapshot?.subject || response?.first_subject || subjects.primary || {};
  $: secondarySubject =
    response?.natal_subject || response?.snapshot?.natal_subject || response?.second_subject || subjects.natal || {};

  $: points = collectPoints(primarySubject || {}).points || {};
  $: secondaryPoints = collectPoints(secondarySubject || {}).points || {};
  $: active = get(configStore).active_points || [];
  $: activeSet = new Set(active.map(normalize));
  $: subject1Name = subject1.name || 'Subject 1';
  $: subject2Name = subject2.name || 'Subject 2';

  const collectAspectLabels = (arr = []) => {
    const set = new Set();
    (arr || []).forEach((a) => {
      if (a?.leftKey) set.add(a.leftKey);
      if (a?.rightKey) set.add(a.rightKey);
    });
    return Array.from(set);
  };

  const pickKeys = (formatted = [], formattedSecondary = []) => {
    const entries = new Set([
      ...Object.keys(points || {}),
      ...Object.keys(secondaryPoints || {}),
      ...collectAspectLabels(formatted),
      ...collectAspectLabels(formattedSecondary),
    ]);
    const arr = Array.from(entries);
    if (!arr.length) return [];
    if (activeSet.size) return arr.filter((k) => activeSet.has(normalize(k)));
    return arr;
  };
  $: rawAspects = subject1.aspects || [];
  $: rawSecondaryAspects = subject2.aspects || [];

  const formatAspect = (entry) => {
    if (!entry) return null;
    const leftLabel = entry.left || entry.leftLabel || entry.leftRef;
    const rightLabel = entry.right || entry.rightLabel || entry.rightRef;
    const left = normalize(entry.leftKey || entry.leftRef || entry.left);
    const right = normalize(entry.rightKey || entry.rightRef || entry.right);
    const leftPlain = normalize(stripOwner(entry.leftKey || entry.leftRef || entry.left));
    const rightPlain = normalize(stripOwner(entry.rightKey || entry.rightRef || entry.right));
    if (!left || !right) return null;
    if (
      activeSet.size &&
      ((!activeSet.has(left) && !activeSet.has(leftPlain)) || (!activeSet.has(right) && !activeSet.has(rightPlain)))
    )
      return null;
    const aspectName = entry.name || entry.aspect || '';
    const icon = aspectIcon(aspectName);
    const iconClass = aspectColorClass(aspectName);
    const orbVal = Number.isFinite(entry.orb) ? entry.orb : Number.parseFloat(String(entry.orb || '').replace('°', ''));
    return {
      left,
      right,
      leftLabel,
      rightLabel,
      leftKey: left,
      rightKey: right,
      leftOwner: entry.leftOwner || '1',
      rightOwner: entry.rightOwner || '1',
      leftSign: entry.signLeft || entry.leftSign,
      rightSign: entry.signRight || entry.rightSign,
      icon,
      iconClass,
      orb: Number.isFinite(orbVal) ? orbVal : null,
      name: aspectName,
    };
  };

  const aspectTitle = (aspect, includeOwners = false) => {
    if (!aspect) return '';
    const leftName = aspect.leftLabel || aspect.left || '';
    const rightName = aspect.rightLabel || aspect.right || '';
    const leftSignGlyph = aspect.leftSign ? signSymbol(aspect.leftSign) : '';
    const rightSignGlyph = aspect.rightSign ? signSymbol(aspect.rightSign) : '';
    const leftOwner =
      includeOwners && aspect.leftOwner === '2'
        ? ` (${subject2Name})`
        : includeOwners && aspect.leftOwner === '1'
          ? ` (${subject1Name})`
          : '';
    const rightOwner =
      includeOwners && aspect.rightOwner === '2'
        ? ` (${subject2Name})`
        : includeOwners && aspect.rightOwner === '1'
          ? ` (${subject1Name})`
          : '';
    const icon = aspect.icon || '';
    const aspectName = aspect.name || 'aspect';
    return `${leftName}${leftSignGlyph ? ` ${leftSignGlyph}` : ''} in ${icon ? `${icon} ` : ''}${aspectName} with ${rightName}${rightSignGlyph ? ` ${rightSignGlyph}` : ''}`.trim();
  };

  let labelMap = new Map();
  let pointMeta = new Map();
  $: formatted = rawAspects.map(formatAspect).filter(Boolean);
  $: formattedSecondary = rawSecondaryAspects.map(formatAspect).filter(Boolean);
  $: formattedSyn = (synastry.aspects || []).map(formatAspect).filter(Boolean);
  $: labelMap = (() => {
    const map = new Map();
    [...formatted, ...formattedSecondary, ...formattedSyn].forEach((a) => {
      if (a?.leftKey && a?.leftLabel) map.set(a.leftKey, a.leftLabel);
      if (a?.rightKey && a?.rightLabel) map.set(a.rightKey, a.rightLabel);
    });
    return map;
  })();
  $: pointMeta = (() => {
    const map = new Map();
    const upsert = (key, label, sign, owner) => {
      if (!key) return;
      const ref = map.get(key) || { label: '', primarySign: '', secondarySign: '' };
      if (label) ref.label = label;
      if (sign) {
        if (owner === '2') {
          ref.secondarySign = ref.secondarySign || sign;
        } else {
          ref.primarySign = ref.primarySign || sign;
        }
      }
      map.set(key, ref);
    };
    [...formatted, ...formattedSecondary, ...formattedSyn].forEach((a) => {
      upsert(a.leftKey, a.leftLabel, a.leftSign, a.leftOwner);
      upsert(a.rightKey, a.rightLabel, a.rightSign, a.rightOwner);
    });
    return map;
  })();
  $: keys = pickKeys(formatted.concat(formattedSyn), formattedSecondary.concat(formattedSyn));
  $: matrixRows = (() => {
    if (!keys.length || (!formatted.length && !formattedSecondary.length)) return [];
    const normPair = (a, b) => (a < b ? `${a}__${b}` : `${b}__${a}`);
    const aspectMap = new Map();
    formatted.forEach((asp) => {
      if (!asp?.leftKey || !asp?.rightKey) return;
      aspectMap.set(normPair(asp.leftKey, asp.rightKey), asp);
    });
    const secondaryMap = new Map();
    formattedSecondary.forEach((asp) => {
      if (!asp?.leftKey || !asp?.rightKey) return;
      secondaryMap.set(normPair(asp.leftKey, asp.rightKey), asp);
    });
    const lookupPoint = (key, preferSecondary = false) => {
      const plain = normalize(stripOwner(key));
      if (preferSecondary) return secondaryPoints[plain] || points[plain] || {};
      return points[plain] || secondaryPoints[plain] || {};
    };
    return keys.map((rowKey, rowIdx) => {
      const rowPoint = lookupPoint(rowKey, false) || {};
      const rowSecondary = lookupPoint(rowKey, true) || {};
      const meta = pointMeta.get(normalize(rowKey)) || {};
      const cells = keys.map((colKey, colIdx) => {
        if (colIdx === rowIdx) {
          const normKey = normalize(rowKey);
          const signVal = meta.primarySign || meta.secondarySign || rowPoint.sign || rowSecondary.sign || '';
          const primaryGlyph = POINT_SYMBOLS[normKey] || signSymbol(signVal) || '★';
          const labelText = labelMap.get(normKey) || meta.label || rowPoint.name || stripOwner(rowKey) || rowKey;
          const titleText = signVal ? `${labelText} in ${signSymbol(signVal)}` : labelText;
          return {
            type: 'diag',
            label: titleText,
            icon: primaryGlyph,
          };
        }
        const pair = normPair(rowKey, colKey);
        const hit = aspectMap.get(pair);
        const hitSecondary = secondaryMap.get(pair);
        if (!hit && !hitSecondary) return { type: 'empty' };
        if (colIdx < rowIdx) {
          return hit
            ? { type: 'icon', value: hit.icon, title: aspectTitle(hit, false), cls: hit.iconClass }
            : { type: 'empty' };
        }
        if (colIdx > rowIdx) {
          if (hitSecondary) {
            return {
              type: 'icon',
              value: hitSecondary.icon,
              title: aspectTitle(hitSecondary, false),
              cls: hitSecondary.iconClass,
            };
          }
          if (!hit) return { type: 'empty' };
          if (mode === 'natal' || mode === 'transit') {
            return {
              type: 'orb',
              value: Number.isFinite(hit.orb) ? `${hit.orb.toFixed(2)}°` : '—',
              title: aspectTitle(hit, false),
            };
          }
          return { type: 'empty' };
        }
        return { type: 'empty' };
      });
        return { rowKey, cells };
    });
  })();

  const diagMeta = (rowKey, colKey) => {
    const normRow = normalize(rowKey);
    const metaRow = pointMeta.get(normRow) || {};
    const baseRow = normalize(stripOwner(rowKey));
    const signValPrimary = metaRow.primarySign || points[baseRow]?.sign;
    const signValSecondary = metaRow.secondarySign || secondaryPoints[baseRow]?.sign || '*';

    const glyph = POINT_SYMBOLS[normRow] || signSymbol(signValPrimary) || signSymbol(signValSecondary) || '★';
    const labelText = labelMap.get(normRow) || metaRow.label || stripOwner(rowKey) || rowKey;

    const titleSign = signValPrimary && signValSecondary && signValPrimary !== signValSecondary
      ? `${signSymbol(signValPrimary)} or ${signSymbol(signValSecondary)}`
      : signSymbol(signValPrimary || signValSecondary);
    const title = titleSign ? `${stripOwner(labelText)} in ${titleSign}` : labelText;
    return { glyph, title };
  };
  const diagonalLegend = 'Diagonal cells show the active points icons.';
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
    Legend: lower-left = {subject1.name || 'Primary'}; upper-right = {subject2.name || 'Secondary'}; 
  </p>
{:else if formattedSecondary.length}
  <p class="text-xs text-slate-400 mt-2">Legend: upper-right = {subject2.name || 'Secondary'} aspects; {diagonalLegend}</p>
{:else if formatted.length}
  <p class="text-xs text-slate-400 mt-2">Legend: lower-left = {subject1.name || 'Primary'} aspects; {diagonalLegend}</p>
{/if}

{#if formattedSyn.length}
  <div class="adv-matrix-wrap mt-4" id="adv-aspects-synastry-matrix">
    <table class="adv-aspect-matrix w-full">
      <tbody>
        {#each keys as rowKey, rowIdx}
          <tr>
              {#each keys as colKey, colIdx}
                {#if colIdx === rowIdx}
                  {@const diag = diagMeta(rowKey, colKey)}
                  <td class="adv-matrix-cell adv-matrix-diag" title={diag.title}>
                    <span class="text-amber-300">{diag.glyph}</span>
                  </td>
                {:else}
                  {@const synHit = formattedSyn.find(
                    (a) =>
                      (a.left === normalize(rowKey) && a.right === normalize(colKey)) ||
                      (a.left === normalize(colKey) && a.right === normalize(rowKey))
                  )}
                  {#if synHit}
                    {#if colIdx > rowIdx}
                      <td class="adv-matrix-cell adv-matrix-orb" title={aspectTitle(synHit, true)}>
                        {Number.isFinite(synHit.orb) ? `${synHit.orb.toFixed(2)}°` : '—'}
                      </td>
                    {:else}
                      <td class={`adv-matrix-cell ${synHit.iconClass || ''}`} title={aspectTitle(synHit, true)}>
                        {synHit.icon}
                      </td>
                    {/if}
                  {:else}
                    <td class="adv-matrix-empty"></td>
                  {/if}
                {/if}
              {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="text-xs text-slate-400 mt-2">Synastry: icons for aspects between subjects; {diagonalLegend}</p>
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
    background: rgba(251, 146, 60, 0.12);
    color: #f59e0b;
  }

  .adv-matrix-orb {
    color: #cbd5e1;
    font-variant-numeric: tabular-nums;
  }

  .adv-matrix-empty {
    background: rgba(15, 23, 42, 0.35);
  }
</style>
