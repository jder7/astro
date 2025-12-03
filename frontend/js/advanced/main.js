(function () {
  // Store API responses separately from the home page so only config + inputs are shared.
  const ns = "AdvancedApp";
  const app = (window[ns] = window[ns] || {});
  // Keep input/config storage shared with Home; only API cache is advanced-specific.
  app.constants = {
    ...(app.constants || {}),
    STORAGE_INPUT: "astroInputState",
    STORAGE_CONFIG: "astroConfig",
    STORAGE_API: "astroApiStateAdvanced",
  };

  const STORAGE_RANGE = "astroAdvancedRange";

  const dom = {
    rangeStart: document.getElementById("advancedRangeStart"),
    rangeEnd: document.getElementById("advancedRangeEnd"),
    rangeSummary: document.getElementById("advancedRangeSummary"),
    rangeNow: document.getElementById("advancedRangeNow"),
    summaryEl: document.getElementById("summaryContent"),
    apiCollapseBtn: document.getElementById("apiCollapseBtn"),
    apiResponseBody: document.getElementById("apiResponseBody"),
    ascSummaryContainer: document.getElementById("ascSummaryContainer"),
    ascClockContainer: document.getElementById("ascClockContainer"),
    ascClockBody: document.getElementById("ascClockBody"),
    ascClockCollapse: document.getElementById("ascClockCollapse"),
    moonClockContainer: document.getElementById("moonClockContainer"),
    moonClockBody: document.getElementById("moonClockBody"),
    moonClockCollapse: document.getElementById("moonClockCollapse"),
  };

  const shared = window.AppShared || {};
  const {
    SIGN_META,
    ELEMENT_ICON,
    QUALITY_ICON,
    POINTS_ICONS,
    ASPECT_ICON_MAP,
    computeAspects: computeAspectsShared,
    resolveActivePointKeys,
    normalizePointKey,
    MAJOR_ASPECT_ICON_MAP,
    MAJOR_ASPECT_PATTERNS,
    getMajorAspectIcon,
    emojiNumber,
    formatHouseLabel,
    formatHouseLabelShort,
    formatDateLabel,
    capitalise,
    CHALDEAN_DAY_RULERS,
    computeIlluminationFromAbsPos,
    getLunationInfo,
  } = shared;
  const flags = (app.flags = { ...(app.flags || {}), skipSvg: true });
  console.info("[advanced] main init", { ns, skipSvg: flags.skipSvg });

  const fallbackIcon = (id) => {
    if (typeof getMajorAspectIcon === "function") {
      const svg = getMajorAspectIcon(id);
      if (svg) return svg;
    }
    if (MAJOR_ASPECT_ICON_MAP && MAJOR_ASPECT_ICON_MAP[id]) return MAJOR_ASPECT_ICON_MAP[id];
    if (MAJOR_ASPECT_ICON_MAP && MAJOR_ASPECT_ICON_MAP.generic) return MAJOR_ASPECT_ICON_MAP.generic;
    return `<svg viewBox="0 0 88 88" class="adv-pattern-svg" aria-hidden="true" role="img"><circle cx="44" cy="44" r="32" fill="rgba(56,189,248,0.12)" stroke="#38bdf8" stroke-width="2.2"/></svg>`;
  };

  const wrapPointIcon = (icon) => `<span class="adv-point-icon">${icon}</span>`;
  const wrapMajorAspectIcon = (icon) => `<span class="adv-major-aspect-icon">${icon}</span>`;

  const pad = (v) => String(v).padStart(2, "0");
  const toDatetimeLocal = (date) => {
    if (!(date instanceof Date)) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const ELEMENT_RGB = {
    Fire: "251, 113, 133",
    Earth: "234, 179, 8",
    Air: "52, 211, 153",
    Water: "96, 165, 250",
    Default: "148, 163, 184",
  };
  const ACTIVE_SEGMENT_COLOR = "#0ea5e9";
  const PRIMARY_HAND_COLOR = "#38bdf8";
  const SECONDARY_HAND_COLOR = "#34d399";
  const HOUR_MS = 60 * 60 * 1000;
  let ascClockCounter = 0;
  const DAY_MS = 24 * HOUR_MS;
  let moonClockCounter = 0;

  const formatOrdinal = (n) => {
    if (n === 1) return "1st";
    if (n === 2) return "2nd";
    if (n === 3) return "3rd";
    return `${n}th`;
  };

  const elementFill = (element, alpha = 0.32) => {
    const rgb = ELEMENT_RGB[element] || ELEMENT_RGB.Default;
    return `rgba(${rgb}, ${alpha})`;
  };
  const elementStroke = (element, alpha = 0.85) => {
    const rgb = ELEMENT_RGB[element] || ELEMENT_RGB.Default;
    return `rgba(${rgb}, ${alpha})`;
  };

  const computeAscProgress = (entry, targetTs) => {
    const start = safeDate(entry?.start || entry?.timestamp);
    const end = safeDate(entry?.end);
    if (!(start && end && end > start)) return { orb: null, decan: null };
    const baseMs = start.getTime();
    const endMs = end.getTime();
    const t = targetTs instanceof Date && Number.isFinite(targetTs.getTime()) ? targetTs.getTime() : baseMs;
    const clamped = Math.min(Math.max(t, baseMs), endMs);
    const ratio = (clamped - baseMs) / (endMs - baseMs);
    const orb = Math.min(30, Math.max(0, ratio * 30));
    const decan = Math.max(1, Math.min(3, Math.floor(orb / 10) + 1));
    return { orb, decan };
  };

  const computeMoonProgress = (entry, targetTs) => {
    const start = safeDate(entry?.start || entry?.timestamp);
    const end = safeDate(entry?.end);
    if (!(start && end && end > start)) return { orb: null, decan: null };
    const baseMs = start.getTime();
    const endMs = end.getTime();
    const t = targetTs instanceof Date && Number.isFinite(targetTs.getTime()) ? targetTs.getTime() : baseMs;
    const clamped = Math.min(Math.max(t, baseMs), endMs);
    const ratio = (clamped - baseMs) / (endMs - baseMs);
    const orb = Math.min(30, Math.max(0, ratio * 30));
    const decan = Math.max(1, Math.min(3, Math.floor(orb / 10) + 1));
    return { orb, decan };
  };

  const computeDecan = (position) => {
    if (!Number.isFinite(position)) return null;
    return Math.max(1, Math.min(3, Math.floor(position / 10) + 1));
  };

  const computeMoonIllumination = (points) => {
    const moon = points?.moon;
    const sun = points?.sun;
    if (typeof moon?.illumination_percentage === "number") return moon.illumination_percentage;
    if (typeof moon?.illumination === "number") return moon.illumination;
    if (typeof moon?.illumination_percentage === "string") return moon.illumination_percentage;
    if (typeof moon?.illumination === "string") return moon.illumination;
    const sunPos = typeof sun?.abs_pos === "number" ? sun.abs_pos : null;
    const moonPos = typeof moon?.abs_pos === "number" ? moon.abs_pos : null;
    if (sunPos === null || moonPos === null) return null;
    return computeIlluminationFromAbsPos(sunPos, moonPos);
  };

  const pickPoint = (points, key) => {
    const target = normalizePointKey(key);
    return (
      Object.entries(points || {}).find(([k]) => normalizePointKey(k) === target)?.[1] ||
      points?.[key] ||
      null
    );
  };

  const summarizePoint = (point) => {
    const pos = typeof point?.position === "number" ? point.position : typeof point?.orb === "number" ? point.orb : null;
    return {
      sign: point?.sign || null,
      quality: point?.quality || null,
      element: point?.element || null,
      orb: pos,
      decan: computeDecan(pos),
      emoji: point?.emoji,
    };
  };

  const formatSummaryRow = (label, icon, data, extras = "") => {
    const signMeta = SIGN_META[data.sign] || { name: data.sign || "—", icon: data.emoji || "" };
    const orbText = Number.isFinite(data.orb) ? `${data.orb.toFixed(2)}°` : "—";
    const decanText = data.decan ? `${formatOrdinal(data.decan)} Dec.` : "—";
    const elementIcon = ELEMENT_ICON[data.element] || "";
    const qualityIcon = QUALITY_ICON[data.quality] || "";
    return `
      <div class="adv-summary-row">
        <div class="adv-summary-label">${icon || ""}<span>${label}</span></div>
        <div class="adv-summary-values">
          <span>${signMeta.icon || ""} ${signMeta.name}</span>
          <span>${decanText}</span>
          <span>${orbText}</span>
          <span>${qualityIcon ? `${qualityIcon} ` : ""}${data.quality || "—"}</span>
          <span>${elementIcon ? `${elementIcon} ` : ""}${data.element || "—"}</span>
          ${extras ? `<span class="adv-summary-extra">${extras}</span>` : ""}
        </div>
      </div>
    `;
  };

  function buildAscSummary(range, formatTimeFn) {
    if (!range || !Array.isArray(range.entries) || !range.entries.length) return null;
    const anchor = safeDate(range.anchor) || safeDate(range.entries[0].start) || new Date();
    const current =
      range.entries.find((e) => {
        const start = safeDate(e.start || e.timestamp);
        const end = safeDate(e.end);
        return start && end && anchor >= start && anchor < end;
      }) || range.entries[0];
    const currentProgress = computeAscProgress(current, anchor);
    const idx = range.entries.indexOf(current);
    const nextEntry = idx !== -1 && range.entries[idx + 1] ? range.entries[idx + 1] : null;
    const nextSign = nextEntry?.sign || null;
    const nextTime =
      nextEntry?.start && nextEntry.start instanceof Date && Number.isFinite(nextEntry.start.getTime())
        ? formatTimeFn(nextEntry.start)
        : "—";
    return {
      current,
      orb: currentProgress.orb,
      decan: currentProgress.decan,
      nextSign,
      nextTime,
    };
  }

  function buildMoonSummary(range, formatTimeFn) {
    if (!range || !Array.isArray(range.entries) || !range.entries.length) return null;
    const anchor = safeDate(range.anchor) || safeDate(range.entries[0].start) || new Date();
    const current =
      range.entries.find((e) => {
        const start = safeDate(e.start || e.timestamp);
        const end = safeDate(e.end);
        return start && end && anchor >= start && anchor < end;
      }) || range.entries[0];

    const currentProgress = computeMoonProgress(current, anchor);
    const idx = range.entries.indexOf(current);
    const nextEntry = idx !== -1 && range.entries[idx + 1] ? range.entries[idx + 1] : null;
    const nextSign = nextEntry?.sign || null;
    const nextTime =
      nextEntry?.start && nextEntry.start instanceof Date && Number.isFinite(nextEntry.start.getTime())
        ? formatTimeFn(nextEntry.start)
        : "—";

    return {
      anchor,
      current,
      orb: currentProgress.orb,
      decan: currentProgress.decan,
      nextSign,
      nextTime,
      nextStart: nextEntry?.start || null,
    };
  }

  function renderSummaryPanel(points, ascendantRanges, moonRanges, metaSource, formatTimeFn, isDual) {
    if (!ascendantRanges.length && !moonRanges.length) return "";
    const ascMap = new Map();
    const moonMap = new Map();
    ascendantRanges.forEach((r, idx) => ascMap.set(r.id || r.label || `asc-${idx}`, r));
    moonRanges.forEach((r, idx) => moonMap.set(r.id || r.label || `moon-${idx}`, r));
    const cardIds = ascendantRanges.map((r, idx) => r.id || r.label || `range-${idx}`);
    moonRanges.forEach((r, idx) => {
      const id = r.id || r.label || `moon-${idx}`;
      if (!cardIds.includes(id)) cardIds.push(id);
    });
    const anchor = safeDate(ascendantRanges[0]?.anchor) || safeDate(moonRanges[0]?.anchor) || safeDate(metaSource?.timestamp) || new Date();
    const dateInfo = formatDateLabel(metaSource || {});
    const dateLabel = dateInfo.label ? `${dateInfo.label}${dateInfo.tzShort ? ` (${dateInfo.tzShort})` : ""}` : "Requested datetime";
    const dayIdx = anchor instanceof Date && Number.isFinite(anchor.getTime()) ? anchor.getDay() : new Date().getDay();
    const dayRulerKey = CHALDEAN_DAY_RULERS?.[dayIdx] || null;
    const dayRulerPt = dayRulerKey ? pickPoint(points, dayRulerKey) : null;
    const dayRulerName = dayRulerKey ? capitalise(dayRulerKey) : "—";
    const dayRulerIcon = dayRulerKey ? POINTS_ICONS[dayRulerKey] || "" : "";

    const sunPt = pickPoint(points, "sun");
    const moonPt = pickPoint(points, "moon");

    const cards = cardIds.map((cardId) => {
      const ascRange = ascMap.get(cardId) || null;
      const moonRange = moonMap.get(cardId) || (!ascRange && moonRanges.length === 1 ? moonRanges[0] : null);
      const range = ascRange || moonRange;
      if (!range) return "";

      const ascSummary = ascRange ? buildAscSummary(ascRange, formatTimeFn) : null;
      const ascData = ascSummary
        ? {
            ...summarizePoint(ascSummary.current),
            orb: ascSummary.orb,
            decan: ascSummary.decan,
          }
        : null;
      const dayData = dayRulerPt ? summarizePoint(dayRulerPt) : null;
      const sunData = sunPt ? summarizePoint(sunPt) : null;
      const moonSummary = moonRange ? buildMoonSummary(moonRange, formatDateTimeShort) : null;
      const moonPointData = moonPt ? summarizePoint(moonPt) : null;
      const moonCurrent = moonSummary?.current || null;
      const moonData =
        moonCurrent || moonPointData
          ? {
              sign: moonCurrent?.sign || moonPointData?.sign,
              quality: moonCurrent?.quality || moonPointData?.quality,
              element: moonCurrent?.element || moonPointData?.element,
              emoji: moonCurrent?.emoji || moonPointData?.emoji,
              orb: typeof moonSummary?.orb === "number" ? moonSummary.orb : moonPointData?.orb,
              decan: typeof moonSummary?.decan === "number" ? moonSummary.decan : moonPointData?.decan,
            }
          : null;
      const moonIllumVal = computeMoonIllumination(points);
      const lunation = getLunationInfo({
        year: metaSource?.year || metaSource?.moment?.year || metaSource?.birth?.year || anchor.getFullYear(),
        month: metaSource?.month || metaSource?.moment?.month || metaSource?.birth?.month || anchor.getMonth() + 1,
        day: metaSource?.day || metaSource?.moment?.day || metaSource?.birth?.day || anchor.getDate(),
        hour: metaSource?.hour || metaSource?.moment?.hour || metaSource?.birth?.hour || anchor.getHours(),
        minute: metaSource?.minute || metaSource?.moment?.minute || metaSource?.birth?.minute || anchor.getMinutes(),
      });
      const moonIllumRaw =
        typeof moonIllumVal === "number"
          ? `${moonIllumVal.toFixed(1)}%`
          : typeof moonIllumVal === "string"
            ? moonIllumVal
            : "";
      const moonIllum = moonIllumRaw || "—";

      const nextInfo =
        ascSummary && ascSummary.nextSign
          ? `Next ${SIGN_META[ascSummary.nextSign]?.name || ascSummary.nextSign} at ${ascSummary.nextTime}`
          : "";

      const moonNext =
        moonSummary && moonSummary.nextSign
          ? `Next ${SIGN_META[moonSummary.nextSign]?.name || moonSummary.nextSign} at ${moonSummary.nextTime}`
          : "";
      const moonExtras = [moonNext, `Illumination ${moonIllum}${lunation && lunation.name ? ` · ${lunation.name}` : ""}`]
        .filter(Boolean)
        .join(" · ");

      return `
        <div class="adv-summary-card">
          <div class="adv-summary-head">
            <div>
              <p class="adv-asc-kicker">Day Ruler · ${dayRulerName} ${dayRulerIcon}</p>
              <p class="adv-asc-sub">${dateLabel}</p>
            </div>
            <span class="adv-asc-pill">${range.label || range.id || "Range"}</span>
          </div>
          <div class="adv-summary-grid">
            ${sunData ? formatSummaryRow("Sun", POINTS_ICONS.sun, sunData) : ""}
            ${moonData ? formatSummaryRow("Moon", POINTS_ICONS.moon, moonData, moonExtras) : ""}
            ${dayData ? formatSummaryRow(dayRulerName || "Day Ruler", POINTS_ICONS[dayRulerKey] || "☉", dayData) : ""}
            ${
              ascData
                ? formatSummaryRow(
                    "Asc",
                    POINTS_ICONS.ascendant,
                    ascData,
                    nextInfo ? nextInfo : ""
                  )
                : ""
            }
          </div>
        </div>
      `;
    });

    const wrapClass = isDual ? "adv-summary-wrap adv-summary-wrap--stacked" : "adv-summary-wrap";
    return `<div class="${wrapClass}">${cards.join("")}</div>`;
  }

  function normalizeAscendantRanges(payload) {
    if (!payload) return [];
    const rangesRaw = [];
    const pushRanges = (val) => {
      if (Array.isArray(val)) rangesRaw.push(...val);
    };
    pushRanges(payload.ascendant_day_range || payload.ascendantDayRange);
    pushRanges(payload.snapshot?.ascendant_day_range || payload.snapshot?.ascendantDayRange);
    pushRanges(payload.subject?.ascendant_day_range || payload.subject?.ascendantDayRange);

    const seen = new Set();
    const normalized = [];
    rangesRaw.forEach((range, idx) => {
      if (!range || typeof range !== "object") return;
      const id = String(range.id || range.label || `range-${idx}`);
      if (seen.has(id)) return;
      seen.add(id);

      const anchorRaw = range.anchor || range.anchor_timestamp || range.anchorTimestamp;
      const anchorCandidate = anchorRaw ? new Date(anchorRaw) : null;
      const entriesRaw = Array.isArray(range.entries) ? range.entries : [];

      const normalizedEntries = entriesRaw
        .map((entry) => {
          const startRaw =
            entry.start ||
            entry.start_timestamp ||
            entry.startTimestamp ||
            entry.timestamp ||
            entry.time ||
            entry.date ||
            null;
          const endRaw = entry.end || entry.end_timestamp || entry.endTimestamp || entry.finish || entry.until || entry.to || null;
          const start = startRaw ? new Date(startRaw) : null;
          const end = endRaw ? new Date(endRaw) : null;
          const hasStart = start instanceof Date && Number.isFinite(start.getTime());
          if (!hasStart) return null;
          const hasEnd = end instanceof Date && Number.isFinite(end.getTime());
          const resolvedEnd = hasEnd ? end : new Date(start.getTime() + 2 * HOUR_MS);
          return {
            ...entry,
            timestamp: start,
            start,
            end: resolvedEnd,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.start - b.start);

      const anchorDate =
        anchorCandidate instanceof Date && Number.isFinite(anchorCandidate.getTime())
          ? anchorCandidate
          : normalizedEntries[0]?.start || new Date();
      const anchorHour = anchorDate instanceof Date ? (anchorDate.getHours() + anchorDate.getMinutes() / 60) % 24 : 0;

      const withOffsets = normalizedEntries.map((entry, entryIdx) => {
        const offsetHours =
          anchorDate instanceof Date && entry.start instanceof Date
            ? (entry.start.getTime() - anchorDate.getTime()) / HOUR_MS
            : entry.offset_hours ?? entry.offsetHours ?? entryIdx * 2;
        const endOffset =
          anchorDate instanceof Date && entry.end instanceof Date
            ? (entry.end.getTime() - anchorDate.getTime()) / HOUR_MS
            : offsetHours + 2;
        return {
          ...entry,
          offsetHours,
          endOffset,
          displayHour: ((offsetHours % 24) + 24) % 24,
        };
      });

      normalized.push({
        id,
        label: range.label || id,
        anchor: anchorDate,
        anchorHour,
        entries: withOffsets,
      });
    });
    return normalized;
  }

  function normalizeMoonRanges(payload) {
    if (!payload) return [];
    const rangesRaw = [];
    const pushRanges = (val) => {
      if (Array.isArray(val)) rangesRaw.push(...val);
    };
    pushRanges(payload.moon_month_range || payload.moonMonthRange);
    pushRanges(payload.snapshot?.moon_month_range || payload.snapshot?.moonMonthRange);
    pushRanges(payload.subject?.moon_month_range || payload.subject?.moonMonthRange);

    const seen = new Set();
    const normalized = [];
    rangesRaw.forEach((range, idx) => {
      if (!range || typeof range !== "object") return;
      const id = String(range.id || range.label || `range-${idx}`);
      if (seen.has(id)) return;
      seen.add(id);

      const anchorRaw = range.anchor || range.anchor_timestamp || range.anchorTimestamp;
      const anchorCandidate = anchorRaw ? new Date(anchorRaw) : null;
      const entriesRaw = Array.isArray(range.entries) ? range.entries : [];

      const normalizedEntries = entriesRaw
        .map((entry) => {
          const startRaw =
            entry.start ||
            entry.start_timestamp ||
            entry.startTimestamp ||
            entry.timestamp ||
            entry.time ||
            entry.date ||
            null;
          const endRaw = entry.end || entry.end_timestamp || entry.endTimestamp || entry.finish || entry.until || entry.to || null;
          const start = startRaw ? new Date(startRaw) : null;
          const end = endRaw ? new Date(endRaw) : null;
          const hasStart = start instanceof Date && Number.isFinite(start.getTime());
          if (!hasStart) return null;
          const hasEnd = end instanceof Date && Number.isFinite(end.getTime());
          const resolvedEnd = hasEnd ? end : new Date(start.getTime() + 2 * DAY_MS);
          return {
            ...entry,
            start,
            end: resolvedEnd,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.start - b.start);

      const anchorDate =
        anchorCandidate instanceof Date && Number.isFinite(anchorCandidate.getTime())
          ? anchorCandidate
          : normalizedEntries[0]?.start || new Date();

      const withOffsets = normalizedEntries.map((entry, entryIdx) => {
        const offsetHours =
          anchorDate instanceof Date && entry.start instanceof Date
            ? (entry.start.getTime() - anchorDate.getTime()) / HOUR_MS
            : entry.offset_hours ?? entry.offsetHours ?? entryIdx * 48;
        const endOffset =
          anchorDate instanceof Date && entry.end instanceof Date
            ? (entry.end.getTime() - anchorDate.getTime()) / HOUR_MS
            : offsetHours + 48;
        return {
          ...entry,
          offsetHours,
          endOffset,
        };
      });

      normalized.push({
        id,
        label: range.label || id,
        anchor: anchorDate,
        entries: withOffsets,
      });
    });
    return normalized;
  }

  function formatClockTime(entry, fallbackHour) {
    if (entry && entry.timestamp instanceof Date && Number.isFinite(entry.timestamp.getTime())) {
      const h = entry.timestamp.getHours();
      const m = entry.timestamp.getMinutes();
      return `${pad(h)}:${pad(m)}`;
    }
    const h = Math.round(((fallbackHour % 24) + 24) % 24);
    return `${pad(h)}:00`;
  }

  const formatTimeSimple = (date) => {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "—";
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const formatDateTimeShort = (date) => {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "—";
    try {
      return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (err) {
      return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
  };

  const safeDate = (value) => (value instanceof Date && Number.isFinite(value.getTime()) ? value : null);

  function computeSignSegments(range, windowStart, windowEnd) {
    if (!range || !Array.isArray(range.entries)) return [];
    const startMs = windowStart?.getTime();
    const endMs = windowEnd?.getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return [];

    const entries = range.entries
      .map((entry) => {
        const start = safeDate(entry.start || entry.timestamp);
        const end = safeDate(entry.end);
        if (!(start && end && end > start)) return null;
        return { ...entry, start, end };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);

    return entries
      .map((entry) => {
        const clippedStart = Math.max(entry.start.getTime(), startMs);
        const clippedEnd = Math.min(entry.end.getTime(), endMs);
        if (clippedEnd <= clippedStart) return null;
        return {
          sign: entry.sign,
          start: new Date(clippedStart),
          end: new Date(clippedEnd),
          entry,
        };
      })
      .filter(Boolean);
  }

  function renderAscendantCenter(ranges, hours, centerEl, handColors = [], showLabels) {
    if (!centerEl) return;
    const parts = ranges.map((range) => {
      if (!range.entries.length || !range.anchor) return null;
      const rangeIdx = ranges.indexOf(range);
      const bandLabel = ranges.length > 1 ? `<span class="adv-asc-label">${rangeIdx === 0 ? "Outer:" : "Inner:"}</span>` : "";
      const targetHour = Array.isArray(hours) ? hours[rangeIdx] ?? hours[0] ?? 0 : hours ?? 0;
      const targetTs = new Date(range.anchor.getTime() + targetHour * HOUR_MS);

      const pickEntry = () => {
        for (let i = 0; i < range.entries.length; i++) {
          const entry = range.entries[i];
          const start = safeDate(entry.start || entry.timestamp);
          const end = safeDate(entry.end);
          if (start && end && targetTs >= start && targetTs < end) return entry;
        }
        return range.entries[0];
      };

      const best = pickEntry();
      const signMeta = SIGN_META[best.sign] || { name: best.sign || "—", icon: best.emoji || "?" };
      const { orb, decan } = computeAscProgress(best, targetTs);
      const orbText = typeof orb === "number" ? `${orb.toFixed(2)}°` : "—";
      const decanText = decan ? `${formatOrdinal(decan)} Dec.` : "—";
      const qualityIcon = QUALITY_ICON[best.quality] || "";
      const qualityText = best.quality || "—";
      const tone = elementStroke(best.element || "Default", 0.6);
      const handColor = handColors[rangeIdx] || tone;
      const timeLabel = formatClockTime({ timestamp: targetTs }, targetHour);

      const label = showLabels ? `<span class="adv-asc-label">${range.label || range.id}</span>` : "";
      return `
        <div class="adv-asc-active-row" style="--asc-accent:${tone}">
          <div class="adv-asc-glyph">${signMeta.icon || "↗"}</div>
          <div class="adv-asc-active-meta">
            <div class="adv-asc-active-title">
              ${bandLabel}${label}
              <span class="adv-asc-sign" style="color:${handColor}">${signMeta.name}</span>
              <span class="adv-asc-meta-inline">${decanText} · Orb ${orbText}</span>
            </div>
            <div class="adv-asc-active-stats">
              <span>${timeLabel}</span>
              <span>${qualityIcon ? `${qualityIcon} ` : ""}${qualityText} ${ELEMENT_ICON[best.element] || ""}</span>
            </div>
          </div>
        </div>
      `;
    }).filter(Boolean);

    centerEl.innerHTML = `
      <div class="adv-asc-center-card">
        ${parts.join("")}
      </div>
    `;
  }

  function initAscendantClock(ranges, ids) {
    if (!ranges.length || !ids) return;
    const canvas = document.getElementById(ids.canvasId);
    const playBtn = document.getElementById(ids.playId);
    const centerEl = document.getElementById(ids.centerId);
    const bodyEl = document.getElementById(ids.bodyId);
    const range12Btn = document.getElementById(ids.range12Id);
    const range24Btn = document.getElementById(ids.range24Id);
    if (!canvas || !centerEl) return;

    if (window.AdvancedApp && typeof window.AdvancedApp._cleanupAscClock === "function") {
      try {
        window.AdvancedApp._cleanupAscClock();
      } catch (err) {}
    }

    const ctx = canvas.getContext("2d");
    const isDual = ranges.length > 1;
    const wrapOffset = (offset, windowHours) => {
      let value = offset;
      while (value >= windowHours) value -= windowHours;
      while (value < 0) value += windowHours;
      return value;
    };
    const rings = isDual
      ? [
          { outer: 0.94, inner: 0.64, hand: 0.92, handColor: PRIMARY_HAND_COLOR },
          { outer: 0.56, inner: 0.32, hand: 0.58, handColor: SECONDARY_HAND_COLOR },
        ]
      : [{ outer: 0.9, inner: 0.58, hand: 0.9, handColor: PRIMARY_HAND_COLOR }];

    const state = {
      offsets: ranges.map(() => 0),
      playing: false,
      lastTick: performance.now(),
      windowHours: range24Btn && range24Btn.getAttribute("aria-pressed") === "true" ? 24 : 12,
    };

    const hourStep = () => (Math.PI * 2) / state.windowHours;

    const windowForRange = (range) => {
      const anchor = safeDate(range.anchor) || safeDate(range.entries?.[0]?.start) || new Date();
      const start = anchor;
      const end = new Date(start.getTime() + state.windowHours * HOUR_MS);
      return { anchor, start, end };
    };

    const angleForOffset = (offset) => -Math.PI / 2 + wrapOffset(offset, state.windowHours) * hourStep();

    const resetOffsets = () => {
      state.offsets = ranges.map((range) => {
        const window = windowForRange(range);
        const anchorHour = typeof range.anchorHour === "number" ? range.anchorHour : window.start.getHours() + window.start.getMinutes() / 60;
        const startHour = window.start.getHours() + window.start.getMinutes() / 60;
        return wrapOffset(anchorHour - startHour, state.windowHours);
      });
    };

    const applyLayout = () => {
      if (!bodyEl) return;
      const isStacked = isDual || window.innerWidth < 768;
      bodyEl.classList.toggle("adv-asc-body--stacked", isStacked);
    };

    const resize = () => {
      const parent = canvas.parentElement;
      const baseSize = parent ? parent.clientWidth : canvas.getBoundingClientRect().width;
      const target = Math.max(280, baseSize || 360);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = target * dpr;
      canvas.height = target * dpr;
      canvas.style.width = "100%";
      canvas.style.height = `${target}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
      applyLayout();
    };

    const drawRing = (range, ringConfig, ringIdx, activeOffset) => {
      if (!range.entries.length) return { handColor: ringConfig.handColor };
      const { width, height } = canvas;
      const w = width / (window.devicePixelRatio || 1);
      const h = height / (window.devicePixelRatio || 1);
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2;
      const outerR = radius * ringConfig.outer;
      const innerR = radius * ringConfig.inner;
      const boundaries = Array.from({ length: state.windowHours + 1 }, (_, i) => -Math.PI / 2 + i * hourStep());
      const rangeWindow = windowForRange(range);

      ctx.save();
      ctx.translate(cx, cy);

      const angleForTime = (date) => {
        const spanMs = state.windowHours * HOUR_MS;
        const frac = (date.getTime() - rangeWindow.start.getTime()) / spanMs;
        return -Math.PI / 2 + frac * Math.PI * 2;
      };

      const renderSegments = computeSignSegments(range, rangeWindow.start, rangeWindow.end).map((seg) => {
        const startAngle = angleForTime(seg.start);
        let endAngle = angleForTime(seg.end);
        if (endAngle <= startAngle) endAngle += Math.PI * 2;
        return { ...seg, startAngle, endAngle };
      });

      const mergedSegments = [];
      renderSegments.forEach((seg) => {
        const prev = mergedSegments[mergedSegments.length - 1];
        if (prev && prev.sign === seg.sign && Math.abs(seg.startAngle - prev.endAngle) < 1e-4) {
          prev.endAngle = seg.endAngle;
          prev.end = seg.end;
        } else {
          mergedSegments.push({ ...seg });
        }
      });

      const normalizedOffset = wrapOffset(activeOffset ?? 0, state.windowHours);
      const activeTime = new Date(rangeWindow.start.getTime() + normalizedOffset * HOUR_MS);
      const highlightStart = angleForOffset(normalizedOffset);
      let highlightEnd = angleForOffset(normalizedOffset + 1);
      if (highlightEnd <= highlightStart) highlightEnd += Math.PI * 2;

      if (ringIdx === 0) {
        ctx.save();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.65;
        boundaries.forEach((ang) => {
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * innerR, Math.sin(ang) * innerR);
          ctx.lineTo(Math.cos(ang) * outerR, Math.sin(ang) * outerR);
          ctx.stroke();
        });
        ctx.restore();
      }

      let currentSignHighlighter = null;
      mergedSegments.forEach((seg) => {
        const sliceStart = seg.startAngle;
        const sliceEnd = seg.endAngle;
        const srcEntry = seg.entry;
        const isActive = activeTime >= seg.start && activeTime < seg.end;

        ctx.beginPath();
        ctx.arc(0, 0, outerR, sliceStart, sliceEnd);
        ctx.arc(0, 0, innerR, sliceEnd, sliceStart, true);
        ctx.closePath();
        ctx.fillStyle = elementFill(srcEntry.element, isDual ? 0.28 : 0.34);
        ctx.strokeStyle = elementStroke(srcEntry.element, 0.45);
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();

        const isOuterRing = ringConfig === rings[0];
        const outerRingInnerR = radius * (rings[0]?.inner || ringConfig.inner);
        const lineStartR = innerR;
        const lineEndR = isOuterRing ? outerR + radius * 0.06 : Math.max(lineStartR, outerRingInnerR);
        ctx.save();
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = elementStroke(srcEntry.element, 0.6);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sliceStart) * lineStartR, Math.sin(sliceStart) * lineStartR);
        ctx.lineTo(Math.cos(sliceStart) * lineEndR, Math.sin(sliceStart) * lineEndR);
        ctx.stroke();
        ctx.restore();

        const decanStep = (sliceEnd - sliceStart) / 3;
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        for (let j = 1; j <= 2; j++) {
          const a = sliceStart + decanStep * j;
          const x1 = Math.cos(a) * innerR;
          const y1 = Math.sin(a) * innerR;
          const x2 = Math.cos(a) * outerR;
          const y2 = Math.sin(a) * outerR;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        const signMeta = SIGN_META[srcEntry.sign] || {};
        const glyph = signMeta.icon || srcEntry.emoji || "?";
        const decanCenter = sliceStart + (sliceEnd - sliceStart) / 6;
        const labelR = innerR + (outerR - innerR) * (isOuterRing ? 0.45 : 0.43);
        const tx = Math.cos(decanCenter) * labelR;
        const ty = Math.sin(decanCenter) * labelR;
        ctx.fillStyle = "#e8f4ff";
        ctx.font = `${Math.max(12, radius * 0.06)}px "Space Grotesk", "Inter", system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(glyph, tx, ty);

        if (isActive) {
          currentSignHighlighter = {
            startAngle: sliceStart,
            endAngle: sliceEnd,
            color: elementStroke(srcEntry.element, 0.9),
          };
        }
      });

      if (ringIdx === 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        ctx.lineWidth = 1;
        const tickOuter = outerR * 1.015;
        for (let i = 0; i < state.windowHours; i++) {
          const a = boundaries[i];
          const r1 = outerR * 0.97;
          const r2 = tickOuter;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
          ctx.stroke();

          const labelR = outerR * 1.05;
          ctx.fillStyle = "#cbd5e1";
          ctx.font = `${Math.max(11, radius * 0.04)}px "Space Grotesk", "Inter", system-ui`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const labelDate = new Date(rangeWindow.start.getTime() + i * HOUR_MS);
          const mins = labelDate.getMinutes();
          const labelVal = mins ? `${pad(labelDate.getHours())}:${pad(mins)}` : `${pad(labelDate.getHours())}`;
          ctx.fillText(labelVal, Math.cos(a) * labelR, Math.sin(a) * labelR);
        }
      }

      if (ringIdx === 1 && isDual) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = `${Math.max(10, radius * 0.035)}px "Space Grotesk", "Inter", system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const innerLabelR = innerR * 0.88;
        for (let i = 0; i < state.windowHours; i++) {
          const a = boundaries[i];
          const labelDate = new Date(rangeWindow.start.getTime() + i * HOUR_MS);
          const mins = labelDate.getMinutes();
          const labelVal = `${pad(labelDate.getHours())}:${pad(mins)}`;
          ctx.fillText(labelVal, Math.cos(a) * innerLabelR, Math.sin(a) * innerLabelR);
        }
      }

      if (currentSignHighlighter) {
        const outerHighlightR = outerR * 1.01;
        const innerHighlightR = outerR * 0.99;
        ctx.save();
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(0, 0, outerHighlightR, currentSignHighlighter.startAngle + 0.002, currentSignHighlighter.endAngle - 0.002);
        ctx.strokeStyle = currentSignHighlighter.color;
        ctx.lineWidth = 4.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, innerHighlightR, currentSignHighlighter.startAngle + 0.002, currentSignHighlighter.endAngle - 0.002);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
      return { handColor: currentSignHighlighter?.color || ringConfig.handColor };
    };

    const drawHands = (activeColors) => {
      const { width, height } = canvas;
      const w = width / (window.devicePixelRatio || 1);
      const h = height / (window.devicePixelRatio || 1);
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2;
      ranges.forEach((range, idx) => {
        const handCfg = rings[idx] || rings[0];
        const offset = wrapOffset(state.offsets[idx] ?? state.offsets[0] ?? 0, state.windowHours);
        const angle = angleForOffset(offset);
        const handR = radius * handCfg.hand;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = activeColors[idx] || handCfg.handColor;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * handR, Math.sin(angle) * handR);
        ctx.stroke();
        ctx.restore();
      });
      renderAscendantCenter(ranges, state.offsets, centerEl, rings.map((r) => r.handColor), isDual);
    };

    const draw = () => {
      const { width, height } = canvas;
      const w = width / (window.devicePixelRatio || 1);
      const h = height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);

      const activeColors = ranges.map((range, idx) => {
        const offset = wrapOffset(state.offsets[idx] ?? state.offsets[0] ?? 0, state.windowHours);
        const result = drawRing(range, rings[idx] || rings[0], idx, offset);
        return result?.handColor || (rings[idx] || rings[0]).handColor;
      });
      drawHands(activeColors);
    };

    const tick = (ts) => {
      if (!state.playing) return;
      const delta = (ts - state.lastTick) / 1000;
      state.lastTick = ts;
      state.offsets = state.offsets.map((h) => wrapOffset(h + delta, state.windowHours));
      draw();
      requestAnimationFrame(tick);
    };

    const setOffsetFromClick = (event) => {
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width;
      const x = (event.clientX - rect.left) * scale - canvas.width / 2;
      const y = (event.clientY - rect.top) * scale - canvas.height / 2;
      const angle = Math.atan2(y, x);
      const rawOffset = (angle + Math.PI / 2) / hourStep();
      const snapped = Math.round(rawOffset);
      if (isDual) {
        const r = Math.sqrt(x * x + y * y);
        const radius = Math.min(canvas.width, canvas.height) / 2;
        const radial = r / radius;
        const ringIdx = radial > (rings[0].inner + rings[0].outer) / 2 ? 0 : 1;
        const normalized = wrapOffset(snapped, state.windowHours);
        state.offsets[ringIdx] = normalized;
      } else {
        const normalized = wrapOffset(snapped, state.windowHours);
        state.offsets = [normalized];
      }
      state.playing = false;
      if (playBtn) {
        playBtn.setAttribute("aria-pressed", "false");
        playBtn.innerHTML =
          '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14l11-7z" /></svg><span>Play</span>';
      }
      draw();
    };

    const togglePlay = () => {
      if (!ranges.length) {
        state.playing = false;
        return;
      }
      state.playing = !state.playing;
      state.lastTick = performance.now();
      if (playBtn) {
        playBtn.setAttribute("aria-pressed", state.playing ? "true" : "false");
        playBtn.innerHTML = state.playing
          ? '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 6h2v12h-2zM12 12h2v6h-2z"/></svg><span>Pause</span>'
          : '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14l11-7z" /></svg><span>Play</span>';
      }
      if (state.playing) {
        requestAnimationFrame(tick);
      }
    };

    const setWindowHours = (hours) => {
      if (hours !== 12 && hours !== 24) return;
      state.windowHours = hours;
      resetOffsets();
      if (range12Btn) range12Btn.setAttribute("aria-pressed", hours === 12 ? "true" : "false");
      if (range24Btn) range24Btn.setAttribute("aria-pressed", hours === 24 ? "true" : "false");
      resize();
      renderAscendantCenter(ranges, state.offsets, centerEl, rings.map((r) => r.handColor), isDual);
    };

    resetOffsets();
    resize();
    renderAscendantCenter(ranges, state.offsets, centerEl, rings.map((r) => r.handColor), isDual);

    const onRange12 = () => setWindowHours(12);
    const onRange24 = () => setWindowHours(24);
    if (playBtn) {
      playBtn.addEventListener("click", togglePlay);
    }
    if (range12Btn) {
      range12Btn.addEventListener("click", onRange12);
    }
    if (range24Btn) {
      range24Btn.addEventListener("click", onRange24);
    }
    window.addEventListener("resize", resize);
    canvas.addEventListener("click", setOffsetFromClick);
    if (window.AdvancedApp) {
      window.AdvancedApp._cleanupAscClock = () => {
        window.removeEventListener("resize", resize);
        if (playBtn) playBtn.removeEventListener("click", togglePlay);
        canvas.removeEventListener("click", setOffsetFromClick);
        if (range12Btn) range12Btn.removeEventListener("click", onRange12);
        if (range24Btn) range24Btn.removeEventListener("click", onRange24);
      };
    }
    draw();
  }
  function buildAscendantClockBlock(ascendantRanges, metaSource) {
    if (!ascendantRanges.length) return { html: "", ids: null };
    const clockId = `asc-clock-${++ascClockCounter}`;
    const canvasId = `${clockId}-canvas`;
    const playId = `${clockId}-play`;
    const centerId = `${clockId}-center`;
    const range12Id = `${clockId}-12h`;
    const range24Id = `${clockId}-24h`;
    const bodyId = `${clockId}-body`;
    const dateInfo = formatDateLabel(metaSource || {});
    const dateLabel = dateInfo.label ? `${dateInfo.label}${dateInfo.tzShort ? ` (${dateInfo.tzShort})` : ""}` : "Requested datetime";
    const legend = ascendantRanges
      .map((r, idx) => {
        const tagColor = idx === 0 ? PRIMARY_HAND_COLOR : SECONDARY_HAND_COLOR;
        return `<span class="adv-asc-pill" style="--asc-pill:${tagColor}">${r.label || r.id}</span>`;
      })
      .join("");

    const html = `
      <div class="adv-asc-card" data-asc-clock="${clockId}">
        <div class="adv-asc-head">
          <div>
            <p class="adv-asc-kicker">Ascendant clock</p>
            <p class="adv-asc-sub">Forward from ${dateLabel}</p>
          </div>
          <div class="adv-asc-actions">
            <button type="button" class="adv-asc-play" id="${playId}" aria-pressed="false">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Play</span>
            </button>
            <button type="button" class="adv-asc-toggle" id="${range12Id}" aria-pressed="true">Next 12h</button>
            <button type="button" class="adv-asc-toggle" id="${range24Id}" aria-pressed="false">Next 24h</button>
          </div>
        </div>
        <div class="adv-asc-legend">${legend}</div>
        <div class="adv-asc-body" id="${bodyId}">
          <div class="adv-asc-canvas-wrap">
            <canvas id="${canvasId}" class="adv-asc-canvas" aria-label="Ascendant clock"></canvas>
          </div>
          <div id="${centerId}" class="adv-asc-center"></div>
        </div>
      </div>
    `;
    return { html, ids: { canvasId, playId, centerId, range12Id, range24Id, bodyId } };
  }

  function buildAscendantTables(ranges) {
    if (!ranges.length) return "";
    const formatTime = (ts) => {
      if (!(ts instanceof Date) || !Number.isFinite(ts.getTime())) return "—";
      return `${pad(ts.getHours())}:${pad(ts.getMinutes())}`;
    };
    const renderRow = (entry) => {
      const signMeta = SIGN_META[entry.sign] || { name: entry.sign || "—", icon: entry.emoji || "" };
      const qualityIcon = QUALITY_ICON[entry.quality] || "";
      const elementIcon = ELEMENT_ICON[entry.element] || "";
      const swatchColor = elementFill(entry.element, 1).replace("rgba(", "rgb(").replace(/,\s*1\)$/, ")");
      const start = entry.start || entry.timestamp;
      const end = entry.end;
      const durationHours =
        start instanceof Date && end instanceof Date
          ? ((end.getTime() - start.getTime()) / HOUR_MS).toFixed(2)
          : "—";
      return `
        <tr>
          <td>${formatTime(start)}</td>
          <td>${formatTime(end)}</td>
          <td>${signMeta.icon || ""} ${signMeta.name}</td>
          <td>${durationHours}</td>
          <td>${qualityIcon ? `${qualityIcon} ` : ""}${entry.quality || "—"}</td>
          <td><span class="adv-asc-color-swatch" style="background:${swatchColor}"></span>${elementIcon ? `${elementIcon} ` : ""}${entry.element || "—"}</td>
        </tr>
      `;
    };

    const tables = ranges.map((range, idx) => {
      const handColor = idx === 0 ? PRIMARY_HAND_COLOR : SECONDARY_HAND_COLOR;
      const rows = range.entries.map(renderRow).join("");
      return `
        <table class="adv-asc-table">
          <caption style="color:${handColor}">${range.label || range.id}</caption>
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Sign</th>
              <th>Duration (h)</th>
              <th>Quality</th>
              <th>Element</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5">No data</td></tr>'}</tbody>
        </table>
      `;
    });

    return `<div class="adv-asc-table-grid">${tables.join("")}</div>`;
  }

  function renderMoonCenter(ranges, offsets, centerEl, handColors = [], showLabels = false, windowDays = 14) {
    if (!centerEl) return;
    const parts = ranges
      .map((range, idx) => {
        if (!range.entries.length || !range.anchor) return null;
        const targetOffset = Array.isArray(offsets) ? offsets[idx] ?? offsets[0] ?? 0 : offsets || 0;
        const targetTs = new Date(range.anchor.getTime() + targetOffset * HOUR_MS);
        const pickEntry = () => {
          for (let i = 0; i < range.entries.length; i++) {
            const entry = range.entries[i];
            const start = safeDate(entry.start || entry.timestamp);
            const end = safeDate(entry.end);
            if (start && end && targetTs >= start && targetTs < end) return entry;
          }
          return range.entries[0];
        };
        const best = pickEntry();
        const signMeta = SIGN_META[best.sign] || { name: best.sign || "—", icon: best.emoji || "☾" };
        const { orb, decan } = computeMoonProgress(best, targetTs);
        const qualityIcon = QUALITY_ICON[best.quality] || "";
        const tone = elementStroke(best.element || "Default", 0.6);
        const handColor = handColors[idx] || tone;
        const timeLabel = formatDateTimeShort(targetTs);

        const label = showLabels ? `<span class="adv-asc-label">${range.label || range.id}</span>` : "";
        const bandLabel = ranges.length > 1 ? `<span class="adv-asc-label">${idx === 0 ? "Outer:" : "Inner:"}</span>` : "";
        return `
          <div class="adv-asc-active-row adv-moon-active" style="--asc-accent:${tone}">
            <div class="adv-asc-glyph">${signMeta.icon || "☾"}</div>
            <div class="adv-asc-active-meta">
              <div class="adv-asc-active-title">
                ${bandLabel}${label}
                <span class="adv-asc-sign" style="color:${handColor}">${signMeta.name}</span>
                <span class="adv-asc-meta-inline">${decan ? `${formatOrdinal(decan)} Dec.` : "—"} · Orb ${typeof orb === "number" ? orb.toFixed(2) : "—"}°</span>
              </div>
              <div class="adv-asc-active-stats">
                <span>${timeLabel}</span>
                <span>${qualityIcon ? `${qualityIcon} ` : ""}${best.quality || "—"} ${ELEMENT_ICON[best.element] || ""}</span>
                <span>Window ${windowDays}d</span>
              </div>
            </div>
          </div>
        `;
      })
      .filter(Boolean);

    centerEl.innerHTML = `
      <div class="adv-asc-center-card adv-moon-center">
        ${parts.join("")}
      </div>
    `;
  }

  function buildMoonClockBlock(moonRanges, metaSource) {
    if (!moonRanges.length) return { html: "", ids: null };
    const clockId = `moon-clock-${++moonClockCounter}`;
    const canvasId = `${clockId}-canvas`;
    const centerId = `${clockId}-center`;
    const playId = `${clockId}-play`;
    const range14Id = `${clockId}-14d`;
    const range28Id = `${clockId}-28d`;
    const bodyId = `${clockId}-body`;
    const dateInfo = formatDateLabel(metaSource || {});
    const dateLabel = dateInfo.label ? `${dateInfo.label}${dateInfo.tzShort ? ` (${dateInfo.tzShort})` : ""}` : "Requested datetime";
    const legend = moonRanges
      .map((r, idx) => {
        const tagColor = idx === 0 ? PRIMARY_HAND_COLOR : SECONDARY_HAND_COLOR;
        return `<span class="adv-asc-pill" style="--asc-pill:${tagColor}">${r.label || r.id}</span>`;
      })
      .join("");

    const html = `
      <div class="adv-asc-card adv-moon-card" data-moon-clock="${clockId}">
        <div class="adv-asc-head">
          <div>
            <p class="adv-asc-kicker">Moon clock</p>
            <p class="adv-asc-sub">Forward from ${dateLabel}</p>
          </div>
          <div class="adv-asc-actions">
            <button type="button" class="adv-asc-play" id="${playId}" aria-pressed="false">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Play</span>
            </button>
            <button type="button" class="adv-asc-toggle" id="${range14Id}" aria-pressed="true">Next 2w</button>
            <button type="button" class="adv-asc-toggle" id="${range28Id}" aria-pressed="false">Next 4w</button>
          </div>
        </div>
        <div class="adv-asc-legend">${legend}</div>
        <div class="adv-asc-body adv-asc-body--stacked" id="${bodyId}">
          <div class="adv-asc-canvas-wrap">
            <canvas id="${canvasId}" class="adv-asc-canvas" aria-label="Moon clock"></canvas>
          </div>
          <div id="${centerId}" class="adv-asc-center"></div>
        </div>
      </div>
    `;
    return { html, ids: { canvasId, centerId, playId, range14Id, range28Id, bodyId } };
  }

  function initMoonClock(ranges, ids) {
    if (!ranges.length || !ids) return;
    const canvas = document.getElementById(ids.canvasId);
    const playBtn = document.getElementById(ids.playId);
    const centerEl = document.getElementById(ids.centerId);
    const range14Btn = document.getElementById(ids.range14Id);
    const range28Btn = document.getElementById(ids.range28Id);
    if (!canvas || !centerEl) return;

    if (window.AdvancedApp && typeof window.AdvancedApp._cleanupMoonClock === "function") {
      try {
        window.AdvancedApp._cleanupMoonClock();
      } catch (err) {}
    }

    const ctx = canvas.getContext("2d");
    const isDual = ranges.length > 1;
    const wrapOffset = (offset, windowHours) => {
      let value = offset;
      while (value >= windowHours) value -= windowHours;
      while (value < 0) value += windowHours;
      return value;
    };
    const rings = isDual
      ? [
          { outer: 0.9, inner: 0.6, hand: 0.9, handColor: PRIMARY_HAND_COLOR, width: 7 },
          { outer: 0.52, inner: 0.28, hand: 0.48, handColor: SECONDARY_HAND_COLOR, width: 6 },
        ]
      : [{ outer: 0.9, inner: 0.6, hand: 0.88, handColor: PRIMARY_HAND_COLOR, width: 8 }];

    const state = {
      offsets: ranges.map(() => 0),
      playing: false,
      lastTick: performance.now(),
      windowDays: range28Btn && range28Btn.getAttribute("aria-pressed") === "true" ? 28 : 14,
    };

    const windowHours = () => state.windowDays * 24;
    const hourStep = () => (Math.PI * 2) / windowHours();

    const windowForRange = (range) => {
      const anchor = safeDate(range.anchor) || safeDate(range.entries?.[0]?.start) || new Date();
      const start = anchor;
      const end = new Date(start.getTime() + windowHours() * HOUR_MS);
      return { anchor, start, end };
    };

    const angleForOffset = (offset) => -Math.PI / 2 + wrapOffset(offset, windowHours()) * hourStep();

    const resetOffsets = () => {
      state.offsets = ranges.map((range) => {
        const window = windowForRange(range);
        return wrapOffset(0, windowHours());
      });
    };

    const applyLayout = () => {
      if (!ids.bodyId) return;
      const bodyEl = document.getElementById(ids.bodyId);
      if (bodyEl) {
        const isStacked = isDual || window.innerWidth < 768;
        bodyEl.classList.toggle("adv-asc-body--stacked", isStacked);
      }
    };

    const resize = () => {
      const parent = canvas.parentElement;
      const baseSize = parent ? parent.clientWidth : canvas.getBoundingClientRect().width;
      const target = Math.max(280, baseSize || 360);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = target * dpr;
      canvas.height = target * dpr;
      canvas.style.width = "100%";
      canvas.style.height = `${target}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
      applyLayout();
    };

    const drawRing = (range, ringConfig, ringIdx, activeOffset) => {
      if (!range.entries.length) return { handColor: ringConfig.handColor };
      const { width, height } = canvas;
      const w = width / (window.devicePixelRatio || 1);
      const h = height / (window.devicePixelRatio || 1);
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2;
      const outerR = radius * ringConfig.outer;
      const innerR = radius * ringConfig.inner;
      const boundaries = Array.from({ length: state.windowDays + 1 }, (_, i) => angleForOffset(i * 24));
      const rangeWindow = windowForRange(range);

      ctx.save();
      ctx.translate(cx, cy);

      const angleForTime = (date) => {
        const spanMs = windowHours() * HOUR_MS;
        const frac = (date.getTime() - rangeWindow.start.getTime()) / spanMs;
        return -Math.PI / 2 + frac * Math.PI * 2;
      };

      const renderSegments = computeSignSegments(range, rangeWindow.start, rangeWindow.end).map((seg) => {
        const startAngle = angleForTime(seg.start);
        let endAngle = angleForTime(seg.end);
        if (endAngle <= startAngle) endAngle += Math.PI * 2;
        return { ...seg, startAngle, endAngle };
      });

      const mergedSegments = [];
      renderSegments.forEach((seg) => {
        const prev = mergedSegments[mergedSegments.length - 1];
        if (prev && prev.sign === seg.sign && Math.abs(seg.startAngle - prev.endAngle) < 1e-4) {
          prev.endAngle = seg.endAngle;
          prev.end = seg.end;
        } else {
          mergedSegments.push({ ...seg });
        }
      });

      const normalizedOffset = wrapOffset(activeOffset ?? 0, windowHours());
      const activeTime = new Date(rangeWindow.start.getTime() + normalizedOffset * HOUR_MS);
      const highlightStart = angleForOffset(normalizedOffset);
      let highlightEnd = angleForOffset(normalizedOffset + 1);
      if (highlightEnd <= highlightStart) highlightEnd += Math.PI * 2;

      if (ringIdx === 0) {
        ctx.save();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.65;
        boundaries.forEach((ang) => {
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * innerR, Math.sin(ang) * innerR);
          ctx.lineTo(Math.cos(ang) * outerR, Math.sin(ang) * outerR);
          ctx.stroke();
        });
        ctx.restore();
      }

      let currentSignHighlighter = null;
      mergedSegments.forEach((seg) => {
        const sliceStart = seg.startAngle;
        const sliceEnd = seg.endAngle;
        const srcEntry = seg.entry;
        const isActive = activeTime >= seg.start && activeTime < seg.end;

        ctx.beginPath();
        ctx.arc(0, 0, outerR, sliceStart, sliceEnd);
        ctx.arc(0, 0, innerR, sliceEnd, sliceStart, true);
        ctx.closePath();
        ctx.fillStyle = elementFill(srcEntry.element, isDual ? 0.24 : 0.3);
        ctx.strokeStyle = elementStroke(srcEntry.element, 0.5);
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();

        const signMeta = SIGN_META[srcEntry.sign] || {};
        const glyph = signMeta.icon || srcEntry.emoji || "?";
        const decanCenter = sliceStart + (sliceEnd - sliceStart) / 6;
        const labelR = innerR + (outerR - innerR) * 0.45;
        const tx = Math.cos(decanCenter) * labelR;
        const ty = Math.sin(decanCenter) * labelR;
        ctx.fillStyle = "#e8f4ff";
        ctx.font = `${Math.max(12, radius * 0.06)}px "Space Grotesk", "Inter", system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(glyph, tx, ty);

        if (isActive) {
          currentSignHighlighter = {
            startAngle: sliceStart,
            endAngle: sliceEnd,
            color: elementStroke(srcEntry.element, 0.9),
          };
        }
      });

      // day ticks
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      const tickOuter = outerR * 1.02;
      for (let i = 0; i < state.windowDays; i++) {
        const a = angleForOffset(i * 24);
        const r1 = outerR * 0.96;
        const r2 = tickOuter;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        ctx.stroke();

        const labelR = ringIdx === 0 ? outerR * 1.08 : innerR * 0.95;
        const labelDate = new Date(rangeWindow.start.getTime() + i * DAY_MS);
        const labelVal = `${labelDate.getMonth() + 1}/${pad(labelDate.getDate())}`;
        ctx.fillStyle = "#cbd5e1";
        ctx.font = `${Math.max(9, radius * 0.035)}px "Space Grotesk", "Inter", system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labelVal, Math.cos(a) * labelR, Math.sin(a) * labelR);
      }

      if (currentSignHighlighter) {
        const outerHighlightR = outerR * 1.01;
        const innerHighlightR = outerR * 0.99;
        ctx.save();
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(0, 0, outerHighlightR, currentSignHighlighter.startAngle + 0.002, currentSignHighlighter.endAngle - 0.002);
        ctx.strokeStyle = currentSignHighlighter.color;
        ctx.lineWidth = 4.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, innerHighlightR, currentSignHighlighter.startAngle + 0.002, currentSignHighlighter.endAngle - 0.002);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
      return { handColor: currentSignHighlighter?.color || ringConfig.handColor };
    };

    const drawHands = (activeColors) => {
      const { width, height } = canvas;
      const w = width / (window.devicePixelRatio || 1);
      const h = height / (window.devicePixelRatio || 1);
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2;
      ranges.forEach((range, idx) => {
        const handCfg = rings[idx] || rings[0];
        const offset = wrapOffset(state.offsets[idx] ?? state.offsets[0] ?? 0, windowHours());
        const angle = angleForOffset(offset);
        const handR = radius * handCfg.hand;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = activeColors[idx] || handCfg.handColor;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * handR, Math.sin(angle) * handR);
        ctx.stroke();
        ctx.restore();
      });
      renderMoonCenter(
        ranges,
        state.offsets,
        centerEl,
        rings.map((r) => r.handColor),
        true,
        state.windowDays
      );
    };

    const draw = () => {
      const { width, height } = canvas;
      const w = width / (window.devicePixelRatio || 1);
      const h = height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);

      const activeColors = ranges.map((range, idx) => {
        const offset = wrapOffset(state.offsets[idx] ?? state.offsets[0] ?? 0, windowHours());
        const result = drawRing(range, rings[idx] || rings[0], idx, offset);
        return result?.handColor || (rings[idx] || rings[0]).handColor;
      });
      drawHands(activeColors);
    };

    const tick = (ts) => {
      if (!state.playing) return;
      const delta = (ts - state.lastTick) / 1000;
      state.lastTick = ts;
      const windowHrs = windowHours();
      state.offsets = state.offsets.map((h) => wrapOffset(h + delta, windowHrs));
      draw();
      requestAnimationFrame(tick);
    };

    const setOffsetFromClick = (event) => {
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width;
      const x = (event.clientX - rect.left) * scale - canvas.width / 2;
      const y = (event.clientY - rect.top) * scale - canvas.height / 2;
      const angle = Math.atan2(y, x);
      const rawOffset = (angle + Math.PI / 2) / hourStep();
      const snapped = Math.round(rawOffset);
      if (isDual) {
        const r = Math.sqrt(x * x + y * y);
        const radius = Math.min(canvas.width, canvas.height) / 2;
        const radial = r / radius;
        const ringIdx = radial > (rings[0].inner + rings[0].outer) / 2 ? 0 : 1;
        const normalized = wrapOffset(snapped, windowHours());
        state.offsets[ringIdx] = normalized;
      } else {
        const normalized = wrapOffset(snapped, windowHours());
        state.offsets = [normalized];
      }
      state.playing = false;
      if (playBtn) {
        playBtn.setAttribute("aria-pressed", "false");
        playBtn.innerHTML =
          '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14l11-7z" /></svg><span>Play</span>';
      }
      draw();
    };

    const togglePlay = () => {
      if (!ranges.length) {
        state.playing = false;
        return;
      }
      state.playing = !state.playing;
      state.lastTick = performance.now();
      if (playBtn) {
        playBtn.setAttribute("aria-pressed", state.playing ? "true" : "false");
        playBtn.innerHTML = state.playing
          ? '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 6h2v12h-2zM12 12h2v6h-2z"/></svg><span>Pause</span>'
          : '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14l11-7z" /></svg><span>Play</span>';
      }
      if (state.playing) {
        requestAnimationFrame(tick);
      }
    };

    const setWindowDays = (days) => {
      if (days !== 14 && days !== 28) return;
      state.windowDays = days;
      resetOffsets();
      if (range14Btn) range14Btn.setAttribute("aria-pressed", days === 14 ? "true" : "false");
      if (range28Btn) range28Btn.setAttribute("aria-pressed", days === 28 ? "true" : "false");
      resize();
      renderMoonCenter(ranges, state.offsets, centerEl, rings.map((r) => r.handColor), isDual, state.windowDays);
    };

    const onRange14 = () => setWindowDays(14);
    const onRange28 = () => setWindowDays(28);
    if (playBtn) playBtn.addEventListener("click", togglePlay);
    if (range14Btn) range14Btn.addEventListener("click", onRange14);
    if (range28Btn) range28Btn.addEventListener("click", onRange28);
    window.addEventListener("resize", resize);
    canvas.addEventListener("click", setOffsetFromClick);

    if (window.AdvancedApp) {
      window.AdvancedApp._cleanupMoonClock = () => {
        window.removeEventListener("resize", resize);
        if (playBtn) playBtn.removeEventListener("click", togglePlay);
        canvas.removeEventListener("click", setOffsetFromClick);
        if (range14Btn) range14Btn.removeEventListener("click", onRange14);
        if (range28Btn) range28Btn.removeEventListener("click", onRange28);
      };
    }

    resetOffsets();
    resize();
    renderMoonCenter(ranges, state.offsets, centerEl, rings.map((r) => r.handColor), isDual, state.windowDays);
    draw();
  }

  function buildMoonTables(ranges) {
    if (!ranges.length) return "";
    const formatDateTime = (ts) => {
      if (!(ts instanceof Date) || !Number.isFinite(ts.getTime())) return "—";
      return ts.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    };
    const renderRow = (entry) => {
      const start = entry.start || entry.timestamp;
      const end = entry.end;
      const signMeta = SIGN_META[entry.sign] || { name: entry.sign || "—", icon: entry.emoji || "☾" };
      const qualityIcon = QUALITY_ICON[entry.quality] || "";
      const elementIcon = ELEMENT_ICON[entry.element] || "";
      const swatchColor = elementFill(entry.element, 1).replace("rgba(", "rgb(").replace(/,\s*1\)$/, ")");
      const durationHours =
        start instanceof Date && end instanceof Date
          ? (end.getTime() - start.getTime()) / HOUR_MS
          : null;
      const durationLabel =
        durationHours !== null ? `${(durationHours / 24).toFixed(2)}d (${durationHours.toFixed(1)}h)` : "—";
      const phase =
        start instanceof Date
          ? getLunationInfo({
              year: start.getFullYear(),
              month: start.getMonth() + 1,
              day: start.getDate(),
              hour: start.getHours(),
              minute: start.getMinutes(),
            })
          : null;
      const illum = phase ? Math.round((phase.illumination ?? phase.fraction) * 100) : null;
      const phaseLabel = phase ? `${phase.icon || ""} ${phase.name}` : "—";
      return `
        <tr>
          <td>${formatDateTime(start)}</td>
          <td>${formatDateTime(end)}</td>
          <td>${signMeta.icon || ""} ${signMeta.name}</td>
          <td>${durationLabel}</td>
          <td>${illum !== null ? `${illum}%` : "—"}</td>
          <td>${phaseLabel}</td>
          <td>${qualityIcon ? `${qualityIcon} ` : ""}${entry.quality || "—"}</td>
          <td><span class="adv-asc-color-swatch" style="background:${swatchColor}"></span>${elementIcon ? `${elementIcon} ` : ""}${entry.element || "—"}</td>
        </tr>
      `;
    };

    const tables = ranges.map((range, idx) => {
      const handColor = idx === 0 ? PRIMARY_HAND_COLOR : SECONDARY_HAND_COLOR;
      const rows = (range.entries || []).map(renderRow).join("");
      return `
        <table class="adv-moon-table">
          <caption style="color:${handColor}">${range.label || range.id}</caption>
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Sign</th>
              <th>Duration</th>
              <th>Illum.</th>
              <th>Phase</th>
              <th>Quality</th>
              <th>Element</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="8">No data</td></tr>'}</tbody>
        </table>
      `;
    });

    return `<div class="adv-asc-table-grid adv-moon-table-grid">${tables.join("")}</div>`;
  }

  const getDefaultRange = () => {
    const start = new Date();
    const end = new Date(start.getTime() + 6 * 60 * 60 * 1000);
    return { start: toDatetimeLocal(start), end: toDatetimeLocal(end) };
  };

  function loadRange() {
    try {
      const raw = localStorage.getItem(STORAGE_RANGE);
      if (!raw) return getDefaultRange();
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...getDefaultRange(), ...parsed };
      }
    } catch (err) {
    }
    return getDefaultRange();
  }

  function saveRange(range) {
    try {
      localStorage.setItem(STORAGE_RANGE, JSON.stringify(range));
    } catch (err) {
    }
  }

  function formatRangeSummary(range) {
    if (!dom.rangeSummary) return;
    const start = range.start || "";
    const end = range.end || "";
    if (!start && !end) {
      dom.rangeSummary.textContent = "Set start and end to see duration.";
      return;
    }
    const parseDate = (value) => {
      if (!value) return null;
      const d = new Date(value);
      return Number.isFinite(d.getTime()) ? d : null;
    };
    const startDate = parseDate(start);
    const endDate = parseDate(end);
    if (startDate && endDate && endDate > startDate) {
      const diffMs = endDate.getTime() - startDate.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      dom.rangeSummary.textContent = `${start.replace("T", " ")} → ${end.replace("T", " ")} (${hours}h ${minutes}m)`;
    } else if (startDate || endDate) {
      dom.rangeSummary.textContent = startDate ? `Starting ${start.replace("T", " ")}` : `Ending ${end.replace("T", " ")}`;
    } else {
      dom.rangeSummary.textContent = "Set start and end to see duration.";
    }
  }

  function applyRange(range) {
    if (dom.rangeStart) dom.rangeStart.value = range.start || "";
    if (dom.rangeEnd) dom.rangeEnd.value = range.end || "";
    formatRangeSummary(range);
  }

  function handleRangeChange() {
    const range = {
      start: dom.rangeStart ? dom.rangeStart.value : "",
      end: dom.rangeEnd ? dom.rangeEnd.value : "",
    };
    saveRange(range);
    formatRangeSummary(range);
  }

  function formatPointRow(point, { labelOverride } = {}) {
    if (!point) return "";
    const pointIcon = point.point_type === "House"
      ? wrapPointIcon(formatHouseLabelShort(point.name) || "🏠")
      : wrapPointIcon(POINTS_ICONS[(point.name || "").toLowerCase()] || "✶");
    const signMeta = SIGN_META[point.sign] || { name: point.sign || "—", icon: point.emoji || "?" };
    const element = point.element || "";
    const quality = point.quality || "";
    const elementIcon = ELEMENT_ICON[element] || "";
    const qualityIcon = QUALITY_ICON[quality] || "";
    const houseLabel = point.house ? formatHouseLabel(point.house) : "";
    const pos = Number.isFinite(point.position) ? `${point.position.toFixed(2)}°` : "—";
    const signNum = Number.isFinite(point.sign_num) ? emojiNumber(point.sign_num) : "";
    const retro = point.retrograde ? " · Rx" : "";
    const name = capitalise(labelOverride || point.name || "Point");
    return `
      <div class="adv-row">
        <div class="adv-row-main">
          <span class="adv-chip">${pointIcon}</span>
          <span class="adv-label"><strong>${name}</strong> — ${signMeta.name} ${signMeta.icon || ""} — 
          <span>
          <span>${pos} </span>
          ${houseLabel ? `<span>— ${houseLabel} </span>` : ""}
          ${element ? `<span>— ${elementIcon} ${element}</span>` : ""}
          ${quality ? `<span>— ${qualityIcon} ${quality}</span>` : ""}
          ${retro ? `<span>— ${retro}</span>` : ""}
          </span>
          </span>
        </div>
        
      </div>
    `;
  }

  function collectPoints(obj) {
    return Object.entries(obj || {}).reduce(
      (acc, [key, val]) => {
        if (val && typeof val === "object" && val.point_type === "AstrologicalPoint") {
          acc.points[key] = val;
        } else if (val && typeof val === "object" && val.point_type === "House") {
          acc.houses[key] = val;
        }
        return acc;
      },
      { points: {}, houses: {} }
    );
  }

  function normalizeAspectRows(aspectList, points) {
    const rows = [];
    const list = Array.isArray(aspectList)
      ? aspectList
      : aspectList && typeof aspectList === "object"
        ? Object.values(aspectList)
        : [];
    list.forEach((a) => {
      const baseKey = normalizePointKey(
        a.base_key || a.baseKey || a.left || a.first_point || a.first || a.point1 || a.planet1 || a.p1_name || a.p1
      );
      const otherKey = normalizePointKey(
        a.other_key || a.otherKey || a.right || a.second_point || a.second || a.point2 || a.planet2 || a.p2_name || a.p2
      );
      const type = (a.aspect_type || a.aspect || a.type || a.name || "").toLowerCase();
      if (!baseKey || !otherKey || !type) return;
      rows.push({
        baseKey,
        otherKey,
        aspect: {
          name: type,
          icon: ASPECT_ICON_MAP[type] || "✶",
          orb: typeof a.orb_value === "number" ? a.orb_value : Number.parseFloat(a.orb) || null,
        },
        base: points?.[baseKey],
        other: points?.[otherKey],
      });
    });
    return rows;
  }

  function extractMajorAspects(payload) {
    if (!payload) return [];
    if (Array.isArray(payload.major_aspects)) return payload.major_aspects;
    if (Array.isArray(payload.snapshot?.major_aspects)) return payload.snapshot.major_aspects;
    if (Array.isArray(payload.subject?.major_aspects)) return payload.subject.major_aspects;
    return [];
  }

  function extractNatalMajorAspects(payload) {
    if (!payload) return [];
    if (Array.isArray(payload.natal_major_aspects)) return payload.natal_major_aspects;
    if (Array.isArray(payload.snapshot?.natal_major_aspects)) return payload.snapshot.natal_major_aspects;
    return [];
  }

  function renderAspectMatrix(points, keys, aspects) {
    if (!keys.length || !aspects.length) return "";
    const norm = (a, b) => (a < b ? `${a}__${b}` : `${b}__${a}`);
    const aspectMap = new Map();
    aspects.forEach(({ baseKey, otherKey, aspect }) => {
      aspectMap.set(norm(baseKey, otherKey), {
        icon: aspect.icon || "✶",
        name: aspect.name || "",
        orb: aspect.orb,
      });
    });
    const iconFor = (key) => {
      const pt = points[key] || {};
      return wrapPointIcon(POINTS_ICONS[(pt.name || "").toLowerCase()] || "✶");
    };
    const rows = keys
      .map((rowKey, rowIdx) => {
        const rowPt = points[rowKey] || {};
        const cells = keys
          .map((colKey, colIdx) => {
            if (colIdx === rowIdx) {
              return `<td class="adv-matrix-cell adv-matrix-diag" title="${rowPt.name || rowKey}">${iconFor(rowKey)}</td>`;
            }
            const pair = norm(rowKey, colKey);
            const hit = aspectMap.get(pair);
            if (!hit) return '<td class="adv-matrix-empty"></td>';
            const note = hit.name ? ` — ${capitalise(hit.name)}` : "";
            const colName = points[colKey]?.name || colKey;
            if (colIdx < rowIdx) {
              const icon = wrapMajorAspectIcon(hit.icon || "✶");
              return `<td class="adv-matrix-cell" title="${rowPt.name || rowKey} × ${colName}${note}">${icon}</td>`;
            }
            const orbLabel = Number.isFinite(hit.orb) ? hit.orb.toFixed(2) : "";
            return `<td class="adv-matrix-cell adv-matrix-orb" title="${rowPt.name || rowKey} × ${colName}${note}">${orbLabel}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    return `
      <div class="adv-matrix-wrap">
        <table class="adv-aspect-matrix">
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  let advTableId = 0;
  function renderSortableTable(headers, rows) {
    if (!rows.length) return "";
    const tableId = `adv-table-${++advTableId}`;
    const head = headers
      .map(
        (h) => `<th scope="col" data-sort="${h.key}" aria-label="Sort by ${h.label}">${h.label}</th>`
      )
      .join("");
    const body = rows
      .map(
        (row) => `<tr ${Object.entries(row.sortAttrs || {})
          .map(([k, v]) => `data-${k}="${v}"`)
          .join(" ")}>
          ${row.cells.join("")}
        </tr>`
      )
      .join("");
    return `
      <table class="adv-table adv-sortable" data-table-id="${tableId}">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    `;
  }

  function enableSortableTables(root) {
    const tables = root.querySelectorAll(".adv-sortable");
    tables.forEach((table) => {
      const headers = table.querySelectorAll("th[data-sort]");
      headers.forEach((th) => {
        th.addEventListener("click", () => {
          const key = th.getAttribute("data-sort");
          const tbody = table.querySelector("tbody");
          if (!tbody) return;
          const rows = Array.from(tbody.querySelectorAll("tr"));
          const currentDir = th.getAttribute("data-dir") === "asc" ? "desc" : "asc";
          headers.forEach((hdr) => hdr.removeAttribute("data-dir"));
          th.setAttribute("data-dir", currentDir);
          rows.sort((a, b) => {
            const av = a.getAttribute(`data-sort-${key}`) || "";
            const bv = b.getAttribute(`data-sort-${key}`) || "";
            const na = parseFloat(av);
            const nb = parseFloat(bv);
            const isNum = Number.isFinite(na) && Number.isFinite(nb);
            const res = isNum ? na - nb : av.localeCompare(bv);
            return currentDir === "asc" ? res : -res;
          });
          tbody.innerHTML = "";
          rows.forEach((r) => tbody.appendChild(r));
        });
      });
    });
  }

  function formatPointInline(points, key) {
    if (!key) return "";
    const pt = points[key] || {};
    const label = pt.name || capitalise(key.replace(/_/g, " "));
    const signShortName = pt.sign || "";
    const signIcon = (SIGN_META[pt.sign]?.icon || signShortName).trim();
    const pos = Number.isFinite(pt.position) ? `${pt.position.toFixed(2)}°` : "";
    const icon = wrapPointIcon(POINTS_ICONS[(pt.name || key || "").toLowerCase()] || "✶");
    return `${icon} ${label}${signIcon ? ` ${signIcon}` : ""}${pos ? ` @ ${pos}` : ""}`;
  }

  function formatPointInlineShort(points, key) {
    if (!key) return "";
    const pt = points[key] || {};
    const icon = wrapPointIcon(POINTS_ICONS[(pt.name || key || "").toLowerCase()] || "✶");
    return `${icon}`;
  }

  function formatPointGroup(list, points) {
    return (list || []).map((key) => formatPointInline(points, key)).filter(Boolean).join(" · ");
  }

  function formatLinkLine(link, points) {
    if (!link || !Array.isArray(link.pair)) return "";
    const [leftKey, rightKey] = link.pair;
    const aspectIcon = ASPECT_ICON_MAP[link.type] || link.icon || "✶";
    const orbLabel = Number.isFinite(link.orb) ? `${link.orb.toFixed(2)}°` : "";
    const left = formatPointInlineShort(points, leftKey);
    const right = formatPointInlineShort(points, rightKey);
    const icon = wrapMajorAspectIcon(aspectIcon);
    return `${left} ${icon} ${right}${orbLabel ? ` (orb ${orbLabel})` : ""}`;
  }

  const PATTERN_RENDERERS = {
    stellium: (pattern, points) => {
      const cluster = pattern.structure?.cluster || pattern.points || [];
      const text = formatPointGroup(cluster, points);
      return text ? [`<li><strong>Cluster</strong>: ${text}</li>`] : [];
    },
    t_square: (pattern, points) => {
      const focal = pattern.structure?.focal;
      const others = (pattern.points || []).filter((k) => k !== focal);
      const lines = [];
      if (focal) lines.push(`<li><strong>Focal</strong>: ${formatPointInline(points, focal)}</li>`);
      if (others.length) lines.push(`<li><strong>Opposition base</strong>: ${formatPointGroup(others, points)}</li>`);
      return lines;
    },
    grand_trine: (pattern, points) => {
      const triple = pattern.structure?.triple || pattern.points || [];
      const text = formatPointGroup(triple, points);
      return text ? [`<li><strong>Triangle</strong>: ${text}</li>`] : [];
    },
    kite: (pattern, points) => {
      const triangle = pattern.structure?.triangle || [];
      const opposition = pattern.structure?.opposition || [];
      const lines = [];
      const triText = formatPointGroup(triangle, points);
      if (triText) lines.push(`<li><strong>Grand Trine</strong>: ${triText}</li>`);
      const oppText = formatPointGroup(opposition, points);
      if (oppText) lines.push(`<li><strong>Spine</strong>: ${oppText}</li>`);
      return lines;
    },
    grand_cross: (pattern, points) => {
      const axes = pattern.structure?.axes || [];
      const lines = axes
        .map((pair, idx) => `<li><strong>Axis ${idx + 1}</strong>: ${formatPointGroup(pair, points)}</li>`)
        .filter(Boolean);
      const pointsLine = formatPointGroup(pattern.points || [], points);
      if (!lines.length && pointsLine) lines.push(`<li><strong>Points</strong>: ${pointsLine}</li>`);
      return lines;
    },
    grand_sextile: (pattern, points) => {
      const triples = pattern.structure?.triples || [];
      const lines = triples
        .map((triple, idx) => `<li><strong>Triangle ${idx + 1}</strong>: ${formatPointGroup(triple, points)}</li>`)
        .filter(Boolean);
      if (!lines.length) {
        const pts = formatPointGroup(pattern.points || [], points);
        if (pts) lines.push(`<li><strong>Points</strong>: ${pts}</li>`);
      }
      return lines;
    },
    mystic_rectangle: (pattern, points) => {
      const oppositions = pattern.structure?.oppositions || [];
      const lines = oppositions
        .map((pair, idx) => `<li><strong>Opposition ${idx + 1}</strong>: ${formatPointGroup(pair, points)}</li>`)
        .filter(Boolean);
      const pts = formatPointGroup(pattern.points || [], points);
      if (!lines.length && pts) lines.push(`<li><strong>Points</strong>: ${pts}</li>`);
      return lines;
    },
    trapeze: (pattern, points) => {
      const chain = pattern.structure?.chain || pattern.points || [];
      const text = formatPointGroup(chain, points);
      return text ? [`<li><strong>Chain</strong>: ${text}</li>`] : [];
    },
    default: (pattern, points) => {
      const text = formatPointGroup(pattern.points || [], points);
      return text ? [`<li><strong>Points</strong>: ${text}</li>`] : [];
    },
  };

  function renderPatternLinks(pattern, points) {
    const links = Array.isArray(pattern.links) ? pattern.links : [];
    const linksLine = links
      .map((link) => formatLinkLine(link, points))
      .filter(Boolean)
      .join(" — ");
    return `<li><strong>Links</strong>: ${linksLine}</li>`;
  }

  function renderPatternCard(pattern, points) {
    const icon = fallbackIcon(pattern.id);
    const aspectsLabel = pattern.aspects_label || pattern.aspectsLabel || (pattern.aspects || []).map(capitalise).join(", ");
    const detailRenderer = PATTERN_RENDERERS[pattern.id] || PATTERN_RENDERERS.default;
    const detailLines = detailRenderer(pattern, points || {});
    const linkLines = renderPatternLinks(pattern, points || {});
    const lines = [...detailLines, ...linkLines];
    const list =
      lines.length > 0
        ? `<ul class="adv-pattern-hit-list">${lines.join("")}</ul>`
        : `<p class="adv-pattern-none">No structural links found for this pattern.</p>`;
    const geometry = pattern.geometry ? `<p class="adv-pattern-sub">${pattern.geometry}</p>` : "";
    return `
      <article class="adv-pattern-card">
        <div class="adv-pattern-title-row">
          <div class="adv-pattern-icon" aria-hidden="true">${icon}</div>
          <div class="adv-pattern-title-stack">
            <h4>${pattern.name || capitalise(pattern.id || "Pattern")}</h4>
            <p class="adv-pattern-subtitle">${aspectsLabel}</p>
            ${geometry}
          </div>
          <span class="adv-pattern-pill">${pattern.planets || ""}</span>
        </div>
        <div class="adv-pattern-aspects">${list}</div>
      </article>
    `;
  }

  function renderPatternGroupCard(patterns, points) {
    if (!patterns || !patterns.length) return "";
    const primary = patterns[0];
    const icon = fallbackIcon(primary.id);
    const aspectsLabel =
      primary.aspects_label || primary.aspectsLabel || (primary.aspects || []).map(capitalise).join(", ");
    const geometry = primary.geometry ? `<p class="adv-pattern-sub">${primary.geometry}</p>` : "";
    const body = patterns
      .map((pattern, idx) => {
        const detailRenderer = PATTERN_RENDERERS[pattern.id] || PATTERN_RENDERERS.default;
        const detailLines = detailRenderer(pattern, points || {});
        const linkLines = renderPatternLinks(pattern, points || {});
        const lines = [...detailLines, ...linkLines];
        const list =
          lines.length > 0
            ? `<ul class="adv-pattern-hit-list">${lines.join("")}</ul>`
            : `<p class="adv-pattern-none">No structural links found for this pattern.</p>`;
        return `<div class="adv-pattern-instance-block">${list}</div>`;
      })
      .join("");
    return `
      <article class="adv-pattern-card">
        <div class="adv-pattern-title-row">
          <div class="adv-pattern-icon" aria-hidden="true">${icon}</div>
          <div class="adv-pattern-title-stack">
            <h4>${primary.name || capitalise(primary.id || "Pattern")}</h4>
            <p class="adv-pattern-subtitle">${aspectsLabel}</p>
            ${geometry}
          </div>
          <span class="adv-pattern-pill">${primary.planets || ""}</span>
        </div>
        <div class="adv-pattern-aspects">
          ${body}
        </div>
      </article>
    `;
  }

  function renderMajorAspectsList(patterns, points, title, subtitle, includeModal = true) {
    if (!Array.isArray(patterns) || patterns.length === 0) return "";
    const headerTitle = title || "Major Ptolemaic Aspect Configurations";
    const headerSubtitle = subtitle || "Geometric patterns detected in the response payload.";
    const modal = includeModal ? renderPatternModal(MAJOR_ASPECT_PATTERNS) : "";
    const infoBtn = includeModal
      ? `<button type="button" class="adv-pattern-info-btn" data-target="#advPatternModal" aria-label="Show pattern descriptions">i</button>`
      : "";

    // Group by pattern type and sort groups by max unique point count (desc).
    const grouped = patterns.reduce((acc, p) => {
      const key = p.id || p.name || "pattern";
      acc[key] = acc[key] || [];
      acc[key].push(p);
      return acc;
    }, {});
    const sortedGroups = Object.values(grouped).sort((a, b) => {
      const maxA = Math.max(...a.map((p) => (p.points || []).length || 0), 0);
      const maxB = Math.max(...b.map((p) => (p.points || []).length || 0), 0);
      return maxB - maxA;
    });

    const cards = sortedGroups
      .map((group) => {
        const label = group[0]?.name || capitalise((group[0]?.id || "Pattern").replace(/_/g, " "));
        return `<div class="adv-pattern-type"><h4>${label}</h4>${renderPatternGroupCard(group, points || {})}</div>`;
      })
      .join("");

    return `
      <div class="adv-patterns">
        <div class="adv-patterns-head">
          <div>
            <p class="adv-patterns-kicker">${headerTitle}</p>
            <h3>${headerSubtitle}</h3>
            <p class="adv-patterns-sub">Shapes derived from the returned major aspect payload.</p>
          </div>
          ${infoBtn}
        </div>
        <div class="adv-pattern-list">${cards}</div>
      </div>
      ${modal}
    `;
  }

  function renderPatternModal(patterns) {
    const items = (patterns || [])
      .map(
        (p) => `
      <article class="adv-pattern-modal-card">
        <div class="adv-pattern-icon" aria-hidden="true">${fallbackIcon(p.id)}</div>
        <div class="adv-pattern-modal-title">
          <h4>${p.name}</h4>
          <span class="adv-pattern-pill">${p.planets}</span>
        </div>
        <p class="adv-pattern-overlay-geometry">${p.geometry}</p>
        <dl class="adv-pattern-meta">
          <div>
            <dt>Orb guide</dt>
            <dd>${p.orb}</dd>
          </div>
          <div>
            <dt>Construction</dt>
            <dd>${p.construction}</dd>
          </div>
        </dl>
      </article>
    `
      )
      .join("");
    return `
      <div class="adv-pattern-modal hidden" id="advPatternModal" role="dialog" aria-modal="true" aria-label="Major aspects descriptions">
        <div class="adv-pattern-modal-backdrop" data-close-modal></div>
        <div class="adv-pattern-modal-content">
          <div class="adv-pattern-modal-header">
            <div>
              <p class="adv-patterns-kicker">Pattern guide</p>
              <h3>Major aspect configurations</h3>
            </div>
            <button type="button" class="adv-pattern-close-btn" data-close-modal aria-label="Close pattern descriptions">✕</button>
          </div>
          <div class="adv-pattern-modal-body">
            ${items}
          </div>
        </div>
      </div>
    `;
  }

  function attachPatternModalHandlers() {
    const modal = document.querySelector("#advPatternModal");
    const openBtn = document.querySelector(".adv-pattern-info-btn");
    if (!modal || !openBtn) return;
    const backdrop = modal.querySelector(".adv-pattern-modal-backdrop");
    const closeBtns = modal.querySelectorAll("[data-close-modal]");
    const open = () => modal.classList.remove("hidden");
    const close = () => modal.classList.add("hidden");
    openBtn.addEventListener("click", open);
    closeBtns.forEach((btn) => btn.addEventListener("click", close));
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
    if (backdrop) backdrop.addEventListener("click", close);
  }

  function renderAspectRow(entry) {
    const { baseKey, otherKey, aspect, base, other } = entry;
    const baseSign = SIGN_META[base.sign] || { name: base.sign || "", icon: base.emoji || "" };
    const otherSign = SIGN_META[other.sign] || { name: other.sign || "", icon: other.emoji || "" };
    const basePos = Number.isFinite(base.position) ? `${base.position.toFixed(2)}°` : "—";
    const otherPos = Number.isFinite(other.position) ? `${other.position.toFixed(2)}°` : "—";
    const orbLabel = Number.isFinite(aspect.orb) ? `${aspect.orb.toFixed(2)}°` : "—";
    const aspectName = capitalise(aspect.name || "Aspect");
    const aspectIcon = wrapMajorAspectIcon(aspect.icon || "✶");
    const aspectAngle = Number.isFinite(aspect.angle) ? `${aspect.angle}°` : "";
    const baseIcon = wrapPointIcon(POINTS_ICONS[(base.name || "").toLowerCase()] || "✶");
    const otherIcon = wrapPointIcon(POINTS_ICONS[(other.name || "").toLowerCase()] || "✶");
    return `
      <div class="adv-row adv-row-aspect">
        <div class="adv-aspect-grid">
          <div class="adv-aspect-cell">
            <span class="adv-chip">${baseIcon}</span>
            <div class="adv-aspect-text">
              <strong>${base.name || baseKey}</strong>
              <span class="adv-aspect-note">${baseSign.icon || ""} ${baseSign.name} ${basePos}</span>
            </div>
          </div>
          <div class="adv-aspect-cell">
            <span class="adv-chip">${aspectIcon}</span>
            <div class="adv-aspect-text">
              <strong>${aspectName}</strong>
              ${aspectAngle ? `<span class="adv-aspect-note">@ ${aspectAngle}</span>` : ""}
            </div>
          </div>
          <div class="adv-aspect-cell">
            <span class="adv-chip">${otherIcon}</span>
            <div class="adv-aspect-text">
              <strong>${other.name || otherKey}</strong>
              <span class="adv-aspect-note">${otherSign.icon || ""} ${otherSign.name} ${otherPos}</span>
            </div>
          </div>
          <div class="adv-aspect-cell adv-aspect-orb">
            <span class="adv-chip">Orb</span>
            <div class="adv-aspect-text">
              <strong>${orbLabel}</strong>
              <span class="adv-aspect-note">${aspectIcon} ${aspectName}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAspectTable(aspects) {
    if (!aspects.length) return "";
    const headers = [
      { key: "base", label: "Base" },
      { key: "aspect", label: "Aspect" },
      { key: "other", label: "Other" },
      { key: "orb", label: "Orb" },
    ];
    const rows = aspects.map((row) => {
      const baseSign = SIGN_META[row.base?.sign] || { name: row.base?.sign || "", icon: row.base?.emoji || "" };
      const otherSign = SIGN_META[row.other?.sign] || { name: row.other?.sign || "", icon: row.other?.emoji || "" };
      const orbVal = Number.isFinite(row.aspect?.orb) ? row.aspect.orb.toFixed(2) : "";
      return {
        sortAttrs: {
          "sort-base": row.base?.name || row.baseKey || "",
          "sort-aspect": row.aspect?.name || "",
          "sort-other": row.other?.name || row.otherKey || "",
          "sort-orb": orbVal || "",
        },
        cells: [
          `<td>${wrapPointIcon(POINTS_ICONS[(row.base?.name || row.baseKey || "").toLowerCase()] || "✶")} ${row.base?.name || row.baseKey}</td>`,
          `<td>${wrapMajorAspectIcon(row.aspect?.icon || "✶")} ${capitalise(row.aspect?.name || "")}</td>`,
          `<td>${wrapPointIcon(POINTS_ICONS[(row.other?.name || row.otherKey || "").toLowerCase()] || "✶")} ${row.other?.name || row.otherKey}</td>`,
          `<td>${orbVal ? `${orbVal}°` : "—"}</td>`,
        ],
      };
    });
    return renderSortableTable(headers, rows);
  }

  function renderPointsTable(keys, points) {
    if (!keys.length) return "";
    const headers = [
      { key: "point", label: "Point" },
      { key: "sign", label: "Sign" },
      { key: "pos", label: "Position" },
      { key: "house", label: "House" },
      { key: "element", label: "Element" },
      { key: "quality", label: "Quality" },
      { key: "retro", label: "Retrograde" },
    ];
    const rows = keys.map((k) => {
      const pt = points[k] || {};
      const signMeta = SIGN_META[pt.sign] || { name: pt.sign || "", icon: pt.emoji || "" };
      const pos = Number.isFinite(pt.position) ? pt.position.toFixed(2) : "";
      const retro = pt.retrograde ? "Yes" : "No";
      return {
        sortAttrs: {
          "sort-point": pt.name || k,
          "sort-sign": signMeta.name,
          "sort-pos": pos,
          "sort-house": pt.house || "",
          "sort-element": pt.element || "",
          "sort-quality": pt.quality || "",
          "sort-retro": retro,
        },
        cells: [
          `<td>${wrapPointIcon(POINTS_ICONS[(pt.name || k || "").toLowerCase()] || "✶")} ${pt.name || k}</td>`,
          `<td>${signMeta.icon || ""} ${signMeta.name}</td>`,
          `<td>${pos ? `${pos}°` : "—"}</td>`,
          `<td>${pt.house || "—"}</td>`,
          `<td>${ELEMENT_ICON[pt.element] || ""} ${pt.element || "—"}</td>`,
          `<td>${QUALITY_ICON[pt.quality] || ""} ${pt.quality || "—"}</td>`,
          `<td>${retro}</td>`,
        ],
      };
    });
    return renderSortableTable(headers, rows);
  }

  function renderSection(title, inner, open = true) {
    return `
      <details class="adv-accordion"${open ? " open" : ""}>
        <summary>${title}</summary>
        <div class="adv-accordion-body">${inner}</div>
      </details>
    `;
  }

  function renderMetaHeader(data) {
    if (!dom.summaryEl) return;
    const title = data.title || data.name || "Chart";
    const city = data.city ? `${data.city}${data.nation ? `, ${data.nation}` : ""}` : "";
    const dateInfo = formatDateLabel(data);
    const tz = dateInfo.tzShort || "";
    return `
      <div class="adv-meta">
        <div>
          <p class="adv-meta-title">${title}</p>
          <p class="adv-meta-sub">${city || "Unknown location"}</p>
        </div>
        <div class="adv-meta-time">
          <p>${dateInfo.weekday || ""}</p>
          <p>${dateInfo.label || ""} ${tz ? `(${tz})` : ""}</p>
        </div>
      </div>
    `;
  }

  function renderPointRowProxy(point, opts) {
    return formatPointRow(point, opts);
  }

  function renderStructured(kind, payload) {
    if (!dom.summaryEl) return;
    const source = payload?.snapshot || payload?.subject || payload?.data || payload;
    const chart = source?.subject || source;
    if (!source || typeof source !== "object") {
      dom.summaryEl.innerHTML = "<p class=\"hint\">No data returned.</p>";
      console.warn("[advanced] renderStructured payload missing", { kind, payload });
      return;
    }

    const { points, houses } = collectPoints(chart);
    const natalSource = payload?.natal_subject || payload?.snapshot?.natal_subject;
    const natalCollected = natalSource ? collectPoints(natalSource) : { points: {}, houses: {} };
    const natalPoints = natalCollected.points || {};
    const ns = "AdvancedApp";
    const cfg =
      (window[ns]?.config?.getConfigFromInputs?.() || window[ns]?.constants?.DEFAULT_CONFIG) || {};
    const sourceActive = Array.isArray(chart.active_points) ? chart.active_points : [];
    const activePoints = (Array.isArray(cfg.active_points) ? cfg.active_points : sourceActive).filter(Boolean);
    const filteredPointKeys = resolveActivePointKeys(points, activePoints);

    const pointRows = filteredPointKeys
      .map((k) => renderPointRowProxy(points[k], { labelOverride: points[k]?.name || k }))
      .join("");
    const houseRows = Object.entries(houses)
      .map(([k, v]) => renderPointRowProxy(v, { labelOverride: formatHouseLabel(v.house || k) }))
      .join("");
    let aspects = computeAspectsShared(points, filteredPointKeys);
    if (!aspects.length) {
      const payloadAspects = chart.aspects || source.aspects || payload?.aspects || [];
      aspects = normalizeAspectRows(payloadAspects, points);
    }
    const aspectKeySet = aspects.reduce((set, a) => {
      set.add(a.baseKey);
      set.add(a.otherKey);
      return set;
    }, new Set());
    const matrixKeys = filteredPointKeys.filter((k) => aspectKeySet.has(k));
    const aspectRows = aspects.map(renderAspectRow).join("");
    const aspectMatrix = renderAspectMatrix(points, matrixKeys, aspects);
    const aspectTable = renderAspectTable(aspects);
    const majorAspects = extractMajorAspects(payload);
    const natalMajorAspects = extractNatalMajorAspects(payload);
    const majorBlocks = [];
    if (majorAspects.length) {
      majorBlocks.push(
        renderMajorAspectsList(
          majorAspects,
          points,
          "Major Ptolemaic Aspect Configurations",
          "Geometric patterns detected for this chart.",
          true
        )
      );
    }
    if (natalMajorAspects.length) {
      majorBlocks.push(
        renderMajorAspectsList(
          natalMajorAspects,
          natalPoints,
          "Natal major aspect configurations",
          "Patterns detected from the provided natal chart.",
          majorBlocks.length === 0
        )
      );
    }
    const majorAspectsList = majorBlocks.join("");
    const metaSource =
      chart.birth ||
      chart.moment ||
      source.birth ||
      source.moment ||
      source.first ||
      payload?.birth ||
      payload?.moment ||
      chart;
    const ascendantRanges = normalizeAscendantRanges(payload);
    const moonRanges = normalizeMoonRanges(payload);
    const priority = ["transit", "second", "first", "natal"];
    if (ascendantRanges.length > 1) {
      ascendantRanges.sort((a, b) => {
        const ai = priority.indexOf((a.id || "").toLowerCase());
        const bi = priority.indexOf((b.id || "").toLowerCase());
        const aval = ai === -1 ? 99 : ai;
        const bval = bi === -1 ? 99 : bi;
        return aval - bval;
      });
    }
    if (moonRanges.length > 1) {
      moonRanges.sort((a, b) => {
        const ai = priority.indexOf((a.id || "").toLowerCase());
        const bi = priority.indexOf((b.id || "").toLowerCase());
        const aval = ai === -1 ? 99 : ai;
        const bval = bi === -1 ? 99 : bi;
        return aval - bval;
      });
    }
    const clockBlock = buildAscendantClockBlock(ascendantRanges, metaSource);
    const moonClockBlock = buildMoonClockBlock(moonRanges, metaSource);
    const aspectContent =
      aspectMatrix +
      majorAspectsList +
      (aspectTable || aspectRows || "<p class=\"hint\">No aspects found for active points.</p>");

    const meta = renderMetaHeader(metaSource);
    const pointsTable = renderPointsTable(filteredPointKeys, points);
    const sections = [
      renderSection("Aspects", aspectContent, true),
      renderSection("Points", pointsTable || pointRows || "<p class=\"hint\">No points returned.</p>", false),
      renderSection("Houses", houseRows || "<p class=\"hint\">No houses returned.</p>", false),
    ].join("");

    dom.summaryEl.innerHTML = `${meta}${sections}`;
    enableSortableTables(dom.summaryEl);
    const hasDual = ascendantRanges.length > 1 || moonRanges.length > 1;
    if (dom.ascSummaryContainer) {
      if (!ascendantRanges.length && !moonRanges.length) {
        dom.ascSummaryContainer.innerHTML = "<p class=\"hint\">Generate a chart to see the summary.</p>";
      } else {
        const summaries = renderSummaryPanel(points, ascendantRanges, moonRanges, metaSource, formatTimeSimple, hasDual);
        dom.ascSummaryContainer.innerHTML = summaries || "<p class=\"hint\">No summary available.</p>";
      }
    }

    if (dom.ascClockContainer) {
      if (!ascendantRanges.length) {
        dom.ascClockContainer.innerHTML = "<p class=\"hint\">Generate a chart to see the ascendant clock and hourly breakdown.</p>";
      } else {
        const tables = buildAscendantTables(ascendantRanges);
        dom.ascClockContainer.innerHTML = `${clockBlock.html}${tables}`;
        initAscendantClock(ascendantRanges, clockBlock.ids);
      }
    }

    if (dom.moonClockContainer) {
      if (!moonRanges.length) {
        dom.moonClockContainer.innerHTML = "<p class=\"hint\">Generate a chart to see the lunar clock and sign breakdown.</p>";
      } else {
        const tables = buildMoonTables(moonRanges);
        dom.moonClockContainer.innerHTML = `${moonClockBlock.html}${tables}`;
        initMoonClock(moonRanges, moonClockBlock.ids);
      }
    }
    attachPatternModalHandlers();
  }

  function registerHandleSubmit() {
    const appCtx = (window.AdvancedApp = window.AdvancedApp || {});
    appCtx.handleSubmit = async function handleSubmit(event) {
      event.preventDefault();
      const { dom: advDom, utils: advUtils, payloads: advPayloads, state: advState } = window.AdvancedApp || {};
      if (!advDom || !advUtils || !advPayloads || !advState) {
        console.warn("[advanced] missing app pieces for submit", { hasDom: !!advDom, hasUtils: !!advUtils, hasPayloads: !!advPayloads, hasState: !!advState });
        return;
      }

      advUtils.setStatus?.("");
      advUtils.clearSummary?.();
      advUtils.clearChart?.();
      advUtils.clearReport?.();

      if (advDom.generateBtn) {
        advDom.generateBtn.disabled = true;
        advDom.generateBtn.textContent = "Generating…";
      }

      const mode = advUtils.getSelectedMode ? advUtils.getSelectedMode() : "natal";

      try {
        const { payload, birthDateParts, transitDateParts } = advPayloads.buildPayloadFromForm(mode);

        if (mode === "natal") {
          const jsonResp = await fetch("/api/natal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!jsonResp.ok) {
            const text = await jsonResp.text();
            throw new Error(`Natal request failed: ${jsonResp.status} ${jsonResp.statusText} - ${text}`);
          }
          const natalJson = await jsonResp.json();
          if (natalJson && natalJson.subject) {
            window.AdvancedApp.render?.renderNatalSummary?.(natalJson);
          } else if (advDom.summaryEl) {
            advDom.summaryEl.innerHTML = "<p>Unexpected response from natal endpoint – subject field not found.</p>";
          }
          advUtils.setStatus?.("Natal response loaded.");
          advState.saveFormState(mode, payload);
          advState.saveApiData(mode, { summary: advDom.summaryEl ? advDom.summaryEl.innerHTML : "" });
        } else if (mode === "transit") {
          const jsonResp = await fetch("/api/transit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!jsonResp.ok) {
            const text = await jsonResp.text();
            throw new Error(`Transit request failed: ${jsonResp.status} ${jsonResp.statusText} - ${text}`);
          }
          const transitJson = await jsonResp.json();
          if (transitJson && transitJson.snapshot) {
            window.AdvancedApp.render?.renderTransitSummary?.(transitJson);
          } else if (advDom.summaryEl) {
            advDom.summaryEl.innerHTML = "<p>Unexpected response from transit endpoint – snapshot not found.</p>";
          }
          advUtils.setStatus?.("Transit response loaded.");
          advState.saveFormState(mode, payload);
          advState.saveApiData(mode, { summary: advDom.summaryEl ? advDom.summaryEl.innerHTML : "" });
        } else if (mode === "natal_transit") {
          const jsonResp = await fetch("/api/transit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!jsonResp.ok) {
            const text = await jsonResp.text();
            throw new Error(`Natal + transit request failed: ${jsonResp.status} ${jsonResp.statusText} - ${text}`);
          }
          const transitJson = await jsonResp.json();
          if (transitJson && transitJson.snapshot) {
            window.AdvancedApp.render?.renderCombinedSummary?.(transitJson);
          } else if (advDom.summaryEl) {
            advDom.summaryEl.innerHTML = "<p>Unexpected response from transit endpoint – snapshot not found.</p>";
          }
          advUtils.setStatus?.("Combined response loaded.");
          advState.saveFormState(mode, payload);
          advState.saveApiData(mode, { summary: advDom.summaryEl ? advDom.summaryEl.innerHTML : "" });
        } else {
          const synPayload = advPayloads.buildRelationshipPayload();
          const jsonResp = await fetch("/api/relationship", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(synPayload),
          });
          if (!jsonResp.ok) {
            const text = await jsonResp.text();
            throw new Error(`Relationship request failed: ${jsonResp.status} ${jsonResp.statusText} - ${text}`);
          }
          const relJson = await jsonResp.json();
          window.AdvancedApp.render?.renderRelationshipSummary?.(relJson);
          advUtils.setStatus?.("Relationship response loaded.");
          advState.saveFormState(mode, { ...payload, ...synPayload });
          advState.saveApiData(mode, { summary: advDom.summaryEl ? advDom.summaryEl.innerHTML : "" });
        }
      } catch (err) {
        advUtils.setStatus?.(err.message || "An error occurred while generating the chart.", true);
        console.error("[advanced] submit failed", err);
        if (advDom.summaryEl && !advDom.summaryEl.innerHTML) {
          advDom.summaryEl.innerHTML =
            "<p>Could not generate summary due to an error. Check the console for details.</p>";
        }
      } finally {
        if (advDom.generateBtn) {
          advDom.generateBtn.disabled = false;
          advDom.generateBtn.textContent = "Generate chart";
        }
        advUtils.updateDownloadState?.();
      }
    };
  }

  function overrideRenderers() {
    const app = window.AdvancedApp || {};
    if (!app.render) return;
    app.render.renderNatalSummary = (subject) => renderStructured("natal", subject);
    app.render.renderTransitSummary = (snapshot) => renderStructured("transit", snapshot);
    app.render.renderCombinedSummary = (snapshot) => renderStructured("combined", snapshot);
    app.render.renderRelationshipSummary = (data) => renderStructured("relationship", data);
  }

  function reveal() {
    const items = document.querySelectorAll("[data-fade-in]");
    items.forEach((item, idx) => {
      setTimeout(() => item.classList.add("visible"), 90 * (idx + 1));
    });
  }

  function init() {
    const range = loadRange();
    applyRange(range);

    if (dom.ascClockCollapse && dom.ascClockBody) {
      dom.ascClockCollapse.addEventListener("click", () => {
        const isHidden = dom.ascClockBody.classList.toggle("hidden");
        dom.ascClockCollapse.setAttribute("aria-expanded", isHidden ? "false" : "true");
        dom.ascClockCollapse.setAttribute("aria-label", isHidden ? "Expand ascendant panel" : "Collapse ascendant panel");
        dom.ascClockCollapse.innerHTML = isHidden
          ? '<svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>'
          : '<svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 15l6-6 6 6"/></svg>';
      });
    }

    if (dom.moonClockCollapse && dom.moonClockBody) {
      dom.moonClockCollapse.addEventListener("click", () => {
        const isHidden = dom.moonClockBody.classList.toggle("hidden");
        dom.moonClockCollapse.setAttribute("aria-expanded", isHidden ? "false" : "true");
        dom.moonClockCollapse.setAttribute("aria-label", isHidden ? "Expand Moon panel" : "Collapse Moon panel");
        dom.moonClockCollapse.innerHTML = isHidden
          ? '<svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>'
          : '<svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 15l6-6 6 6"/></svg>';
      });
    }

    if (dom.rangeStart) dom.rangeStart.addEventListener("change", handleRangeChange);
    if (dom.rangeEnd) dom.rangeEnd.addEventListener("change", handleRangeChange);
    if (dom.rangeNow) {
      dom.rangeNow.addEventListener("click", () => {
        const next = getDefaultRange();
        applyRange(next);
        saveRange(next);
      });
    }

    if (dom.apiCollapseBtn && dom.apiResponseBody) {
      // start collapsed per markup
      dom.apiCollapseBtn.addEventListener("click", () => {
        const isHidden = dom.apiResponseBody.classList.toggle("hidden");
        dom.apiCollapseBtn.setAttribute("aria-expanded", isHidden ? "false" : "true");
        dom.apiCollapseBtn.setAttribute("aria-label", isHidden ? "Expand API panel" : "Collapse API panel");
        dom.apiCollapseBtn.innerHTML = isHidden
          ? '<svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 15l-6-6-6 6"/></svg>'
          : '<svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>';
      });
    }

    reveal();
  }

  registerHandleSubmit();
  overrideRenderers();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
