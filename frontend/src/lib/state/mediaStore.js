import { readable } from 'svelte/store';

const createMediaQueryStore = (query, fallback = false) =>
  readable(fallback, (set) => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return () => {};
    }
    const media = window.matchMedia(query);
    const update = () => set(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  });

export const isMobileStore = createMediaQueryStore('(max-width: 640px)', false);
