<script>
  import ElementSigil from '$components/shared/ElementSigil.svelte';
  import ShareLinkButton from '$components/shared/ShareLinkButton.svelte';
  import { inputStore } from '$lib/state/inputStore';
  import { formatNameWithGender } from '$lib/utils/gender';
  import { DAY_RULERS, ELEMENT_ICON, QUALITY_ICON, POINT_SYMBOLS, signName, signSymbol } from '$lib/astro/signs';
  import { DECAN_META, ELEMENT_PLANE_NUMBERS, QUALITY_MAP } from '$lib/astro/esotericMeta';
  import { formatOrdinal, ucfirst } from '$lib/astro/format';
  import { getRayColorHex, getSignRays } from '$lib/astro/rays';

  export let summary = { sections: [], ranges: [], aspects: [], context: {}, rawAspects: [] };

  const slugify = (value) =>
    String(value || 'section')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const pad = (v) => String(v ?? 0).padStart(2, '0');

  const normalizeKey = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

  const toDateParts = (value) => {
    if (!value) return null;
    if (value.year && value.month && value.day) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate(),
      hour: parsed.getHours(),
      minute: parsed.getMinutes(),
    };
  };

  const formatDateLabel = (parts, fallback) => {
    const resolved = parts && [parts.year, parts.month, parts.day].every((n) => Number.isFinite(Number(n))) ? parts : null;
    if (resolved) {
      return `${resolved.year}-${pad(resolved.month)}-${pad(resolved.day)} ${pad(resolved.hour)}:${pad(resolved.minute)}`.trim();
    }
    if (fallback) {
      const parsed = new Date(fallback);
      if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
      }
    }
    return 'Requested datetime';
  };

  const resolvePartsForSection = (section) => {
    const contextKey = section?.meta?.contextKey;
    if (contextKey === 'transit') return summary.context?.transitParts || null;
    if (contextKey === 'birth') return summary.context?.birthParts || null;
    if (contextKey === 'first') return summary.context?.firstParts || null;
    if (contextKey === 'second') return summary.context?.secondParts || null;
    const title = String(section?.meta?.title || '').toLowerCase();
    if (title.includes('transit')) return summary.context?.transitParts || null;
    if (title.includes('natal')) return summary.context?.birthParts || null;
    if (title.includes('partner a')) return summary.context?.firstParts || null;
    if (title.includes('partner b')) return summary.context?.secondParts || null;
    return null;
  };

  $: inputState = $inputStore;

  const resolveGenderForSection = (section) => {
    const key = section?.meta?.contextKey;
    if (key === 'birth') return inputState?.birth?.gender || '';
    if (key === 'first') return inputState?.relationship?.first?.gender || '';
    if (key === 'second') return inputState?.relationship?.second?.gender || '';
    return '';
  };

  const getDayRulerKey = (parts) => {
    if (!parts) return '';
    const date = new Date(parts.year, (parts.month || 1) - 1, parts.day || 1, parts.hour || 0, parts.minute || 0);
    return DAY_RULERS[date.getDay()] || '';
  };

  const buildPointMap = (points = []) => {
    const map = new Map();
    (points || []).forEach((pt) => {
      const key = normalizeKey(pt.key || pt.label);
      if (key) map.set(key, pt);
    });
    return map;
  };

  const formatElementText = (element) => {
    if (!element) return '--';
    const number = ELEMENT_PLANE_NUMBERS[element];
    const icon = ELEMENT_ICON[element] || '';
    return `${icon ? `${icon} ` : ''}${element}${number ? ` (${number})` : ''}`.trim();
  };

  const formatQuality = (quality) => {
    const meta = QUALITY_MAP[quality] || null;
    return {
      label: meta?.label || quality || '--',
      className: meta?.className || 'eso-quality-muted',
      icon: QUALITY_ICON[quality] || '',
    };
  };

  const formatDecan = (point) => {
    const meta = DECAN_META[point?.decan] || null;
    const degree = point?.degree && /\d/.test(String(point.degree)) ? point.degree : '';
    return {
      label: meta?.label || '--',
      className: meta?.className || 'eso-decan eso-decan-muted',
      degree,
    };
  };

  const resolveRawSign = (point) =>
    point?.sign_name || point?.sign_label || point?.sign_abbrev || point?.sign_symbol || point?.sign || '';

  const resolveSignLabel = (point) => signName(resolveRawSign(point));

  const resolveSignSymbol = (point) => signSymbol(point?.sign_symbol || point?.sign || resolveRawSign(point));

  const resolveSignRays = (point) => getSignRays(resolveSignLabel(point));

  const buildRows = (pointMap, dayKey) => {
    const rows = [];
    const pushRow = (key, fallbackLabel) => {
      const point = pointMap.get(key);
      if (!point) return;
      rows.push({
        key,
        label: fallbackLabel || point.label || ucfirst(key),
        icon: POINT_SYMBOLS[key] || point.emoji || '*',
        point,
      });
    };
    pushRow('sun', 'Sun');
    pushRow('moon', 'Moon');
    if (dayKey) {
      pushRow(dayKey, ucfirst(dayKey));
    }
    pushRow('ascendant', 'Asc');
    return rows;
  };

  $: cards = (summary.sections || []).map((section) => {
    const parts = resolvePartsForSection(section) || toDateParts(section?.meta?.datetime);
    const dayKey = getDayRulerKey(parts);
    const pointMap = buildPointMap(section.points || []);
    const dayPoint = dayKey ? pointMap.get(dayKey) : null;
    const title = section?.meta?.title || 'Chart';
    const gender = resolveGenderForSection(section);
    const sigil = {
      sunElement: pointMap.get('sun')?.element || '',
      moonElement: pointMap.get('moon')?.element || '',
      ascElement: pointMap.get('ascendant')?.element || '',
      dayElement: dayPoint?.element || '',
      dayRulerKey: dayKey || '',
      sunSign: pointMap.get('sun')?.sign || '',
      moonSign: pointMap.get('moon')?.sign || '',
      ascSign: pointMap.get('ascendant')?.sign || '',
      daySign: dayPoint?.sign || '',
    };
    return {
      id: `eso-summary-${slugify(section?.meta?.title)}`,
      title: formatNameWithGender(title, gender) || title,
      dateLabel: formatDateLabel(parts, section?.meta?.datetime),
      dayLabel: dayKey ? ucfirst(dayKey) : '--',
      rows: buildRows(pointMap, dayKey),
      sigil,
    };
  });
