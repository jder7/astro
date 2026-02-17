<script>
  import { onDestroy, tick } from 'svelte';
  import { animate, stagger } from 'animejs';
  import MajorAspectIcon from '$components/shared/MajorAspectIcon.svelte';
  import AspectGlyphIcon from '$components/shared/AspectGlyphIcon.svelte';
  import MetatronCubeIcon from '$components/shared/MetatronCubeIcon.svelte';
  import HypercubeIcon from '$components/shared/HypercubeIcon.svelte';
  import PlanetRingIcon from '$components/shared/PlanetRingIcon.svelte';
  import OrbArcIcon from '$components/shared/OrbArcIcon.svelte';
  import { POINT_SYMBOLS } from '$lib/astro/signs';
  import { capitalise } from '$lib/astro/format';

  export let pattern = null;
  export let placements = '';
  export let ownerLabels = {};
  export let pointMeta = {};
  export let size = 22;
  export let textClass = 'text-xs text-slate-200';

  let open = false;
  let overlayEl;
  let panelEl;
  let entryEl;
  let panelTop = 16;
  let copyState = 'idle';
  let copyResetTimer = null;

  const portal = (node) => {
    if (typeof document === 'undefined') return {};
    const target = document.body;
    target.appendChild(node);
    return {
      destroy() {
        if (node && node.parentNode === target) {
          target.removeChild(node);
        }
      },
    };
  };

  const normalizePointKey = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]+/g, '');

  const formatPattern = (entry, entryPoints = '', compactPoints = '') => {
    if (!entry || typeof entry !== 'object') return { name: 'Pattern', short: '' };
    const name = entry.name || entry.id || entry.geometry || 'Pattern';
    const desc = entry.geometry || entry.aspects_label || entry.aspectsLabel || entry.planets || '';

    return { name, short: [compactPoints, desc].filter(Boolean).join(' · '), entryPoints };
  };

  const toList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
    return [String(value)];
  };

  const formatOrb = (value) => {
    if (value === null || value === undefined || value === '') return '';
    return typeof value === 'string' ? value : `${value}`;
  };

  const pointIcon = (value) => POINT_SYMBOLS[normalizePointKey(value)] || '✶';
  const isMobileViewport = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  const resolveOwnerLabel = (owner) => {
    const key = String(owner || '').trim();
    if (!key) return '';
    return ownerLabels?.[key] || ownerLabels?.[Number(key)] || '';
  };

  const truncateOwner = (label) => {
    const value = String(label || '');
    return value.length > 7 ? `${value.slice(0, 5)}..` : value;
  };

  const ownerSuffix = (owner, compact = false) => {
    const label = resolveOwnerLabel(owner);
    if (!label) return '';
    return compact ? ` (${label})` : ` (${truncateOwner(label)})`;
  };

  const resolvePointMeta = (key, owner = '') => {
    const norm = normalizePointKey(key);
    const ownerKey = String(owner || '').trim();
    const byOwner = ownerKey ? pointMeta?.[`${ownerKey}:${norm}`] : null;
    if (byOwner) return byOwner;
    return pointMeta?.[norm] || null;
  };

  const resetCopyStateSoon = () => {
    if (copyResetTimer) clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(() => {
      copyState = 'idle';
      copyResetTimer = null;
    }, 1800);
  };

  const buildCopyPayload = () => {
    const points = pointList.map((key, idx) => {
      const owner = String(pointOwners[idx] || '');
      const ownerLabel = resolveOwnerLabel(owner);
      const meta = resolvePointMeta(key, owner) || {};
      const item = { key };
      if (ownerLabel) item.ownerLabel = ownerLabel;
      if (meta?.sign) item.sign = meta.sign;
      if (meta?.house !== null && meta?.house !== undefined && meta?.house !== '') item.house = meta.house;
      return item;
    });
    const linksPayload = links.map((link) => {
      const pairOwners = toList(link?.pair_owners || link?.pairOwners);
      const pair = (link?.pair || []).map((key, idx) => {
        const owner = String(pairOwners[idx] || '');
        const ownerLabel = resolveOwnerLabel(owner);
        const item = { key };
        if (ownerLabel) item.ownerLabel = ownerLabel;
        return item;
      });
      const entry = { type: link?.type || 'Aspect', pair };
      if (Number.isFinite(Number(link?.orb))) entry.orb = Number(link.orb);
      return entry;
    });
    const payload = {
      pattern: {
        id: pattern?.id || patternId,
        name: formatted?.name || pattern?.name || 'Pattern',
      },
      points,
      links: linksPayload,
    };
    if (aspectList.length) payload.pattern.aspects = [...aspectList];
    return payload;
  };

  const copyDetails = async () => {
    const text = JSON.stringify(buildCopyPayload(), null, 2);
    try {
      if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } else {
        throw new Error('Clipboard unavailable');
      }
      copyState = 'copied';
      resetCopyStateSoon();
    } catch (err) {
      copyState = 'error';
      resetCopyStateSoon();
    }
  };

  onDestroy(() => {
    if (copyResetTimer) clearTimeout(copyResetTimer);
  });

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const animateOverlay = async () => {
    if (prefersReducedMotion()) return;
    await tick();
    if (!overlayEl || !panelEl) return;
    animate(overlayEl, { opacity: [0, 1], duration: 220, easing: 'linear' });
    animate(panelEl, {
      opacity: [0, 1],
      scale: [0.96, 1],
      translateY: [16, 0],
      duration: 360,
      easing: 'easeOutCubic',
    });
    const cards = panelEl.querySelectorAll('.major-aspect-card, .major-aspect-link');
    if (cards.length) {
      animate(cards, {
        opacity: [0, 1],
        translateY: [8, 0],
        delay: stagger(40),
        duration: 420,
        easing: 'easeOutCubic',
      });
    }
    const hero = panelEl.querySelector('.major-aspect-hero');
    if (hero) {
      animate(hero, { scale: [0.9, 1], rotate: [-4, 0], duration: 520, easing: 'easeOutBack' });
    }
  };

  const zoomIn = (event) => {
    if (prefersReducedMotion()) return;
    const target = event.currentTarget;
    if (!target) return;
    animate(target, { scale: 1.03, duration: 220, easing: 'easeOutCubic' });
  };

  const zoomOut = (event) => {
    if (prefersReducedMotion()) return;
    const target = event.currentTarget;
    if (!target) return;
    animate(target, { scale: 1, duration: 220, easing: 'easeOutCubic' });
  };

  const close = () => {
    open = false;
  };

  const positionPanel = async () => {
    await tick();
    if (!panelEl || !entryEl || !overlayEl || typeof window === 'undefined') return;
    const viewportPadding = 16;
    const triggerRect = entryEl.getBoundingClientRect();
    const overlayRect = overlayEl.getBoundingClientRect();
    const panelRect = panelEl.getBoundingClientRect();
    const maxTop = Math.max(viewportPadding, overlayRect.height - panelRect.height - viewportPadding);
    const desiredTop = triggerRect.top - overlayRect.top;
    panelTop = Math.min(Math.max(desiredTop, viewportPadding), maxTop);
  };

  const openPanel = async () => {
    open = true;
    await tick();
    await positionPanel();
    animateOverlay();
    overlayEl?.focus();
  };

  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };

  $: patternId = pattern?.id || 'generic';
  $: aspectList = toList(pattern?.aspects);
  $: pointList = toList(pattern?.points);
  $: pointOwners = toList(pattern?.point_owners || pattern?.pointOwners);
  $: entryPointsDetail = pointList.map((name, idx) => `${capitalise(name)}${ownerSuffix(pointOwners[idx], false)}`).join(' · ');
  $: entryPointsCompact = pointList.map((name) => capitalise(name)).join(' · ');
  $: tooltipPoints = pointList.map((name, idx) => `${capitalise(name)}${ownerSuffix(pointOwners[idx], true)}`).join(' · ');
  $: formatted = formatPattern(pattern, entryPointsDetail, entryPointsCompact);
  $: displayDetail = placements || formatted.short;
  $: tooltipBody = tooltipPoints || formatted.short || placements;
  $: tooltip = tooltipBody ? `${formatted.name} · ${tooltipBody}` : formatted.name;
  $: links = Array.isArray(pattern?.links) ? pattern.links : [];
  $: planetChips = pointList.map((name, idx) => ({ name, icon: pointIcon(name), owner: ownerSuffix(pointOwners[idx], false) }));
  $: aspectChips = aspectList.map((name) => ({ name }));
  $: copyButtonTitle = copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy details';
