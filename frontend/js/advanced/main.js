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
    ascClockContainer: document.getElementById("ascClockContainer"),
    ascClockBody: document.getElementById("ascClockBody"),
    ascClockCollapse: document.getElementById("ascClockCollapse"),
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
  const ASC_CLOCK_STEP = (Math.PI * 2) / 12;
  const HOUR_MS = 60 * 60 * 1000;
  let ascClockCounter = 0;

  const formatOrdinal = (n) => {
    if (n === 1) return "1st";
    if (n === 2) return "2nd";
    if (n === 3) return "3rd";
    return `${n}th`;
  };

  const normalizeOffset = (offset) => {
    let value = offset;
    while (value > 12) value -= 24;
    while (value < -12) value += 24;
    return value;
  };

  const angleForHour = (hour) => -Math.PI / 2 + (((hour % 12) + 12) % 12) * ASC_CLOCK_STEP;
  const elementFill = (element, alpha = 0.32) => {
    const rgb = ELEMENT_RGB[element] || ELEMENT_RGB.Default;
    return `rgba(${rgb}, ${alpha})`;
  };
  const elementStroke = (element, alpha = 0.85) => {
    const rgb = ELEMENT_RGB[element] || ELEMENT_RGB.Default;
    return `rgba(${rgb}, ${alpha})`;
  };

  const getOrbDegrees = (entry) => {
    if (!entry) return null;
    if (typeof entry.orb === "number") return entry.orb;
    if (typeof entry.position === "number") return entry.position;
    return null;
  };

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
      const anchor = anchorRaw ? new Date(anchorRaw) : null;
      const hasAnchor = anchor instanceof Date && Number.isFinite(anchor.getTime());
      const entries = Array.isArray(range.entries) ? range.entries : [];

      const normalizedEntries = entries
        .map((entry, entryIdx) => {
          const tsRaw = entry.timestamp || entry.time || entry.date || null;
          const ts = tsRaw ? new Date(tsRaw) : null;
          const rawOffset = hasAnchor && ts instanceof Date
            ? (ts.getTime() - anchor.getTime()) / (1000 * 60 * 60)
            : entry.offset_hours ?? entry.offsetHours ?? entryIdx - 12;
          const offsetFromAnchor = Number.isFinite(Number(rawOffset)) ? Number(rawOffset) : entryIdx - 12;
          const orb = typeof entry.orb === "number" ? entry.orb : (typeof entry.position === "number" ? entry.position : null);
          const decan = entry.decan || (typeof orb === "number" ? Math.max(1, Math.min(3, Math.floor(orb / 10) + 1)) : null);
          return {
            ...entry,
            timestamp: ts,
            offsetHours: normalizeOffset(offsetFromAnchor),
            orb,
            decan,
          };
        })
        .sort((a, b) => a.offsetHours - b.offsetHours);

      const anchorDate = hasAnchor
        ? anchor
        : normalizedEntries.find((e) => Math.abs(e.offsetHours) < 0.25)?.timestamp || normalizedEntries[0]?.timestamp || new Date();
      const anchorHour = anchorDate instanceof Date ? (anchorDate.getHours() + anchorDate.getMinutes() / 60) % 24 : 0;

      const withDisplayHours = normalizedEntries.map((entry) => {
        const fallbackHour = (anchorHour + entry.offsetHours + 24) % 24;
        const tsHour =
          entry.timestamp instanceof Date
            ? (entry.timestamp.getHours() + entry.timestamp.getMinutes() / 60) % 24
            : fallbackHour;
        return {
          ...entry,
          displayHour: ((tsHour % 24) + 24) % 24,
        };
      });

      normalized.push({
        id,
        label: range.label || id,
        anchor: anchorDate,
        anchorHour,
        entries: withDisplayHours,
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

  const safeDate = (value) => (value instanceof Date && Number.isFinite(value.getTime()) ? value : null);

  function resolveAscTimestamp(entry, anchor) {
    const ts = safeDate(entry?.timestamp);
    if (ts) return ts;
    if (!anchor) return null;
    const offset = Number.isFinite(entry?.offsetHours) ? entry.offsetHours : null;
    if (offset === null) return null;
    return new Date(anchor.getTime() + offset * HOUR_MS);
  }

  function computeSignSegments(range, windowStart, windowEnd) {
    if (!range || !Array.isArray(range.entries)) return [];
    const dbgTag = "[asc-clock]";
    const fmt = (d) => (d instanceof Date && Number.isFinite(d.getTime()) ? d.toISOString() : "—");
    const anchor = safeDate(range.anchor);
    const entries = range.entries
      .map((entry, idx) => {
        const ts = resolveAscTimestamp(entry, anchor);
        return {
          entry,
          ts,
          phi: getOrbDegrees(entry),
          sign: entry.sign,
          idx,
        };
      })
      .filter((item) => item.sign && safeDate(item.ts));

    if (!entries.length) return [];

    entries.sort((a, b) => a.ts - b.ts);
    console.info(dbgTag, "entries", range.id || range.label || "", entries.length);

    // Group by sequential sign in time order.
    const groups = [];
    entries.forEach((item) => {
      const prev = groups[groups.length - 1];
      if (prev && prev.sign === item.sign) {
        prev.items.push(item);
      } else {
        groups.push({ sign: item.sign, items: [item], start: null, end: null });
      }
    });

    // Compute start/end for groups with 2 or 3 entries.
    groups.forEach((group) => {
      const n = group.items.length;
      if (n < 2) return;
      const first = group.items[0];
      const ref = n >= 3 ? group.items[2] : group.items[1];
      if (typeof first.phi !== "number" || typeof ref.phi !== "number") return;
      const deltaPhi = ref.phi - first.phi;
      if (!deltaPhi || deltaPhi <= 0) return;
      const deltaHours = (ref.ts.getTime() - first.ts.getTime()) / HOUR_MS;
      if (!Number.isFinite(deltaHours) || deltaHours <= 0) return;
      const alpha = deltaHours / deltaPhi;
      const startMs = first.ts.getTime() - alpha * first.phi * HOUR_MS;
      const endMs = ref.ts.getTime() + alpha * (30 - ref.phi) * HOUR_MS;
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return;
      group.start = new Date(startMs);
      group.end = new Date(endMs);
    });

    const isKnown = (g) => safeDate(g.start) && safeDate(g.end);
    const findKnownLeft = (idx) => {
      for (let i = idx - 1; i >= 0; i--) {
        if (isKnown(groups[i])) return i;
      }
      return -1;
    };
    const findKnownRight = (idx) => {
      for (let i = idx + 1; i < groups.length; i++) {
        if (isKnown(groups[i])) return i;
      }
      return -1;
    };

    // Allocate intervals for chains of 1-entry groups using neighbors.
    let idx = 0;
    while (idx < groups.length) {
      if (isKnown(groups[idx])) {
        idx += 1;
        continue;
      }
      const chainStart = idx;
      while (idx < groups.length && !isKnown(groups[idx])) idx += 1;
      const chainEnd = idx - 1;
      const leftIdx = findKnownLeft(chainStart);
      const rightIdx = findKnownRight(chainEnd);
      const chainLen = chainEnd - chainStart + 1;
      if (leftIdx !== -1 && rightIdx !== -1) {
        const leftEnd = groups[leftIdx].end;
        const rightStart = groups[rightIdx].start;
        const missingCount = rightIdx - leftIdx - 1;
        const totalMs = rightStart.getTime() - leftEnd.getTime();
        if (missingCount > 0 && totalMs > 0) {
          const step = totalMs / (missingCount + 1);
          const base = leftEnd.getTime();
          groups[leftIdx].end = new Date(base + step);
          for (let k = 0; k < missingCount; k++) {
            const start = new Date(base + step * (k + 1));
            const end = new Date(base + step * (k + 2));
            const target = groups[leftIdx + 1 + k];
            target.start = start;
            target.end = end;
          }
          const rightBoundary = new Date(base + step * (missingCount + 1));
          groups[rightIdx].start = rightBoundary;
        }
      } else if (leftIdx === -1 && rightIdx !== -1) {
        // Chain at the very start: spread from windowStart to the first known.
        const leftBoundary = windowStart;
        const rightStart = groups[rightIdx].start;
        const spanMs = rightStart.getTime() - leftBoundary.getTime();
        if (spanMs > 0) {
          const step = spanMs / (chainLen + 1);
          for (let k = 0; k < chainLen; k++) {
            const start = new Date(leftBoundary.getTime() + step * k);
            const end = new Date(leftBoundary.getTime() + step * (k + 1));
            groups[chainStart + k].start = start;
            groups[chainStart + k].end = end;
          }
          groups[rightIdx].start = new Date(leftBoundary.getTime() + step * chainLen);
        }
      } else if (leftIdx !== -1 && rightIdx === -1) {
        // Chain at the end: spread from the last known to windowEnd.
        const leftEnd = groups[leftIdx].end;
        const rightBoundary = windowEnd;
        const spanMs = rightBoundary.getTime() - leftEnd.getTime();
        if (spanMs > 0) {
          const step = spanMs / (chainLen + 1);
          groups[leftIdx].end = new Date(leftEnd.getTime() + step);
          for (let k = 0; k < chainLen; k++) {
            const start = new Date(leftEnd.getTime() + step * (k + 1));
            const end = new Date(leftEnd.getTime() + step * (k + 2));
            groups[chainStart + k].start = start;
            groups[chainStart + k].end = end;
          }
        }
      } else {
        console.warn(dbgTag, "orphan chain with no anchors", { chainStart, chainEnd, sign: groups[chainStart]?.sign });
      }
    }

    // Continuity fix: median boundary between consecutive intervals.
    const finalized = groups.filter(isKnown).sort((a, b) => a.start - b.start);
    for (let i = 0; i < finalized.length - 1; i++) {
      const a = finalized[i];
      const b = finalized[i + 1];
      const boundary = new Date((a.end.getTime() + b.start.getTime()) / 2);
      a.end = boundary;
      b.start = boundary;
    }

    // Clip to the selected 12h window and map to a renderable structure.
    let segments = finalized
      .map((group) => {
        if (group.end <= group.start) return null;
        const startMs = Math.max(group.start.getTime(), windowStart.getTime());
        const endMs = Math.min(group.end.getTime(), windowEnd.getTime());
        if (endMs <= startMs) return null;
        return {
          sign: group.sign,
          start: new Date(startMs),
          end: new Date(endMs),
          entry: group.items[0]?.entry || group.items[0],
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);

    // Anchor guarantee: if the anchor hour lies in the window, enforce that hour to be the anchor sign.
    const anchorEntry =
      range.entries.find((e) => Math.abs(e.offsetHours || 0) < 0.25) || range.entries.find((e) => e.anchor === true);
    const anchorTs = resolveAscTimestamp(anchorEntry, anchor);
    if (anchorEntry && anchorTs && anchorTs >= windowStart && anchorTs <= windowEnd) {
      const anchorSign = anchorEntry.sign;
      const hourStart = new Date(Math.floor(anchorTs.getTime() / HOUR_MS) * HOUR_MS);
      const hourEnd = new Date(hourStart.getTime() + HOUR_MS);
      const clipStart = new Date(Math.max(hourStart.getTime(), windowStart.getTime()));
      const clipEnd = new Date(Math.min(hourEnd.getTime(), windowEnd.getTime()));
      if (clipEnd > clipStart && anchorSign) {
        const overlaps = (seg) => !(seg.end <= clipStart || seg.start >= clipEnd);
        const hasAnchor = segments.some((s) => overlaps(s) && s.sign === anchorSign);
        if (!hasAnchor) {
          segments = segments
            .map((s) => {
              if (!overlaps(s)) return s;
              const parts = [];
              if (s.start < clipStart) parts.push({ ...s, end: clipStart });
              if (s.end > clipEnd) parts.push({ ...s, start: clipEnd });
              return parts;
            })
            .flat()
            .filter(Boolean);
          segments.push({ sign: anchorSign, start: clipStart, end: clipEnd, entry: anchorEntry });
          segments.sort((a, b) => a.start - b.start);
        }
      }
    }

    if (!segments.length) {
      console.warn(dbgTag, "no segments after clipping", {
        id: range.id || range.label || "",
        windowStart: fmt(windowStart),
        windowEnd: fmt(windowEnd),
      });
    } else {
      console.info(
        dbgTag,
        "segments",
        range.id || range.label || "",
        segments.map((s) => `${s.sign} ${fmt(s.start)} -> ${fmt(s.end)}`)
      );
    }
    return segments;
  }

  function renderAscendantCenter(ranges, hours, centerEl, handColors = [], showLabels) {
    if (!centerEl) return;
    const parts = ranges.map((range) => {
      if (!range.entries.length) return null;
      const targetHour = Array.isArray(hours) ? hours[ranges.indexOf(range)] ?? hours[0] ?? 0 : hours ?? 0;
      let best = range.entries[0];
      const hourDist = (a, b) => {
        const d = ((a - b + 12) % 24) - 12;
        return Math.abs(d);
      };
      let bestDiff = hourDist(best.displayHour || 0, targetHour);
      range.entries.forEach((entry) => {
        const diff = hourDist(entry.displayHour || 0, targetHour);
        if (diff < bestDiff) {
          best = entry;
          bestDiff = diff;
        }
      });
      const signMeta = SIGN_META[best.sign] || { name: best.sign || "—", icon: best.emoji || "?" };
      const orbText = typeof best.orb === "number" ? `${best.orb.toFixed(2)}°` : "—";
      const decanText = best.decan ? `${formatOrdinal(best.decan)} Dec.` : "—";
      const qualityIcon = QUALITY_ICON[best.quality] || "";
      const qualityText = best.quality || "—";
      const tone = elementStroke(best.element || "Default", 0.6);
      const handColor = handColors[ranges.indexOf(range)] || tone;
      const timeLabel = formatClockTime(best, targetHour);

      const label = showLabels ? `<span class="adv-asc-label">${range.label || range.id}</span>` : "";
      return `
        <div class="adv-asc-active-row" style="--asc-accent:${tone}">
          <div class="adv-asc-glyph">${signMeta.icon || "↗"}</div>
          <div class="adv-asc-active-meta">
            <div class="adv-asc-active-title">
              ${label}
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
    if (!canvas || !centerEl) return;

    if (window.AdvancedApp && typeof window.AdvancedApp._cleanupAscClock === "function") {
      try {
        window.AdvancedApp._cleanupAscClock();
      } catch (err) {
      }
    }

    const ctx = canvas.getContext("2d");
    const isDual = ranges.length > 1;
    const hourStep = ASC_CLOCK_STEP;

    const ringContexts = ranges.map((range, idx) => {
      const anchorHour = typeof range.anchorHour === "number" ? ((range.anchorHour % 24) + 24) % 24 : 0;
      const baseStart = anchorHour >= 12 ? 12 : 0;
      const wrapHour = (hour) => {
        let h = hour;
        if (baseStart === 12) {
          while (h < 12) h += 12;
          while (h >= 24) h -= 12;
        } else {
          while (h >= 12) h -= 12;
          while (h < 0) h += 12;
        }
        return h;
      };
      return {
        idx,
        baseStart,
        displayedHours: Array.from({ length: 12 }, (_, i) => baseStart + i),
        boundaries: Array.from({ length: 13 }, (_, i) => -Math.PI / 2 + i * hourStep),
        wrapHour,
      };
    });
    const primaryCtx = ringContexts[0];
    const hourIndexForAngle = (angle) => {
      const raw = Math.round(((angle + Math.PI / 2) / hourStep) % 12);
      return (raw + 12) % 12;
    };
    const rings = isDual
      ? [
          { outer: 0.94, inner: 0.64, hand: 0.92, handColor: PRIMARY_HAND_COLOR },
          { outer: 0.56, inner: 0.32, hand: 0.58, handColor: SECONDARY_HAND_COLOR },
        ]
      : [{ outer: 0.9, inner: 0.58, hand: 0.9, handColor: PRIMARY_HAND_COLOR }];

    const initialHour =
      ranges[0]?.anchorHour ??
      (ranges[0]?.entries?.find((e) => Math.abs(e.offsetHours) < 0.25)?.displayHour ??
        ranges[0]?.entries?.[0]?.displayHour ??
        0);
    const state = {
      hours: ranges.map((r, idx) => {
        const ctxInfo = ringContexts[idx] || primaryCtx;
        const anchor = typeof r.anchorHour === "number" ? r.anchorHour : initialHour;
        const wrapped = ctxInfo.wrapHour(anchor);
        if (ctxInfo.displayedHours.includes(Math.floor(wrapped))) return wrapped;
        return ctxInfo.displayedHours[0];
      }),
      playing: false,
      lastTick: performance.now(),
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
    };

    const drawRing = (range, ringConfig, ringCtx, activeHour) => {
      if (!range.entries.length) return;
      const { width, height } = canvas;
      const w = width / (window.devicePixelRatio || 1);
      const h = height / (window.devicePixelRatio || 1);
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2;
      const outerR = radius * ringConfig.outer;
      const innerR = radius * ringConfig.inner;
      const { baseStart, displayedHours, boundaries, wrapHour } = ringCtx;

      ctx.save();
      ctx.translate(cx, cy);

      const anchorDate =
        safeDate(range.anchor) ||
        safeDate(range.entries.find((e) => safeDate(e.timestamp))?.timestamp) ||
        new Date();
      const windowStartDate = new Date(anchorDate);
      windowStartDate.setHours(baseStart, 0, 0, 0);
      const windowEndDate = new Date(windowStartDate.getTime() + 12 * HOUR_MS);
      const angleForTime = (date) => {
        const frac = (date.getTime() - windowStartDate.getTime()) / (12 * HOUR_MS);
        return -Math.PI / 2 + frac * Math.PI * 2;
      };

      const renderSegments = computeSignSegments(range, windowStartDate, windowEndDate).map((seg) => {
        const startAngle = angleForTime(seg.start);
        let endAngle = angleForTime(seg.end);
        if (endAngle <= startAngle) endAngle += Math.PI * 2;
        return { ...seg, startAngle, endAngle };
      });

      // Merge contiguous segments of the same sign so labels render only once at the start.
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

      const normalizedHour = wrapHour(activeHour ?? baseStart);
      const activeOffset = ((normalizedHour - baseStart + 12) % 12);
      const activeTime = new Date(windowStartDate.getTime() + activeOffset * HOUR_MS);
      const highlightStart = angleForTime(activeTime);
      let highlightEnd = angleForTime(new Date(activeTime.getTime() + HOUR_MS));
      if (highlightEnd <= highlightStart) highlightEnd += Math.PI * 2;

      // Hour boundary guides for clearer segmentation.
      if (ringCtx.idx === 0) {
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

        // Sign boundary line and glyph near the start of the segment.
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
        const decanCenter = sliceStart + (sliceEnd - sliceStart) / 6; // middle of 1st decan
        const labelR = innerR + (outerR - innerR) * (isOuterRing ? 0.45 : 0.43);
        const tx = Math.cos(decanCenter) * labelR;
        const ty = Math.sin(decanCenter) * labelR;
        ctx.fillStyle = "#e8f4ff";
        ctx.font = `${Math.max(12, radius * 0.06)}px "Space Grotesk", "Inter", system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(glyph, tx, ty);

        if (isActive) {
          const outerHighlightR = outerR * 1.01;
          const innerHighlightR = outerR * 0.99;
          ctx.save();
          ctx.lineCap = "round";
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.arc(0, 0, outerHighlightR, highlightStart + 0.002, highlightEnd - 0.002);
          ctx.strokeStyle = ACTIVE_SEGMENT_COLOR;
          ctx.lineWidth = 4.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, innerHighlightR, highlightStart + 0.002, highlightEnd - 0.002);
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 3.5;
          ctx.stroke();
          ctx.restore();
        }
      });

      if (ringCtx.idx === 0) {
        // Hour ticks + labels
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        ctx.lineWidth = 1;
        const tickOuter = outerR * 1.015;
        for (let i = 0; i < displayedHours.length; i++) {
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
          const rawLabel = displayedHours[i] % 24;
          const labelVal = rawLabel === 0 ? 12 : baseStart === 12 && rawLabel === 12 ? 24 : rawLabel;
          ctx.fillText(String(labelVal), Math.cos(a) * labelR, Math.sin(a) * labelR);
        }
      }

      // Inner ring hour labels if its window differs from the primary.
      const primaryBase = primaryCtx?.baseStart ?? baseStart;
      if (ringCtx.idx > 0 && baseStart !== primaryBase) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = `${Math.max(10, radius * 0.035)}px "Space Grotesk", "Inter", system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const labelR = innerR * 0.9;
        for (let i = 0; i < displayedHours.length; i++) {
          const a = boundaries[i];
          const rawLabel = displayedHours[i] % 24;
          const labelVal = rawLabel === 0 ? 12 : baseStart === 12 && rawLabel === 12 ? 24 : rawLabel;
          ctx.fillText(String(labelVal), Math.cos(a) * labelR, Math.sin(a) * labelR);
        }
      }

      ctx.restore();
    };

    const drawHands = () => {
      const { width, height } = canvas;
      const w = width / (window.devicePixelRatio || 1);
      const h = height / (window.devicePixelRatio || 1);
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2;
      ranges.forEach((range, idx) => {
        const handCfg = rings[idx] || rings[0];
        const ctxInfo = ringContexts[idx] || primaryCtx;
        const hour = ((state.hours[idx] ?? state.hours[0] ?? ctxInfo.baseStart) % 24 + 24) % 24;
        const relHour = ((hour - ctxInfo.baseStart + 24) % 24) % 12;
        const angle = angleForHour(relHour);
        const handR = radius * handCfg.hand;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = handCfg.handColor;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * handR, Math.sin(angle) * handR);
        ctx.stroke();
        ctx.restore();
      });
      renderAscendantCenter(ranges, state.hours, centerEl, rings.map((r) => r.handColor));
    };

    const draw = () => {
      const { width, height } = canvas;
      const w = width / (window.devicePixelRatio || 1);
      const h = height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);

      ranges.forEach((range, idx) => {
        const ctxInfo = ringContexts[idx] || primaryCtx;
        const hour = ((state.hours[idx] ?? state.hours[0] ?? ctxInfo.baseStart) % 24 + 24) % 24;
        drawRing(range, rings[idx] || rings[0], ctxInfo, hour);
      });
      drawHands();
    };

    const tick = (ts) => {
      if (!state.playing) return;
      const delta = (ts - state.lastTick) / 1000;
      state.lastTick = ts;
      state.hours = state.hours.map((h, idx) => {
        const ctxInfo = ringContexts[idx] || primaryCtx;
        return ctxInfo.wrapHour(h + delta); // 1 hour per second
      });
      draw();
      requestAnimationFrame(tick);
    };

    const setOffsetFromClick = (event) => {
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width;
      const x = (event.clientX - rect.left) * scale - canvas.width / 2;
      const y = (event.clientY - rect.top) * scale - canvas.height / 2;
      const angle = Math.atan2(y, x);
      const rawIdx = Math.round((angle + Math.PI / 2) / hourStep);
      const idx = ((rawIdx % 12) + 12) % 12;
      if (isDual) {
        const r = Math.sqrt(x * x + y * y);
        const radius = Math.min(canvas.width, canvas.height) / 2;
        const radial = r / radius;
        const ringIdx = radial > (rings[0].inner + rings[0].outer) / 2 ? 0 : 1;
        const ctxInfo = ringContexts[ringIdx] || primaryCtx;
        const normalized = ctxInfo.wrapHour(ctxInfo.baseStart + idx);
        state.hours[ringIdx] = normalized;
      } else {
        const ctxInfo = primaryCtx;
        const normalized = ctxInfo.wrapHour(ctxInfo.baseStart + idx);
        state.hours = [normalized];
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

    resize();
    renderAscendantCenter(ranges, state.hours, centerEl, rings.map((r) => r.handColor), isDual);

    if (playBtn) {
      playBtn.addEventListener("click", togglePlay);
    }
    window.addEventListener("resize", resize);
    canvas.addEventListener("click", setOffsetFromClick);
    if (window.AdvancedApp) {
      window.AdvancedApp._cleanupAscClock = () => {
        window.removeEventListener("resize", resize);
        if (playBtn) playBtn.removeEventListener("click", togglePlay);
        canvas.removeEventListener("click", setOffsetFromClick);
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
            <p class="adv-asc-sub">±12h around ${dateLabel}</p>
          </div>
          <div class="adv-asc-actions">
            <button type="button" class="adv-asc-play" id="${playId}" aria-pressed="false">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Play</span>
            </button>
          </div>
        </div>
        <div class="adv-asc-legend">${legend}</div>
        <div class="adv-asc-body">
          <div class="adv-asc-canvas-wrap">
            <canvas id="${canvasId}" class="adv-asc-canvas" aria-label="Ascendant clock"></canvas>
          </div>
          <div id="${centerId}" class="adv-asc-center"></div>
        </div>
      </div>
    `;
    return { html, ids: { canvasId, playId, centerId } };
  }

  function buildAscendantTables(ranges) {
    if (!ranges.length) return "";
    const renderRow = (entry) => {
      const signMeta = SIGN_META[entry.sign] || { name: entry.sign || "—", icon: entry.emoji || "" };
      const orbText = typeof entry.orb === "number" ? `${entry.orb.toFixed(2)}°` : "—";
      const qualityIcon = QUALITY_ICON[entry.quality] || "";
      const elementIcon = ELEMENT_ICON[entry.element] || "";
      const swatchColor = elementFill(entry.element, 1).replace("rgba(", "rgb(").replace(/,\s*1\)$/, ")");
      return `
        <tr>
          <td>${pad(Math.round(entry.displayHour) % 24)}:00</td>
          <td>${signMeta.icon || ""} ${signMeta.name}</td>
          <td>${orbText}</td>
          <td>${qualityIcon ? `${qualityIcon} ` : ""}${entry.quality || "—"}</td>
          <td><span class="adv-asc-color-swatch" style="background:${swatchColor}"></span>${elementIcon ? `${elementIcon} ` : ""}${entry.element || "—"}</td>
        </tr>
      `;
    };

    const tables = ranges.map((range, idx) => {
      const handColor = idx === 0 ? PRIMARY_HAND_COLOR : SECONDARY_HAND_COLOR;
      const startHour = Math.round(range.anchorHour ?? range.entries?.[0]?.displayHour ?? 0);
      const hours = Array.from({ length: 12 }, (_, i) => (startHour + i) % 24);
      const rows = hours
        .map((hour) => {
          const match = range.entries.find((e) => Math.round(e.displayHour) % 24 === hour);
          return match ? renderRow(match) : "";
        })
        .join("");
      return `
        <table class="adv-asc-table">
          <caption style="color:${handColor}">${range.label || range.id}</caption>
          <thead>
            <tr>
              <th>Time</th>
              <th>Sign</th>
              <th>Orb</th>
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
    if (ascendantRanges.length > 1) {
      const priority = ["transit", "second", "first", "natal"];
      ascendantRanges.sort((a, b) => {
        const ai = priority.indexOf((a.id || "").toLowerCase());
        const bi = priority.indexOf((b.id || "").toLowerCase());
        const aval = ai === -1 ? 99 : ai;
        const bval = bi === -1 ? 99 : bi;
        return aval - bval;
      });
    }
    const clockBlock = buildAscendantClockBlock(ascendantRanges, metaSource);
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
    if (dom.ascClockContainer) {
      if (!ascendantRanges.length) {
        dom.ascClockContainer.innerHTML = "<p class=\"hint\">Generate a chart to see the ascendant clock and hourly breakdown.</p>";
      } else {
        const tables = buildAscendantTables(ascendantRanges);
        dom.ascClockContainer.innerHTML = `${clockBlock.html}${tables}`;
        initAscendantClock(ascendantRanges, clockBlock.ids);
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
