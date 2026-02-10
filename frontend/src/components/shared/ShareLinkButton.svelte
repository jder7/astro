<script>
  import { get } from 'svelte/store';
  import { inputStore } from '$lib/state/inputStore';
  import { buildShareUrl } from '$lib/utils/shareParams';
  import { showToast } from '$lib/state/toastStore';

  export let label = 'Share link';
  export let title = 'Copy share link';
  export let className = '';

  const copyShareLink = async () => {
    const state = get(inputStore);
    const url = buildShareUrl(state);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Share link copied.', { tone: 'success' });
    } catch (err) {
      showToast('Unable to copy share link.', { tone: 'error' });
    }
  };
</script>

<button
  type="button"
  class={`inline-flex items-center justify-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-400 hover:text-white transition ${className}`}
  on:click={copyShareLink}
  title={title}
  aria-label={title}
>
  <svg class="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M7 7a4 4 0 0 1 6.8-2.8l1 1a4 4 0 0 1 0 5.6l-2 2" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M17 17a4 4 0 0 1-6.8 2.8l-1-1a4 4 0 0 1 0-5.6l2-2" />
  </svg>
  <span>{label}</span>
</button>