</script>

<div
  class="flex items-start gap-2"
  title={tooltip}
  role="button"
  tabindex="0"
  on:click={() => {
    if (isMobileViewport()) {
      openPanel();
    }
  }}
  on:dblclick={openPanel}
  on:keydown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPanel();
    }
  }}
  bind:this={entryEl}
>
  <MajorAspectIcon {patternId} {size} />
  <p class={textClass}>
    {formatted.name}
    {#if displayDetail}
      : {displayDetail}
    {/if}
  </p>
</div>

{#if open}
  <div
    class="major-aspect-overlay"
    role="dialog"
    aria-modal="true"
    on:keydown={onKey}
    tabindex="0"
    bind:this={overlayEl}
    use:portal
  >
    <div class="major-aspect-panel" bind:this={panelEl} style={`--panel-top: ${panelTop}px`}>
      <div class="major-aspect-head">
        <div class="major-aspect-title">
          <div class="major-aspect-hero">
            <MajorAspectIcon {patternId} size={256} className="major-aspect-icon--hero" />
          </div>
          <div>
            <div class="major-aspect-kicker-row">
              <p class="major-aspect-kicker">Major configuration details panel</p>
              <div class="major-aspect-actions">
                <button
                  type="button"
                  class="major-aspect-copy"
                  on:click={copyDetails}
                  aria-label={copyButtonTitle}
                  title={copyButtonTitle}
                >
                  {#if copyState === 'copied'}
                    <span aria-hidden="true">✓</span>
                  {:else if copyState === 'error'}
                    <span aria-hidden="true">!</span>
                  {:else}
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path
                        d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H10V7h9v14Z"
                        fill="currentColor"
                      ></path>
                    </svg>
                  {/if}
                </button>
                <button type="button" class="major-aspect-close" on:click={close} aria-label="Close details" title="Close details">
                  ✕
                </button>
              </div>
            </div>
            <h3 class="major-aspect-name">{formatted.name}</h3>
            {#if formatted.entryPoints}
              <p class="major-aspect-points">{formatted.entryPoints}</p>
            {/if}
            {#if formatted.short}
              <p class="major-aspect-sub">{formatted.short}</p>
            {/if}
          </div>
        </div>
      </div>

      <div class="major-aspect-body">
        {#if placements}
          <div class="major-aspect-card major-aspect-card--placements major-aspect-zoom" role="presentation" on:mouseenter={zoomIn} on:mouseleave={zoomOut}>
            <h4>Placements</h4>
            <p class="major-aspect-placements">{placements}</p>
          </div>
        {/if}

        <div class="major-aspect-grid">
          {#if pattern?.planets || planetChips.length}
            <div class="major-aspect-card major-aspect-card--planets major-aspect-zoom" role="presentation" on:mouseenter={zoomIn} on:mouseleave={zoomOut}>
              <h4>Planets</h4>
              {#if pattern?.planets}
                <p class="major-aspect-line">
                  <PlanetRingIcon size={64} className="major-aspect-line-icon major-aspect-line-icon--planets" />
                  {pattern.planets}
                </p>
              {/if}
              {#if planetChips.length}
                <div class="major-aspect-chips">
                  {#each planetChips as planet}
                    <span class="major-aspect-chip major-aspect-zoom" role="presentation" on:mouseenter={zoomIn} on:mouseleave={zoomOut}>
                      <span class="major-aspect-chip-icon">{planet.icon}</span>
                      <span>{capitalise(planet.name)}{planet.owner}</span>
                    </span>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          {#if aspectChips.length || pattern?.aspects_label || pattern?.aspectsLabel}
            <div class="major-aspect-card major-aspect-card--aspects major-aspect-zoom" role="presentation" on:mouseenter={zoomIn} on:mouseleave={zoomOut}>
              <h4>Aspects</h4>
              {#if pattern?.aspects_label || pattern?.aspectsLabel}
                <p>{pattern.aspects_label || pattern.aspectsLabel}</p>
              {/if}
              {#if aspectChips.length}
                <div class="major-aspect-chips">
                  {#each aspectChips as aspect}
                    <span class="major-aspect-chip major-aspect-zoom" role="presentation" on:mouseenter={zoomIn} on:mouseleave={zoomOut}>
                      <AspectGlyphIcon name={aspect.name} size={32} className="major-aspect-chip-icon-svg" />
                      <span>{capitalise(aspect.name)}</span>
                    </span>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          {#if pattern?.geometry || pattern?.construction}
            <div class="major-aspect-card major-aspect-card--structure major-aspect-zoom" role="presentation" on:mouseenter={zoomIn} on:mouseleave={zoomOut}>
              <span class="major-aspect-graphic major-aspect-graphic--structure" aria-hidden="true"></span>
              <h4>Structure</h4>
              {#if pattern?.geometry}
                <p class="major-aspect-line">
                  <MetatronCubeIcon size={64} className="major-aspect-line-icon" />
                  <strong>Geometry:</strong> {pattern.geometry}
                </p>
              {/if}
              {#if pattern?.construction}
                <p class="major-aspect-line">
                  <HypercubeIcon size={64} className="major-aspect-line-icon" />
                  <strong>Construction:</strong> {pattern.construction}
                </p>
              {/if}
            </div>
          {/if}

          {#if formatOrb(pattern?.orb)}
            <div class="major-aspect-card major-aspect-card--orb major-aspect-zoom" role="presentation" on:mouseenter={zoomIn} on:mouseleave={zoomOut}>
              <span class="major-aspect-graphic major-aspect-graphic--orb" aria-hidden="true"></span>
              <h4>Orb</h4>
              <p class="major-aspect-line">
                <OrbArcIcon size={64} className="major-aspect-line-icon major-aspect-line-icon--orb" />
                {formatOrb(pattern?.orb)}
              </p>
            </div>
          {/if}
        </div>

        {#if links.length}
          <div class="major-aspect-card major-aspect-card--links major-aspect-zoom" role="presentation" on:mouseenter={zoomIn} on:mouseleave={zoomOut}>
            <h4>Links</h4>
            <div class="major-aspect-links">
              {#each links as link}
                {@const pairOwners = toList(link?.pair_owners || link?.pairOwners)}
                <div class="major-aspect-link major-aspect-zoom" role="presentation" on:mouseenter={zoomIn} on:mouseleave={zoomOut}>
                  <div class="major-aspect-link-line">
                    <span class="major-aspect-link-aspect">
                      <AspectGlyphIcon name={link.type || 'Aspect'} size={32} className="major-aspect-link-aspect-icon" />
                      {link.type || 'Aspect'}
                    </span>
                    <div class="major-aspect-link-pair">
                      {#each (link.pair || []) as point, idx}
                        {#if idx > 0}
                          <AspectGlyphIcon name={link.type || 'Aspect'} size={24} className="major-aspect-link-divider" />
                        {/if}
                        <span class="major-aspect-link-point">
                          <span class="major-aspect-link-icon">{pointIcon(point)}</span>
                          {capitalise(point)}{ownerSuffix(pairOwners[idx], false)}
                        </span>
                      {/each}
                    </div>
                  </div>
                  <div class="major-aspect-link-meta">
                    {#if link.orb !== undefined}
                      <span>Orb: {link.orb}</span>
                    {/if}
                    {#if link.difference !== undefined}
                      <span>Diff: {link.difference}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
    <button type="button" class="major-aspect-backdrop" on:click={close} aria-label="Close details"></button>
  </div>
{/if}

<style>
  .major-aspect-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 1.5rem 1rem 1.25rem;
  }

  .major-aspect-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(8, 12, 24, 0.7);
    border: none;
  }

  .major-aspect-panel {
    position: absolute;
    top: var(--panel-top, 16px);
    left: 0;
    right: 0;
    margin: 0 auto;
    width: min(calc(100% - 2rem), 720px);
    max-height: 88vh;
    overflow: auto;
    background: rgba(12, 17, 32, 0.96);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 20px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    z-index: 1;
    box-shadow: 0 24px 80px rgba(5, 10, 30, 0.6);
  }

  .major-aspect-head {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .major-aspect-title {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .major-aspect-hero {
    width: min(256px, 70vw);
    height: min(256px, 70vw);
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 18px 40px rgba(56, 189, 248, 0.25));
  }

  :global(.major-aspect-icon--hero) {
    transform: scale(0.95);
  }

  .major-aspect-kicker {
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-size: 0.65rem;
    color: rgba(148, 163, 184, 0.7);
    margin: 0;
  }

  .major-aspect-kicker-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .major-aspect-name {
    margin: 0.2rem 0 0;
    font-size: 1.3rem;
    color: #e2e8f0;
  }

  .major-aspect-sub {
    margin: 0.25rem 0 0;
    color: rgba(148, 163, 184, 0.85);
    font-size: 0.9rem;
  }

  .major-aspect-card--placements .major-aspect-placements {
    font-size: 1rem;
    color: rgba(226, 232, 240, 0.92);
    line-height: 1.5;
    margin: 0.35rem 0 0;
  }

  .major-aspect-points {
    margin: 0.25rem 0 0;
    color: #f4ff2c;
    font-size: 1.5rem;
  }

  .major-aspect-close {
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(15, 23, 42, 0.65);
    color: #e2e8f0;
    border-radius: 999px;
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-size: 0.85rem;
  }

  .major-aspect-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .major-aspect-copy {
    border: 1px solid rgba(56, 189, 248, 0.45);
    background: rgba(8, 47, 73, 0.45);
    color: #bae6fd;
    border-radius: 999px;
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .major-aspect-copy svg {
    width: 15px;
    height: 15px;
  }

  .major-aspect-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .major-aspect-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .major-aspect-card {
    position: relative;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.55);
    padding: 0.9rem 1rem;
    border-radius: 14px;
    overflow: hidden;
    transform-origin: center;
  }

  .major-aspect-zoom {
    cursor: pointer;
    will-change: transform;
  }

  .major-aspect-card h4 {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: rgba(148, 163, 184, 0.7);
  }

  .major-aspect-card p {
    margin: 0.2rem 0;
    font-size: 0.9rem;
    color: #e2e8f0;
  }

  .major-aspect-line {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .major-aspect-line-icon {
    color: rgba(125, 211, 252, 0.9);
    flex-shrink: 0;
  }

  .major-aspect-line-icon--orb {
    color: rgba(251, 191, 36, 0.85);
  }

  .major-aspect-line-icon--planets {
    color: rgba(110, 231, 183, 0.85);
  }

  .major-aspect-muted {
    color: rgba(148, 163, 184, 0.85);
    font-size: 0.85rem;
  }

  .major-aspect-graphic {
    position: absolute;
    inset: -20% 50% 40% -20%;
    opacity: 0.45;
    border-radius: 999px;
    pointer-events: none;
    filter: blur(8px);
  }

  .major-aspect-graphic--structure {
    background: radial-gradient(circle at 30% 30%, rgba(56, 189, 248, 0.5), rgba(99, 102, 241, 0.1));
  }

  .major-aspect-graphic--orb {
    background: radial-gradient(circle at 70% 40%, rgba(251, 191, 36, 0.6), rgba(248, 113, 113, 0.12));
  }

  .major-aspect-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.4rem;
  }

  .major-aspect-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.65rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.65);
    color: rgba(226, 232, 240, 0.9);
    font-size: 0.8rem;
    transform-origin: center;
  }

  .major-aspect-chip-icon {
    font-size: 0.95rem;
    color: rgba(125, 211, 252, 0.9);
  }

  .major-aspect-chip-icon-svg {
    width: 18px;
    height: 18px;
  }

  .major-aspect-links {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }

  .major-aspect-link {
    padding: 0.6rem 0.75rem;
    border-radius: 12px;
    background: rgba(10, 15, 28, 0.75);
    border: 1px solid rgba(148, 163, 184, 0.15);
    transform-origin: center;
  }

  .major-aspect-link-line {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    color: #e2e8f0;
    font-size: 0.9rem;
  }

  .major-aspect-link-aspect {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
    color: rgba(56, 189, 248, 0.9);
  }

  .major-aspect-link-aspect-icon {
    width: 18px;
    height: 18px;
  }

  .major-aspect-link-pair {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    color: rgba(226, 232, 240, 0.9);
    font-size: 0.9rem;
  }

  .major-aspect-link-point {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.45rem;
    border-radius: 999px;
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .major-aspect-link-icon {
    font-size: 0.9rem;
    color: rgba(148, 163, 184, 0.9);
  }

  .major-aspect-link-divider {
    width: 16px;
    height: 16px;
    color: rgba(248, 250, 252, 0.7);
  }

  .major-aspect-link-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    font-size: 0.75rem;
    color: rgba(148, 163, 184, 0.85);
    margin-top: 0.35rem;
  }

  @media (min-width: 640px) {
    .major-aspect-overlay {
      align-items: flex-start;
      padding: 2rem;
    }

    .major-aspect-head {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }

    .major-aspect-title {
      flex-direction: row;
      align-items: center;
    }

    .major-aspect-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .major-aspect-links {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (min-width: 640px) {
    .major-aspect-card--placements .major-aspect-placements {
      font-size: 1.05rem;
    }
  }

  @media (max-width: 480px) {
    .major-aspect-card--placements .major-aspect-placements {
      font-size: 0.95rem;
    }
  }

  @media (max-width: 480px) {
    :global(.major-aspect-icon--hero) {
      transform: scale(0.72);
    }
  }
</style>
