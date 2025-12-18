<script>
  import ElementSigil from '$components/shared/ElementSigil.svelte';
  import MajorAspectIcon from '$components/shared/MajorAspectIcon.svelte';
  import { formatDecimalDegree, ucfirst } from '$lib/astro/format';
  import { formatDateLabel, formatDateShort, toDate } from '$lib/astro/date';
  import { DAY_RULERS, ELEMENT_ICON, POINT_SYMBOLS, QUALITY_ICON, signName, signSymbol } from '$lib/astro/signs';
  import { computeDecan, extractAspects, extractRanges, extractSubjects } from '$lib/astro/advanced';

  export let response = null;
  export let mode = 'natal';

  const resolveCurrentEntry = (range) => {
    if (!range || !Array.isArray(range.entries) || !range.entries.length) return { current: null, next: null, anchor: null };
    const anchor = toDate(range.anchor) || toDate(range.entries[0]?.start || range.entries[0]?.timestamp);
    const entries = range.entries || [];
    const current =
      entries.find((entry) => {
        const start = toDate(entry.start || entry.timestamp);
        const end = toDate(entry.end);
        return start && end && anchor && anchor >= start && anchor < end;
      }) || entries[0];
    const idx = entries.indexOf(current);
    const next = idx !== -1 && entries[idx + 1] ? entries[idx + 1] : null;
    return { current, next, anchor };
  };

  const resolveDegreeValue = (point) => {
    if (!point) return null;
    if (Number.isFinite(point.position)) return point.position;
    if (Number.isFinite(point.abs_pos)) return point.abs_pos % 30;
    return null;
  };

  const formatOrdinal = (value) => {
    if (!Number.isFinite(Number(value))) return '';
    const num = Number(value);
    if (num === 1) return '1st';
    if (num === 2) return '2nd';
    if (num === 3) return '3rd';
    return `${num}th`;
  };

  const formatSubjectId = (value) => {
    const id = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return id || 'subject';
  };

  const normalizePointKey = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

  const pickPoint = (points, key) => {
    if (!points || !key) return null;
    const direct = points[key];
    if (direct) return direct;
    const target = normalizePointKey(key);
    const match = Object.entries(points).find(([name]) => normalizePointKey(name) === target);
    return match ? match[1] : null;
  };

  const computeIlluminationFromAbsPos = (sunPos, moonPos) => {
    const sunDeg = Number(sunPos);
    const moonDeg = Number(moonPos);
    if (!Number.isFinite(sunDeg) || !Number.isFinite(moonDeg)) return null;
    const deg = Math.abs(((moonDeg - sunDeg) % 360 + 360) % 360);
    const rad = (deg * Math.PI) / 180;
    const illum = ((1 - Math.cos(rad)) / 2) * 100;
    return Number.isFinite(illum) ? illum : null;
  };

  const resolveMoonIllumination = (points) => {
    const moon = points?.moon || null;
    const sun = points?.sun || null;
    if (typeof moon?.illumination_percentage === 'number') return `${moon.illumination_percentage.toFixed(1)}%`;
    if (typeof moon?.illumination === 'number') return `${moon.illumination.toFixed(1)}%`;
    if (typeof moon?.illumination_percentage === 'string') return moon.illumination_percentage;
    if (typeof moon?.illumination === 'string') return moon.illumination;
    const computed = computeIlluminationFromAbsPos(sun?.abs_pos, moon?.abs_pos);
    return Number.isFinite(computed) ? `${computed.toFixed(1)}%` : '';
  };

  const formatPointPlacement = (points, key) => {
    const pt = pickPoint(points, key) || {};
    const normalized = normalizePointKey(key);
    const label = pt.name || (normalized ? normalized.replace(/_/g, ' ') : '') || key || '—';
    const pointIcon = POINT_SYMBOLS[normalized] || pt.emoji || ucfirst(label);
    const signGlyph = signSymbol(pt.sign);
    const posVal =
      typeof pt.position === 'number'
        ? pt.position
        : typeof pt.abs_pos === 'number'
          ? pt.abs_pos % 30
          : typeof pt.orb === 'number'
            ? pt.orb
            : null;
    const pos = Number.isFinite(posVal) ? `${posVal.toFixed(2)}°` : '';
    const signPart = signGlyph ? ` in ${signGlyph}` : pt.sign ? ` in ${pt.sign}` : '';
    const posPart = pos ? ` @ ${pos}` : '';
    return `${pointIcon}${signPart}${posPart}`.trim();
  };

  const buildMajorAspectLines = (patterns, points) => {
    if (!Array.isArray(patterns) || !patterns.length) return [];
    const collectKeys = (structure) => {
      const acc = [];
      const pushVal = (val) => {
        if (Array.isArray(val)) {
          val.forEach(pushVal);
        } else if (typeof val === 'string') {
          acc.push(val);
        }
      };
      Object.values(structure || {}).forEach(pushVal);
      return acc;
    };
    return patterns
      .map((pattern) => {
        const keys = Array.isArray(pattern.points) && pattern.points.length ? pattern.points : collectKeys(pattern.structure);
        const uniq = [];
        keys.forEach((val) => {
          const norm = normalizePointKey(val);
          if (norm && !uniq.includes(norm)) uniq.push(norm);
        });
        const placements = uniq.map((val) => formatPointPlacement(points, val)).filter(Boolean).join(' · ');
        if (!placements) return null;
        const label =
          pattern.name ||
          pattern.geometry ||
          pattern.aspects_label ||
          pattern.aspectsLabel ||
          (pattern.id ? ucfirst(String(pattern.id).replace(/_/g, ' ')) : 'Pattern');
        return {
          patternId: pattern.id || 'generic',
          label,
          placements,
        };
      })
      .filter(Boolean);
  };

  const buildPointRow = ({ subject, key, label, icon, current, point, id, extras }) => {
    const source = point || (key ? subject?.[key] : null) || null;
    const sign = source?.sign || current?.sign || '';
    const degreeValue = resolveDegreeValue(source) ?? resolveDegreeValue(current);
    const decan = computeDecan(degreeValue);
    const quality = source?.quality || current?.quality || '';
    const element = source?.element || current?.element || '';
    const signDisplay = sign ? [signSymbol(sign), signName(sign)].filter(Boolean).join(' ') : '—';
    const qualityDisplay = quality ? [QUALITY_ICON[quality], quality].filter(Boolean).join(' ') : '—';
    const elementDisplay = element ? [ELEMENT_ICON[element], element].filter(Boolean).join(' ') : '—';
    const decanLabel = decan ? `${formatOrdinal(decan)} Dec.` : '—';
    const degreeLabel = formatDecimalDegree(degreeValue);
    const extra = extras || '';
    return {
      type: 'point',
      id,
      label,
      icon,
      signDisplay,
      decanLabel,
      degreeLabel,
      qualityDisplay,
      elementDisplay,
      extra,
    };
  };

  $: subjects = extractSubjects(response, mode);
  $: ranges = extractRanges(response);
  $: aspectData = extractAspects(response || {});
  $: primary = subjects.primary || null;

  const buildSummaryRows = (subject, subjectKey) => {
    if (!subject) return { rows: [], sigil: {} };
    const sunRange = ranges.sun?.[0] || null;
    const moonRange = ranges.moon?.[0] || null;
    const ascRange = ranges.asc?.[0] || null;
    const sunEntry = resolveCurrentEntry(sunRange);
    const moonEntry = resolveCurrentEntry(moonRange);
    const ascEntry = resolveCurrentEntry(ascRange);
    const anchorDate =
      toDate(subject.iso_formatted_local_datetime || subject.timestamp) ||
      sunEntry.anchor ||
      moonEntry.anchor ||
      ascEntry.anchor;

    const dayRulerKey = anchorDate ? DAY_RULERS[anchorDate.getDay()] : null;
    const dayPoint = dayRulerKey ? pickPoint(subject, dayRulerKey) : null;

    const sunNext = sunEntry.next?.sign
      ? `Next ${signName(sunEntry.next.sign)} at ${formatDateLabel(sunEntry.next.start || sunEntry.next.timestamp)}`
      : '';
    const moonNext = moonEntry.next?.sign
      ? `Next ${signName(moonEntry.next.sign)} at ${formatDateLabel(moonEntry.next.start || moonEntry.next.timestamp)}`
      : '';
    const ascNext = ascEntry.next?.sign
      ? `Next ${signName(ascEntry.next.sign)} at ${formatDateLabel(ascEntry.next.start || ascEntry.next.timestamp)}`
      : '';

    const nextLunation = moonRange?.nextLunation || moonRange?.next_lunation;
    const nextLunationDate = toDate(nextLunation?.date || nextLunation?.timestamp);
    const nextLunationLabel =
      nextLunation && nextLunationDate
        ? `Next ${nextLunation.type || 'Lunation'} ~${formatDateShort(nextLunationDate)}`
        : '';
    const moonIllum = resolveMoonIllumination(subject);
    const lunationName = subject?.lunar_phase?.moon_phase_name || '';
    const illuminationLabel =
      moonIllum || lunationName ? `Illumination ${moonIllum || '—'}${lunationName ? ` · ${lunationName}` : ''}` : '';
    const moonExtras = [moonNext, nextLunationLabel, illuminationLabel].filter(Boolean).join(' · ');

    const majorPatterns = aspectData.majorAspects?.length
      ? aspectData.majorAspects
      : aspectData.natalMajorAspects || [];
    const majorAspectLines = buildMajorAspectLines(majorPatterns, subject);
    const subjectId = formatSubjectId(subjectKey);

    const sunPoint = subject?.sun || null;
    const moonPoint = subject?.moon || null;
    const ascPoint = subject?.ascendant || null;

    const sigil = {
      sunElement: sunPoint?.element || sunEntry.current?.element || '',
      moonElement: moonPoint?.element || moonEntry.current?.element || '',
      ascElement: ascPoint?.element || ascEntry.current?.element || '',
      dayElement: dayPoint?.element || '',
      dayRulerKey: dayRulerKey || '',
    };

    return {
      sigil,
      rows: [
      buildPointRow({
        subject,
        key: 'sun',
        label: 'Sun',
        icon: POINT_SYMBOLS.sun || '★',
        current: sunEntry.current,
        id: `summary-row-${subjectId}-sun`,
        extras: sunNext,
      }),
      buildPointRow({
        subject,
        key: 'moon',
        label: 'Moon',
        icon: POINT_SYMBOLS.moon || '★',
        current: moonEntry.current,
        id: `summary-row-${subjectId}-moon`,
        extras: moonExtras,
      }),
      buildPointRow({
        subject,
        label: dayRulerKey ? ucfirst(dayRulerKey) : 'Day Ruler',
        icon: POINT_SYMBOLS[dayRulerKey] || '★',
        point: dayPoint,
        id: `summary-row-${subjectId}-day-ruler`,
      }),
      buildPointRow({
        subject,
        key: 'ascendant',
        label: 'Asc',
        icon: POINT_SYMBOLS.ascendant || '★',
        current: ascEntry.current,
        id: `summary-row-${subjectId}-asc`,
        extras: ascNext,
      }),
      {
        type: 'major',
        id: `summary-row-${subjectId}-major-aspects`,
        label: 'Major aspects',
        icon: '✶',
        lines: majorAspectLines,
      },
      ],
    };
  };

  $: summaryBlocks = (() => {
    if (!response) return [];
    const blocks = [];
    if (mode === 'relationship') {
      if (response?.first_subject) {
        blocks.push({
          key: 'partner-a',
          label: response.first_subject?.name || 'Partner A',
          subject: response.first_subject,
        });
      }
      if (response?.second_subject) {
        blocks.push({
          key: 'partner-b',
          label: response.second_subject?.name || 'Partner B',
          subject: response.second_subject,
        });
      }
    } else {
      if (primary) {
        blocks.push({
          key: mode === 'natal_transit' ? 'transit' : 'primary',
          label: primary?.name || (mode === 'natal_transit' ? 'Transit' : 'Subject'),
          subject: primary,
        });
      }
      if (subjects.natal) {
        blocks.push({
          key: mode === 'relationship' ? 'partner-b' : 'natal',
          label: subjects.natal?.name || 'Natal',
          subject: subjects.natal,
        });
      }
    }

    return blocks
      .filter((block) => block.subject)
      .map((block) => {
        const timestampLabel = formatDateLabel(block.subject.iso_formatted_local_datetime || block.subject.timestamp);
        const locationLabel = [block.subject.city, block.subject.nation].filter(Boolean).join(', ');
        const { rows, sigil } = buildSummaryRows(block.subject, block.key);
        return {
          key: block.key,
          label: block.label,
          timestampLabel,
          locationLabel,
          rows,
          sigil,
        };
      });
  })();
