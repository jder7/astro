import { animate, set, stagger } from 'animejs';

const CARD_SELECTOR = '[id$="chart-results"] .flowbite-card, [id$="chart-results"] .glass-card';
const IN_DURATION = 700;
const OUT_DURATION = 460;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const getTargets = () => {
  if (typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll(CARD_SELECTOR)).filter(
    (node) => node && node.offsetParent !== null
  );
};

export const animatePageIn = () => {
  if (prefersReducedMotion()) return;
  const targets = getTargets();
  if (!targets.length) return;
  set(targets, {
    opacity: 0,
    scaleY: 0.92,
    scaleX: 0.98,
    translateY: 14,
    transformOrigin: '50% 0%',
  });
  animate(targets, {
    opacity: [0, 1],
    scaleY: [0.92, 1],
    scaleX: [0.98, 1],
    translateY: [14, 0],
    delay: stagger(60),
    duration: IN_DURATION,
    easing: 'easeOutCubic',
  });
};

export const animateCards = () => {
  if (prefersReducedMotion()) return;
  const targets = getTargets();
  if (!targets.length) return;
  set(targets, {
    opacity: 0,
    scaleY: 0.96,
    scaleX: 0.98,
    translateY: 10,
    transformOrigin: '50% 0%',
  });
  animate(targets, {
    opacity: [0, 1],
    scaleY: [0.96, 1],
    scaleX: [0.98, 1],
    translateY: [10, 0],
    delay: stagger(40),
    duration: 520,
    easing: 'easeOutCubic',
  });
};

export const animatePageOut = () =>
  new Promise((resolve) => {
    if (prefersReducedMotion()) {
      resolve();
      return;
    }
    const targets = getTargets();
    if (!targets.length) {
      resolve();
      return;
    }
    animate(targets, {
      opacity: [1, 0],
      scaleY: [1, 0.9],
      scaleX: [1, 0.98],
      translateY: [0, 10],
      delay: stagger(40),
      duration: OUT_DURATION,
      easing: 'easeInCubic',
      complete: resolve,
    });
  });
