<script>
  import { hierarchy, pack } from 'd3-hierarchy';
  import { formatOrdinal } from '$lib/astro/format';
  import { collectPoints, extractAspects, extractSubjects } from '$lib/astro/advanced';
  import { getRayColorHex } from '$lib/astro/rays';
  import { configStore } from '$lib/state/configStore';
  import { normalizePointKey } from '$lib/astro/pointRays';
  import { EsotericRaySpectrumUtils } from '$lib/astro/esotericRaySpectrumUtils';

  export let debug = true;

  export let response = null;
  export let mode = 'natal';
  export let state = 'personality';
  export let overtoneCoeff = 0.2;
  export let enablePointRays = false;
  export let dayRulerWeight = 3;
  export let sunPointWeight = 5;
  export let moonPointWeight = 3;
  export let ascendantPointWeight = 7;
  export let aspectWeightTight = EsotericRaySpectrumUtils.DEFAULT_ORB_WEIGHTS.tight;
  export let aspectWeightClose = EsotericRaySpectrumUtils.DEFAULT_ORB_WEIGHTS.close;
  export let aspectWeightWide = EsotericRaySpectrumUtils.DEFAULT_ORB_WEIGHTS.wide;
  export let aspectWeightLoose = EsotericRaySpectrumUtils.DEFAULT_ORB_WEIGHTS.loose;

  let tooltipVisible = false;
  let tooltipText = '';
  let tooltipTimer = null;

  const RAYS = EsotericRaySpectrumUtils.RAYS;
  const MIN_GROUP_VALUE = EsotericRaySpectrumUtils.MIN_GROUP_VALUE;
  const MIN_CHANNEL_FRACTION = EsotericRaySpectrumUtils.MIN_CHANNEL_FRACTION;

  const width = 820;
  const height = 520;

  const filterPointsByActive = (points, activeSet) => {
    if (!points || typeof points !== 'object' || !activeSet || !activeSet.size) return points || {};
    return Object.fromEntries(Object.entries(points).filter(([key]) => activeSet.has(normalizePointKey(key))));
  };

  const debugLog = (...args) => {
    if (!debug) return;
    console.log('[EsotericRaySpectrum]', ...args);
  };

  const showTooltip = (text, autoHide = false) => {
    if (!text) return;
    tooltipText = text;
    tooltipVisible = true;
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
    if (autoHide) {
      tooltipTimer = setTimeout(() => {
        tooltipVisible = false;
        tooltipTimer = null;
      }, 2400);
    }
  };

  const hideTooltip = () => {
    tooltipVisible = false;
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
  };

  const toggleTooltip = (text) => {
    if (tooltipVisible) hideTooltip();
    else showTooltip(text, true);
  };

  const buildHierarchy = (points) => {
    const totals = {};
    RAYS.forEach((ray) => {
      totals[ray] = 0;
    });

    const groups = RAYS.map((ray) => {
      const children = [];
      (points || []).forEach((point) => {
        const value = point.weighted[ray] || 0;
        if (value <= 0) return;
        children.push({
          type: 'set',
          pointKey: point.key,
          label: point.label,
          symbol: point.symbol,
          signLabel: point.signLabel,
          signSymbol: point.signSymbol,
          ray,
          value,
          channelPercentages: point.channelPercentages,
          multiplier: point.multiplier,
          dayRulerMultiplier: point.dayRulerMultiplier,
          aspectPos: point.aspectPos,
          aspectNeg: point.aspectNeg,
          signRays: point.signRays,
          pointRays: point.pointRays,
        });
        totals[ray] += value;
      });
      if (!children.length) {
        children.push({
          type: 'empty',
          ray,
          value: MIN_GROUP_VALUE,
        });
      }
      return {
        type: 'group',
        ray,
        children,
      };
    });

    return { type: 'root', children: groups, totals };
  };

  $: subjects = extractSubjects(response, mode);
  $: primaryPoints = collectPoints(subjects.primary || {});
  $: secondaryPoints = collectPoints(subjects.natal || {});
  $: activeSet = new Set(($configStore?.active_points || []).map(normalizePointKey));
  $: filteredPrimaryPoints = filterPointsByActive(primaryPoints.points, activeSet);
  $: filteredSecondaryPoints = filterPointsByActive(secondaryPoints.points, activeSet);
  $: activePointKeys = Object.keys(filteredPrimaryPoints || {}).map(normalizePointKey);
  $: isMultiMode = Boolean(subjects.natal) && (mode === 'natal_transit' || mode === 'relationship');
  $: dayRulerPrimary = EsotericRaySpectrumUtils.getDayRulerKey(subjects.primary);
  $: dayRulerSecondary = EsotericRaySpectrumUtils.getDayRulerKey(subjects.natal);

  $: aspectBundle = extractAspects(response, mode);
  $: aspectSource = (() => {
    if (!aspectBundle) return [];
    if (isMultiMode) {
      return [
        ...(aspectBundle.subject1?.aspects || []),
        ...(aspectBundle.subject2?.aspects || []),
        ...(aspectBundle.synastry?.aspects || []),
      ];
    }
    return aspectBundle.subject1?.aspects || [];
  })();
  $: aspectWeights = {
    tight: aspectWeightTight,
    close: aspectWeightClose,
    wide: aspectWeightWide,
    loose: aspectWeightLoose,
  };
  $: aspectIndex = EsotericRaySpectrumUtils.buildAspectIndex(aspectSource, aspectWeights);

  const buildPointEntries = (points, ownerKey, ownerLabel) =>
    Object.entries(points || {}).map(([key, point]) => ({
      key,
      point,
      ownerKey,
      ownerLabel,
    }));

  $: pointData = (() => {
    const entries = [
      ...buildPointEntries(filteredPrimaryPoints, '1', subjects.primary?.name || 'Subject 1'),
      ...(isMultiMode ? buildPointEntries(filteredSecondaryPoints, '2', subjects.natal?.name || 'Subject 2') : []),
    ];
    const result = entries
      .map(({ key, point, ownerKey, ownerLabel }) => {
        const dayRulerKey = ownerKey === '2' ? dayRulerSecondary : dayRulerPrimary;
        return EsotericRaySpectrumUtils.computePointEntry({
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
          enablePointRays,
          aspectIndex,
        });
      })
      .filter(Boolean);
    debugLog('pointData', { dayRulerPrimary, dayRulerSecondary, result });
    if (debug) {
      const sample = result.slice(0, 3).map((entry) => ({
        key: entry.key,
        s1_signRayCounts: entry.layers?.s1_signRayCounts,
        s2_pointRayCounts: entry.layers?.s2_pointRayCounts,
        s3_combinedRayCounts: entry.layers?.s3_combinedRayCounts,
        s4_channelPercentages: entry.layers?.s4_channelPercentages,
        s5_pointIdentityWeightedRays: entry.layers?.s5_pointIdentityWeightedRays,
        aspectMultiplier: entry.layers?.aspectMultiplier,
        aspectMultiplierList: entry.layers?.aspectMultiplierList,
        s6_aspectWeightedRays: entry.weighted,
      }));
      debugLog('rayLayersSample', sample);
    }
    return result;
  })();

  $: hierarchyData = buildHierarchy(pointData);
  $: rootStops = EsotericRaySpectrumUtils.buildGradientStops(
    EsotericRaySpectrumUtils.applyRootTone(hierarchyData?.totals || {}),
    0
  ).stops;
  $: setGradients = (pointData || []).map((point) => {
    const gradient = EsotericRaySpectrumUtils.buildGradientStops(point.channelPercentages, MIN_CHANNEL_FRACTION);
    return {
      id: `ray-mix-${point.key}`,
      stops: gradient.stops,
      solidRay: gradient.solidRay,
    };
  });
  $: debugLog('rootStops', rootStops);
  $: debugLog('setGradients', setGradients);
  $: solidRayByPoint = (setGradients || []).reduce((acc, entry) => {
    const key = entry.id.replace('ray-mix-', '');
    acc[key] = entry.solidRay;
    return acc;
  }, {});
  $: gradientAvailableByPoint = (setGradients || []).reduce((acc, entry) => {
    const key = entry.id.replace('ray-mix-', '');
    acc[key] = entry.stops.length > 0;
    return acc;
  }, {});
  $: packedRoot = (() => {
    if (!hierarchyData) return null;
    const root = hierarchy(hierarchyData)
      .sum((d) => (d.type === 'set' ? d.value : 0))
      .sort((a, b) => b.value - a.value);
    return pack().size([width, height]).padding(14)(root);
  })();

  $: nodes = packedRoot ? packedRoot.descendants() : [];