</script>

<div class="flowbite-card space-y-4">
  <div class="flex items-center justify-between gap-3">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Overview</p>
      <h2>Summary</h2>
    </div>
    {#if response}
      <span class="badge capitalize">{mode}</span>
    {/if}
  </div>

  <div id="adv-summary-panel" class="space-y-4">
    {#if !response}
      <p class="text-sm text-slate-400">Generate a chart to see the summary.</p>
    {:else}
      {#if summaryBlocks.length}
        <div class="space-y-6">
          {#each summaryBlocks as block}
            <div class="space-y-3">
              {#if summaryBlocks.length > 1}
                <p class="text-xs uppercase tracking-[0.2em] font-semibold text-slate-300">{block.label}</p>
              {/if}
              <div class="compact-row">
                <div>
                  <p class="compact-label">Moment</p>
                  <p class="compact-value">{block.timestampLabel || 'Requested datetime'}</p>
                </div>
                <div class="ml-auto flex items-center gap-3">
                  <div class="text-right">
                    <p class="compact-label">Location</p>
                    <p class="compact-value">{block.locationLabel || 'Unknown'}</p>
                  </div>
                  <div id={`summary-sigil-${block.key}`} class="shrink-0">
                    <ElementSigil
                      id={`summary-sigil-svg-${block.key}`}
                      size={56}
                      compact={true}
                      sunElement={block.sigil?.sunElement}
                      moonElement={block.sigil?.moonElement}
                      ascElement={block.sigil?.ascElement}
                      dayElement={block.sigil?.dayElement}
                      dayRulerKey={block.sigil?.dayRulerKey}
                    />
                  </div>
                </div>
              </div>

              <div class="space-y-3">
                {#each block.rows as row}
                  {#if row.type === 'major'}
                    <div id={row.id} class="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <div class="flex items-center gap-2 text-sm font-semibold text-slate-200">
                        <span aria-hidden="true">{row.icon}</span>
                        <span>{row.label}</span>
                      </div>
                      <div class="mt-2 space-y-1 text-sm text-slate-100">
                        {#if row.lines.length}
                          {#each row.lines as line}
                            <div class="flex items-start gap-2">
                              <MajorAspectIcon patternId={line.patternId} size={22} />
                              <p class="text-xs text-slate-200">{line.label}: {line.placements}</p>
                            </div>
                          {/each}
                        {:else}
                          <p class="text-xs text-slate-400">No major aspects found.</p>
                        {/if}
                      </div>
                    </div>
                  {:else}
                    <div id={row.id} class="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <div class="space-y-1">
                        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div class="flex items-center gap-2 text-sm font-semibold text-slate-200">
                            <span aria-hidden="true">{row.icon}</span>
                            <span>{row.label}</span>
                          </div>
                          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-100 sm:justify-end">
                            <span>{row.signDisplay}</span>
                            <span class="text-slate-300">{row.decanLabel}</span>
                            <span>{row.degreeLabel}</span>
                            <span>{row.qualityDisplay}</span>
                            <span>{row.elementDisplay}</span>
                          </div>
                        </div>
                        {#if row.extra}
                          <div class="text-xs text-slate-400">{row.extra}</div>
                        {/if}
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-slate-400">No summary points available.</p>
      {/if}
    {/if}
  </div>
</div>