</script>

<div class="flowbite-card space-y-4" id="esoteric-summary-card" tabindex="-1">
  <div class="card-head">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Summary</p>
      <h2>Esoteric Overview</h2>
    </div>
    <div class="card-head-actions">
      <span class="badge">{summary.sections?.length || 0} sections</span>
      <ShareLinkButton label="Share" />
    </div>
  </div>

  {#if cards.length}
    <div class="space-y-4">
      {#each cards as card}
        <div class="eso-summary-card" id={card.id}>
          <div class="eso-summary-head">
            <div>
              <p class="eso-summary-kicker">Day Ruler - {card.dayLabel}</p>
              <p class="eso-summary-sub">{card.dateLabel}</p>
            </div>
            <div class="eso-summary-head-meta">
              <span class="eso-summary-pill">{card.title}</span>
              {#key `${card.id}-${card.sigil?.sunSign || ''}-${card.sigil?.moonSign || ''}-${card.sigil?.ascSign || ''}-${card.sigil?.daySign || ''}`}
                <div class="eso-summary-figure">
                  <ElementSigil size={88} compact={true} sigil={card.sigil} />
                </div>
              {/key}
            </div>
          </div>

          <div class="eso-summary-grid">
            {#each card.rows as row}
              {@const qualityMeta = formatQuality(row.point?.quality)}
              {@const decanMeta = formatDecan(row.point)}
              <div class="eso-summary-row">
                <div class="eso-summary-label">
                  <span aria-hidden="true">{row.icon}</span>
                  <span>{row.label}</span>
                </div>
                <div class="eso-summary-values">
                  <span>
                    <span style={`color:${resolveSignRays(row.point).length ? getRayColorHex(resolveSignRays(row.point)[0]) : 'inherit'}`}>
                      {resolveSignSymbol(row.point)} {resolveSignLabel(row.point)}
                    </span>
                    {#if resolveSignRays(row.point).length}
                      <span class="text-slate-400"> · </span>
                      {#each resolveSignRays(row.point) as ray, idx}
                        <span style={`color:${getRayColorHex(ray)}`}>{formatOrdinal(ray)}</span>{idx < resolveSignRays(row.point).length - 1 ? ', ' : ''}
                      {/each}
                    {/if}
                  </span>
                  <span class={decanMeta.className}>
                    {decanMeta.label}{decanMeta.degree ? ` (${decanMeta.degree})` : ''}
                  </span>
                  <span class={qualityMeta.className}>
                    {qualityMeta.icon ? `${qualityMeta.icon} ` : ''}{qualityMeta.label}
                  </span>
                  <span>{formatElementText(row.point?.element)}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-slate-400">Generate a chart to see the summary.</p>
  {/if}
</div>

<style>
  .eso-summary-card {
    border: 1px solid rgba(20, 83, 45, 0.6);
    border-radius: 18px;
    padding: 1rem;
    background: rgba(7, 28, 19, 0.6);
  }

  .eso-summary-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  .eso-summary-head-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    justify-content: flex-end;
    min-width: 0;
  }

  .eso-summary-kicker {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-weight: 700;
    color: rgba(167, 243, 208, 0.85);
  }

  .eso-summary-sub {
    font-size: 0.85rem;
    color: rgba(226, 253, 244, 0.9);
    overflow-wrap: anywhere;
  }

  .eso-summary-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    background: rgba(9, 33, 24, 0.75);
    border: 1px solid rgba(34, 197, 94, 0.35);
    color: #d1fae5;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .eso-summary-figure :global(svg) {
    display: block;
  }

  .eso-summary-grid {
    margin-top: 0.85rem;
    display: grid;
    gap: 0.6rem;
  }

  .eso-summary-row {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 0.75rem;
    align-items: center;
    border: 1px solid rgba(20, 83, 45, 0.55);
    border-radius: 14px;
    padding: 0.6rem 0.75rem;
    background: rgba(9, 32, 22, 0.7);
    min-width: 0;
  }

  .eso-summary-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: #e2f7ee;
    min-width: 0;
  }

  .eso-summary-values {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.9rem;
    font-size: 0.85rem;
    color: #e2f7ee;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .eso-decan {
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    font-size: 11px;
    border: 1px solid rgba(148, 163, 184, 0.3);
  }

  .eso-decan-physical {
    background: rgba(34, 197, 94, 0.18);
    color: #bbf7d0;
  }

  .eso-decan-emotional {
    background: rgba(59, 130, 246, 0.18);
    color: #bfdbfe;
  }

  .eso-decan-mental {
    background: rgba(192, 132, 252, 0.2);
    color: #e9d5ff;
  }

  .eso-decan-muted {
    background: rgba(30, 41, 59, 0.5);
    color: #94a3b8;
  }

  .eso-quality-motion {
    color: #fda4af;
  }

  .eso-quality-consciousness {
    color: #fde68a;
  }

  .eso-quality-matter {
    color: #bbf7d0;
  }

  .eso-quality-muted {
    color: #94a3b8;
  }

  @media (max-width: 640px) {
    .eso-summary-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .eso-summary-head-meta {
      width: 100%;
      justify-content: space-between;
    }

    .eso-summary-row {
      grid-template-columns: 1fr;
      align-items: flex-start;
    }
  }
</style>
