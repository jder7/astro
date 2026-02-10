import { writable } from 'svelte/store';

const DEFAULT_DURATION = 3200;

const createToastStore = () => {
  const { subscribe, set } = writable({ message: '', visible: false, tone: 'info' });
  let timeoutId;

  const show = (message, options = {}) => {
    if (!message) return;
    const duration = Number.isFinite(options.duration) ? options.duration : DEFAULT_DURATION;
    const tone = options.tone || 'info';
    set({ message, visible: true, tone });
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      set({ message: '', visible: false, tone });
    }, duration);
  };

  const clear = () => {
    if (timeoutId) clearTimeout(timeoutId);
    set({ message: '', visible: false, tone: 'info' });
  };

  return { subscribe, show, clear };
};

export const toastStore = createToastStore();

export const showToast = (message, options) => toastStore.show(message, options);
