import { MoveCommand } from '../commands/MoveCommand.js';
import useCollaborationStore from '@features/room/state/collaborationStore.js';
import { queryMoveGuides, getGroupEdges } from '../smartGuides/SmartGuideEngine.js';
import ObjectGeometry from '../geometry/ObjectGeometry.js';

export default class MoveController {
  constructor(canvasManager, selectionManager) {
    this.canvasManager = canvasManager;
    this.selectionManager = selectionManager;

    this.isDragging = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.objectIds = [];
    this.activeCommand = null;
    this.hasMovedSignificantly = false;
    this.dragThreshold = 2;
    this.pointerMeta = null;

    this.lastBroadcastAt = 0;
    this.broadcastIntervalMs = 50;
  }

  isActive() {
    return this.isDragging;
  }

  onPointerDown(event) {
    if (!this.selectionManager.hasSelection()) return false;

    const activeTool = this.canvasManager.getActiveTool();
    // Include precision-eraser and object-eraser so they aren't blocked by move
    const drawingTools = ['pencil', 'eraser', 'precision-eraser', 'object-eraser', 'fill'];
    if (activeTool && drawingTools.includes(activeTool.name)) {
      return false;
    }

    this.objectIds = this.selectionManager.getSelectedIds();
    if (this.objectIds.length === 0) return false;

    // Let SelectTool handle text double-click editing.
    if (event?.originalEvent?.detail >= 2 && this.objectIds.length === 1) {
      const selectedObj = this.canvasManager.getObjectById(this.objectIds[0]);
      if (selectedObj?.type === 'text') {
        return false;
      }
    }

    // Bug 1: When a text or sticky note is in edit mode (contenteditable overlay
    // is focused/visible), pointer events within the object bounds should be
    // allowed for caret placement — but NOT captured for drag-moving.
    // We detect edit state via the text tool's isEditing flag or the sticky editor.
    // A drag that STARTS outside the contenteditable element is fine to move.
    if (this.objectIds.length === 1) {
      const selectedObj = this.canvasManager.getObjectById(this.objectIds[0]);
      if (selectedObj) {
        // Check if text tool is actively editing this object
        if (selectedObj.type === 'text') {
          const textTool = this.canvasManager.toolManager?.getToolInstance?.('text');
          if (textTool?.isEditing && textTool.editingTextId === selectedObj.id) {
            // If the down event target is the contenteditable input, let it through
            const targetEl = event?.originalEvent?.target;
            if (targetEl && targetEl.hasAttribute('data-text-tool-input')) {
              return false; // Let the contenteditable handle it
            }
          }
        }
        // Check if sticky note editor is open (data-sticky-editor attribute)
        if (selectedObj.type === 'sticky') {
          const stickyEditor = document.querySelector(`[data-sticky-editor="${selectedObj.id}"]`);
          if (stickyEditor) {
            const targetEl = event?.originalEvent?.target;
            if (targetEl === stickyEditor || stickyEditor.contains(targetEl)) {
              return false; // Let the contenteditable handle it
            }
          }
        }
      }
    }

    const worldPoint = this.canvasManager.screenToWorld(event.x, event.y);
    let clickedOnSelectedObject = false;

    const lockedIds = useCollaborationStore.getState().remoteSelections;
    let isAnyLocked = false;
    if (lockedIds && lockedIds.size > 0) {
      for (const [remoteUserId, remoteIds] of lockedIds.entries()) {
        for (const id of this.objectIds) {
          if (remoteIds.includes(id)) {
            isAnyLocked = true;
            console.warn(`Object ${id} is locked by user ${remoteUserId}`);
            break;
          }
        }
        if (isAnyLocked) break;
      }
    }

    if (isAnyLocked) {
      this.canvasManager.emit('object:locked', { objectIds: this.objectIds });
      return false;
    }

    for (const id of this.objectIds) {
      const obj = this.canvasManager.getObjectById(id);
      if (!obj) continue;
      const bounds = this.canvasManager.getObjectBounds(obj);
      if (!bounds) continue;
      if (this.canvasManager.isPointInBounds(worldPoint, bounds, 5)) {
        clickedOnSelectedObject = true;
        break;
      }
    }

    if (!clickedOnSelectedObject) return false;

    this.startPoint = { ...worldPoint };
    this.currentPoint = { ...worldPoint };
    const firstObject = this.canvasManager.getObjectById(this.objectIds[0]);
    this.pointerMeta = {
      objectId: firstObject?.id || null,
      objectType: firstObject?.type || null,
    };
    this.isDragging = true;
    this.hasMovedSignificantly = false;
    this.lastBroadcastAt = 0;
    this.activeCommand = new MoveCommand(this.objectIds, { x: 0, y: 0 });
    this.activeCommand.userId = useCollaborationStore.getState().currentUser?.id || null;
    return true;
  }

