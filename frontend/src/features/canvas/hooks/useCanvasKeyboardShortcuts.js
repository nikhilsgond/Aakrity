import { useEffect } from 'react';

export function useCanvasKeyboardShortcuts({ zoomIn, zoomOut, resetViewport }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        e.stopPropagation();
        zoomIn();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        e.stopPropagation();
        zoomOut();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        e.stopPropagation();
        resetViewport();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [zoomIn, zoomOut, resetViewport]);
}
