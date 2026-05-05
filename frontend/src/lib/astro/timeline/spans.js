/**
 * Snapshot-to-span adapter for the aspects timeline.
 *
 * Converts an array of transit-range snapshots (each with timestamp + aspects[])
 * into a flat array of contiguous "span" objects for Gantt-style rendering.
 *
 * See specs/advanced-aspects-timeline-v2.md §5
 */

const normalizeLabel = (value) =>
  String(value || '').trim().replace(/\s+/g, '_').toLowerCase();

const stripOwner = (value) =>
  String(value || '').replace(/\s*\([^)]*\)\s*/g, '').trim();

const normalizeOwner = (value) => String(value || '').trim().toLowerCase();

/**
 * Build a deterministic key for an aspect entry.
 * Keys are sorted so "Sun square Moon" and "Moon square Sun" produce the same key.
 */
export function normalizeAspectKey(aspect) {
  const left = normalizeLabel(stripOwner(aspect.left || aspect.first_point || aspect.point_a || ''));
  const right = normalizeLabel(stripOwner(aspect.right || aspect.second_point || aspect.point_b || ''));
  const type = normalizeLabel(aspect.name || aspect.aspect || aspect.type || '');
  const sorted = [left, right].sort();
  return `${sorted[0]}:${type}:${sorted[1]}`;
}

/** Parse numeric orb from various formats. */
export function parseOrb(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value.replace('°', ''));
  return NaN;
}

const FAST_POINTS = new Set([
  'moon', 'sun', 'mercury', 'venus', 'mars', 'ascendant', 'asc', 'descendant', 'dsc', 'medium_coeli', 'mc', 'imum_coeli', 'ic',
]);

const POINT_SPEED_RANK = {
  ascendant: 0,
  asc: 0,
  descendant: 0,
  dsc: 0,
  medium_coeli: 1,
  mc: 1,
  imum_coeli: 1,
  ic: 1,
  moon: 2,
  mercury: 3,
  venus: 4,
  sun: 5,
  mars: 6,
  jupiter: 7,
  saturn: 8,
  uranus: 9,
  neptune: 10,
  pluto: 11,
};

/** Classify a point as "fast" or "slow". */
export function classifySpeed(pointLabel) {
  return FAST_POINTS.has(normalizeLabel(stripOwner(pointLabel))) ? 'fast' : 'slow';
}

export function spanMotionPoints(span) {
  const points = [];
  if (normalizeOwner(span?.leftOwner) === 'transit') points.push(span?.left);
  if (normalizeOwner(span?.rightOwner) === 'transit') points.push(span?.right);
  return points.filter(Boolean).length ? points.filter(Boolean) : [span?.left, span?.right].filter(Boolean);
}

export function spanPrimaryPointLabel(span) {
  const motionPoints = spanMotionPoints(span);
  if (motionPoints.length === 1) return motionPoints[0];
  return span?.left || motionPoints[0] || '';
}

const spanMotionRanks = (span) => {
  const ranks = spanMotionPoints(span).map(pointSpeedRank);
  return ranks.length ? ranks : [99];
};

export function spanSpeedDebug(span) {
  const rawDurationMs = Number(span?.endAt) - Number(span?.startAt);
  const durationMs = Number.isFinite(rawDurationMs) ? Math.abs(rawDurationMs) : rawDurationMs;
  const durationDays = Number.isFinite(durationMs) ? durationMs / 86_400_000 : NaN;
  const leftRank = pointSpeedRank(span?.left);
  const rightRank = pointSpeedRank(span?.right);
  const motionPoints = spanMotionPoints(span);
  const motionRanks = spanMotionRanks(span);
  const fastestMotionRank = Math.min(...motionRanks);
  const slowestRank = Math.max(...motionRanks);
  const confidence = span?.confidence || 'full';
  const clipped = confidence !== 'full';
  const engine = String(span?.engine || '').toLowerCase();
  let speedClass = 'normal';
  let reason = 'duration_unavailable';

  if (Number.isFinite(durationMs)) {
    if (durationMs <= 86_400_000) {
      speedClass = 'very_fast';
      reason = 'duration_lte_1d';
    } else if (durationMs <= 7 * 86_400_000) {
      speedClass = 'fast';
      reason = 'duration_lte_1w';
    } else if (durationMs <= 30 * 86_400_000) {
      speedClass = 'normal';
      reason = 'duration_lte_1mo';
    } else if (durationMs <= 365 * 86_400_000) {
      speedClass = 'slow';
      reason = 'duration_lte_1y';
    } else {
      speedClass = 'very_slow';
      reason = 'duration_gt_1y';
    }
  }

  return {
    id: span?.id,
    left: span?.left,
    right: span?.right,
    aspectType: span?.aspectType,
    speedClass,
    reason,
    durationMs,
    durationDays,
    confidence,
    clipped,
    engine,
    leftRank,
    rightRank,
    motionPoints,
    motionRanks,
    fastestMotionRank,
    slowestRank,
    minOrb: span?.minOrb,
    startAt: span?.startAt,
    exactAt: span?.exactAt,
    endAt: span?.endAt,
  };
}