</script>

<div class="eso-ray-widget">
  <div class="eso-ray-meta">
    <div>
      <p class="eso-ray-kicker">Ray spectrum</p>
      <p class="eso-ray-sub">{activePointKeys.length} active points · {pointData.length} in state</p>
    </div>
  </div>

  {#if tooltipVisible}
    <div class="eso-ray-tooltip" aria-live="polite">
      {tooltipText}
    </div>
  {/if}

  <svg class="eso-ray-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Ray spectrum widget">
    <defs>
      <radialGradient id="ray-root" cx="50%" cy="50%" r="100%">
        {#if rootStops.length === 0}
          <stop offset="0%" stop-color="#475569" />
          <stop offset="100%" stop-color="#1f2937" />
        {:else}
          <stop offset="0%" stop-color={rootStops[0].color} />
          {#each rootStops as stop}
            <stop offset={stop.offset} stop-color={stop.color} />
          {/each}
        {/if}
      </radialGradient>

      {#each setGradients as gradient}
        {#if gradient.stops.length}
          <radialGradient id={gradient.id} cx="50%" cy="50%" r="100%">
            {#each gradient.stops as stop}
              <stop offset={stop.offset} stop-color={stop.color} />
            {/each}
          </radialGradient>
        {/if}
      {/each}
    </defs>

    {#each nodes as node}
      <g transform={`translate(${node.x}, ${node.y})`}>
        <circle
          r={node.r}
          on:mouseenter={() => showTooltip(EsotericRaySpectrumUtils.makeTooltip(node, state))}
          on:mouseleave={hideTooltip}
          on:click={() => toggleTooltip(EsotericRaySpectrumUtils.makeTooltip(node, state))}
          fill={
            node.depth === 0
              ? 'url(#ray-root)'
              : node.data.type === 'group'
                ? getRayColorHex(node.data.ray)
                : node.data.type === 'empty'
                  ? 'none'
                : node.data.type === 'set'
                  ? solidRayByPoint[node.data.pointKey]
                    ? getRayColorHex(solidRayByPoint[node.data.pointKey])
                    : gradientAvailableByPoint[node.data.pointKey]
                      ? `url(#ray-mix-${node.data.pointKey})`
                      : '#1f2937'
                  : '#1f2937'
          }
          fill-opacity={node.depth === 0 ? 0.5 : node.data.type === 'group' ? 0.3 : 0.9}
          stroke={
            node.depth === 0
              ? '#475569'
              : node.data.type === 'group'
                ? getRayColorHex(node.data.ray)
                : node.data.type === 'empty'
                  ? getRayColorHex(node.data.ray)
                : node.data.type === 'set'
                  ? getRayColorHex(node.data.ray)
                  : '#475569'
          }
          stroke-width={node.depth === 0 ? 1.1 : node.data.type === 'empty' ? 1 : 1.3}
          stroke-dasharray={node.data.type === 'empty' ? '4 4' : null}
        >
          <title>{EsotericRaySpectrumUtils.makeTooltip(node, state)}</title>
        </circle>

        {#if node.data.type === 'group'}
          <text
            text-anchor="middle"
            dy="0.35em"
            class="eso-ray-label"
          >
            {formatOrdinal(node.data.ray)}
          </text>
        {/if}

        {#if node.data.type === 'set'}
          <text
            text-anchor="middle"
            dy="0.35em"
            class="eso-ray-set"
          >
            {node.data.symbol}
          </text>
        {/if}
      </g>
    {/each}
  </svg>
</div>

<style>
  .eso-ray-widget {
    position: relative;
    border: 1px solid rgba(30, 41, 59, 0.7);
    border-radius: 16px;
    padding: 0.9rem 1rem 1.1rem;
    background: rgba(2, 6, 23, 0.35);
  }

  .eso-ray-meta {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }


  .eso-ray-kicker {
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 10px;
    font-weight: 700;
    color: rgba(148, 163, 184, 0.9);
  }

  .eso-ray-sub {
    font-size: 0.85rem;
    color: rgba(226, 232, 240, 0.9);
  }

  .eso-ray-warning {
    font-size: 0.75rem;
    color: #facc15;
    background: rgba(250, 204, 21, 0.08);
    border: 1px solid rgba(250, 204, 21, 0.3);
    padding: 0.3rem 0.5rem;
    border-radius: 999px;
  }

  .eso-ray-svg {
    width: 100%;
    height: auto;
    border-radius: 14px;
    background: rgba(8, 10, 26, 0.6);
    border: 1px solid rgba(30, 41, 59, 0.5);
  }

  .eso-ray-tooltip {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    max-width: min(320px, 80vw);
    border-radius: 10px;
    border: 1px solid rgba(20, 83, 45, 0.6);
    background: rgba(6, 24, 17, 0.95);
    padding: 0.4rem 0.6rem;
    font-size: 11px;
    color: #e2f7ee;
    white-space: pre-line;
    box-shadow: 0 10px 30px rgba(2, 6, 23, 0.5);
    pointer-events: none;
    z-index: 10;
  }

  .eso-ray-label {
    font-size: 12px;
    font-weight: 700;
    fill: #f8fafc;
    pointer-events: none;
  }

  .eso-ray-set {
    font-size: 12px;
    font-weight: 600;
    fill: #f8fafc;
    pointer-events: none;
  }

</style>
