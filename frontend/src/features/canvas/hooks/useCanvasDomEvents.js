import { useEffect } from 'react';

export function useCanvasDomEvents({
  isReady,
  containerRef,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleWheel,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
}) {
  useEffect(() => {
    if (!isReady || !containerRef.current) return;

    const container = containerRef.current;

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);
    container.addEventListener('contextmenu', preventContextMenu);
    container.addEventListener('dragenter', handleDragEnter);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      container.removeEventListener('contextmenu', preventContextMenu);
      container.removeEventListener('dragenter', handleDragEnter);
      container.removeEventListener('dragleave', handleDragLeave);
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
  }, [
    isReady,
    containerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  ]);

  // Prevent browser zoom globally (Ctrl+wheel, Ctrl+=/-, Ctrl+0) on the whole page
  useEffect(() => {
    const preventBrowserZoom = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+' || e.key === '-' || e.key === '0')) {
        e.preventDefault();
      }
    };
    const preventWheelZoom = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', preventBrowserZoom);
    document.addEventListener('wheel', preventWheelZoom, { passive: false });
    return () => {
      document.removeEventListener('keydown', preventBrowserZoom);
      document.removeEventListener('wheel', preventWheelZoom);
    };
  }, []);
}

function preventContextMenu(e) {
  e.preventDefault();
}