/** Determine the duration bucket for filtering and grouping timeline spans. */
export function spanSpeedClass(span) {
  return spanSpeedDebug(span).speedClass;
}

export function pointSpeedRank(pointLabel) {
  const key = normalizeLabel(stripOwner(pointLabel));
  return POINT_SPEED_RANK[key] ?? 99;
}

export function spanFastestPointRank(span) {
  return Math.min(...spanMotionRanks(span));
}

export function isUltraFastSpan(span) {
  return spanMotionRanks(span).some((rank) => rank <= 1);
}

export function isVeryFastSpanForRange(span, rangeMs = 0) {
  const rangeDays = Number(rangeMs) / 86_400_000;
  return spanMotionRanks(span).some((rank) => rank <= 1 || (rank === 2 && rangeDays >= 30));
}

export function normalizeBackendSpans(rawSpans) {
  if (!Array.isArray(rawSpans)) return [];
  return rawSpans
    .map((span, index) => {
      const startAt = new Date(span.startAt || span.applying_start).getTime();
      const exactAt = new Date(span.exactAt || span.exact_at).getTime();
      const endAt = new Date(span.endAt || span.separating_end).getTime();
      if (![startAt, exactAt, endAt].every(Number.isFinite)) return null;
      const left = stripOwner(span.left || span.first_point || '');
      const right = stripOwner(span.right || span.second_point || '');
      const aspectType = span.aspectType || span.aspect || span.name || span.type || '';
      const leftOwner = span.leftOwner || span.left_owner || 'Transit';
      const rightOwner = span.rightOwner || span.right_owner || 'Transit';
      const minOrb = parseOrb(span.minOrb ?? span.min_orb ?? span.orb_value ?? span.orb);
      const leftSign = span.leftSign || span.left_sign || span.signLeft || span.sign_left || '';
      const rightSign = span.rightSign || span.right_sign || span.signRight || span.sign_right || '';
      const parentId = span.id || `${leftOwner}:${normalizeLabel(left)}:${normalizeLabel(aspectType)}:${rightOwner}:${normalizeLabel(right)}:${index}`;
      const passes = Array.isArray(span.passes)
        ? span.passes
            .map((pass, passIndex) => {
              const passStartAt = new Date(pass.startAt || pass.applying_start).getTime();
              const passExactAt = new Date(pass.exactAt || pass.exact_at).getTime();
              const passEndAt = new Date(pass.endAt || pass.separating_end).getTime();
              if (![passStartAt, passExactAt, passEndAt].every(Number.isFinite)) return null;
              const passMinOrb = parseOrb(pass.minOrb ?? pass.min_orb ?? pass.orb_value ?? pass.orb);
              return {
                id: pass.id || `${parentId}:pass:${passIndex + 1}`,
                parentId,
                seriesId: pass.seriesId || span.seriesId || parentId,
                seriesIndex: Number(pass.seriesIndex || passIndex + 1),
                seriesCount: Number(pass.seriesCount || span.seriesCount || span.passes.length),
                startAt: passStartAt,
                exactAt: passExactAt,
                endAt: passEndAt,
                minOrb: Number.isFinite(passMinOrb) ? Math.abs(passMinOrb) : NaN,
                movementStart: pass.movementStart || pass.movement_start || '',
                movementEnd: pass.movementEnd || pass.movement_end || '',
                confidence: pass.confidence || 'full',
                engine: pass.engine || span.engine || '',
                samples: Number(pass.samples || 0),
                leftSign: pass.leftSign || pass.left_sign || pass.signLeft || pass.sign_left || leftSign,
                rightSign: pass.rightSign || pass.right_sign || pass.signRight || pass.sign_right || rightSign,
              };
            })
            .filter(Boolean)
            .sort((a, b) => a.exactAt - b.exactAt)
        : [];
      return {
        id: parentId,
        key: span.key || `${leftOwner}:${normalizeLabel(left)}:${normalizeLabel(aspectType)}:${rightOwner}:${normalizeLabel(right)}`,
        left,
        right,
        aspectType,
        leftSign,
        rightSign,
        leftOwner,
        rightOwner,
        startAt,
        exactAt,
        endAt,
        minOrb: Number.isFinite(minOrb) ? Math.abs(minOrb) : NaN,
        movementStart: span.movementStart || span.movement_start || '',
        movementEnd: span.movementEnd || span.movement_end || '',
        confidence: span.confidence || 'full',
        engine: span.engine || '',
        samples: Number(span.samples || 0),
        mode: span.mode || '',
        seriesId: span.seriesId || '',
        seriesCount: Number(span.seriesCount || passes.length || 0),
        isRetrogradeSeries: Boolean(span.isRetrogradeSeries || passes.length > 1),
        passes,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startAt - b.startAt || a.exactAt - b.exactAt);
}

/**
 * Convert snapshots to spans.
 *
 * @param {Array} snapshots - Array of { timestamp, aspects: [...] }
 * @param {number} granularityMs - Expected step in ms between snapshots
 * @returns {Array} Array of span objects per spec §5.2
 */
export function snapshotsToSpans(snapshots, granularityMs) {
  if (!Array.isArray(snapshots) || !snapshots.length) return [];

  const sorted = snapshots
    .map((snap) => ({ ...snap, _ts: new Date(snap.timestamp).getTime() }))
    .filter((s) => Number.isFinite(s._ts))
    .sort((a, b) => a._ts - b._ts);

  if (!sorted.length) return [];

  // Auto-detect granularity if not provided
  if (!granularityMs || !Number.isFinite(granularityMs)) {
    if (sorted.length >= 2) {
      const gaps = [];
      for (let i = 1; i < Math.min(sorted.length, 10); i++) {
        gaps.push(sorted[i]._ts - sorted[i - 1]._ts);
      }
      gaps.sort((a, b) => a - b);
      granularityMs = gaps[Math.floor(gaps.length / 2)];
    } else {
      granularityMs = 3600000;
    }
  }

  const gapTolerance = granularityMs * 1.5;
  const firstTs = sorted[0]._ts;
  const lastTs = sorted[sorted.length - 1]._ts;

  // Collect aspect hits by normalized key
  const hitsByKey = new Map();
  for (const snap of sorted) {
    for (const aspect of (snap.aspects || [])) {
      const key = normalizeAspectKey(aspect);
      const orb = parseOrb(aspect.orb_value ?? aspect.orb ?? aspect.orbit ?? aspect.diff);
      const hit = {
        ts: snap._ts,
        orb: Number.isFinite(orb) ? Math.abs(orb) : NaN,
        movement: aspect.aspect_movement || aspect.movement || '',
        left: stripOwner(aspect.left || aspect.first_point || aspect.point_a || ''),
        right: stripOwner(aspect.right || aspect.second_point || aspect.point_b || ''),
        aspectType: aspect.name || aspect.aspect || aspect.type || '',
        leftOwner: aspect.leftOwner || aspect.p1_owner || '1',
        rightOwner: aspect.rightOwner || aspect.p2_owner || '1',
      };
      if (!hitsByKey.has(key)) hitsByKey.set(key, []);
      hitsByKey.get(key).push(hit);
    }
  }

  // Split each key's hits into contiguous runs → spans
  const spans = [];
  let runIndex = 0;

  for (const [key, hits] of hitsByKey) {
    hits.sort((a, b) => a.ts - b.ts);

    const runs = [];
    let currentRun = [hits[0]];
    for (let i = 1; i < hits.length; i++) {
      if (hits[i].ts - hits[i - 1].ts <= gapTolerance) {
        currentRun.push(hits[i]);
      } else {
        runs.push(currentRun);
        currentRun = [hits[i]];
      }
    }
    runs.push(currentRun);

    for (const run of runs) {
      const startAt = run[0].ts;
      const endAt = run[run.length - 1].ts;
      let minOrb = Infinity;
      let exactAt = startAt;
      for (const hit of run) {
        if (Number.isFinite(hit.orb) && hit.orb < minOrb) {
          minOrb = hit.orb;
          exactAt = hit.ts;
        }
      }
      if (!Number.isFinite(minOrb)) minOrb = NaN;

      const clippedStart = startAt <= firstTs + gapTolerance;
      const clippedEnd = endAt >= lastTs - gapTolerance;
      let confidence = 'full';
      if (clippedStart && clippedEnd) confidence = 'clipped_both';
      else if (clippedStart) confidence = 'clipped_start';
      else if (clippedEnd) confidence = 'clipped_end';

      const ref = run[0];
      spans.push({
        id: `${key}:${runIndex++}`,
        key,
        left: ref.left,
        right: ref.right,
        aspectType: ref.aspectType,
        leftOwner: ref.leftOwner,
        rightOwner: ref.rightOwner,
        startAt,
        exactAt,
        endAt,
        minOrb,
        movementStart: run[0].movement,
        movementEnd: run[run.length - 1].movement,
        confidence,
        samples: run.length,
      });
    }
  }

  // Sort: duration (short→long), then startAt, then minOrb
  spans.sort((a, b) => {
    const durDiff = (a.endAt - a.startAt) - (b.endAt - b.startAt);
    if (durDiff !== 0) return durDiff;
    if (a.startAt !== b.startAt) return a.startAt - b.startAt;
    const orbA = Number.isFinite(a.minOrb) ? a.minOrb : Infinity;
    const orbB = Number.isFinite(b.minOrb) ? b.minOrb : Infinity;
    return orbA - orbB;
  });

  return spans;
}

/** Granularity string to milliseconds. */
export function granularityToMs(granularity) {
  const g = String(granularity || '').toLowerCase();
  if (g === 'minute') return 60_000;
  if (g === 'hour') return 3_600_000;
  if (g === 'day') return 86_400_000;
  if (g === 'month') return 30 * 86_400_000;
  return 3_600_000;
}

/** Range presets with days and granularity. */
export const RANGE_PRESETS = {
  '1D': { days: 1, granularity: 'hour', label: '1 Day' },
  '1W': { days: 7, granularity: 'hour', label: '1 Week' },
  '1M': { days: 30, granularity: 'day', label: '1 Month' },
  '3M': { days: 90, granularity: 'day', label: '3 Months' },
  '6M': { days: 180, granularity: 'day', label: '6 Months' },
  '1Y': { days: 365, granularity: 'month', label: '1 Year' },
};

/** Build start/end from a preset key and a base date. */
export function presetToRange(presetKey, baseDate = new Date()) {
  const preset = RANGE_PRESETS[presetKey];
  if (!preset) return null;
  const reference = new Date(baseDate);
  const rangeMs = preset.days * 86_400_000;
  const start = new Date(reference.getTime() - rangeMs);
  const end = new Date(reference.getTime() + rangeMs);
  return {
    start: { year: start.getFullYear(), month: start.getMonth() + 1, day: start.getDate(), hour: start.getHours(), minute: start.getMinutes() },
    end: { year: end.getFullYear(), month: end.getMonth() + 1, day: end.getDate(), hour: end.getHours(), minute: end.getMinutes() },
    granularity: preset.granularity,
    days: preset.days,
  };
}

/** Format a duration in ms as a short human-readable string. */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 60) return `${Math.round(days)}d`;
  return `${(days / 30).toFixed(1)}mo`;
}

/**
 * Pack spans into non-overlapping rows (greedy lane packing).
 * Returns a Map of spanId → rowIndex.
 */
export function packRows(spans, scale) {
  const rows = []; // each row is an array of { endX }
  const assignment = new Map();
  for (const span of spans) {
    const x1 = scale(span.startAt);
    const x2 = scale(span.endAt);
    let placed = false;
    for (let r = 0; r < rows.length; r++) {
      const lastEnd = rows[r];
      if (x1 >= lastEnd + 2) {
        rows[r] = x2;
        assignment.set(span.id, r);
        placed = true;
        break;
      }
    }
    if (!placed) {
      assignment.set(span.id, rows.length);
      rows.push(x2);
    }
  }
  return { assignment, rowCount: rows.length };
}
