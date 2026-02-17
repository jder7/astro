<script>
  import MajorAspectEntry from '$components/shared/MajorAspectEntry.svelte';
  import { signSymbol, POINT_SYMBOLS } from '$lib/astro/signs';
  import { ucfirst } from '$lib/astro/format';

  export let patterns = [];
  export let subject = null;
  export let size = 22;
  export let textClass = 'text-xs text-slate-200';
  export let emptyLabel = 'No major aspects found.';
  export let showEmpty = true;
  export let id = '';
  export let subjectsByOwner = null;

  const normalizePointKey = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

  const pickPoint = (points, key) => {
    if (!points || !key) return null;
    const direct = points[key];
    if (direct) return direct;
    const target = normalizePointKey(key);
    const match = Object.entries(points).find(([name]) => normalizePointKey(name) === target);
    return match ? match[1] : null;
  };

  const toList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
    return [String(value)];
  };

  const formatPointPlacement = (points, key) => {
    const pt = pickPoint(points, key) || {};
    const normalized = normalizePointKey(key);
    const label = pt.name || (normalized ? normalized.replace(/_/g, ' ') : '') || key || '—';
    const pointIcon = POINT_SYMBOLS[normalized] || pt.emoji || ucfirst(label);
    const signGlyph = signSymbol(pt.sign);
    const posVal =
      typeof pt.position === 'number'
        ? pt.position
        : typeof pt.abs_pos === 'number'
          ? pt.abs_pos % 30
          : typeof pt.orb === 'number'
            ? pt.orb
            : null;
    const pos = Number.isFinite(posVal) ? `${posVal.toFixed(2)}°` : '';
    const signPart = signGlyph ? ` in ${signGlyph}` : pt.sign ? ` in ${pt.sign}` : '';
    const posPart = pos ? ` @ ${pos}` : '';
    return `${pointIcon}${signPart}${posPart}`.trim();
  };

  const collectKeys = (structure) => {
    const acc = [];
    const pushVal = (val) => {
      if (Array.isArray(val)) {
        val.forEach(pushVal);
      } else if (typeof val === 'string') {
        acc.push(val);
      }
    };
    Object.values(structure || {}).forEach(pushVal);
    return acc;
  };

  const buildOwnerLabels = (ownerSubjects) => ({
    '1': ownerSubjects?.['1']?.name || ownerSubjects?.[1]?.name || 'Subject 1',
    '2': ownerSubjects?.['2']?.name || ownerSubjects?.[2]?.name || 'Subject 2',
  });

  const ownerValues = (pattern) =>
    toList(pattern?.pointOwners || pattern?.point_owners).map((owner) => String(owner));

  const resolvePointSource = (owner, fallback, ownerSubjects) => {
    if (!owner) return fallback;
    if (ownerSubjects?.[owner]) return ownerSubjects[owner];
    if (ownerSubjects?.[Number(owner)]) return ownerSubjects[Number(owner)];
    return fallback;
  };

  const buildEntries = (items, points, ownerSubjects) => {
    if (!Array.isArray(items) || !items.length) return [];
    const labels = buildOwnerLabels(ownerSubjects);
    return items
      .map((pattern) => {
        const keys = Array.isArray(pattern.points) && pattern.points.length ? pattern.points : collectKeys(pattern.structure);
        const owners = ownerValues(pattern);
        const uniq = [];
        keys.forEach((val, idx) => {
          const norm = normalizePointKey(val);
          const owner = owners[idx] || '';
          const identity = owner ? `${owner}:${norm}` : norm;
          if (norm && !uniq.find((entry) => entry.identity === identity)) {
            uniq.push({ key: norm, owner, identity });
          }
        });
        const placements = uniq
          .map((entry) => formatPointPlacement(resolvePointSource(entry.owner, points, ownerSubjects), entry.key))
          .filter(Boolean)
          .join(' · ');
        if (!placements) return null;
        return { pattern, placements, ownerLabels: labels };
      })
      .filter(Boolean);
  };

  $: entries = buildEntries(patterns, subject || {}, subjectsByOwner || null);
</script>

{#if entries.length}
  <div class="space-y-1" id={id || undefined}>
    {#each entries as entry}
      <MajorAspectEntry
        pattern={entry.pattern}
        placements={entry.placements}
        ownerLabels={entry.ownerLabels}
        {size}
        {textClass}
      />
    {/each}
  </div>
{:else if showEmpty}
  <p class="text-xs text-slate-400" id={id || undefined}>{emptyLabel}</p>
{/if}