  onPointerMove(event) {
    if (!this.isDragging || !this.activeCommand) return null;

    const newPoint = this.canvasManager.screenToWorld(event.x, event.y);
    let totalDelta = {
      x: newPoint.x - this.startPoint.x,
      y: newPoint.y - this.startPoint.y,
    };

    if (!this.hasMovedSignificantly) {
      const distance = Math.sqrt(totalDelta.x * totalDelta.x + totalDelta.y * totalDelta.y);
      if (distance > this.dragThreshold) {
        this.hasMovedSignificantly = true;
      }
    }

    this.currentPoint = newPoint;

    // ── Smart Guides snapping ──────────────────────────────
    const sgs = this.canvasManager.smartGuideState;
    const suppressSnap = !!(event.ctrlKey || event.metaKey);
    sgs.suppressed = suppressSnap;

    // Undo previous frame's command application first so objects are at initial positions
    if (this.activeCommand.initialPositions) {
      this.activeCommand.undo(this.canvasManager.state);
    }

    if (!suppressSnap && this.hasMovedSignificantly) {
      // Objects are at their initial positions now — compute target bounds
      const movingBounds = this._getMovingBounds(totalDelta);

      if (movingBounds) {
        sgs.mode = 'move';
        const result = queryMoveGuides(
          movingBounds,
          this.canvasManager.state.objects,
          this.objectIds,
          sgs.currentAlignSnaps,
        );

        // Apply snap correction
        totalDelta.x += result.snapDelta.x;
        totalDelta.y += result.snapDelta.y;

        sgs.alignGuides    = result.alignGuides;
        sgs.spacingGuides  = result.spacingGuides;
        sgs.currentAlignSnaps = result.newSnaps;
      }
    } else {
      sgs.alignGuides = [];
      sgs.spacingGuides = [];
    }

    this.activeCommand.delta = { ...totalDelta };
    this.activeCommand.execute(this.canvasManager.state);
    this.canvasManager.requestRender();

    if (this.hasMovedSignificantly && this.canvasManager) {
      const now = performance.now();
      if (now - this.lastBroadcastAt >= this.broadcastIntervalMs) {
        this.lastBroadcastAt = now;
        // Broadcast absolute positions instead of deltas to avoid
        // cumulative drift and overshoot on remote screens.
        const positions = this.objectIds
          .map((id) => {
            const obj = this.canvasManager.state.objects.find((o) => o.id === id);
            if (!obj) return null;
            const snapshot = { id };
            ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'rotation', 'radius', 'radiusX', 'radiusY']
              .forEach((k) => { if (obj[k] !== undefined) snapshot[k] = obj[k]; });
            if (Array.isArray(obj.points)) {
              snapshot.points = obj.points.map((p) => ({ ...p }));
            }
            return snapshot;
          })
          .filter(Boolean);
        this.canvasManager.emit('move:update', {
          objectIds: this.objectIds,
          positions,
        });
      }
    }

    return totalDelta;
  }

  onPointerUp(event) {
    if (!this.isDragging) return null;

    let result = null;

    if (this.hasMovedSignificantly && this.activeCommand) {
      this.canvasManager.historyManager.applyOwnership(this.canvasManager.state, this.activeCommand);
      this.canvasManager.historyManager.registerWithoutExecuting(this.activeCommand);
      this.canvasManager.emit('state:changed', {
        type: 'local',
        command: this.activeCommand,
      });

      result = {
        command: this.activeCommand.serialize(),
        type: 'local',
      };

      const positions = this.objectIds
        .map((id) => {
          const obj = this.canvasManager.state.objects.find((o) => o.id === id);
          if (!obj) return null;
          const snapshot = { id };
          ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'rotation', 'radius', 'radiusX', 'radiusY', 'flipX', 'flipY']
            .forEach((k) => { if (obj[k] !== undefined) snapshot[k] = obj[k]; });
          if (Array.isArray(obj.points)) {
            snapshot.points = obj.points.map((p) => ({ ...p }));
          }
          return snapshot;
        })
        .filter(Boolean);

      this.canvasManager.emit('move:final', {
        objectIds: this.objectIds,
        positions,
      });
    } else {
      // No significant move — undo any partial command application
      if (this.activeCommand && this.activeCommand.initialPositions) {
        this.activeCommand.undo(this.canvasManager.state);
        this.canvasManager.requestRender();
      }

      // Click (no drag) on selected text should reopen editor.
      if (
        this.objectIds.length === 1 &&
        this.pointerMeta?.objectType === 'text'
      ) {
        const point = this.currentPoint || this.startPoint || this.canvasManager.screenToWorld(event?.x || 0, event?.y || 0);
        this.canvasManager.emit('text:edit', {
          objectId: this.objectIds[0],
          point,
        });
      }
    }

    this.reset();
    return result;
  }

  reset() {
    // Clear smart guide state
    if (this.canvasManager?.smartGuideState) {
      this.canvasManager.smartGuideState.reset();
      this.canvasManager.requestRender();
    }
    this.isDragging = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.objectIds = [];
    this.activeCommand = null;
    this.hasMovedSignificantly = false;
    this.pointerMeta = null;
    this.lastBroadcastAt = 0;
  }

  cancel() {
    if (this.isDragging && this.activeCommand && this.activeCommand.initialPositions) {
      this.activeCommand.undo(this.canvasManager.state);
      this.canvasManager.requestRender();
    }
    this.reset();
  }

  /**
   * Compute the AABB of all objects being moved, with the given delta applied.
   * Must be called AFTER undo (objects at initial positions).
   */
  _getMovingBounds(delta) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of this.objectIds) {
      const obj = this.canvasManager.getObjectById(id);
      if (!obj) continue;
      const b = ObjectGeometry.getBounds(obj);
      if (!b) continue;
      minX = Math.min(minX, b.x + delta.x);
      minY = Math.min(minY, b.y + delta.y);
      maxX = Math.max(maxX, b.x + b.width + delta.x);
      maxY = Math.max(maxY, b.y + b.height + delta.y);
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}
