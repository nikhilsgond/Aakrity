/**
 * CanvasScrollbars.jsx
 * Thin scrollbar overlays (horizontal + vertical) that show the current scroll
 * position and allow panning by dragging — similar to code-editor scrollbars.
 * Works at all zoom levels including 1-5%.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const SCROLLBAR_SIZE = 8; // px thickness
const MIN_THUMB_SIZE = 24; // px minimum thumb size

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default function CanvasScrollbars({ canvasManager, canvasState }) {
  const [hBar, setHBar] = useState(null); // { thumbLeft, thumbWidth, trackWidth }
  const [vBar, setVBar] = useState(null); // { thumbTop, thumbHeight, trackHeight }
  const dragRef = useRef(null); // { axis, startPos, startPanX, startPanY }
  const containerRef = useRef(null);

  // ── Compute scrollbar geometry from viewport ──
  const compute = useCallback(() => {
    if (!canvasManager) return;
    const bounds = canvasManager.canvasBounds;
    const { zoom, panX, panY } = canvasManager.state.viewport;
    const container = canvasManager.container;
    if (!bounds || !container) return;

    const canvasCSSW = container.clientWidth || 800;
    const canvasCSSH = container.clientHeight || 600;

    // World dimensions scaled to screen pixels
    const worldW = bounds.maxX - bounds.minX;
    const worldH = bounds.maxY - bounds.minY;
    const scaledW = worldW * zoom;
    const scaledH = worldH * zoom;

    // Total scrollable pixel range
    const totalW = Math.max(scaledW, canvasCSSW);
    const totalH = Math.max(scaledH, canvasCSSH);

    // Current scroll position in pixels (how far we've panned from the origin)
    // panX = -minX*zoom means we're at the left edge (scrollX = 0)
    // panX = canvasCSSW - maxX*zoom means we're at the right edge
    const maxPanX = -bounds.minX * zoom;
    const minPanX = canvasCSSW - bounds.maxX * zoom;
    const scrollRangeX = maxPanX - minPanX; // total pan travel
    // scrollX is 0 at left edge, scrollRangeX at right edge
    const scrollX = clamp(maxPanX - panX, 0, scrollRangeX);

    const maxPanY = -bounds.minY * zoom;
    const minPanY = canvasCSSH - bounds.maxY * zoom;
    const scrollRangeY = maxPanY - minPanY;
    const scrollY = clamp(maxPanY - panY, 0, scrollRangeY);

    // Thumb width = (viewport / total) * track
    const trackW = canvasCSSW - SCROLLBAR_SIZE;
    const trackH = canvasCSSH - SCROLLBAR_SIZE;

    const thumbW = Math.max(MIN_THUMB_SIZE, (canvasCSSW / Math.max(totalW, 1)) * trackW);
    const thumbH = Math.max(MIN_THUMB_SIZE, (canvasCSSH / Math.max(totalH, 1)) * trackH);

    // Thumb offset
    const thumbLeft = scrollRangeX > 0
      ? (scrollX / scrollRangeX) * (trackW - thumbW)
      : 0;
    const thumbTop = scrollRangeY > 0
      ? (scrollY / scrollRangeY) * (trackH - thumbH)
      : 0;

    // Only show scrollbar when world is bigger than viewport or close to it
    // (always show for usability)
    setHBar({ thumbLeft, thumbWidth: thumbW, trackWidth: trackW, visible: scrollRangeX > 1 });
    setVBar({ thumbTop, thumbHeight: thumbH, trackHeight: trackH, visible: scrollRangeY > 1 });
  }, [canvasManager]);

  // Re-compute on every viewport change
  useEffect(() => {
    if (!canvasManager) return;
    compute();
    canvasManager.on('viewport:changed', compute);
    canvasManager.on('move:final', compute);
    canvasManager.on('state:changed', compute);
    return () => {
      canvasManager.off('viewport:changed', compute);
      canvasManager.off('move:final', compute);
      canvasManager.off('state:changed', compute);
    };
  }, [canvasManager, compute]);

  // Also re-compute when canvasState changes (zoom, pan)
  useEffect(() => {
    compute();
  }, [canvasState, compute]);

  // ── Drag handlers ──
  const onPointerDownH = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      axis: 'h',
      startPos: e.clientX,
      startPanX: canvasManager.state.viewport.panX,
    };
    document.addEventListener('pointermove', onPointerMoveDrag);
    document.addEventListener('pointerup', onPointerUpDrag);
  }, [canvasManager]); // eslint-disable-line

  const onPointerDownV = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      axis: 'v',
      startPos: e.clientY,
      startPanY: canvasManager.state.viewport.panY,
    };
    document.addEventListener('pointermove', onPointerMoveDrag);
    document.addEventListener('pointerup', onPointerUpDrag);
  }, [canvasManager]); // eslint-disable-line

  const onPointerMoveDrag = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag || !canvasManager) return;

    const bounds = canvasManager.canvasBounds;
    const { zoom } = canvasManager.state.viewport;
    const container = canvasManager.container;
    if (!bounds || !container) return;

    const canvasCSSW = container.clientWidth || 800;
    const canvasCSSH = container.clientHeight || 600;

    if (drag.axis === 'h') {
      const worldW = bounds.maxX - bounds.minX;
      const scaledW = worldW * zoom;
      const totalW = Math.max(scaledW, canvasCSSW);
      const trackW = canvasCSSW - SCROLLBAR_SIZE;
      const thumbW = Math.max(MIN_THUMB_SIZE, (canvasCSSW / Math.max(totalW, 1)) * trackW);
      const maxPanX = -bounds.minX * zoom;
      const minPanX = canvasCSSW - bounds.maxX * zoom;
      const scrollRangeX = maxPanX - minPanX;
      const thumbTravel = trackW - thumbW;
      if (thumbTravel <= 0) return;

      const deltaPx = e.clientX - drag.startPos;
      // scrollX: moving thumb right → scrolling right → panX decreases
      const deltaScroll = (deltaPx / thumbTravel) * scrollRangeX;
      const newPanX = clamp(drag.startPanX - deltaScroll, minPanX, maxPanX);
      canvasManager.pan(newPanX - canvasManager.state.viewport.panX, 0);
      compute();
    } else {
      const worldH = bounds.maxY - bounds.minY;
      const scaledH = worldH * zoom;
      const totalH = Math.max(scaledH, canvasCSSH);
      const trackH = canvasCSSH - SCROLLBAR_SIZE;
      const thumbH = Math.max(MIN_THUMB_SIZE, (canvasCSSH / Math.max(totalH, 1)) * trackH);
      const maxPanY = -bounds.minY * zoom;
      const minPanY = canvasCSSH - bounds.maxY * zoom;
      const scrollRangeY = maxPanY - minPanY;
      const thumbTravel = trackH - thumbH;
      if (thumbTravel <= 0) return;

      const deltaPx = e.clientY - drag.startPos;
      const deltaScroll = (deltaPx / thumbTravel) * scrollRangeY;
      const newPanY = clamp(drag.startPanY - deltaScroll, minPanY, maxPanY);
      canvasManager.pan(0, newPanY - canvasManager.state.viewport.panY);
      compute();
    }
  }, [canvasManager, compute]);

  const onPointerUpDrag = useCallback(() => {
    dragRef.current = null;
    document.removeEventListener('pointermove', onPointerMoveDrag);
    document.removeEventListener('pointerup', onPointerUpDrag);
  }, [onPointerMoveDrag]); // eslint-disable-line

  if (!canvasManager) return null;

  const thumbStyle = {
    position: 'absolute',
    background: 'rgba(100,116,139,0.5)',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'background 0.15s',
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {/* Horizontal scrollbar */}
      {hBar?.visible && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: SCROLLBAR_SIZE,
            bottom: 0,
            height: SCROLLBAR_SIZE,
            background: 'rgba(0,0,0,0.04)',
            pointerEvents: 'auto',
          }}
        >
          <div
            onPointerDown={onPointerDownH}
            style={{
              ...thumbStyle,
              bottom: 1,
              top: 1,
              left: hBar.thumbLeft,
              width: hBar.thumbWidth,
            }}
          />
        </div>
      )}

      {/* Vertical scrollbar */}
      {vBar?.visible && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: SCROLLBAR_SIZE,
            right: 0,
            width: SCROLLBAR_SIZE,
            background: 'rgba(0,0,0,0.04)',
            pointerEvents: 'auto',
          }}
        >
          <div
            onPointerDown={onPointerDownV}
            style={{
              ...thumbStyle,
              right: 1,
              left: 1,
              top: vBar.thumbTop,
              height: vBar.thumbHeight,
            }}
          />
        </div>
      )}
    </div>
  );
}
