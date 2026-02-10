<script>
  import { toastStore } from '$lib/state/toastStore';

  $: toast = $toastStore;
</script>

{#if toast?.visible}
  <div class={`toast-shell toast-${toast.tone || 'info'}`} role="status" aria-live="polite">
    <span>{toast.message}</span>
  </div>
{/if}

<style>
  .toast-shell {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    padding: 0.7rem 1.1rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(15, 23, 42, 0.92);
    color: #e2e8f0;
    font-size: 0.9rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    box-shadow: 0 18px 40px rgba(2, 6, 23, 0.45);
    z-index: 50;
    max-width: min(90vw, 520px);
    text-align: center;
  }

  .toast-success {
    border-color: rgba(34, 197, 94, 0.45);
    color: #bbf7d0;
  }

  .toast-warning {
    border-color: rgba(251, 191, 36, 0.55);
    color: #fde68a;
  }

  .toast-error {
    border-color: rgba(248, 113, 113, 0.6);
    color: #fecdd3;
  }
</style>
