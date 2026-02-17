<script>
  import { get } from 'svelte/store';
  import MajorAspectsList from '$components/shared/MajorAspectsList.svelte';
  import AdvAspectMatrix from '$components/advanced/AdvAspectMatrix.svelte';
  import AdvSynastryAspects from '$components/advanced/AdvSynastryAspects.svelte';
  import AdvAspectsConfigPanel from '$components/advanced/AdvAspectsConfigPanel.svelte';
  import CardHeader from '$components/shared/CardHeader.svelte';
  import ConfigIcon from '$components/visual/ConfigIcon.svelte';
  import { extractAspects, extractSubjects, collectPoints } from '$lib/astro/advanced';
  import { configStore } from '$lib/state/configStore';
  import { POINT_SYMBOLS, signSymbol } from '$lib/astro/signs';
  import { aspectIcon, aspectColorClass } from '$lib/astro/aspects';
  import { formatModeLabel } from '$lib/astro/format';
  import { inputStore } from '$lib/state/inputStore';
  import { formatNameWithGender } from '$lib/utils/gender';

  export let response = null;
  export let mode = 'natal';
  let collapsed = true;
  let showConfig = false;
  let maxOrb = 3;
  let showMajorAspects = true;
  let movementFilter = 'both';
  let hideAscendantAspects = false;
  let showMatrices = false;
  const SHOW_DEBUG_LOGS = false;
  let majorFilterLogKey = '';
  $: orbLimit = Number.isFinite(Number(maxOrb)) ? Number(maxOrb) : 3;

  const normalizeLabel = (label) => String(label || '').trim().replace(/\s+/g, '_').toLowerCase();
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
    const norm = normalizeLabel(stripOwner(value));
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
  const toList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
    return [String(value)];
  };
  const evaluateMajorPatternFilters = (pattern, options = {}) => {
    const {
      activeSet: activeFilter = new Set(),
      hideAscendantAspects: hideAsc = false,
      orbLimit: maxOrbLimit = 3,
    } = options;
    if (!pattern || typeof pattern !== 'object') return { keep: false, reason: 'invalid_pattern' };
    const points = toList(pattern.points).map((point) => normalizeLabel(point));
    if (!points.length) return { keep: false, reason: 'no_points' };
    if (activeFilter.size && points.some((point) => !activeFilter.has(point))) return { keep: false, reason: 'active_points' };
    if (hideAsc && points.some((point) => point === 'asc' || point === 'ascendant')) {
      return { keep: false, reason: 'asc_hidden' };
    }
    const links = Array.isArray(pattern.links) ? pattern.links : [];
    if (!links.length) return { keep: false, reason: 'no_links' };
    const linkOrbs = links.map((link) => Number(link?.orb));
    const invalidOrb = linkOrbs.some((orb) => !Number.isFinite(orb));
    if (invalidOrb) return { keep: false, reason: 'invalid_link_orb', linkOrbs };
    const overLimit = linkOrbs.some((orb) => orb < 0 || orb > maxOrbLimit);
    if (overLimit) return { keep: false, reason: 'orb_limit', linkOrbs };
    return { keep: true, reason: 'kept', linkOrbs };
  };

  const parsePlanetsCount = (pattern) => {
    const points = Array.isArray(pattern?.points) ? pattern.points.filter(Boolean) : [];
    if (points.length) return points.length;
    const fromLabel = Number.parseInt(String(pattern?.planets || '').match(/\d+/)?.[0] || '', 10);
    return Number.isFinite(fromLabel) && fromLabel > 0 ? fromLabel : 0;
  };

  const majorScore = (pattern) => {
    const links = Array.isArray(pattern?.links) ? pattern.links : [];
    const orbSum = links.reduce((sum, link) => {
      const value = Number(link?.orb);
      return Number.isFinite(value) ? sum + Math.abs(value) : sum;
    }, 0);
    const planetsCount = parsePlanetsCount(pattern);
    if (!planetsCount) return Number.POSITIVE_INFINITY;
    return orbSum / planetsCount;
  };

  const sortMajorPatternsByScore = (patterns = []) =>
    (Array.isArray(patterns) ? patterns : []).slice().sort((a, b) => {
      const aScore = majorScore(a);
      const bScore = majorScore(b);
      if (aScore !== bScore) return aScore - bScore;
      return String(a?.name || a?.id || '').localeCompare(String(b?.name || b?.id || ''));
    });

  const bucketMajorPatterns = (patterns = [], options = {}) => {
    const keptPatterns = [];
    const kept = [];
    const dropped = [];
    (patterns || []).forEach((pattern) => {
      const verdict = evaluateMajorPatternFilters(pattern, options);
      const bucketEntry = {
        id: pattern?.id || 'unknown',
        name: pattern?.name || pattern?.id || 'Pattern',
        reason: verdict.reason,
        linkOrbs: verdict.linkOrbs || [],
      };
      if (verdict.keep) {
        keptPatterns.push(pattern);
        kept.push(bucketEntry);
      } else {
        dropped.push(bucketEntry);
      }
    });
    return { keptPatterns, kept, dropped };
  };

  $: aspectData = extractAspects(response || {}, mode);
  $: subject1 = aspectData.subject1 || { name: 'Subject 1', aspects: [], majorAspects: [] };
  $: subject2 = aspectData.subject2 || { name: 'Subject 2', aspects: [], majorAspects: [] };
  $: synastry = aspectData.synastry || { aspects: [], majorAspects: [] };
  $: rawSynAspects = synastry.aspects || [];
  $: aspects = subject1.aspects || [];
  $: natalAspects = subject2.aspects || [];
  $: synAspects = filterAspectEntries(rawSynAspects, {
    useActive: false,
    movementMode: movementFilter,
    hideAsc: hideAscendantAspects,
    orbLimit,
  });
  $: majorAspects = subject1.majorAspects || [];
  $: natalMajorAspects = subject2.majorAspects || [];
  $: synastryMajorAspects = synastry.majorAspects || [];
  $: inputState = $inputStore;
  $: subject2Gender =
    mode === 'relationship' ? inputState?.relationship?.second?.gender : mode === 'natal_transit' ? inputState?.birth?.gender : '';
  $: subject2Label =
    mode === 'relationship'
      ? formatNameWithGender(subject2.name || 'Partner B', subject2Gender) || subject2.name || 'Partner B'
      : mode === 'natal_transit'
        ? formatNameWithGender(subject2.name || 'Natal', subject2Gender) || subject2.name || 'Natal'
        : 'Natal';
  $: activeSet = new Set((get(configStore).active_points || []).map((point) => normalizeLabel(point)));
  $: subjects = extractSubjects(response, mode);
  $: primarySubject = response?.subject || response?.snapshot?.subject || response?.first_subject || subjects.primary || {};
  $: secondarySubject =
    response?.natal_subject || response?.snapshot?.natal_subject || response?.second_subject || subjects.natal || {};
  $: subject1Points = collectPoints(primarySubject || {}).points || {};
  $: subject2Points = collectPoints(secondarySubject || {}).points || {};
  $: synastryOwnerSubjects = { '1': primarySubject || {}, '2': secondarySubject || {} };

  const findPoint = (label, owner = '1') => {
    const norm = normalizeLabel(stripOwner(label));
    if (!norm) return {};
    if (owner === '2') return subject2Points[norm] || subject1Points[norm] || {};
    return subject1Points[norm] || subject2Points[norm] || {};
  };

  const filterAspectsByActive = (entries) =>
    (entries || []).filter((aspect) => {
      if (!aspect || !activeSet.size) return Boolean(aspect);
      const leftKey = normalizeLabel(aspect.left);
      const rightKey = normalizeLabel(aspect.right);
      const leftPlain = normalizeLabel(stripOwner(aspect.left));
      const rightPlain = normalizeLabel(stripOwner(aspect.right));
      if (!leftKey || !rightKey) return false;
      return (activeSet.has(leftKey) || activeSet.has(leftPlain)) && (activeSet.has(rightKey) || activeSet.has(rightPlain));
    });

  const filterAspectEntries = (
    entries,
    { useActive = true, movementMode = 'both', hideAsc = false, orbLimit = 3 } = {},
  ) => {
    const base = useActive ? filterAspectsByActive(entries) : entries || [];
    const ascFiltered = hideAsc
      ? base.filter((aspect) => !isAscendantLabel(aspect?.left) && !isAscendantLabel(aspect?.right))
      : base;
    const movementFiltered = ascFiltered.filter((aspect) => matchesMovementFilter(aspect, movementMode));
    return movementFiltered.filter((aspect) => withinOrb(aspect?.orb, orbLimit));
  };

  $: filteredAspects = filterAspectEntries(aspects, {
    movementMode: movementFilter,
    hideAsc: hideAscendantAspects,
    orbLimit,
  });
  $: filteredNatalAspects = filterAspectEntries(natalAspects, {
    movementMode: movementFilter,
    hideAsc: hideAscendantAspects,
    orbLimit,
  });

  const formatAspectRow = (entry) => {
    if (!entry) return null;
    const base = entry.left || '—';
    const other = entry.right || '—';
    const baseOwner = entry.leftOwner || '1';
    const otherOwner = entry.rightOwner || (mode === 'relationship' ? '2' : baseOwner);
    const baseSign = entry.signLeft || findPoint(base, baseOwner).sign;
    const otherSign = entry.signRight || findPoint(other, otherOwner).sign;
    const baseIcon = POINT_SYMBOLS[normalizeLabel(stripOwner(base))] || '';
    const otherIcon = POINT_SYMBOLS[normalizeLabel(stripOwner(other))] || '';
    const aspectLabel = entry.name || entry.aspect || 'Aspect';
    const aspectGlyph = aspectIcon(aspectLabel);
    const aspectCls = aspectColorClass(aspectLabel);
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
      aspectGlyph,
      aspectCls,
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

  $: currentRows = sortBy(filteredAspects.map(formatAspectRow).filter(Boolean), sortState.column, sortState.direction);
  $: natalRows = sortBy(filteredNatalAspects.map(formatAspectRow).filter(Boolean), sortState.column, sortState.direction);
  $: isDualMode = mode === 'relationship' || mode === 'natal_transit';
  $: majorFilterOptions = {
    orbLimit,
    hideAscendantAspects,
    activeSet,
  };
  $: majorBuckets = bucketMajorPatterns(majorAspects, majorFilterOptions);
  $: natalMajorBuckets = bucketMajorPatterns(natalMajorAspects, majorFilterOptions);
  $: synastryMajorBuckets = bucketMajorPatterns(synastryMajorAspects, majorFilterOptions);
  $: filteredMajorAspects = sortMajorPatternsByScore(majorBuckets.keptPatterns);
  $: filteredNatalMajorAspects = sortMajorPatternsByScore(natalMajorBuckets.keptPatterns);
  $: filteredSynastryMajorAspects = sortMajorPatternsByScore(synastryMajorBuckets.keptPatterns);
  $: {
    const logKey = JSON.stringify({
      orbLimit,
      hideAscendantAspects,
      activeSize: activeSet.size,
      majorIn: majorAspects.length,
      majorOut: filteredMajorAspects.length,
      natalIn: natalMajorAspects.length,
      natalOut: filteredNatalMajorAspects.length,
      synIn: synastryMajorAspects.length,
      synOut: filteredSynastryMajorAspects.length,
    });
    if (SHOW_DEBUG_LOGS && logKey !== majorFilterLogKey) {
      majorFilterLogKey = logKey;
      // Debug buckets for major-aspect filter behavior by panel section.
      console.debug('[AdvAspectsCard][major-filter]', {
        orbLimit,
        hideAscendantAspects,
        activePoints: Array.from(activeSet),
        current: {
          total: majorAspects.length,
          kept: majorBuckets.kept,
          dropped: majorBuckets.dropped,
        },
        natal: {
          total: natalMajorAspects.length,
          kept: natalMajorBuckets.kept,
          dropped: natalMajorBuckets.dropped,
        },
        synastry: {
          total: synastryMajorAspects.length,
          kept: synastryMajorBuckets.kept,
          dropped: synastryMajorBuckets.dropped,
        },
      });
    }
  }
  $: showSynastryPanel = isDualMode;
</script>

<div class="flowbite-card space-y-4">
  <div class="card-head card-head-inline">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Synthesis</p>
      <h2>Aspects Summary</h2>
    </div>
    <div class="card-head-actions">
      <button
        type="button"
        class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition"
        on:click={() => (collapsed = !collapsed)}
        aria-expanded={!collapsed}
        aria-controls="adv-aspects-panel"
        aria-label={collapsed ? 'Expand aspects panel' : 'Collapse aspects panel'}
      >
        <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
        </svg>
      </button>
    </div>
  </div>

  {#if !collapsed}
    <div id="adv-aspects-panel" class="space-y-4">
      {#if !response}
        <p class="text-sm text-slate-400">Generate any mode to view aspects and configurations.</p>
      {:else}
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-2">
              <span class="badge">{formatModeLabel(mode)}</span>
              <button
                type="button"
                class="icon-button"
                aria-label={showConfig ? 'Hide aspect settings' : 'Show aspect settings'}
                aria-expanded={showConfig}
                aria-controls="adv-aspects-config"
                on:click={() => (showConfig = !showConfig)}
              >
                <ConfigIcon />
              </button>
            </div>
          </div>

          {#if showConfig}
            <AdvAspectsConfigPanel
              bind:maxOrb
              orbLimit={orbLimit}
              bind:showMajorAspects
              bind:showMatrices
              bind:hideAscendantAspects
              bind:movementFilter
            />
          {/if}

          {#if showMatrices && !isDualMode}
            <AdvAspectMatrix {response} mode={mode} hideSynastryMatrix={showSynastryPanel} maxOrb={orbLimit} />
          {/if}

          {#if !isDualMode && showMajorAspects}
            <div id="adv-aspects-major-configs" class="space-y-2">
              <CardHeader label="Major configurations" badge={filteredMajorAspects.length + filteredNatalMajorAspects.length} />
              {#if filteredMajorAspects.length}
                <div class="space-y-1">
                  <p class="text-xs text-slate-400">Current chart</p>
                  <div id="adv-aspects-major-current" class="text-sm text-slate-200">
                    <MajorAspectsList
                      patterns={filteredMajorAspects}
                      subject={primarySubject}
                      size={24}
                      textClass="text-sm text-slate-200"
                      showEmpty={false}
                      id="adv-aspects-major-current"
                    />
                  </div>
                </div>
              {/if}
              {#if filteredNatalMajorAspects.length}
                <div class="space-y-1">
                  <p class="text-xs text-slate-400">Natal</p>
                  <div id="adv-aspects-major-natal" class="text-sm text-slate-200">
                    <MajorAspectsList
                      patterns={filteredNatalMajorAspects}
                      subject={secondarySubject}
                      size={24}
                      textClass="text-sm text-slate-200"
                      showEmpty={false}
                      id="adv-aspects-major-natal"
                    />
                  </div>
                </div>
              {/if}
              {#if !filteredMajorAspects.length && !filteredNatalMajorAspects.length}
                <p class="text-sm text-slate-400">No pattern matches returned.</p>
              {/if}
            </div>
          {/if}

          <CardHeader
            label="Aspects"
            badge={isDualMode ? synAspects.length : filteredAspects.length + filteredNatalAspects.length + synAspects.length}
          />

        {#if !isDualMode && currentRows.length}
          <div class="overflow-x-auto">
            <table class="w-full text-sm min-w-[520px]" id="adv-aspects-current-table">
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
                  {#each currentRows as aspect}
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
        {/if}
          {#if !isDualMode && natalRows.length}
            <div class="space-y-2">
              <p class="text-xs text-slate-400">{subject2Label}</p>
              <div class="overflow-x-auto">
                <table class="w-full text-sm min-w-[520px]" id="adv-aspects-natal-table">
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
                    {#each natalRows as aspect}
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

          {#if !isDualMode && !filteredAspects.length && !filteredNatalAspects.length}
            <p class="text-sm text-slate-400">No aspects found for the current active points.</p>
          {/if}

        {#if showSynastryPanel}
          <AdvSynastryAspects
            {response}
            mode={mode}
            maxOrb={orbLimit}
            {showMatrices}
            {movementFilter}
            {hideAscendantAspects}
          />
        {/if}

          {#if isDualMode && showMajorAspects}
            <div id="adv-aspects-synastry-major" class="adv-aspects-synastry-major space-y-2">
              <CardHeader label="Synastry major aspects" badge={filteredSynastryMajorAspects.length} />
              <MajorAspectsList
                patterns={filteredSynastryMajorAspects}
                subject={primarySubject}
                subjectsByOwner={synastryOwnerSubjects}
                size={24}
                textClass="text-sm text-slate-200"
                emptyLabel="No synastry major aspects found for the current filters."
                id="adv-aspects-synastry-major-list"
              />
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
