<script>
  import { extractAspects, extractSubjects, collectPoints } from '$lib/astro/advanced';
  import { POINT_SYMBOLS, signSymbol } from '$lib/astro/signs';
  import { aspectIcon, aspectColorClass } from '$lib/astro/aspects';
  import CardHeader from '$components/shared/CardHeader.svelte';
  import AdvAspectMatrix from '$components/advanced/AdvAspectMatrix.svelte';

  export let response = null;
  export let mode = 'natal';
  export let maxOrb = 10;
  export let showMatrices = true;
  export let movementFilter = 'both';
  export let hideAscendantAspects = false;
  $: orbLimit = Number.isFinite(Number(maxOrb)) ? Number(maxOrb) : 10;

  const normalize = (value) => String(value || '').trim().replace(/\s+/g, '_').toLowerCase();
  const stripOwner = (value) => String(value || '').replace(/\s*\([^)]*\)\s*/g, '').trim();
  const parseOrb = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number.parseFloat(value.replace('°', ''));
    return NaN;
  };
  const withinOrb = (value, limit) => {
    const orbVal = parseOrb(value);
    if (!Number.isFinite(orbVal)) return true;
    return orbVal >= 0 && orbVal <= limit;
  };
  const truncateText = (value, limit = 15) => {
    const text = String(value || '');
    if (text.length <= limit) return text;
    return `${text.slice(0, Math.max(0, limit - 1))}…`;
  };
  const isAscendantLabel = (value) => {
    const norm = normalize(stripOwner(value));
    return norm === 'asc' || norm === 'ascendant';
  };
  const matchesMovementFilter = (aspect, movementMode) => {
    if (movementMode === 'both') return true;
    const movement = String(aspect?.movement || aspect?.aspect_movement || '').toLowerCase();
    if (!movement) return false;
    if (movementMode === 'applying') return movement.includes('applying');
    if (movementMode === 'separating') return movement.includes('separating');
    return true;
  };

  $: aspectData = extractAspects(response || {}, mode);
  $: synastry = aspectData.synastry || { aspects: [] };
  $: synAspects = synastry.aspects || [];
  $: subjects = extractSubjects(response, mode);
  $: subject1 = subjects.primary || response?.snapshot?.subject || response?.first_subject || response?.subject || {};
  $: subject2 = subjects.natal || response?.snapshot?.natal_subject || response?.second_subject || response?.natal_subject || {};
  $: subject1Points = collectPoints(subject1 || {}).points || {};
  $: subject2Points = collectPoints(subject2 || {}).points || {};

  const formatAspect = (entry) => {
    if (!entry) return null;
    const leftLabel = entry.left || entry.leftLabel || entry.leftRef;
    const rightLabel = entry.right || entry.rightLabel || entry.rightRef;
    const leftRef = entry.leftRef || leftLabel;
    const rightRef = entry.rightRef || rightLabel;
    const leftKey = normalize(entry.leftKey || leftRef || entry.left);
    const rightKey = normalize(entry.rightKey || rightRef || entry.right);
    if (!leftKey || !rightKey) return null;
    const aspectName = entry.name || entry.aspect || '';
    return {
      leftKey,
      rightKey,
      leftLabel,
      rightLabel,
      left: leftLabel,
      right: rightLabel,
      leftRef,
      rightRef,
      leftOwner: entry.leftOwner || '1',
      rightOwner: entry.rightOwner || '2',
      leftSign: entry.signLeft,
      rightSign: entry.signRight,
      icon: aspectIcon(aspectName),
      iconClass: aspectColorClass(aspectName),
      name: aspectName,
      orb: entry.orb,
      movement: entry.movement || entry.aspect_movement || '',
    };
  };

  const formatAspectRow = (entry) => {
    if (!entry) return null;
    const base = entry.left || '—';
    const other = entry.right || '—';
    const baseOwner = entry.leftOwner || '1';
    const otherOwner = entry.rightOwner || '2';
    const baseKey = normalize(stripOwner(entry.leftRef || entry.left));
    const otherKey = normalize(stripOwner(entry.rightRef || entry.right));
    const basePoint = baseOwner === '2' ? subject2Points[baseKey] || subject1Points[baseKey] : subject1Points[baseKey] || subject2Points[baseKey];
    const otherPoint = otherOwner === '1' ? subject1Points[otherKey] || subject2Points[otherKey] : subject2Points[otherKey] || subject1Points[otherKey];
    const baseSign = entry.signLeft || basePoint?.sign;
    const otherSign = entry.signRight || otherPoint?.sign;
    const baseIcon = POINT_SYMBOLS[baseKey] || '';
    const otherIcon = POINT_SYMBOLS[otherKey] || '';
    const aspectLabel = entry.name || entry.aspect || 'Aspect';
    const orb =
      typeof entry.orb === 'number'
        ? `${entry.orb.toFixed(2)}°`
        : typeof entry.orb === 'string' && entry.orb.includes('°')
          ? entry.orb
          : entry.orb
            ? `${entry.orb}°`
            : '';
    const orbValue =
      typeof entry.orb === 'number'
        ? entry.orb
        : Number.parseFloat(String(entry.orb || '').replace('°', ''));
    const movement = entry.movement || entry.aspect_movement || '';
    const movementLower = String(movement || '').toLowerCase();
    const movementClass =
      movementLower.includes('applying')
        ? 'text-emerald-300'
        : movementLower.includes('separating')
          ? 'text-rose-300'
          : '';
    return {
      baseIcon,
      base,
      baseSign: baseSign ? signSymbol(baseSign) : '',
      otherIcon,
      other,
      otherSign: otherSign ? signSymbol(otherSign) : '',
      aspect: aspectLabel,
      aspectGlyph: aspectIcon(aspectLabel),
      aspectCls: aspectColorClass(aspectLabel),
      orb: orb || '—',
      orbValue: Number.isFinite(orbValue) ? orbValue : Number.POSITIVE_INFINITY,
      movement,
      movementClass,
    };
  };

  const sortBy = (rows, column, direction) => {
    const dir = direction === 'desc' ? -1 : 1;
    return rows.slice().sort((a, b) => {
      if (!a || !b) return 0;
      if (column === 'orb') {
        return (a.orbValue - b.orbValue) * dir;
      }
      if (column === 'movement') {
        return String(a.movement || '').localeCompare(String(b.movement || '')) * dir;
      }
      return String(a[column] || '').localeCompare(String(b[column] || '')) * dir;
    });
  };

  let sortState = { column: 'orb', direction: 'asc' };
  const onSort = (column) => {
    sortState =
      sortState.column === column
        ? { column, direction: sortState.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' };
  };

  $: filteredSynAspects = synAspects
    .filter((aspect) => withinOrb(aspect?.orb, orbLimit))
    .filter((aspect) => matchesMovementFilter(aspect, movementFilter))
    .filter((aspect) =>
      hideAscendantAspects
        ? !isAscendantLabel(aspect?.left || aspect?.leftRef) && !isAscendantLabel(aspect?.right || aspect?.rightRef)
        : true,
    );
  $: formattedSyn = filteredSynAspects.map(formatAspect).filter(Boolean);
  $: synRows = sortBy(formattedSyn.map(formatAspectRow).filter(Boolean), sortState.column, sortState.direction);

</script>

  <div class="space-y-3" id="adv-aspects-synastry-panel">
  {#if showMatrices}
    <CardHeader label="Synastry matrix" badge={formattedSyn.length} />
    <AdvAspectMatrix {response} mode={mode} showSynastryOnly={true} maxOrb={orbLimit} />
  {/if}

  {#if synRows.length}
    <div class="space-y-2">
      <p class="text-xs text-slate-400">Synastry aspects</p>
      <div class="overflow-x-auto">
        <table class="w-full text-sm min-w-[520px]" id="adv-aspects-synastry-table">
          <thead class="text-xs text-slate-400">
            <tr>
              <th class="py-2 pr-3 text-left cursor-pointer" on:click={() => onSort('base')}>From</th>
              <th class="py-2 pr-3 text-left cursor-pointer" on:click={() => onSort('aspect')}>Aspect</th>
              <th class="py-2 pr-3 text-left cursor-pointer" on:click={() => onSort('other')}>To</th>
              <th class="py-2 pr-3 text-left cursor-pointer" on:click={() => onSort('movement')}>Movement</th>
              <th class="py-2 pr-3 text-left cursor-pointer" on:click={() => onSort('orb')}>Orb</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            {#each synRows as aspect}
              <tr>
                <td class="py-2 pr-3 whitespace-nowrap">
                  <span title={`${aspect.base} ${aspect.baseSign}`.trim()}>
                    {aspect.baseIcon} {truncateText(aspect.base)} {aspect.baseSign}
                  </span>
                </td>
                <td class={`py-2 pr-3 whitespace-nowrap ${aspect.aspectCls}`}>{aspect.aspectGlyph} {aspect.aspect}</td>
                <td class="py-2 pr-3 whitespace-nowrap">
                  <span title={`${aspect.other} ${aspect.otherSign}`.trim()}>
                    {aspect.otherIcon} {truncateText(aspect.other)} {aspect.otherSign}
                  </span>
                </td>
                <td class={`py-2 pr-3 whitespace-nowrap ${aspect.movementClass || ''}`}>{aspect.movement || '—'}</td>
                <td class="py-2 pr-3 whitespace-nowrap">{aspect.orb}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
