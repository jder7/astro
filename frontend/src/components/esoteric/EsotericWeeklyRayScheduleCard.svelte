<script>
  import { onDestroy, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { requestWeeklyRaySchedule, requestWeeklyRaySchedulePdf } from '$lib/api/client';
  import { buildWeeklyRaySchedulePayload, buildWeeklyRaySchedulePdfPayload } from '$lib/payloads';
  import { getRayColorHex, getRayColorName, getSignRays } from '$lib/astro/rays';
  import { signName, signSymbol } from '$lib/astro/signs';
  import { configStore } from '$lib/state/configStore';
  import { inputStore } from '$lib/state/inputStore';
  import { downloadBlob } from '$lib/utils/download';
  import ElementSigil from '$components/shared/ElementSigil.svelte';

  export let mode = 'natal';
  export let chartReady = false;
  export let resultKey = 0;

  let loading = false;
  let pdfLoading = false;
  let errorMessage = '';
  let schedule = null;
  let hourWindow = { start: 6, end: 20 };
  let fullDay = false;
  let collapsed = true;
  let zoomed = false;
  let gridWrapEl = null;
  let lastResultKey = resultKey;
  let selectedDayIndex = -1;

  const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII' };
  const PLANET_LABELS = {
    sun: 'Sun',
    moon: 'Moon',
    mercury: 'Mercury',
    venus: 'Venus',
    mars: 'Mars',
    jupiter: 'Jupiter',
    saturn: 'Saturn',
  };
  const DEFAULT_FALLBACK = '#64748b';
  const GROUP_SEPARATOR = ' · ';
  const MOON_ICON = '☾';
  const BASE_SUBTITLE = 'Aligned sun/moon/day aura headers with ascendant split hour cards.';
  const WEEKLY_STORAGE_KEY = 'astroApiScheduleState';
  const WEEKLY_LEGACY_STORAGE_KEY = 'astroWeeklyRayCacheV1';
  const WEEKLY_LEGACY_CLEANUP_FLAG = 'astroWeeklyRayCacheCleanupV2';
  const WEEKLY_CACHE_MAX_ENTRIES = 2;
  const WEEKLY_RUNTIME_MAX_ENTRIES = 4;
  const WEEKLY_PERSIST_MAX_BYTES = 220000;
  const runtimeScheduleCache = new Map();
  const EMPTY_STATUS = Object.freeze({ kind: 'info', message: '' });
  let timeStatus = EMPTY_STATUS;
  let preloadStatus = EMPTY_STATUS;
  let titleSubtitle = BASE_SUBTITLE;

  $: supported = mode === 'transit' || mode === 'natal_transit';
  $: days = Array.isArray(schedule?.days) ? schedule.days : [];
  $: allRows = Array.isArray(schedule?.rows) ? schedule.rows : [];
  $: visibleRows = allRows.filter((row) => row.hour >= hourWindow.start && row.hour < hourWindow.end);
  $: sunSegments = Array.isArray(schedule?.sunHeaderSegments)
    ? schedule.sunHeaderSegments
    : Array.isArray(schedule?.sun_header_segments)
      ? schedule.sun_header_segments
      : [];
  $: moonSegments = Array.isArray(schedule?.moonHeaderSegments)
    ? schedule.moonHeaderSegments
    : Array.isArray(schedule?.moon_header_segments)
      ? schedule.moon_header_segments
      : [];
  $: sunByDay = days.map((day) => intersectByDay(sunSegments, day));
  $: moonByDay = days.map((day) => intersectByDay(moonSegments, day));
  $: systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  $: scheduleTz = schedule?.week?.tz || $inputStore?.transit?.tz_str || systemTz;
  $: nowInSystemTz = getNowInTz(systemTz);
  $: nowDateKey = nowInSystemTz.dateKey || '';
  $: currentDayIndex = days.findIndex((day) => dateKeyInTz(day?.date, systemTz) === nowInSystemTz.dateKey);
  $: weekStartDateKey = days.length ? dateKeyInTz(days[0]?.date, systemTz) : '';
  $: weekEndDateKey = days.length ? dateKeyInTz(days[days.length - 1]?.date, systemTz) : '';
  $: isNowInsideScheduleWeek = Boolean(weekStartDateKey && weekEndDateKey && nowDateKey >= weekStartDateKey && nowDateKey <= weekEndDateKey);
  $: currentHour = nowInSystemTz.hour;
  $: hasCurrentDayInWeek = currentDayIndex >= 0;
  $: hasCurrentHourInVisibleWindow = currentHour >= hourWindow.start && currentHour < hourWindow.end;
  $: highlightCurrentHourBand = hasCurrentDayInWeek && hasCurrentHourInVisibleWindow;
  $: systemNowLabel = formatSystemNowInTz(systemTz);
  $: timeStatus = buildTimeStatus({
    schedulePresent: Boolean(schedule),
    isNowInsideScheduleWeek,
    hasCurrentDayInWeek,
    hasCurrentHourInVisibleWindow,
    weekStartDateKey,
    weekEndDateKey,
    systemNowLabel,
    currentHour,
    hourStart: hourWindow.start,
    hourEnd: hourWindow.end,
  });
  $: preloadStatus = buildPreloadTimeStatus({
    enabled: supported && chartReady && !schedule,
    transit: $inputStore?.transit,
    nowDateKey,
    currentHour,
    hourStart: hourWindow.start,
    hourEnd: hourWindow.end,
    systemNowLabel,
  });
  $: titleSubtitle =
    timeStatus?.kind === 'warning'
      ? timeStatus.message
      : preloadStatus?.kind === 'warning'
        ? preloadStatus.message
        : BASE_SUBTITLE;
  $: if (!supported) {
    schedule = null;
    errorMessage = '';
  }
  $: sunWeekNumber = isoWeekNumber(schedule?.week?.start);
  $: weekMonthLeft = monthNameInTz(schedule?.week?.start);
  $: weekMonthRight = monthNameInTz(days?.[days.length - 1]?.date || schedule?.week?.end);
  $: sunMonthLine = weekMonthLeft && weekMonthLeft === weekMonthRight ? weekMonthLeft : `${weekMonthLeft || '—'}${GROUP_SEPARATOR}${weekMonthRight || '—'}`;
  $: sunSignsHeaderLine = signsLine(sunSegments);
  $: sunPositionedSegments = positionedSegments(sunSegments);
  $: moonSignsHeaderLine = signsLine(moonSegments);
  $: moonPositionedSegments = positionedSegments(moonSegments);
  $: if (typeof document !== 'undefined') {
    document.body.classList.toggle('weekly-zoom-open', Boolean(zoomed));
  }

  const pad = (value) => String(value ?? 0).padStart(2, '0');

  const toDate = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const formatDate = (value, tz = scheduleTz) => {
    const d = toDate(value);
    if (!d) return '—';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    } catch (err) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
  };

  const formatTime = (value, tz = scheduleTz) => {
    const d = toDate(value);
    if (!d) return '--:--';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(d);
    } catch (err) {
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  };

  const dateKeyInTz = (value, tz) => {
    const date = toDate(value);
    if (!date) return '';
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const out = {};
      parts.forEach((entry) => {
        if (entry.type === 'year' || entry.type === 'month' || entry.type === 'day') out[entry.type] = entry.value;
      });
      return `${out.year || '0000'}-${out.month || '00'}-${out.day || '00'}`;
    } catch (err) {
      return formatDate(date);
    }
  };

  const getNowInTz = (tz) => {
    const now = new Date();
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(now);
      const out = {};
      parts.forEach((entry) => {
        if (entry.type === 'year' || entry.type === 'month' || entry.type === 'day' || entry.type === 'hour') {
          out[entry.type] = entry.value;
        }
      });
      return {
        dateKey: `${out.year || '0000'}-${out.month || '00'}-${out.day || '00'}`,
        hour: Number.isFinite(Number(out.hour)) ? Number(out.hour) : -1,
      };
    } catch (err) {
      return { dateKey: formatDate(now), hour: now.getHours() };
    }
  };

  const formatSystemNowInTz = (tz) => {
    const now = new Date();
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(now);
    } catch (err) {
      return now.toISOString();
    }
  };

  const formatHourWindow = (start, end) => `${String(start).padStart(2, '0')}:00${GROUP_SEPARATOR}${String(end).padStart(2, '0')}:00`;

  const buildRangeIssues = ({ includeWeekCheck, includeHourCheck, insideWeek, hasDay, weekStart, weekEnd, nowLabel, hour, hourStart, hourEnd }) => {
    const issues = [];
    if (includeWeekCheck && (!insideWeek || !hasDay)) {
      issues.push(`current system day (${nowLabel || '—'}) is outside this schedule week (${weekStart || '—'} · ${weekEnd || '—'})`);
    }
    if (includeHourCheck) {
      issues.push(`current system hour ${String(hour ?? -1).padStart(2, '0')}:00 is outside visible window ${formatHourWindow(hourStart ?? 0, hourEnd ?? 0)}`);
    }
    return issues;
  };

  const buildTimeStatus = (ctx) => {
    if (!ctx?.schedulePresent) return EMPTY_STATUS;
    const issues = buildRangeIssues({
      includeWeekCheck: true,
      includeHourCheck: Boolean((ctx?.isNowInsideScheduleWeek || ctx?.hasCurrentDayInWeek) && !ctx?.hasCurrentHourInVisibleWindow),
      insideWeek: ctx?.isNowInsideScheduleWeek,
      hasDay: ctx?.hasCurrentDayInWeek,
      weekStart: ctx?.weekStartDateKey,
      weekEnd: ctx?.weekEndDateKey,
      nowLabel: ctx?.systemNowLabel,
      hour: ctx?.currentHour,
      hourStart: ctx?.hourStart,
      hourEnd: ctx?.hourEnd,
    });
    if (issues.length) {
      return { kind: 'warning', message: `⚠ ${issues.join(' · ')}.` };
    }
    return { kind: 'ok', message: `✓ System time ${ctx?.systemNowLabel || '—'} is inside this schedule and visible window.` };
  };

  const transitIsoWeekBounds = (transit) => {
    const year = Number(transit?.year);
    const month = Number(transit?.month);
    const day = Number(transit?.day);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const anchor = new Date(Date.UTC(Math.floor(year), Math.floor(month) - 1, Math.floor(day)));
    if (Number.isNaN(anchor.getTime())) return null;
    const dayOfWeek = anchor.getUTCDay() || 7;
    const weekStart = new Date(anchor);
    weekStart.setUTCDate(anchor.getUTCDate() - dayOfWeek + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    const key = (value) => `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
    return { startKey: key(weekStart), endKey: key(weekEnd) };
  };

  const buildPreloadTimeStatus = (ctx) => {
    if (!ctx?.enabled) return EMPTY_STATUS;
    const bounds = transitIsoWeekBounds(ctx?.transit);
    if (!bounds?.startKey || !bounds?.endKey) return EMPTY_STATUS;
    const insideWeek = Boolean(ctx?.nowDateKey && ctx.nowDateKey >= bounds.startKey && ctx.nowDateKey <= bounds.endKey);
    const issues = buildRangeIssues({
      includeWeekCheck: true,
      includeHourCheck: Boolean(insideWeek && !(ctx?.currentHour >= ctx?.hourStart && ctx?.currentHour < ctx?.hourEnd)),
      insideWeek,
      hasDay: insideWeek,
      weekStart: bounds.startKey,
      weekEnd: bounds.endKey,
      nowLabel: ctx?.systemNowLabel,
      hour: ctx?.currentHour,
      hourStart: ctx?.hourStart,
      hourEnd: ctx?.hourEnd,
    });
    if (issues.length) {
      return { kind: 'warning', message: `⚠ ${issues.join(' · ')}.` };
    }
    return EMPTY_STATUS;
  };

  const selectedTransitDateKey = (transit) => {
    const source = transit || {};
    const year = Number(source.year);
    const month = Number(source.month);
    const day = Number(source.day);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return '';
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    return `${Math.floor(year)}-${pad(Math.floor(month))}-${pad(Math.floor(day))}`;
  };

  const portal = (node, enabled = false) => {
    let active = false;
    let placeholder = null;
    let originalParent = null;
    let originalNextSibling = null;

    const attach = () => {
      if (active || typeof document === 'undefined') return;
      originalParent = node.parentNode;
      originalNextSibling = node.nextSibling;
      placeholder = document.createComment('weekly-portal-anchor');
      originalParent?.insertBefore(placeholder, node);
      document.body.appendChild(node);
      active = true;
    };

    const detach = () => {
      if (!active) return;
      const placeholderParent = placeholder?.parentNode || null;
      if (placeholderParent) {
        if (node.parentNode !== placeholderParent) {
          placeholderParent.insertBefore(node, placeholder);
        }
        if (placeholder?.parentNode === placeholderParent) {
          placeholderParent.removeChild(placeholder);
        }
      } else if (originalParent) {
        const safeSibling = originalNextSibling && originalNextSibling.parentNode === originalParent ? originalNextSibling : null;
        if (node.parentNode !== originalParent) {
          if (safeSibling) originalParent.insertBefore(node, safeSibling);
          else originalParent.appendChild(node);
        }
      }
      active = false;
      placeholder = null;
      originalParent = null;
      originalNextSibling = null;
    };

    if (enabled) attach();

    return {
      update(nextEnabled) {
        if (nextEnabled) attach();
        else detach();
      },
      destroy() {
        detach();
      },
    };
  };

  const monthNameInTz = (value, tz = scheduleTz) => {
    const date = toDate(value);
    if (!date) return '';
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long' }).format(date);
    } catch (err) {
      return '';
    }
  };

  const isoWeekNumber = (value) => {
    const date = toDate(value);
    if (!date) return null;
    const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    return Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  };

  const uniqueSignItems = (segments, includeIcons = true) => {
    const out = [];
    positionedSegments(segments).forEach((segment) => {
      const key = String(segment?.signLabel || '').trim().toLowerCase();
      if (!key || out.some((item) => item.key === key)) return;
      out.push({
        key,
        label: segment.signLabel,
        icon: includeIcons ? segment.signIconSafe : '',
      });
    });
    return out;
  };

  const signsLine = (segments) =>
    uniqueSignItems(segments, true)
      .map((item) => `${item.icon ? `${item.icon} ` : ''}${item.label}`)
      .join(GROUP_SEPARATOR) || '—';

  const moonStateFromSegments = (segments) => {
    const list = positionedSegments(segments);
    if (!list.length) return '—';
    const dominant = list.reduce((best, current) => (Number(current?.ratio || 0) > Number(best?.ratio || 0) ? current : best), list[0]);
    const firstWithPhase = list.find((segment) => String(segment?.phase || '').trim());
    const phase = String(dominant?.phase || firstWithPhase?.phase || '').trim() || 'Moon cycle';
    const dominantIllum = Number(dominant?.illuminationPercentage ?? dominant?.illumination_percentage);
    const firstIllum = list.find((segment) => Number.isFinite(Number(segment?.illuminationPercentage ?? segment?.illumination_percentage)));
    const illuminationRaw = Number.isFinite(dominantIllum)
      ? dominantIllum
      : Number(firstIllum?.illuminationPercentage ?? firstIllum?.illumination_percentage);
    const illumination = Number.isFinite(illuminationRaw) ? Math.max(0, Math.min(100, Math.round(illuminationRaw))) : null;
    return illumination === null ? `${MOON_ICON}${GROUP_SEPARATOR}${phase}` : `${MOON_ICON}${GROUP_SEPARATOR}${phase}${GROUP_SEPARATOR}${illumination}%`;
  };

  const dayMoonStateLine = (day, dayIdx) => {
    const phase = String(day?.moonPhase ?? day?.moon_phase ?? '').trim();
    const illuminationRaw = Number(day?.moonIlluminationPercentage ?? day?.moon_illumination_percentage);
    const hasIllumination = Number.isFinite(illuminationRaw);
    if (phase || hasIllumination) {
      const illumination = hasIllumination
        ? Math.max(0, Math.min(100, Math.round(illuminationRaw)))
        : null;
      return illumination === null
        ? `${MOON_ICON}${GROUP_SEPARATOR}${phase || 'Moon cycle'}`
        : `${MOON_ICON}${GROUP_SEPARATOR}${phase || 'Moon cycle'}${GROUP_SEPARATOR}${illumination}%`;
    }
    return moonStateFromSegments(moonByDay?.[dayIdx] || []);
  };

  const dayShortDate = (value, tz = scheduleTz) => {
    const date = toDate(value);
    if (!date) return '—';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        day: '2-digit',
        month: 'short',
      }).format(date);
    } catch (err) {
      return formatDate(value, tz);
    }
  };

  const pickSegmentList = (source, camelKey, snakeKey) => {
    const value = source?.[camelKey] ?? source?.[snakeKey];
    return Array.isArray(value) ? value : [];
  };

  const dayRulerName = (day) => {
    const key = String(day?.rulerKey || day?.ruler_key || '').toLowerCase();
    return PLANET_LABELS[key] || key.toUpperCase() || 'Ruler';
  };

  const dayRulerIcon = (day) => day?.rulerIcon || day?.ruler_icon || '';

  const dayRulerSegments = (day) => pickSegmentList(day, 'rulerSegments', 'ruler_segments');
  const dayAuraSegments = (day) => pickSegmentList(day, 'auraSegments', 'aura_segments');
  const cellAscSegments = (cell) => pickSegmentList(cell, 'ascSegments', 'asc_segments');
  const cellDayRulerSegments = (cell) => pickSegmentList(cell, 'dayRulerSegment', 'day_ruler_segment');

  const cellHasSigil = (cell) => Boolean(cell?.hasElementSigil ?? cell?.has_element_sigil);
  const cellSigil = (cell) => cell?.sigil || {};

  const raysShortForSign = (sign) => {
    const rays = getSignRays(sign);
    if (!rays.length) return 'Rays —';
    return `Rays ${rays.map((ray) => ROMAN[ray] || ray).join(GROUP_SEPARATOR)}`;
  };

  const dayRulerLine = (day) => {
    const planet = `${dayRulerIcon(day)} ${dayRulerName(day)}`.trim();
    return planet || '—';
  };

  const daySignRaysLine = (day) => {
    const items = positionedSegments(dayRulerSegments(day));
    if (!items.length) return '—';
    return items
      .map((segment) => `${segment.signIconSafe ? `${segment.signIconSafe} ` : ''}${segment.signLabel}${GROUP_SEPARATOR}${raysShortForSign(segment.sign || segment.signLabel)}`)
      .join(GROUP_SEPARATOR);
  };

  const buildWeeklyCacheKey = (payload) => {
    const safeMode = String(payload?.mode || mode || 'transit');
    const moment = payload?.moment || {};
    const dayKey = `${Number(moment?.year) || 0}-${pad(Number(moment?.month) || 0)}-${pad(Number(moment?.day) || 0)}`;
    const locationKey = [
      String(moment?.tz_str || ''),
      Number.isFinite(Number(moment?.lat)) ? Number(moment.lat).toFixed(4) : '0.0000',
      Number.isFinite(Number(moment?.lng)) ? Number(moment.lng).toFixed(4) : '0.0000',
    ].join('|');
    const cfg = payload?.config || {};
    const cfgKey = [
      cfg?.perspective || '',
      cfg?.zodiac_type || '',
      cfg?.sidereal_mode || '',
      cfg?.house_system || '',
      (Array.isArray(cfg?.active_points) ? [...cfg.active_points].sort().join(',') : ''),
    ].join('|');
    const birth = payload?.birth || {};
    const birthKey = [
      Number(birth?.year) || 0,
      Number(birth?.month) || 0,
      Number(birth?.day) || 0,
      Number.isFinite(Number(birth?.lat)) ? Number(birth.lat).toFixed(3) : '',
      Number.isFinite(Number(birth?.lng)) ? Number(birth.lng).toFixed(3) : '',
    ].join('|');
    return `${safeMode}|${dayKey}|${locationKey}|${cfgKey}|${birthKey}`;
  };

  const readWeeklyPersistedRoot = () => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(WEEKLY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      }
      const legacyRaw = window.localStorage.getItem(WEEKLY_LEGACY_STORAGE_KEY);
      if (!legacyRaw) return {};
      const legacyParsed = JSON.parse(legacyRaw);
      const root = legacyParsed && typeof legacyParsed === 'object' ? legacyParsed : {};
      window.localStorage.setItem(WEEKLY_STORAGE_KEY, JSON.stringify(root));
      window.localStorage.removeItem(WEEKLY_LEGACY_STORAGE_KEY);
      return root;
    } catch (err) {
      return {};
    }
  };

  const pruneEmptyObjectsDeep = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const out = {};
    Object.entries(value).forEach(([key, nested]) => {
      const cleaned = pruneEmptyObjectsDeep(nested);
      if (cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned)) {
        if (Object.keys(cleaned).length) out[key] = cleaned;
      } else if (cleaned !== undefined) {
        out[key] = cleaned;
      }
    });
    return out;
  };

  const cleanupLegacyWeeklyCacheFromV2 = () => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(WEEKLY_LEGACY_CLEANUP_FLAG) === '1') return;
      const raw = window.localStorage.getItem('astroApiState');
      if (!raw) {
        window.localStorage.setItem(WEEKLY_LEGACY_CLEANUP_FLAG, '1');
        window.localStorage.removeItem('astroApiStateV2');
        window.localStorage.removeItem('astroApiStateAdvanced');
        window.localStorage.removeItem(WEEKLY_LEGACY_STORAGE_KEY);
        return;
      }
      const parsed = JSON.parse(raw);
      const root = parsed && typeof parsed === 'object' ? parsed : {};
      const byPage = root?.byPage && typeof root.byPage === 'object' ? { ...root.byPage } : null;
      const esoteric = byPage?.esoteric && typeof byPage.esoteric === 'object' ? { ...byPage.esoteric } : null;
      const byMode = esoteric?.byMode && typeof esoteric.byMode === 'object' ? { ...esoteric.byMode } : null;
      if (!byPage || !esoteric || !byMode) {
        window.localStorage.setItem(WEEKLY_LEGACY_CLEANUP_FLAG, '1');
        return;
      }
      let changed = false;
      Object.entries(byMode).forEach(([modeKey, modeEntry]) => {
        if (!modeEntry || typeof modeEntry !== 'object') return;
        const chartEntry = modeEntry.chart;
        if (!chartEntry || typeof chartEntry !== 'object') return;
        if (!Object.prototype.hasOwnProperty.call(chartEntry, 'weeklyRayScheduleByDay')) return;
        const nextChart = { ...chartEntry };
        delete nextChart.weeklyRayScheduleByDay;
        byMode[modeKey] = { ...modeEntry, chart: nextChart };
        changed = true;
      });
      if (changed) {
        const nextRoot = {
          ...root,
          byPage: {
            ...byPage,
            esoteric: {
              ...esoteric,
              byMode: pruneEmptyObjectsDeep(byMode),
            },
          },
        };
        window.localStorage.setItem('astroApiState', JSON.stringify(nextRoot));
      }
      window.localStorage.removeItem('astroApiStateV2');
      window.localStorage.removeItem('astroApiStateAdvanced');
      window.localStorage.removeItem(WEEKLY_LEGACY_STORAGE_KEY);
      window.localStorage.setItem(WEEKLY_LEGACY_CLEANUP_FLAG, '1');
    } catch (err) {
      // ignore cleanup errors; cache migration must never block rendering
    }
  };

  cleanupLegacyWeeklyCacheFromV2();

  const writeWeeklyPersistedRoot = (root) => {
    if (typeof window === 'undefined') return false;
    try {
      window.localStorage.setItem(WEEKLY_STORAGE_KEY, JSON.stringify(root || {}));
      return true;
    } catch (err) {
      return false;
    }
  };

  const getWeeklyCacheMap = (safeMode) => {
    const root = readWeeklyPersistedRoot();
    const byMode = root?.byMode && typeof root.byMode === 'object' ? root.byMode : {};
    const modeCache = byMode?.[safeMode];
    return modeCache && typeof modeCache === 'object' ? modeCache : {};
  };

  const pruneWeeklyCacheMap = (mapObj, maxEntries = WEEKLY_CACHE_MAX_ENTRIES) =>
    Object.fromEntries(
      Object.entries(mapObj || {})
        .sort((a, b) => String(b?.[1]?.cachedAt || '').localeCompare(String(a?.[1]?.cachedAt || '')))
        .slice(0, maxEntries)
    );

  const compactScheduleForCache = (source) => {
    if (!source || typeof source !== 'object') return source;
    const rows = Array.isArray(source?.rows)
      ? source.rows.map((row) => ({
          ...row,
          cells: Array.isArray(row?.cells)
            ? row.cells.map((cell) => {
                if (!cell || typeof cell !== 'object') return cell;
                const { tooltip, ...rest } = cell;
                return rest;
              })
            : [],
        }))
      : [];
    return { ...source, rows };
  };

  const estimateJsonBytes = (value) => {
    try {
      const raw = JSON.stringify(value);
      if (typeof Blob !== 'undefined') return new Blob([raw]).size;
      return raw.length * 2;
    } catch (err) {
      return Number.POSITIVE_INFINITY;
    }
  };

  const getRuntimeSchedule = (key) => runtimeScheduleCache.get(key)?.schedule || null;

  const setRuntimeSchedule = (key, value) => {
    runtimeScheduleCache.delete(key);
    runtimeScheduleCache.set(key, { schedule: value, cachedAt: new Date().toISOString() });
    while (runtimeScheduleCache.size > WEEKLY_RUNTIME_MAX_ENTRIES) {
      const firstKey = runtimeScheduleCache.keys().next().value;
      if (!firstKey) break;
      runtimeScheduleCache.delete(firstKey);
    }
  };

  const persistWeeklyScheduleCache = ({ safeMode, cacheMap, cacheKey, sourceSchedule }) => {
    const scheduleForCache = compactScheduleForCache(sourceSchedule);
    if (estimateJsonBytes(scheduleForCache) > WEEKLY_PERSIST_MAX_BYTES) return;
    const mergedModeMap = pruneWeeklyCacheMap(
      {
        ...cacheMap,
        [cacheKey]: {
          schedule: scheduleForCache,
          cachedAt: new Date().toISOString(),
        },
      },
      WEEKLY_CACHE_MAX_ENTRIES
    );
    const root = readWeeklyPersistedRoot();
    const byMode = root?.byMode && typeof root.byMode === 'object' ? root.byMode : {};
    const nextRoot = { ...root, byMode: { ...byMode, [safeMode]: mergedModeMap } };
    if (writeWeeklyPersistedRoot(nextRoot)) return;
    // Quota fallback: keep just the latest entry for this mode.
    const latestOnly = Object.fromEntries(Object.entries(mergedModeMap).slice(0, 1));
    writeWeeklyPersistedRoot({ ...root, byMode: { ...byMode, [safeMode]: latestOnly } });
  };

  const isCurrentDay = (idx) => hasCurrentDayInWeek && idx >= 0 && idx === currentDayIndex;
  const isCurrentHourBand = (rowHour) => highlightCurrentHourBand && rowHour === currentHour;
  const isCurrentHourCell = (rowHour, dayIdx) => isCurrentDay(dayIdx) && isCurrentHourBand(rowHour);

  const hexToRgb = (value) => {
    const safe = String(value || '').trim().replace('#', '');
    if (/^[0-9a-fA-F]{3}$/.test(safe)) {
      const r = parseInt(`${safe[0]}${safe[0]}`, 16);
      const g = parseInt(`${safe[1]}${safe[1]}`, 16);
      const b = parseInt(`${safe[2]}${safe[2]}`, 16);
      return { r, g, b };
    }
    if (/^[0-9a-fA-F]{6}$/.test(safe)) {
      const r = parseInt(safe.slice(0, 2), 16);
      const g = parseInt(safe.slice(2, 4), 16);
      const b = parseInt(safe.slice(4, 6), 16);
      return { r, g, b };
    }
    return null;
  };

  const colorWithOpacity = (value, alpha = 0.35, fallback = DEFAULT_FALLBACK) => {
    const rgb = hexToRgb(value || fallback);
    if (!rgb) return `rgba(100,116,139,${alpha})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  };

  const mixHex = (a, b, ratio = 0.5) => {
    const first = hexToRgb(a || DEFAULT_FALLBACK) || hexToRgb(DEFAULT_FALLBACK);
    const second = hexToRgb(b || DEFAULT_FALLBACK) || hexToRgb(DEFAULT_FALLBACK);
    const t = Math.max(0, Math.min(1, Number(ratio)));
    const m = (x, y) => Math.round(x + (y - x) * t);
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(m(first.r, second.r))}${toHex(m(first.g, second.g))}${toHex(m(first.b, second.b))}`;
  };

  const segmentRays = (segment) => getSignRays(segment?.sign || segment?.signIcon || '');

  const segmentColor = (segment, fallback = DEFAULT_FALLBACK) => {
    const rays = segmentRays(segment);
    if (rays.length) return getRayColorHex(rays[0]);
    if (segment?.color) return segment.color;
    return fallback;
  };

  const normalizeSegmentMeta = (segment, fallback = DEFAULT_FALLBACK) => {
    const rays = segmentRays(segment);
    return {
      ...segment,
      rays,
      color: segmentColor(segment, fallback),
      signLabel: signName(segment?.sign),
      signIconSafe: signSymbol(segment?.sign) || segment?.signIcon || '',
    };
  };

  const positionedSegments = (segments, fallback = DEFAULT_FALLBACK) => {
    const normalized = (Array.isArray(segments) ? segments : []).map((segment) => normalizeSegmentMeta(segment, fallback));
    if (!normalized.length) return [];
    let weights = normalized.map((segment) => {
      const value = Number(segment?.ratio);
      return Number.isFinite(value) && value > 0 ? value : 0;
    });
    let total = weights.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      weights = normalized.map(() => 1);
      total = weights.length || 1;
    }
    let cursor = 0;
    return normalized.map((segment, idx) => {
      const width = weights[idx] / total;
      const start = cursor;
      const end = idx === normalized.length - 1 ? 1 : Math.min(1, cursor + width);
      cursor = end;
      return {
        ...segment,
        startPct: start * 100,
        endPct: end * 100,
        widthPct: (end - start) * 100,
      };
    });
  };

  const gradientFromSegments = (segments, fallback = DEFAULT_FALLBACK, alpha = 0.35) => {
    const list = positionedSegments(segments, fallback);
    if (!list.length) {
      const color = colorWithOpacity(fallback, alpha, fallback);
      return `linear-gradient(90deg, ${color}, ${color})`;
    }
    const stops = [];
    list.forEach((segment, idx) => {
      const color = colorWithOpacity(segment.color, alpha, fallback);
      if (idx === 0) stops.push(`${color} 0%`);
      if (idx > 0) {
        const prev = list[idx - 1];
        const boundary = segment.startPct;
        const gap = Math.max(0.7, Math.min(2.0, Math.min(prev.widthPct, segment.widthPct) * 0.22));
        const left = Math.max(0, boundary - gap);
        const right = Math.min(100, boundary + gap);
        const prevColor = colorWithOpacity(prev.color, alpha, fallback);
        const blend = colorWithOpacity(mixHex(prev.color, segment.color, 0.5), alpha, fallback);
        stops.push(`${prevColor} ${left.toFixed(2)}%`);
        stops.push(`${blend} ${boundary.toFixed(2)}%`);
        stops.push(`${color} ${right.toFixed(2)}%`);
      }
      stops.push(`${color} ${segment.endPct.toFixed(2)}%`);
    });
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  };

  const intersectByDay = (segments, day) => {
    const start = toDate(day?.start || day?.date);
    const end = toDate(day?.end);
    if (!start || !end || start >= end) return [];
    const total = end.getTime() - start.getTime();
    const out = [];
    (Array.isArray(segments) ? segments : []).forEach((segment) => {
      const segStart = toDate(segment?.start);
      const segEnd = toDate(segment?.end);
      if (!segStart || !segEnd) return;
      const overlapStart = new Date(Math.max(start.getTime(), segStart.getTime()));
      const overlapEnd = new Date(Math.min(end.getTime(), segEnd.getTime()));
      if (overlapStart >= overlapEnd) return;
      const ratio = (overlapEnd.getTime() - overlapStart.getTime()) / total;
      out.push({ ...segment, start: overlapStart.toISOString(), end: overlapEnd.toISOString(), ratio });
    });
    return out;
  };

  const rayLabel = (rays) => {
    const list = (Array.isArray(rays) ? rays : []).filter((ray) => Number.isFinite(Number(ray))).map(Number);
    if (!list.length) return 'Ray —';
    if (list.length === 1) return `Ray ${ROMAN[list[0]] || list[0]}`;
    return `Ray ${list.map((ray) => ROMAN[ray] || ray).join(GROUP_SEPARATOR)}`;
  };

  const segmentSummary = (segments) => {
    const list = positionedSegments(segments);
    if (!list.length) return '—';
    return list.map((segment) => `${segment.signIconSafe} ${segment.signLabel}`.trim()).join(GROUP_SEPARATOR);
  };

  const daySignDetails = (day) => {
    const list = positionedSegments(dayRulerSegments(day));
    if (!list.length) return '—';
    return list
      .map((segment) => `${segment.signIconSafe} ${segment.signLabel} · ${rayLabel(segment.rays)}`.trim())
      .join(GROUP_SEPARATOR);
  };

  const tooltipComponentLine = (label, component) => {
    if (!component) return '';
    const rays = getSignRays(component?.sign || component?.signIcon || '');
    const rayText = rayLabel(rays);
    const rayNames = rays.map((ray) => getRayColorName(ray)).join(GROUP_SEPARATOR);
    const rayExtra = rayNames ? ` · ${rayNames}` : '';
    return `${label}: ${(component.signIcon || signSymbol(component.sign) || '')} ${signName(component.sign)} · ${rayText}${rayExtra}`;
  };

  const tooltipText = (cell, day) => {
    const lines = [];
    lines.push(`${day?.weekday || 'Day'} ${formatDate(day?.date)} · ${formatTime(cell?.start)}${GROUP_SEPARATOR}${formatTime(cell?.end)}`);

    const sunLine = tooltipComponentLine('Sun', cell?.sunComponent);
    if (sunLine) lines.push(sunLine);
    const moonLine = tooltipComponentLine('Moon', cell?.moonComponent);
    if (moonLine) lines.push(moonLine);

    const daySegments = positionedSegments(cellDayRulerSegments(cell));
    if (daySegments.length) {
      lines.push(
        `Day Ruler ${dayRulerIcon(day)}: ${daySegments
          .map(
            (segment) =>
              `${segment.signIconSafe} ${segment.signLabel} · ${rayLabel(segment.rays)} (${formatTime(segment.start)}${GROUP_SEPARATOR}${formatTime(segment.end)})`
          )
          .join(GROUP_SEPARATOR)}`
      );
    }

    const ascSegments = positionedSegments(cellAscSegments(cell));
    if (ascSegments.length) {
      lines.push(
        `Asc: ${ascSegments
          .map(
            (segment) =>
              `${segment.signIconSafe} ${segment.signLabel} · ${rayLabel(segment.rays)} (${formatTime(segment.start)}${GROUP_SEPARATOR}${formatTime(segment.end)})`
          )
          .join(GROUP_SEPARATOR)}`
      );
    }
    return lines.join('\n');
  };

  const firstSegmentColor = (segments, fallback = DEFAULT_FALLBACK) => {
    const first = positionedSegments(segments, fallback)[0];
    return first?.color || fallback;
  };

  const cellGlowDay = (cell) => colorWithOpacity(firstSegmentColor(cellDayRulerSegments(cell), DEFAULT_FALLBACK), 0.86);
  const dayGlowMoon = (dayIdx) => colorWithOpacity(firstSegmentColor(moonByDay?.[dayIdx] || [], DEFAULT_FALLBACK), 0.82);
  const gridGlowSun = () => colorWithOpacity(firstSegmentColor(sunSegments || [], DEFAULT_FALLBACK), 0.84);

  const cellSignText = (cell) => segmentSummary(cellAscSegments(cell));
  const cellRayText = (cell) => {
    const groups = positionedSegments(cellAscSegments(cell)).map((segment) => rayLabel(segment.rays));
    if (!groups.length) return 'Ray —';
    if (groups.length === 1) return groups[0];
    return groups.map((group) => `(${group})`).join(GROUP_SEPARATOR);
  };

  const setDefaultWindow = () => {
    hourWindow = {
      start: Number.isFinite(Number(schedule?.week?.defaultWindowStart)) ? Number(schedule.week.defaultWindowStart) : 6,
      end: Number.isFinite(Number(schedule?.week?.defaultWindowEnd)) ? Number(schedule.week.defaultWindowEnd) : 20,
    };
    fullDay = false;
  };

  $: selectedDayIndex = days.findIndex((day) => dateKeyInTz(day?.date, scheduleTz) === selectedTransitDateKey($inputStore?.transit));

  async function scrollToCurrentDayIfNeeded() {
    if (!gridWrapEl) return;
    const focusDay = selectedDayIndex >= 0 ? selectedDayIndex : currentDayIndex;
    if (focusDay < 4) return;
    await tick();
    const target = gridWrapEl.querySelector(`[data-day-head='${focusDay}']`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  const toggleWindow = () => {
    if (!schedule?.rows?.length) return;
    if (fullDay) {
      setDefaultWindow();
      return;
    }
    fullDay = true;
    hourWindow = { start: 0, end: 24 };
  };

  async function loadSchedule(force = false) {
    if (!supported || !chartReady || collapsed) return;
    loading = true;
    errorMessage = '';
    try {
      const state = get(inputStore);
      const cfg = get(configStore);
      const payload = buildWeeklyRaySchedulePayload(mode, state, cfg);
      const safeMode = String(mode || payload?.mode || 'transit');
      const cacheKey = buildWeeklyCacheKey(payload);
      const runtimeKey = `${safeMode}|${cacheKey}`;
      const runtimeCached = !force ? getRuntimeSchedule(runtimeKey) : null;
      const cacheMap = getWeeklyCacheMap(safeMode);
      const cachedEntry = cacheMap?.[cacheKey];
      if (runtimeCached) {
        schedule = runtimeCached;
      } else if (!force && cachedEntry?.schedule) {
        schedule = cachedEntry.schedule;
        setRuntimeSchedule(runtimeKey, schedule);
      } else {
        schedule = await requestWeeklyRaySchedule(payload);
        setRuntimeSchedule(runtimeKey, schedule);
        persistWeeklyScheduleCache({ safeMode, cacheMap, cacheKey, sourceSchedule: schedule });
      }
      setDefaultWindow();
      await scrollToCurrentDayIfNeeded();
    } catch (err) {
      errorMessage = err?.message || 'Failed to load weekly schedule.';
    } finally {
      loading = false;
    }
  }

  async function togglePanel() {
    if (!supported) return;
    if (!chartReady && collapsed) return;
    collapsed = !collapsed;
    if (collapsed) {
      zoomed = false;
      return;
    }
    if (!collapsed) {
      if (!schedule) {
        await loadSchedule();
      } else {
        await scrollToCurrentDayIfNeeded();
      }
    }
  }

  async function downloadPdf() {
    if (!supported || !chartReady || !schedule) return;
    pdfLoading = true;
    errorMessage = '';
    try {
      const state = get(inputStore);
      const cfg = get(configStore);
      const payload = buildWeeklyRaySchedulePdfPayload(mode, state, cfg, hourWindow);
      const blob = await requestWeeklyRaySchedulePdf(payload);
      downloadBlob(blob, `weekly-ray-schedule-${mode}.pdf`);
    } catch (err) {
      errorMessage = err?.message || 'Failed to download weekly schedule PDF.';
    } finally {
      pdfLoading = false;
    }
  }

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('weekly-zoom-open');
    }
  });

  $: if (supported && chartReady && resultKey !== lastResultKey) {
    lastResultKey = resultKey;
    if (!collapsed) {
      loadSchedule();
    }
  }
</script>

<div class="flowbite-card space-y-4 weekly-card-root" id="esoteric-weekly-ray-schedule-card">
  <div class="card-head card-head-inline weekly-card-head" id="weekly-card-head">
    <div class="weekly-title-block" id="weekly-title-block">
      <p class="text-sm text-cyan-200/80 font-semibold weekly-title-kicker" id="weekly-title-kicker">Weekly Rays</p>
      <h2 class="weekly-title-main" id="weekly-title-main">Schedule Matrix</h2>
    </div>
    <div class="card-head-actions weekly-head-actions" id="weekly-head-actions">
      {#if supported}
        <button
          type="button"
          class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-slate-200 hover:border-cyan-400 hover:text-white transition weekly-toggle-button"
          id="weekly-toggle-button"
          on:click={togglePanel}
          aria-expanded={!collapsed}
          aria-controls="eso-weekly-schedule-panel"
          aria-label={collapsed ? 'Expand weekly schedule panel' : 'Collapse weekly schedule panel'}
        >
          <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d={collapsed ? 'M6 9l6 6 6-6' : 'M18 15l-6-6-6 6'} />
          </svg>
        </button>
      {:else}
        <span class="badge">Transit only</span>
      {/if}
    </div>
  </div>

  {#if !supported}
    <p class="text-sm text-slate-400 weekly-state-text" id="weekly-state-text-unsupported">Weekly ray schedule is available in transit and dual modes only.</p>
  {:else if !chartReady}
    <p class="text-sm text-slate-400 weekly-state-text" id="weekly-state-text-no-chart">Generate a chart first to use the weekly schedule.</p>
  {:else if errorMessage}
    <p class="text-sm text-rose-300 weekly-state-text" id="weekly-state-text-error">{errorMessage}</p>
  {:else if loading}
    <p class="text-sm text-slate-300 weekly-state-text" id="weekly-state-text-loading">Loading weekly schedule…</p>
  {:else if collapsed}
    <!-- collapsed: no standalone status text -->
  {:else if schedule}
    <div
      id="eso-weekly-schedule-panel"
      class="weekly-shell"
      class:is-zoomed={zoomed}
      on:dblclick={() => zoomed && (zoomed = false)}
      role="dialog"
      aria-modal={zoomed ? 'true' : 'false'}
      tabindex="-1"
      use:portal={zoomed}
    >
      <p
        class="text-xs weekly-title-subtitle"
        class:text-amber-300={timeStatus?.kind === 'warning' || preloadStatus?.kind === 'warning'}
        class:text-slate-400={timeStatus?.kind !== 'warning' && preloadStatus?.kind !== 'warning'}
        id="weekly-title-subtitle"
      >
        {titleSubtitle}
      </p>
      <div class="weekly-panel-tools" id="weekly-panel-tools">
        <span class="badge weekly-window-badge" id="weekly-window-badge">{formatHourWindow(hourWindow.start, hourWindow.end)}</span>
        <div class="weekly-panel-actions" id="weekly-panel-actions">
          <button class="button-ghost weekly-action-button" id="weekly-action-toggle-window" type="button" on:click={toggleWindow} disabled={loading || !schedule}>
            {fullDay ? 'Default window' : 'Full day'}
          </button>
          <button class="button-ghost weekly-action-button" id="weekly-action-refresh" type="button" on:click={() => loadSchedule(true)} disabled={loading || !chartReady}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            class="button-ghost weekly-action-button"
            id="weekly-action-zoom"
            type="button"
            on:click={() => (zoomed = !zoomed)}
            disabled={!schedule}
          >
            {zoomed ? 'Exit zoom' : 'Zoom'}
          </button>
          <button class="button-ghost weekly-action-button" id="weekly-action-pdf" type="button" on:click={downloadPdf} disabled={pdfLoading || !schedule}>
            {pdfLoading ? 'Preparing…' : 'PDF'}
          </button>
        </div>
      </div>
      <div class="weekly-grid-wrap" id="weekly-grid-wrap" bind:this={gridWrapEl} style={`--glow-sun:${gridGlowSun()}`}>
        <div class="weekly-grid" id="weekly-grid">
          <div class="weekly-axis sun-axis weekly-axis-sun" id="weekly-axis-sun">Sun</div>
          <div class="weekly-band weekly-band-wide weekly-band-sun-wide" id="weekly-band-sun-wide" style={`--band:${gradientFromSegments(sunSegments, '#334155', 0.35)}`}>
            <div class="weekly-band-meta" id="weekly-band-meta-sun">
              <p class="weekly-band-line weekly-band-line-1" id="weekly-band-sun-line-1">Week #{sunWeekNumber ?? '—'}</p>
              <p class="weekly-band-line weekly-band-line-2" id="weekly-band-sun-line-2">{sunMonthLine}</p>
              <p class="weekly-band-line weekly-band-line-3" id="weekly-band-sun-line-3">{sunSignsHeaderLine}</p>
            </div>
            {#if sunPositionedSegments.length > 1}
              {#each sunPositionedSegments.slice(1) as split}
                <span class="weekly-band-split weekly-band-split-sun" style={`left:${split.startPct}%`}>↔</span>
              {/each}
            {/if}
          </div>

          <div class="weekly-axis moon-axis weekly-axis-moon" id="weekly-axis-moon">Moon</div>
          <div
            class="weekly-band weekly-band-wide weekly-band-moon weekly-band-row-moon"
            id="weekly-band-moon-wide"
            style={`--band:${gradientFromSegments(moonSegments, '#334155', 0.35)}; --sun-glow:${colorWithOpacity(firstSegmentColor(sunSegments || []), 0.26)};`}
          >
            <div class="weekly-band-meta" id="weekly-band-meta-moon">
              <p class="weekly-band-line weekly-band-line-2" id="weekly-band-moon-line-2">{moonSignsHeaderLine}</p>
            </div>
            {#if moonPositionedSegments.length > 1}
              {#each moonPositionedSegments.slice(1) as split}
                <span class="weekly-band-split weekly-band-split-moon" style={`left:${split.startPct}%`}>↔</span>
              {/each}
            {/if}
          </div>

          <div class="weekly-separator-axis weekly-separator-axis-top"></div>
          {#each days as day, dayIdx}
            <div
              class="weekly-separator weekly-separator-top"
              class:current-day={isCurrentDay(dayIdx)}
              data-day-index={dayIdx}
              style={`--glow-moon:${dayGlowMoon(dayIdx)}`}
            ></div>
          {/each}

          <div class="weekly-axis weekly-axis-hour" id="weekly-axis-hour"> · </div>
          {#each days as day, dayIdx}
            <div
              class="weekly-day-head"
              id={`weekly-day-head-${dayIdx}`}
              data-day-head={dayIdx}
              class:current-day={isCurrentDay(dayIdx)}
              style={`--aura:${gradientFromSegments(dayAuraSegments(day), '#334155', 0.35)}; --glow-moon:${dayGlowMoon(dayIdx)}`}
              title={`Day aura · ${daySignDetails(day)}`}
            >
              <p class="weekly-day-ruler">{dayRulerLine(day)}</p>
              <p class="weekly-day-sign">{daySignRaysLine(day)}</p>
              <p class="weekly-day-date">{dayShortDate(day.date)} · {day.weekday}</p>
              <p class="weekly-day-moon">{dayMoonStateLine(day, dayIdx)}</p>
            </div>
          {/each}

          <div class="weekly-separator-axis weekly-separator-axis-after-day"></div>
          {#each days as _day, dayIdx}
            <div
              class="weekly-separator weekly-separator-after-day"
              class:current-day={isCurrentDay(dayIdx)}
              data-day-index={dayIdx}
              style={`--glow-moon:${dayGlowMoon(dayIdx)}`}
            ></div>
          {/each}

          {#each visibleRows as row}
            <div class="weekly-hour" id={`weekly-hour-${row.hour}`} class:current-hour-row={isCurrentHourBand(row.hour)}>{row.label}</div>
            {#each row.cells as cell, dayIdx}
              {@const day = days[dayIdx]}
              <div
                class="weekly-cell"
                id={`weekly-cell-${row.hour}-${dayIdx}`}
                data-hour={row.hour}
                data-day-index={dayIdx}
                class:current-day-soft={isCurrentDay(dayIdx)}
                class:current-hour-soft={isCurrentHourBand(row.hour)}
                class:current-hour={isCurrentHourCell(row.hour, dayIdx)}
                style={`--asc:${gradientFromSegments(cellAscSegments(cell), '#1e293b', 0.35)}; --glow-day:${cellGlowDay(cell)};`}
                title={tooltipText(cell, day)}
              >
                {#if cellHasSigil(cell)}
                  <div class="weekly-cell-sigil">
                    <ElementSigil sigil={cellSigil(cell)} compact={true} size={24} />
                  </div>
                {/if}
                <div class="weekly-cell-main">
                  <p class="weekly-cell-sign">{cellSignText(cell)}</p>
                  <p class="weekly-cell-rays">{cellRayText(cell)}</p>
                </div>
              </div>
            {/each}
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <p class="text-sm text-slate-400">No weekly schedule data available.</p>
  {/if}
</div>

<style>
  :global(body.weekly-zoom-open) {
    overflow: hidden;
  }

  .weekly-head-actions {
    margin-left: auto;
    justify-content: flex-end;
  }

  .weekly-shell {
    display: grid;
    gap: 0.9rem;
  }

  .weekly-panel-tools {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    flex-wrap: wrap;
  }

  .weekly-panel-actions {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    flex-wrap: wrap;
  }

  .weekly-shell.is-zoomed {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    z-index: 1400;
    background: linear-gradient(180deg, rgba(2, 6, 23, 0.95), rgba(2, 6, 23, 0.88));
    border: 1px solid rgba(71, 85, 105, 0.7);
    border-radius: 0;
    padding: 16px;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(2, 6, 23, 0.62);
  }

  .weekly-shell.is-zoomed .weekly-grid-wrap {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
  }

  .weekly-grid-wrap {
    position: relative;
    isolation: isolate;
    overflow-x: auto;
    border-radius: 16px;
    padding: 12px;
    border: 1px solid rgba(51, 65, 85, 0.55);
    background: transparent;
  }

  .weekly-grid-wrap::before {
    content: '';
    position: absolute;
    inset: -22px;
    pointer-events: none;
    background:
      radial-gradient(88% 48% at 50% -10%, var(--glow-sun), transparent 68%),
      radial-gradient(92% 52% at 50% 110%, var(--glow-sun), transparent 72%);
    filter: blur(14px);
    z-index: 0;
  }

  .weekly-grid {
    position: relative;
    z-index: 1;
    min-width: 1020px;
    display: grid;
    grid-template-columns: 72px repeat(7, minmax(128px, 1fr));
    gap: 10px;
  }

  .weekly-axis {
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.78);
    border: 1px solid rgba(100, 116, 139, 0.4);
    color: #cbd5e1;
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'IBM Plex Sans', 'Trebuchet MS', sans-serif;
    font-weight: 700;
    min-height: 50px;
  }

  .sun-axis {
    color: #fbbf24;
  }

  .moon-axis {
    color: #93c5fd;
  }

  .weekly-axis-hour {
    color: #5eead4;
  }

  .weekly-band {
    position: relative;
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.34);
    min-height: 50px;
    background: var(--band);
    overflow: hidden;
  }

  .weekly-band-wide {
    grid-column: 2 / span 7;
    min-height: 58px;
  }

  .weekly-band-sun-wide {
    min-height: 64px;
  }

  .weekly-band-meta {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 0.1rem;
    padding: 0.22rem 0.4rem;
    pointer-events: none;
  }

  .weekly-band-line {
    margin: 0;
    color: #f8fafc;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
    font-family: 'IBM Plex Sans', 'Trebuchet MS', sans-serif;
    font-weight: 700;
    text-align: center;
    line-height: 1.15;
  }

  .weekly-band-line-1 {
    font-size: 0.74rem;
    letter-spacing: 0.03em;
  }

  .weekly-band-line-2 {
    font-size: 0.7rem;
  }

  .weekly-band-line-3 {
    font-size: 0.68rem;
  }

  .weekly-band-moon {
    box-shadow: inset 0 0 24px var(--sun-glow);
  }

  .weekly-band-split {
    position: absolute;
    top: 4px;
    transform: translateX(-50%);
    color: rgba(248, 250, 252, 0.92);
    font-size: 0.62rem;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.75);
    pointer-events: none;
  }

  .weekly-separator-axis {
    min-height: 6px;
    border-radius: 6px;
    background: rgba(148, 163, 184, 0.22);
  }

  .weekly-separator {
    min-height: 6px;
    border-radius: 6px;
    background: rgba(148, 163, 184, 0.22);
    box-shadow: 0 0 16px var(--glow-moon);
  }

  .weekly-separator-after-day {
    background: rgba(148, 163, 184, 0.28);
  }

  .weekly-day-head {
    border-radius: 13px;
    min-height: 116px;
    background: var(--aura);
    border: 1px solid rgba(148, 163, 184, 0.35);
    color: #f8fafc;
    padding: 0.45rem 0.52rem;
    display: grid;
    align-content: center;
    gap: 0.18rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
    font-family: 'IBM Plex Sans', 'Trebuchet MS', sans-serif;
    overflow-wrap: anywhere;
    box-shadow: 0 0 18px var(--glow-moon);
  }

  .weekly-day-date {
    margin: 0;
    font-size: 0.68rem;
    color: rgba(241, 245, 249, 0.95);
    letter-spacing: 0.04em;
  }

  .weekly-day-ruler {
    margin: 0;
    font-size: 0.67rem;
    color: rgba(248, 250, 252, 0.97);
    line-height: 1.18;
    font-weight: 700;
  }

  .weekly-day-sign {
    margin: 0;
    font-size: 0.64rem;
    color: rgba(248, 250, 252, 0.96);
    line-height: 1.17;
    font-weight: 600;
  }

  .weekly-day-moon {
    margin: 0;
    font-size: 0.62rem;
    color: rgba(226, 232, 240, 0.95);
    line-height: 1.16;
    font-weight: 600;
  }

  .weekly-hour {
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.84);
    border: 1px solid rgba(100, 116, 139, 0.42);
    color: #e2e8f0;
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 74px;
    font-family: 'IBM Plex Sans', 'Trebuchet MS', sans-serif;
  }

  .weekly-cell {
    position: relative;
    border-radius: 13px;
    min-height: 74px;
    background: var(--asc);
    border: 1px solid rgba(148, 163, 184, 0.32);
    padding: 0.45rem 0.6rem 0.5rem;
    display: grid;
    align-items: center;
    justify-items: center;
    overflow: hidden;
    box-shadow:
      inset 0 0 1px rgba(248, 250, 252, 0.24),
      0 0 14px var(--glow-day),
      0 12px 28px rgba(2, 6, 23, 0.46);
  }

  .weekly-cell-main {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 0.16rem;
    justify-items: center;
    text-align: center;
    width: 100%;
  }

  .weekly-cell-sign {
    margin: 0;
    color: #f8fafc;
    font-size: 0.74rem;
    font-weight: 800;
    line-height: 1.22;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.62);
    font-family: 'IBM Plex Sans', 'Trebuchet MS', sans-serif;
  }

  .weekly-cell-rays {
    margin: 0;
    color: #e2e8f0;
    font-size: 0.7rem;
    line-height: 1.2;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.62);
    font-family: 'IBM Plex Sans', 'Trebuchet MS', sans-serif;
  }

  .weekly-cell-sigil {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    background: rgba(2, 6, 23, 0.58);
    border: 1px solid rgba(226, 232, 240, 0.35);
  }

  .current-day {
    border-color: rgba(250, 204, 21, 0.9) !important;
    box-shadow: 0 0 0 1px rgba(250, 204, 21, 0.75), inset 0 0 24px rgba(250, 204, 21, 0.18);
  }

  .current-hour-row {
    border-color: rgba(125, 211, 252, 0.85);
    box-shadow: 0 0 0 1px rgba(125, 211, 252, 0.75), inset 0 0 18px rgba(250, 204, 21, 0.14);
  }

  .current-day-soft {
    outline: 1px solid rgba(250, 204, 21, 0.72);
    outline-offset: -2px;
  }

  .current-hour-soft {
    border-color: rgba(125, 211, 252, 0.78);
  }

  .current-hour {
    border-color: rgba(125, 211, 252, 0.94);
    outline: 2px solid rgba(125, 211, 252, 0.94);
    outline-offset: -2px;
  }

  @media (max-width: 920px) {
    .weekly-grid {
      min-width: 880px;
      grid-template-columns: 66px repeat(7, minmax(116px, 1fr));
      gap: 8px;
    }

    .weekly-cell,
    .weekly-hour {
      min-height: 70px;
    }

    .weekly-panel-tools {
      align-items: flex-start;
    }

    .weekly-shell.is-zoomed {
      inset: 0;
      padding: 8px;
    }
  }
</style>
