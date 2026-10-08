'use client';

import { useEffect } from 'react';

/** Stable scroll-direction detection: changing the toolbar must not cause flicker. */
export function ScrollHeaderBehavior() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.monitor-site-header');
    if (!header) return;
    let previous = window.scrollY;
    let directionDistance = 0;
    let lastDirection = 0;
    let hidden = false;
    let lastTransitionAt = 0;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const current = window.scrollY;
        const delta = current - previous;
        previous = current;
        // Ignore the browser's scroll anchoring adjustment after the toolbar changes height.
        if (performance.now() - lastTransitionAt < 450) return;
        const focusInside = Boolean(document.activeElement?.closest('.monitor-header-secondary'));
        if (current < 100 || focusInside) {
          directionDistance = 0;
          lastDirection = 0;
          if (hidden) { header.classList.remove('monitor-toolbar-hidden'); hidden = false; lastTransitionAt = performance.now(); }
          return;
        }
        if (Math.abs(delta) < 2) return;
        const direction = Math.sign(delta);
        directionDistance = direction === lastDirection ? directionDistance + Math.abs(delta) : Math.abs(delta);
        lastDirection = direction;
        if (!hidden && direction > 0 && current > 180 && directionDistance > 55) {
          header.classList.add('monitor-toolbar-hidden');
          hidden = true;
          lastTransitionAt = performance.now();
          directionDistance = 0;
        } else if (hidden && direction < 0 && directionDistance > 65) {
          header.classList.remove('monitor-toolbar-hidden');
          hidden = false;
          lastTransitionAt = performance.now();
          directionDistance = 0;
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      header.classList.remove('monitor-toolbar-hidden');
    };
  }, []);
  return null;
}
