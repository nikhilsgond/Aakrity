/**
 * CursorOverlay — Thin React wrapper around CursorManager.
 *
 * Delegates ALL cursor logic (tracking, interpolation, rendering) to CursorManager.
 * React only handles mount/unmount lifecycle and wiring Zustand data into the manager.
 *
 * Zero React re-renders during normal cursor movement.
 *
 * Bug #13: Broadcasts local active tool in cursor position updates so remote
 *   users see a tool-appropriate cursor icon.
 * Bug #14: Freeze-on-leave is handled inside CursorManager.handlePointerLeave
 *   (no longer sends off-screen sentinel; cursor stays at last canvas position).
 */
import { useEffect, useRef } from 'react';
import useCollaborationStore from '@features/room/state/collaborationStore';
import { CursorManager } from '@features/canvas/engine/CursorManager';

export default function CursorOverlay({ canvas, canvasManager, activeTool }) {
  const managerRef = useRef(null);

  // Mount / unmount CursorManager
  useEffect(() => {
    if (!canvas || !canvasManager) return;

    const manager = new CursorManager({
      getViewport: () => canvasManager.state.viewport,
      // #13: Include tool in every cursor broadcast
      broadcastCursor: (worldX, worldY, tool) => {
        const { updateCursor } = useCollaborationStore.getState();
        updateCursor({
          worldX,
          worldY,
          tool: tool || 'select',
          viewport: {
            ...canvasManager.state.viewport,
            width: canvasManager.container?.clientWidth || 0,
            height: canvasManager.container?.clientHeight || 0,
          },
        });
      },
      getLocalUserId: () => useCollaborationStore.getState().currentUser?.id,
    });

    manager.mount(canvas);
    managerRef.current = manager;

    // --- Pointer tracking (single listener, no duplicates) ---
    const onPointerMove = (e) => manager.handlePointerMove(e);
    // #14: handlePointerLeave now freezes instead of hiding
    const onPointerLeave = () => manager.handlePointerLeave();

    const container = canvasManager.container || canvas;
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', onPointerLeave);

    // --- Viewport change (just marks dirty, no re-broadcast) ---
    const onViewportChanged = () => {
      manager.onViewportChanged();
      if (manager._lastCanvasWorldX == null || manager._lastCanvasWorldY == null) return;
      const { updateCursor } = useCollaborationStore.getState();
      updateCursor({
        worldX: manager._lastCanvasWorldX,
        worldY: manager._lastCanvasWorldY,
        tool: manager._localTool || activeTool || 'select',
        viewport: {
          ...canvasManager.state.viewport,
          width: canvasManager.container?.clientWidth || 0,
          height: canvasManager.container?.clientHeight || 0,
        },
      });
    };
    canvasManager.on?.('viewport:changed', onViewportChanged);

    // --- Subscribe to Zustand cursor + user maps (outside React render) ---
    const unsubscribe = useCollaborationStore.subscribe((state, prev) => {
      // Cursors changed → feed world coords to manager
      if (state.cursors !== prev.cursors) {
        state.cursors.forEach((pos, userId) => {
          if (!pos) return;
          const user = state.users.get(userId) || {};
          const worldX = pos.worldX ?? pos.world?.x ?? -99999;
          const worldY = pos.worldY ?? pos.world?.y ?? -99999;
          manager.updateRemoteCursor(userId, worldX, worldY, {
            name: user.name,
            color: user.color,
            state: pos.state || (pos.isTextEditing ? 'editing' : 'idle'),
            // #13: pass tool from broadcast payload
            tool: pos.tool || 'select',
          });
        });

        // Remove cursors for users no longer in the map
        manager.cursors.forEach((_, uid) => {
          if (!state.cursors.has(uid)) {
            manager.removeRemoteCursor(uid);
          }
        });
      }

      // Users changed (someone left) → remove their cursor
      if (state.users !== prev.users) {
        manager.cursors.forEach((_, uid) => {
          if (!state.users.has(uid)) {
            manager.removeRemoteCursor(uid);
          }
        });
      }
    });

    return () => {
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
      canvasManager.off?.('viewport:changed', onViewportChanged);
      unsubscribe();
      manager.destroy();
      managerRef.current = null;
    };
  }, [canvas, canvasManager]);

  // #13: Sync local active tool → CursorManager so it's included in broadcasts
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    manager.setLocalTool(activeTool || 'select');
  }, [activeTool]);

  // This component renders nothing — CursorManager manages its own DOM
  return null;
}