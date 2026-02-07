import { computeDecan } from '$lib/astro/advanced';
import { getRayColorHex, getSignRays, RAYS } from '$lib/astro/rays';
import { aspectMultiplier, buildAspectIdentifier } from '$lib/astro/aspects';
import { DAY_RULERS, POINT_SYMBOLS, signName, signSymbol } from '$lib/astro/signs';
import { getPointRays, hasPointRayMapping, normalizePointKey } from '$lib/astro/pointRays';
import { EsotericRaySpectrumTooltipBuilder } from '$lib/astro/esotericRaySpectrumTooltipBuilder';
import { getDecanKeyForState } from '$lib/astro/esotericMeta';

const MIN_CHANNEL_FRACTION = 0.01;
const MIN_GROUP_VALUE = 0.01;
const ROOT_TONE = {
  rays: [4, 5],
  weight: 0.1,
};

const DEFAULT_ORB_WEIGHTS = {
  tight: 1,
  close: 0.75,
  wide: 0.5,
  loose: 0.3  ,
  distant: 0.1,
};

const MULTIPLIER_CLAMP = {
  min: 0.1,
  max: 2,
};

const normalizeOrbValue = (orb) => {
  if (orb == null) return Number.NaN;
  if (typeof orb === 'object') {
    const candidate =
      orb.value ??
      orb.deg ??
      orb.degree ??
      orb.orb ??
      orb.orbit ??
      orb.diff;
    return normalizeOrbValue(candidate);
  }
  if (typeof orb === 'string') {
    const parsed = Number.parseFloat(orb);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.isFinite(orb) ? Number(orb) : Number.NaN;
};

// Ray spectrum algorithm (per point):
// 1) Collect sign rays -> s1_signRayCounts (weight 1 each).
// 2) Collect point rays -> s2_pointRayCounts (weight overtoneCoeff each; 0 if disabled).
// 3) Combine -> s3_combinedRayCounts = s1_signRayCounts + s2_pointRayCounts.
// 4) Normalize -> s4_channelPercentages (percent per ray) from s3_combinedRayCounts.
// 5) Apply point identity multipliers (day ruler, sun, ascendant) -> s5_pointIdentityWeightedRays.
// 6) Apply aspect multiplier (orb + aspect type) -> s6_aspectWeightedRays (final per-ray weights).
export class EsotericRaySpectrumUtils {
  static RAYS = RAYS;
  static MIN_CHANNEL_FRACTION = MIN_CHANNEL_FRACTION;
  static MIN_GROUP_VALUE = MIN_GROUP_VALUE;
  static ROOT_TONE = ROOT_TONE;
  static DEFAULT_ORB_WEIGHTS = DEFAULT_ORB_WEIGHTS;
  static MULTIPLIER_CLAMP = MULTIPLIER_CLAMP;

  static resolveSignLabel(point) {
    return signName(point?.sign || point?.sign_name || point?.sign_label || point?.sign_symbol || point?.sign_abbrev);
  }

  static resolveSignSymbol(point) {
    return signSymbol(point?.sign_symbol || point?.sign || point?.sign_label || point?.sign_abbrev);
  }

  static resolveDecan(point) {
    const raw =
      point?.position ??
      point?.orb ??
      (Number.isFinite(point?.abs_pos) ? point.abs_pos % 30 : null) ??
      (Number.isFinite(point?.absPos) ? point.absPos % 30 : null);
    if (!Number.isFinite(Number(raw))) return null;
    const normalized = Number(raw) > 30 ? Number(raw) % 30 : Number(raw);
    return computeDecan(normalized);
  }

  static parseSubjectParts(subject) {
    if (!subject || typeof subject !== 'object') return null;
    let { year, month, day, hour, minute } = subject;
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      const iso = subject.iso_formatted_local_datetime || subject.iso_formatted_utc_datetime;
      const parsed = iso ? new Date(iso) : null;
      if (parsed && !Number.isNaN(parsed.getTime())) {
        year = parsed.getUTCFullYear();
        month = parsed.getUTCMonth() + 1;
        day = parsed.getUTCDate();
        hour = parsed.getUTCHours();
        minute = parsed.getUTCMinutes();
      }
    }
    if (![year, month, day].every((v) => Number.isFinite(v))) return null;
    return { year, month, day, hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 };
  }

  static getDayRulerKey(subject) {
    const parts = EsotericRaySpectrumUtils.parseSubjectParts(subject);
    if (!parts) return '';
    const date = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    return DAY_RULERS[date.getDay()] || '';
  }

  static aspectToMultiplier(name) {
    return aspectMultiplier(name);
  }

  static getOrbMultiplier(orb, weights = DEFAULT_ORB_WEIGHTS) {
    const value = normalizeOrbValue(orb);
    if (!Number.isFinite(value)) return 1;
    const abs = Math.abs(value);
    const merged = { ...DEFAULT_ORB_WEIGHTS, ...weights };
    if (abs < 1) return merged.tight;
    if (abs < 3) return merged.close;
    if (abs < 5) return merged.wide;
    if (abs < 10) return merged.loose;
    return merged.distant;
  }

  static buildAspectIndex(aspects, orbWeights = DEFAULT_ORB_WEIGHTS) {
    const map = new Map();
    (aspects || []).forEach((entry) => {
      const leftOwner = entry?.leftOwner || '1';
      const rightOwner = entry?.rightOwner || '1';
      const leftBase = normalizePointKey(entry?.leftRef || entry?.left);
      const rightBase = normalizePointKey(entry?.rightRef || entry?.right);
      if (!leftBase || !rightBase) return;
      const left = `${leftOwner}:${leftBase}`;
      const right = `${rightOwner}:${rightBase}`;
      const orb =
        entry?.orb ??
        entry?.orb_value ??
        entry?.orb_value_deg ??
        entry?.orbit ??
        entry?.diff;
      const orbValue = normalizeOrbValue(orb);
      const aspectName = entry?.name || entry?.aspect;
      const typeMultiplier = EsotericRaySpectrumUtils.aspectToMultiplier(aspectName);
      const orbMultiplier = EsotericRaySpectrumUtils.getOrbMultiplier(orbValue, orbWeights);
      const orbStrength = Math.max(0, Math.min(1, orbMultiplier));
      const multiplier =
        typeMultiplier >= 1
          ? 1 + (typeMultiplier - 1) * orbStrength
          : 1 - (1 - typeMultiplier) * orbStrength;
      if (!multiplier || multiplier === 1) return;
      const identifier = buildAspectIdentifier({
        leftIcon: POINT_SYMBOLS[leftBase] || '*',
        rightIcon: POINT_SYMBOLS[rightBase] || '*',
        aspectName,
      });
      const sample = {
        identifier,
        orb: Number.isFinite(orbValue) ? orbValue : orb,
        typeMultiplier,
        orbMultiplier,
        multiplier,
      };
      if (!map.has(left)) map.set(left, []);
      if (!map.has(right)) map.set(right, []);
      map.get(left).push(sample);
      map.get(right).push(sample);
    });
    return map;
  }

  static getMultiplier(key, aspectIndex, clamp = MULTIPLIER_CLAMP) {
    const aspectEntries = aspectIndex?.get(key) || [];
    if (!aspectEntries.length) return { value: 1, pos: 0, neg: 0, raw: [] };
    const totalMultiplier = aspectEntries.reduce((acc, entry) => acc + (entry?.multiplier ?? entry), 0);
    const averageMultiplier = totalMultiplier / aspectEntries.length;
    const minClamp = clamp?.min ?? MULTIPLIER_CLAMP.min;
    const maxClamp = clamp?.max ?? MULTIPLIER_CLAMP.max;
    const clampedMultiplier = Math.max(minClamp, Math.min(maxClamp, averageMultiplier));
    const positiveCount = aspectEntries.filter((entry) => (entry?.multiplier ?? entry) > 1).length;
    const negativeCount = aspectEntries.filter((entry) => (entry?.multiplier ?? entry) < 1).length;
    return { value: clampedMultiplier, pos: positiveCount, neg: negativeCount, raw: aspectEntries };
  }

  static buildRayCounts(rays, weight = 1) {
    const counts = {};
    RAYS.forEach((ray) => {
      counts[ray] = 0;
    });
    (rays || []).forEach((ray) => {
      if (counts[ray] !== undefined) counts[ray] += weight;
    });
    return counts;
  }

  static normaliseCounts(counts) {
    const total = RAYS.reduce((acc, ray) => acc + (counts[ray] || 0), 0);
    if (!total) return { total: 0, channelPercentages: {} };
    const channelPercentages = {};
    RAYS.forEach((ray) => {
      channelPercentages[ray] = (counts[ray] || 0) / total;
    });
    return { total, channelPercentages };
  }

  static computePointEntry({
    key,
    point,
    ownerKey,
    ownerLabel,
    isMultiMode,
    state,
    dayRulerKey,
    dayRulerWeight,
    sunPointWeight,
    moonPointWeight,
    ascendantPointWeight,
    overtoneCoeff,
    enablePointRays = true,
    aspectIndex,
  }) {
    const baseKey = normalizePointKey(key);
    const normalizedKey = `${ownerKey}:${baseKey}`;
    const dayRulerMultiplier = dayRulerKey && dayRulerKey === baseKey ? dayRulerWeight : 1;
    const sunMultiplier = baseKey === 'sun' ? sunPointWeight : 1;
    const moonMultiplier = baseKey === 'moon' ? moonPointWeight : 1;
    const ascendantMultiplier = baseKey === 'ascendant' ? ascendantPointWeight : 1;
    const decan = EsotericRaySpectrumUtils.resolveDecan(point);
    if (state !== 'personality') {
      const stateDecan = getDecanKeyForState(state);
      if (!decan || Number(stateDecan) !== decan) return null;
    }
    const signLabel = EsotericRaySpectrumUtils.resolveSignLabel(point);
    const signSymbol = EsotericRaySpectrumUtils.resolveSignSymbol(point);
    const signRays = getSignRays(signLabel);
    const pointRays = enablePointRays ? getPointRays(baseKey) : [];
    const s1_signRayCounts = EsotericRaySpectrumUtils.buildRayCounts(signRays, 1);
    const s2_pointRayCounts = EsotericRaySpectrumUtils.buildRayCounts(pointRays, enablePointRays ? overtoneCoeff : 0);
    const s3_combinedRayCounts = {};
    RAYS.forEach((ray) => {
      s3_combinedRayCounts[ray] = (s1_signRayCounts[ray] || 0) + (s2_pointRayCounts[ray] || 0);
    });
    const { total, channelPercentages: s4_channelPercentages } = EsotericRaySpectrumUtils.normaliseCounts(s3_combinedRayCounts);
    const { value: aspectMultiplier, pos, neg, raw: aspectMultiplierList } =
      EsotericRaySpectrumUtils.getMultiplier(normalizedKey, aspectIndex);
    const s5_pointIdentityWeightedRays = {};
    RAYS.forEach((ray) => {
      s5_pointIdentityWeightedRays[ray] =
        (s3_combinedRayCounts[ray] || 0) * dayRulerMultiplier * sunMultiplier * moonMultiplier * ascendantMultiplier;
    });
    const s6_aspectWeightedRays = {};
    RAYS.forEach((ray) => {
      s6_aspectWeightedRays[ray] = (s5_pointIdentityWeightedRays[ray] || 0) * aspectMultiplier;
    });
    const weightSum = RAYS.reduce((acc, ray) => acc + (s6_aspectWeightedRays[ray] || 0), 0);
    return {
      key: normalizedKey,
      label: isMultiMode ? `${point?.name || point?.label || key} (${ownerLabel})` : point?.name || point?.label || key,
      symbol: POINT_SYMBOLS[baseKey] || point?.emoji || '✦',
      signLabel: signLabel || '--',
      signSymbol: signSymbol || '',
      signRays,
      pointRays,
      channelPercentages: s4_channelPercentages,
      weighted: s6_aspectWeightedRays,
      weight: weightSum,
      layers: {
        s1_signRayCounts,
        s2_pointRayCounts,
        s3_combinedRayCounts,
        s4_channelPercentages,
        s5_pointIdentityWeightedRays,
        aspectMultiplier,
        aspectMultiplierList,
      },
      multiplier: aspectMultiplier,
      dayRulerMultiplier,
      sunMultiplier,
      moonMultiplier,
      ascendantMultiplier,
      aspectPos: pos,
      aspectNeg: neg,
      hasPointRayMapping: hasPointRayMapping(baseKey),
    };
  }

  static applyRootTone(totals, rootToneWeight = ROOT_TONE.weight, rootToneRays = ROOT_TONE.rays) {
    const base = { ...totals };
    const baseTotal = RAYS.reduce((acc, ray) => acc + (base[ray] || 0), 0);
    const toneWeight = Math.max(0, Math.min(1, rootToneWeight));
    const scale = baseTotal > 0 ? 1 - toneWeight : 0;
    const adjusted = {};
    RAYS.forEach((ray) => {
      adjusted[ray] = (base[ray] || 0) * scale;
    });
    const toneShare = rootToneRays.length ? toneWeight / rootToneRays.length : 0;
    rootToneRays.forEach((ray) => {
      adjusted[ray] = (adjusted[ray] || 0) + toneShare;
    });
    return adjusted;
  }

  static buildGradientStops(channelPercentages, minFraction = 0) {
    const entries = RAYS.map((ray) => ({ ray, value: channelPercentages?.[ray] || 0 })).filter(
      (entry) => entry.value > minFraction
    );
    const totalRaw = RAYS.reduce((acc, ray) => acc + (channelPercentages?.[ray] || 0), 0);
    if (!entries.length && totalRaw > 0) {
      const dominant = RAYS.reduce(
        (best, ray) => ((channelPercentages?.[ray] || 0) > (channelPercentages?.[best] || 0) ? ray : best),
        RAYS[0]
      );
      return { stops: [], solidRay: dominant };
    }
    if (!entries.length) return { stops: [], solidRay: null };
    if (entries.length === 1) return { stops: [], solidRay: entries[0].ray };
    const total = entries.reduce((acc, entry) => acc + entry.value, 0) || 1;
    let cumulative = 0;
    const stops = entries.map((entry) => {
      const start = cumulative;
      cumulative += entry.value / total;
      return {
        offset: `${(start * 100).toFixed(1)}%`,
        color: getRayColorHex(entry.ray),
      };
    });
    return { stops, solidRay: null };
  }

  static makeTooltip(node, state) {
    return EsotericRaySpectrumTooltipBuilder.makeTooltip(node, state);
  }
}
