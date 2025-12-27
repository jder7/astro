<script>
  import ElementSigil from '$components/shared/ElementSigil.svelte';
  import { DAY_RULERS, ELEMENT_ICON, QUALITY_ICON, POINT_SYMBOLS, signName, signSymbol } from '$lib/astro/signs';
  import { DECAN_META, ELEMENT_PLANE_NUMBERS, QUALITY_MAP } from '$lib/astro/esotericMeta';
  import { ucfirst } from '$lib/astro/format';

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
    const sigil = {
      sunElement: pointMap.get('sun')?.element || '',
      moonElement: pointMap.get('moon')?.element || '',
      ascElement: pointMap.get('ascendant')?.element || '',
      dayElement: dayPoint?.element || '',
      dayRulerKey: dayKey || '',
    };
    return {
      id: `eso-summary-${slugify(section?.meta?.title)}`,
      title: section?.meta?.title || 'Chart',
      dateLabel: formatDateLabel(parts, section?.meta?.datetime),
      dayLabel: dayKey ? ucfirst(dayKey) : '--',
      rows: buildRows(pointMap, dayKey),
      sigil,
    };
  });
</script>

<div class="flowbite-card space-y-4" id="esoteric-summary-card">
  <div class="card-head">
    <div>
      <p class="text-sm text-cyan-200/80 font-semibold">Summary</p>
      <h2>Esoteric Overview</h2>
    </div>
    <div class="card-head-actions">
      <span class="badge">{summary.sections?.length || 0} sections</span>
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
              <div class="eso-summary-figure">
                <ElementSigil
                  size={88}
                  compact={true}
                  sunElement={card.sigil.sunElement}
                  moonElement={card.sigil.moonElement}
                  ascElement={card.sigil.ascElement}
                  dayElement={card.sigil.dayElement}
                  dayRulerKey={card.sigil.dayRulerKey}
                />
              </div>
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
                    {signSymbol(row.point?.sign)} {signName(row.point?.sign)}
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
    border: 1px solid rgba(30, 41, 59, 0.8);
    border-radius: 18px;
    padding: 1rem;
    background: rgba(2, 6, 23, 0.35);
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
    color: rgba(148, 163, 184, 0.9);
  }

  .eso-summary-sub {
    font-size: 0.85rem;
    color: rgba(226, 232, 240, 0.9);
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
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.35);
    color: #e2e8f0;
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
    border: 1px solid rgba(30, 41, 59, 0.6);
    border-radius: 14px;
    padding: 0.6rem 0.75rem;
    background: rgba(15, 23, 42, 0.6);
    min-width: 0;
  }

  .eso-summary-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: #e2e8f0;
    min-width: 0;
  }

  .eso-summary-values {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.9rem;
    font-size: 0.85rem;
    color: #e2e8f0;
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
    background: rgba(56, 189, 248, 0.15);
    color: #bae6fd;
  }

  .eso-decan-emotional {
    background: rgba(248, 113, 113, 0.15);
    color: #fecaca;
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
