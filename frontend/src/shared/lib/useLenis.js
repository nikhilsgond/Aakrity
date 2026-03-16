/**
 * useLenis — initializes Lenis smooth scroll for the entire page.
 *
 * Call once at the app root. Lenis overrides the default browser scroll
 * with a smooth, physics-based inertia scroll. The RAF loop is cleaned up
 * automatically on unmount.
 */

import { useEffect } from 'react';
import Lenis from 'lenis';

export function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      // How long (seconds) the scroll momentum lasts — 1.1 is Apple-like
      duration: 1.1,
      // Exponential deceleration curve — matches Apple's scroll feel
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Prevent over-multiplied scroll on high-DPI trackpads
      wheelMultiplier: 0.9,
      touchMultiplier: 1.2,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);
}
