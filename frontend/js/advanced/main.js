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
    const baseStart = ((ranges[0]?.anchorHour || 0) >= 12) ? 12 : 0;
    const displayedHours = Array.from({ length: 12 }, (_, i) => baseStart + i);
    const hourStep = ASC_CLOCK_STEP;
    const boundaries = Array.from({ length: 13 }, (_, i) => -Math.PI / 2 + i * hourStep);
    const hourIndexForAngle = (angle) => {
      const raw = Math.round(((angle + Math.PI / 2) / hourStep) % 12);
      return (raw + 12) % 12;
    };
    const wrapHourToWindow = (hour) => {
      if (baseStart === 12) {
        while (hour < 12) hour += 12;
        while (hour >= 24) hour -= 12;
      } else {
        while (hour >= 12) hour -= 12;
        while (hour < 0) hour += 12;
      }
      return hour;
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
        const anchor = typeof r.anchorHour === "number" ? r.anchorHour : initialHour;
        const wrapped = wrapHourToWindow(anchor);
        if (displayedHours.includes(Math.floor(wrapped))) return wrapped;
        return displayedHours[0];
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

    const drawRing = (range, ringConfig, activeHour, outerMostR) => {
      if (!range.entries.length) return;
      const { width, height } = canvas;
      const w = width / (window.devicePixelRatio || 1);
      const h = height / (window.devicePixelRatio || 1);
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2;
      const outerR = radius * ringConfig.outer;
      const innerR = radius * ringConfig.inner;

      ctx.save();
      ctx.translate(cx, cy);

      let lastSignKey = null;
      let lastSignEnd = null;

      const bucketEntries = new Map();
      range.entries.forEach((e) => {
        const h = Math.floor(((e.displayHour || 0) % 24 + 24) % 24);
        if (!bucketEntries.has(h)) bucketEntries.set(h, e);
      });
      const entryForHour = (target) => {
        const h = ((target % 24) + 24) % 24;
        if (bucketEntries.has(h)) return bucketEntries.get(h);
        let best = null;
        let bestDiff = Number.POSITIVE_INFINITY;
        range.entries.forEach((e) => {
          const eh = ((e.displayHour || 0) % 24 + 24) % 24;
          const diff = Math.abs(eh - h);
          if (diff < bestDiff) {
            best = e;
            bestDiff = diff;
          }
        });
        return best;
      };

      for (let i = 0; i < displayedHours.length; i++) {
        const hour = displayedHours[i];
        const nextHour = displayedHours[(i + 1) % displayedHours.length];
        const entry = entryForHour(hour);
        const nextEntry = entryForHour(nextHour);
        if (!entry || !nextEntry) continue;
        const isActive = Math.round((activeHour ?? 0)) % 24 === hour;

        const start = boundaries[i];
        const end = boundaries[i + 1];
        let splitAngle = null;
        if (entry.sign !== nextEntry.sign) {
          const orbA = typeof entry.orb === "number" ? entry.orb : entry.position || 0;
          const orbB = typeof nextEntry.orb === "number" ? nextEntry.orb : nextEntry.position || 0;
          const rem = Math.max(0.01, 30 - orbA);
          const denom = rem + Math.max(0.01, orbB);
          const fraction = Math.min(1, Math.max(0, rem / denom));
          splitAngle = start + (end - start) * fraction;
        }

        const drawSlice = (sliceStart, sliceEnd, srcEntry) => {
          ctx.beginPath();
          ctx.arc(0, 0, outerR, sliceStart, sliceEnd);
          ctx.arc(0, 0, innerR, sliceEnd, sliceStart, true);
          ctx.closePath();
          ctx.fillStyle = elementFill(srcEntry.element, isDual ? 0.28 : 0.34);
          ctx.strokeStyle = elementStroke(srcEntry.element, 0.45);
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();

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
          const signKey = srcEntry.sign || srcEntry.name || srcEntry.emoji;
          const contiguous =
            signKey === lastSignKey && lastSignEnd !== null && Math.abs(sliceStart - lastSignEnd) < 1e-4;
          if (!contiguous) {
            const mid = sliceStart + (sliceEnd - sliceStart) * 0.18;
            const signMeta = SIGN_META[srcEntry.sign] || {};
            const glyph = signMeta.icon || srcEntry.emoji || "?";
            const tx = Math.cos(mid) * outerR * 0.92;
            const ty = Math.sin(mid) * outerR * 0.92;
            ctx.fillStyle = "#e8f4ff";
            ctx.font = `${Math.max(12, radius * 0.06)}px "Space Grotesk", "Inter", system-ui`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(glyph, tx, ty);
          }
          lastSignKey = signKey;
          lastSignEnd = sliceEnd;
        };

        if (splitAngle) {
          drawSlice(start, splitAngle, entry);
          drawSlice(splitAngle, end, nextEntry);
          // dotted sign switch line
          ctx.save();
          ctx.setLineDash([4, 4]);
          const startR = ringConfig === rings[0] ? innerR : innerR;
          const endR = ringConfig === rings[0] ? outerR * 1.12 : Math.min(outerMostR * 1.02, outerR * 1.08);
          ctx.strokeStyle = "#9ca3af";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(splitAngle) * startR, Math.sin(splitAngle) * startR);
          ctx.lineTo(Math.cos(splitAngle) * endR, Math.sin(splitAngle) * endR);
          ctx.stroke();
          ctx.restore();
        } else {
          drawSlice(start, end, entry);
        }

        if (isActive) {
          const outerHighlightR = outerR * 1.01;
          const innerHighlightR = outerR * 0.99;
          ctx.save();
          ctx.lineCap = "round";
          ctx.globalAlpha = 0.95;
          // Colored outline (outer)
          ctx.beginPath();
          ctx.arc(0, 0, outerHighlightR, start + 0.002, end - 0.002);
          ctx.strokeStyle = ACTIVE_SEGMENT_COLOR;
          ctx.lineWidth = 4.5;
          ctx.stroke();
          // Inner black outline
          ctx.beginPath();
          ctx.arc(0, 0, innerHighlightR, start + 0.002, end - 0.002);
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 3.5;
          ctx.stroke();
          ctx.restore();
        }
      }

      if (ringConfig === rings[0]) {
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
          ctx.fillText(String(displayedHours[i] % 24), Math.cos(a) * labelR, Math.sin(a) * labelR);
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
        const hour = ((state.hours[idx] ?? state.hours[0] ?? 0) % 24 + 24) % 24;
        const relHour = ((hour - baseStart + 24) % 24) % 12;
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
        const hour = ((state.hours[idx] ?? state.hours[0] ?? 0) % 24 + 24) % 24;
        const rMax = Math.min(w, h) / 2;
        drawRing(range, rings[idx] || rings[0], hour, rMax * (rings[0]?.outer || 1));
      });
      drawHands();
    };

    const tick = (ts) => {
      if (!state.playing) return;
      const delta = (ts - state.lastTick) / 1000;
      state.lastTick = ts;
      state.hours = state.hours.map((h) => wrapHourToWindow(h + delta)); // 1 hour per second
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
      const idx = ((rawIdx % displayedHours.length) + displayedHours.length) % displayedHours.length;
      const normalized = wrapHourToWindow(displayedHours[idx] % 24);
      if (isDual) {
        const r = Math.sqrt(x * x + y * y);
        const radius = Math.min(canvas.width, canvas.height) / 2;
        const radial = r / radius;
        const ringIdx = radial > (rings[0].inner + rings[0].outer) / 2 ? 0 : 1;
        state.hours[ringIdx] = normalized;
      } else {
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
