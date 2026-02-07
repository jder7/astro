import { formatOrdinal } from '$lib/astro/format';
import { RAYS } from '$lib/astro/rays';

export class EsotericRaySpectrumTooltipBuilder {
  static makeTooltip(node, state) {
    if (!node) return '';
    const data = node.data || node;
    if (data.type === 'root') {
      const stateLabel = state ? `${state[0].toUpperCase()}${state.slice(1)}` : 'State';
      const groups = node.children || [];
      const totalValue = groups.reduce((acc, group) => acc + (group?.value || 0), 0);
      const lines = [`${stateLabel} spectrum`];
      groups.forEach((group) => {
        const ray = group?.data?.ray;
        const groupValue = group?.value || 0;
        const pct = totalValue > 0 ? ((groupValue / totalValue) * 100).toFixed(1) : '0.0';
        const pointsLine = (group.children || [])
          .filter((child) => child?.data?.type === 'set')
          .map((child) => {
            const childData = child.data;
            return `${childData.symbol} ${childData.signLabel} ${childData.signSymbol}`;
          })
          .join(' · ');
        lines.push(`${formatOrdinal(ray)} Ray · ${pct}%${pointsLine ? `: ${pointsLine}` : ''}`);
      });
      return lines.join('\n');
    }
    if (data.type === 'group') {
      const rayLabel = `${formatOrdinal(data.ray)} Ray`;
      const children = node.children || [];
      const lines = children
        .filter((child) => child?.data?.type === 'set')
        .map((child) => {
          const childData = child.data;
          const signRaysLabel = childData.signRays?.length
            ? childData.signRays.map((ray) => `Ray ${ray}`).join(', ')
            : '—';
          const pointRaysLabel = childData.pointRays?.length
            ? `(${formatOrdinal(childData.pointRays[0])})`
            : '';
          return `${childData.label} ${pointRaysLabel} — ${childData.signLabel} ${childData.signSymbol} · ${signRaysLabel}`;
        });
      return [rayLabel, ...lines].join('\n');
    }
    if (data.type === 'empty') {
      return 'No active points';
    }
    if (data.type === 'set') {
      const mix = RAYS.map((ray) => {
        const pct = ((data.channelPercentages?.[ray] || 0) * 100).toFixed(1);
        return `Ray ${ray}: ${pct}%`;
      }).join(' | ');
      const dayRulerLine = data.dayRulerMultiplier && data.dayRulerMultiplier !== 1
        ? `Day ruler multiplier: ${data.dayRulerMultiplier.toFixed(2)}`
        : '';
      const signRaysLabel = data.signRays?.length ? data.signRays.map((ray) => `Ray ${ray}`).join(', ') : '';
      const pointRaysLabel = data.pointRays?.length ? data.pointRays.map((ray) => `Ray ${ray}`).join(', ') : '';
      const lines = [
        `${data.label} (${data.symbol || ''})${pointRaysLabel ? ` · ${pointRaysLabel}` : ''}`,
        `${data.signLabel} ${data.signSymbol}${signRaysLabel ? ` · ${signRaysLabel}` : ''}`,
        `Multiplier: ${data.multiplier.toFixed(2)} (pos ${data.aspectPos}, neg ${data.aspectNeg})`,
      ];
      const filtered = lines.filter(Boolean);
      if (dayRulerLine) filtered.push(dayRulerLine);
      filtered.push(mix);
      return filtered.join('\n');
    }
    const stateLabel = state ? `${state[0].toUpperCase()}${state.slice(1)}` : 'State';
    return `${stateLabel} spectrum`;
  }
}
