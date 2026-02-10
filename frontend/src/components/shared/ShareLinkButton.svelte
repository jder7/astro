<script>
  import { get } from 'svelte/store';
  import { inputStore } from '$lib/state/inputStore';
  import { buildShareUrl } from '$lib/utils/shareParams';
  import { showToast } from '$lib/state/toastStore';

  export let label = '';
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
  class={`inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-800 bg-slate-900/70 text-sm font-semibold text-slate-200 hover:border-cyan-400 hover:text-white transition ${className}`}
  on:click={copyShareLink}
  title={title}
  aria-label={title}
>
  <span aria-hidden="true">🔗</span>
</button>
