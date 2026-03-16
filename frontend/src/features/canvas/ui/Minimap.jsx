import { useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '@app/state/uiStore';
import useCollaborationStore from '@features/room/state/collaborationStore';

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 130;
const PADDING = 6;

/**
 * Minimap component – renders a birds-eye overview of the entire canvas
 * and shows the current viewport as a highlighted rectangle.
 * Click / drag inside the minimap to pan the main canvas.
 */
export default function Minimap({ canvasManager, canvasState }) {
  const canvasRef = useRef(null);
  const isDragging = useRef(false);
  const rafRef = useRef(null);
  const visible = useUIStore((s) => s.isMinimapOpen);
  const theme = useUIStore((s) => s.theme);
  const cursors = useCollaborationStore((s) => s.cursors);
  const users = useCollaborationStore((s) => s.users);
  const currentUserId = useCollaborationStore((s) => s.currentUser?.id);

  // ---- helpers ----

  /** Compute the mapping from world coords to minimap pixel coords */
  const getMapping = useCallback(() => {
    if (!canvasManager) return null;

    const bounds = typeof canvasManager.getCanvasBounds === 'function'
      ? canvasManager.getCanvasBounds()
      : canvasManager.state?.canvasBounds;
    if (!bounds) return null;
    const width = Number.isFinite(bounds.width)
      ? bounds.width
      : (bounds.maxX ?? 0) - (bounds.minX ?? 0);
    const height = Number.isFinite(bounds.height)
      ? bounds.height
      : (bounds.maxY ?? 0) - (bounds.minY ?? 0);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    if (width <= 0 || height <= 0) return null;

    const innerW = MINIMAP_WIDTH - PADDING * 2;
    const innerH = MINIMAP_HEIGHT - PADDING * 2;
    const scale = Math.min(innerW / width, innerH / height);
    if (!Number.isFinite(scale) || scale <= 0) return null;

    return {
      bounds: { ...bounds, width, height },
      scale,
      innerW,
      innerH,
    };
  }, [canvasManager]);

  /** Convert a minimap pixel position to the world coordinate it represents */
  const minimapToWorld = useCallback((mx, my) => {
    const m = getMapping();
    if (!m) return { x: 0, y: 0 };

    const { bounds, scale, innerW, innerH } = m;
    const drawW = bounds.width * scale;
    const drawH = bounds.height * scale;
    const offsetX = PADDING + (innerW - drawW) / 2;
    const offsetY = PADDING + (innerH - drawH) / 2;

    const worldX = bounds.minX + (mx - offsetX) / scale;
    const worldY = bounds.minY + (my - offsetY) / scale;
    return { x: worldX, y: worldY };
  }, [getMapping]);

  /** Pan the main canvas so the viewport centres on a given world point */
  const panToWorld = useCallback((worldX, worldY) => {
    if (!canvasManager || !canvasManager.container) return;

    const zoom = canvasManager.state.viewport.zoom;
    const screenW = canvasManager.container.clientWidth;
    const screenH = canvasManager.container.clientHeight;

    // Desired panX/panY so that (worldX, worldY) is at screen centre
    const targetPanX = screenW / 2 - worldX * zoom;
    const targetPanY = screenH / 2 - worldY * zoom;

    const deltaX = targetPanX - canvasManager.state.viewport.panX;
    const deltaY = targetPanY - canvasManager.state.viewport.panY;

    if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
      canvasManager.pan(deltaX, deltaY);
    }
  }, [canvasManager]);

  // ---- pointer interaction (click / drag) ----

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;
    isDragging.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const world = minimapToWorld(mx, my);
    panToWorld(world.x, world.y);
    if (typeof e.pointerId === 'number') {
      canvasRef.current.setPointerCapture(e.pointerId);
    }
  }, [minimapToWorld, panToWorld]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const world = minimapToWorld(mx, my);
    panToWorld(world.x, world.y);
  }, [minimapToWorld, panToWorld]);

  const handlePointerUp = useCallback((e) => {
    isDragging.current = false;
    if (canvasRef.current) {
      if (typeof e.pointerId === 'number' && canvasRef.current.hasPointerCapture?.(e.pointerId)) {
        canvasRef.current.releasePointerCapture(e.pointerId);
      }
    }
  }, []);

  // ---- render minimap ----

  const draw = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs || !canvasManager) return;

    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    cvs.width = MINIMAP_WIDTH * dpr;
    cvs.height = MINIMAP_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    const isDark = theme === 'dark';

    // Background
    ctx.fillStyle = isDark ? '#1a1a1a' : '#f8f8f8';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    const m = getMapping();
    if (!m) return;

    const { bounds, scale, innerW, innerH } = m;
    const drawW = bounds.width * scale;
    const drawH = bounds.height * scale;
    const offsetX = PADDING + (innerW - drawW) / 2;
    const offsetY = PADDING + (innerH - drawH) / 2;

    // Canvas area background
    ctx.fillStyle = isDark ? '#222' : '#fff';
    ctx.fillRect(offsetX, offsetY, drawW, drawH);

    // Subtle grid lines to improve visibility
    const gridCols = 6;
    const gridRows = 4;
    ctx.save();
    ctx.strokeStyle = isDark ? '#2a2a2a' : '#e5e7eb';
    ctx.lineWidth = 0.75;
    for (let i = 1; i < gridCols; i += 1) {
      const gx = offsetX + (drawW / gridCols) * i;
      ctx.beginPath();
      ctx.moveTo(gx, offsetY);
      ctx.lineTo(gx, offsetY + drawH);
      ctx.stroke();
    }
    for (let j = 1; j < gridRows; j += 1) {
      const gy = offsetY + (drawH / gridRows) * j;
      ctx.beginPath();
      ctx.moveTo(offsetX, gy);
      ctx.lineTo(offsetX + drawW, gy);
      ctx.stroke();
    }
    ctx.restore();

    // Draw viewport rectangle
    const { zoom, panX, panY } = canvasManager.state.viewport;
    const screenW = canvasManager.container?.clientWidth || 800;
    const screenH = canvasManager.container?.clientHeight || 600;

    // Top-left corner of viewport in world coordinates
    const vtlX = (0 - panX) / zoom;
    const vtlY = (0 - panY) / zoom;
    const vw = screenW / zoom;
    const vh = screenH / zoom;

    const vx = offsetX + (vtlX - bounds.minX) * scale;
    const vy = offsetY + (vtlY - bounds.minY) * scale;
    const vrw = vw * scale;
    const vrh = vh * scale;

    // Viewport rect stroke (always blue outline for local user view)
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.75;
    ctx.strokeRect(vx, vy, vrw, vrh);

    const cursorEntries = cursors instanceof Map ? cursors.entries() : Object.entries(cursors || {});
    for (const [userId, cursor] of cursorEntries) {
      if (!cursor?.viewport || userId === currentUserId) continue;

      const remoteZoom = cursor.viewport.zoom || 1;
      const remotePanX = cursor.viewport.panX || 0;
      const remotePanY = cursor.viewport.panY || 0;
      const remoteScreenW = cursor.viewport.width || screenW;
      const remoteScreenH = cursor.viewport.height || screenH;
      const remoteUser = users instanceof Map ? users.get(userId) : users?.[userId];
      const remoteColor = remoteUser?.color || '#10B981';
      const remoteVtlX = (0 - remotePanX) / remoteZoom;
      const remoteVtlY = (0 - remotePanY) / remoteZoom;
      const remoteVw = remoteScreenW / remoteZoom;
      const remoteVh = remoteScreenH / remoteZoom;
      const remoteX = offsetX + (remoteVtlX - bounds.minX) * scale;
      const remoteY = offsetY + (remoteVtlY - bounds.minY) * scale;
      const remoteW = remoteVw * scale;
      const remoteH = remoteVh * scale;

      ctx.save();
      ctx.strokeStyle = remoteColor;
      ctx.fillStyle = `${remoteColor}22`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(remoteX, remoteY, remoteW, remoteH);
      ctx.strokeRect(remoteX, remoteY, remoteW, remoteH);
      ctx.restore();
    }

    // Border around minimap
    ctx.strokeStyle = isDark ? '#333' : '#d4d4d8';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, MINIMAP_WIDTH - 1, MINIMAP_HEIGHT - 1);
  }, [canvasManager, currentUserId, cursors, getMapping, theme, users]);

  // Redraw whenever canvasState changes (viewport, objects, etc.)
  useEffect(() => {
    if (!visible) return;
    // Use rAF to batch redraws
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [visible, draw, canvasState, cursors, theme]);

  // Also subscribe to viewport:changed and state:changed for live updates
  useEffect(() => {
    if (!canvasManager || !visible) return;

    const redraw = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    };

    canvasManager.on('viewport:changed', redraw);
    canvasManager.on('state:changed', redraw);
    window.addEventListener('resize', redraw);

    return () => {
      canvasManager.off('viewport:changed', redraw);
      canvasManager.off('state:changed', redraw);
      window.removeEventListener('resize', redraw);
    };
  }, [canvasManager, visible, draw]);

  if (!canvasManager) return null;

  return (
    <>
      {/* Toggle button rendered by parent Toolbar — this is just the panel */}
      {visible && (
        <div
          className="fixed left-[68px] bottom-4 z-50 rounded-xl shadow-xl border border-border bg-card overflow-hidden select-none"
          style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT, cursor: 'crosshair' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>
      )}
    </>
  );
}
