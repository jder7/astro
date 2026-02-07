<script>
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import MoonPhasesImage from '$components/shared/MoonPhasesImage.svelte';
  import EducationScrollGlyph from '$components/shared/EducationScrollGlyph.svelte';
  import { requestEducationTopic } from '$lib/api/client';

  const topics = [
    { id: 'aspects', label: 'Aspects', blurb: 'Angles, relationships, and energetic dynamics.' },
    { id: 'special-aspects', label: 'Special aspects', blurb: 'Multi-planet Ptolemaic patterns.' },
    { id: 'planets', label: 'Planets', blurb: 'Core drives, needs, and expressions.' },
    { id: 'signs', label: 'Signs', blurb: 'Elemental tone and style.' },
    { id: 'houses', label: 'Houses', blurb: 'Life areas and lived experience.' },
    { id: 'decans', label: 'Decans', blurb: 'Sub-sign phases and ray emphasis.' },
    { id: 'rulership', label: 'Rulership', blurb: 'Planetary rulers and dignity.' },
    { id: 'moon-phases', label: 'Moon phases', blurb: 'Cycles, visibility, and timing.' },
  ];

  let selectedId = topics[0].id;
  let loading = false;
  let error = '';
  let markdown = '';

  const selectTopic = async (id) => {
    if (!id || id === selectedId) return;
    selectedId = id;
    await loadTopic(id);
  };

  const loadTopic = async (id) => {
    loading = true;
    error = '';
    try {
      const resp = await requestEducationTopic(id);
      markdown = typeof resp?.content === 'string' ? resp.content : '';
    } catch (err) {
      markdown = '';
      error = err?.message || 'Unable to load this topic right now.';
    } finally {
      loading = false;
    }
  };


  $: selectedTopic = topics.find((topic) => topic.id === selectedId) || topics[0];
  $: markdownHtml = markdown.trim() ? marked.parse(markdown) : '';
  $: showMoonPhases = selectedId === 'moon-phases';

  onMount(() => {
    loadTopic(selectedId);
  });
</script>

