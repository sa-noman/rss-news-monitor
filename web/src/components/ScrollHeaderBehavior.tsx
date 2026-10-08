'use client';

import { useEffect } from 'react';

/** Hide just the search/filter toolbar while scrolling down, restore on upward scroll. */
export function ScrollHeaderBehavior() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.monitor-site-header');
    if (!header) return;
    let lastY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const current = window.scrollY;
        const delta = current - lastY;
        const focusInsideToolbar = Boolean(document.activeElement?.closest('.monitor-header-secondary'));
        if (current < 48 || delta < -5 || focusInsideToolbar) {
          header.classList.remove('monitor-toolbar-hidden');
        } else if (current > 145 && delta > 5) {
          header.classList.add('monitor-toolbar-hidden');
        }
        lastY = current;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      header.classList.remove('monitor-toolbar-hidden');
    };
  }, []);
  return null;
}