<div class="page-shell pb-12" id="education-workbench">
  <div class="education-layout">
    <aside class="education-topics">
      <div class="education-topics-head">
        <p class="section-title text-xs">Topics</p>
        <p class="text-xs text-slate-400">Choose a lesson to explore.</p>
      </div>
      <div class="education-topic-list">
        {#each topics as topic}
          <button
            type="button"
            class={`education-topic ${selectedId === topic.id ? 'active' : ''}`}
            on:click={() => selectTopic(topic.id)}
            aria-pressed={selectedId === topic.id}
          >
            <div class="education-topic-title">
              <span class="education-topic-icon" aria-hidden="true">*</span>
              <span>{topic.label}</span>
            </div>
            <span class="education-topic-blurb">{topic.blurb}</span>
          </button>
        {/each}
      </div>
    </aside>

    <section class="education-dashboard">
      <div class="education-panel">
        <div class="education-panel-head">
          <div>
            <p class="section-title text-xs">Study panel BIG TEST</p>
            <h2 class="education-panel-title">{selectedTopic.label}</h2>
            <p class="education-panel-sub">{selectedTopic.blurb}</p>
          </div>
        </div>

        <div class="education-panel-body">
          <div class="education-hero">
            {#if showMoonPhases}
              <MoonPhasesImage className="education-moon-image" alt="Moon phases chart" size={128} />
            {:else}
              <EducationScrollGlyph />
            {/if}
          </div>

          <div class="education-content">
            {#if loading}
              <div class="education-placeholder">Loading lesson...</div>
            {:else if error}
              <div class="education-error">{error}</div>
            {:else if markdownHtml}
              <div class="prose prose-invert prose-amber max-w-none education-markdown">
                {@html markdownHtml}
              </div>
            {:else}
              <div class="education-placeholder">No content found for this topic yet.</div>
            {/if}
          </div>
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  .education-layout {
    display: grid;
    gap: 1.5rem;
  }

  @media (min-width: 960px) {
    .education-layout {
      grid-template-columns: minmax(220px, 320px) minmax(0, 1fr);
      align-items: start;
    }
  }

  .education-topics {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    border-radius: 20px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(15, 23, 42, 0.7);
    box-shadow: 0 18px 45px rgba(9, 13, 28, 0.45);
  }

  .education-topic-list {
    display: grid;
    gap: 0.75rem;
  }

  .education-topic {
    text-align: left;
    padding: 0.75rem 0.85rem;
    border-radius: 16px;
    border: 1px solid rgba(251, 191, 36, 0.2);
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.7));
    color: #fde68a;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .education-topic:hover {
    border-color: rgba(251, 191, 36, 0.6);
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.45);
    transform: translateY(-2px);
  }

  .education-topic.active {
    border-color: rgba(249, 115, 22, 0.8);
    box-shadow: 0 0 0 1px rgba(249, 115, 22, 0.4), 0 20px 50px rgba(17, 24, 39, 0.6);
  }

  .education-topic-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 0.95rem;
    color: #fef3c7;
  }

  .education-topic-icon {
    font-size: 1.1rem;
    color: #f97316;
  }

  .education-topic-blurb {
    margin-top: 0.35rem;
    font-size: 0.75rem;
    color: rgba(253, 224, 71, 0.8);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .education-dashboard {
    display: flex;
  }

  .education-panel {
    width: 100%;
    min-width: 0;
    border-radius: 24px;
    padding: 1.25rem;
    border: 1px solid rgba(251, 191, 36, 0.25);
    background: linear-gradient(160deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.85));
    box-shadow: 0 25px 60px rgba(7, 12, 28, 0.65);
  }

  .education-panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .education-panel-title {
    font-size: 1.5rem;
    margin: 0.35rem 0 0;
    color: #fef9c3;
  }

  .education-panel-sub {
    margin: 0.35rem 0 0;
    color: rgba(251, 191, 36, 0.75);
    font-size: 0.9rem;
  }

  .education-panel-body {
    margin-top: 1.25rem;
    border-radius: 20px;
    border: 1px solid rgba(251, 191, 36, 0.18);
    background: rgba(8, 12, 22, 0.8);
    padding: 1rem;
    min-width: 0;
    overflow: hidden;
  }

  .education-hero {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 1rem;
  }

  .education-scroll {
    width: min(220px, 70vw);
    height: auto;
    animation: scrollFloat 4.6s ease-in-out infinite;
    filter: drop-shadow(0 12px 30px rgba(249, 115, 22, 0.35));
  }

  .education-moon-image {
    width: min(320px, 80vw);
    border-radius: 18px;
    border: 1px solid rgba(251, 191, 36, 0.35);
    box-shadow: 0 14px 40px rgba(15, 23, 42, 0.5);
  }

  .education-content {
    max-height: none;
    overflow-x: auto;
    padding-right: 0.5rem;
    min-width: 0;
  }

  .education-placeholder,
  .education-error {
    padding: 0.75rem 1rem;
    border-radius: 14px;
    border: 1px dashed rgba(251, 191, 36, 0.35);
    color: rgba(253, 224, 71, 0.85);
  }

  .education-error {
    border-color: rgba(248, 113, 113, 0.5);
    color: rgba(254, 202, 202, 0.9);
  }

  .education-markdown h2 {
    color: #fcd34d;
  }

  .education-markdown h3 {
    color: #fde68a;
  }

  .education-markdown {
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .education-markdown table {
    display: block;
    max-width: 100%;
    overflow-x: auto;
  }

  .education-markdown pre,
  .education-markdown code {
    white-space: pre-wrap;
    word-break: break-word;
  }

  @keyframes scrollFloat {
    0% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-6px);
    }
    100% {
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .education-scroll {
      animation: none;
    }
  }

  @media (max-width: 640px) {
    .education-content {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
  }
</style>
