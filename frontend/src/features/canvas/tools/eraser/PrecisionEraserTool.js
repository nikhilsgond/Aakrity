// PrecisionEraserTool.js
// ──────────────────────────────────────────────────────────────────────
// Precision (stroke-splitting) eraser — splits drawing strokes at the
// eraser path, like Miro's partial eraser.
//
// Architecture:
//   • World-coordinate only — zoom-safe at 1 %–400 %
//   • Live state mutation during drag   (matches TransformController pattern)
//   • Single ApplyEraserCommand on pointerUp via registerWithoutExecuting
//   • Lock-safe — skips objects locked by other users
//   • Throttled pointermove (16 ms ≈ 60 fps)
// ──────────────────────────────────────────────────────────────────────

import {
  splitPolylineByCircle,
  circleIntersectsBounds,
  cloneCanvasObject,
} from './lib/eraserMath.js';
import { ApplyEraserCommand } from '../../engine/commands/EraserCommands.js';
import { generateId } from '@shared/lib/idGenerator.js';
import useCollaborationStore from '@features/room/state/collaborationStore';

const THROTTLE_MS = 16;

export class PrecisionEraserTool {
  constructor(options = {}) {
    this.name = 'precision-eraser';
    this.cursor = 'none';
    this.options = { width: 10, ...options };

    this.canvasManager = null;
    this.isErasing = false;
    this.lastMoveTime = 0;

    // ── per-drag tracking ──
    // key = objectId
    // value = { original: snapshot | null, current: obj | null, isNew: boolean }
    //   original  — first snapshot before any modification (null for new splits)
    //   current   — latest state (null ⇒ fully erased / removed)
    //   isNew     — true for segments created by splitting during this drag
    this.tracked = new Map();
  }

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */


  getCursor() {
    return this.cursor;
  }

  activate(canvasManager, toolOptions) {
    this.canvasManager = canvasManager;
    if (toolOptions) this.options = { ...this.options, ...toolOptions };
  }

  deactivate() {
    if (this.isErasing) this._rollback();
    this.canvasManager = null;
  }

  setOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }

  /* ------------------------------------------------------------------ */
  /*  World-coordinate helpers                                           */
  /* ------------------------------------------------------------------ */

  /** Eraser radius in world units — shrinks as zoom increases. */
  _getWorldRadius() {
    const zoom = this.canvasManager?.state?.viewport?.zoom || 1;
    return (this.options.width / 2) / zoom;
  }

  /* ------------------------------------------------------------------ */
  /*  Lock checking                                                      */
  /* ------------------------------------------------------------------ */

  _isLocked(objectId) {
    try {
      const store = this.canvasManager?._collaborationStore || useCollaborationStore;
      const state = typeof store?.getState === 'function' ? store.getState() : store;
      if (!state) return false;

      const lockedByOther = typeof state.isLockedByOther === 'function'
        ? !!state.isLockedByOther(objectId)
        : false;
      if (lockedByOther) return true;

      const currentUserId = state.currentUser?.id;
      const remoteSelections = state.remoteSelections;
      if (remoteSelections instanceof Map) {
        for (const [userId, objectIds] of remoteSelections.entries()) {
          if (userId === currentUserId) continue;
          if (Array.isArray(objectIds) && objectIds.includes(objectId)) return true;
          if (objectIds instanceof Set && objectIds.has(objectId)) return true;
        }
      }
    } catch { /* ignore */ }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /*  Pointer handlers                                                   */
  /* ------------------------------------------------------------------ */

  onPointerDown(event) {
    if (!this.canvasManager) return null;

    this.isErasing = true;
    this.tracked = new Map();
    this._eraseAt(event.x, event.y);

    return null; // command emitted on pointerUp
  }

  onPointerMove(event) {
    if (!this.isErasing || !this.canvasManager) return;

    const now = Date.now();
    if (now - this.lastMoveTime < THROTTLE_MS) return;
    this.lastMoveTime = now;

    this._eraseAt(event.x, event.y);
  }

  onPointerUp(event) {
    if (!this.isErasing || !this.canvasManager) return null;
    this.isErasing = false;

    // Final erase at release position
    this._eraseAt(event.x, event.y);

    if (this.tracked.size === 0) return null;

    // ── Build command from accumulated changes ──
    const beforeObjects = [];
    const afterObjects = [];
    const addedObjects = [];

    for (const [, entry] of this.tracked) {
      if (entry.isNew) {
        // New segment created by splitting
        if (entry.current) addedObjects.push(cloneCanvasObject(entry.current));
      } else {
        // Original object that was modified / deleted
        beforeObjects.push(cloneCanvasObject(entry.original));
        if (entry.current) afterObjects.push(cloneCanvasObject(entry.current));
        // (if current is null the object was fully erased — no afterObject)
      }
    }

    const command = new ApplyEraserCommand({
      beforeObjects,
      afterObjects,
      addedObjects,
      meta: { tool: 'precision-eraser' },
    });

    // State was already mutated during the drag — register without re-executing
    this.canvasManager.historyManager.registerWithoutExecuting(command);
    this.canvasManager.updateObjectIndex();
    this.canvasManager.emit('state:changed', { type: 'local', command });

    this.tracked = new Map();
    return null; // command already registered
  }

  /* ------------------------------------------------------------------ */
  /*  Core erase logic                                                   */
  /* ------------------------------------------------------------------ */

  _eraseAt(worldX, worldY) {
    const center = { x: worldX, y: worldY };
    const baseRadius = this._getWorldRadius();
    const objects = this.canvasManager.state.objects;

    // Track live changes for broadcast
    const liveChanges = { deletedIds: [], modifiedObjects: [], addedObjects: [] };

    // Iterate backwards so splices are index-safe
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (!obj || obj.type !== 'drawing') continue;

      // Already fully deleted during this drag?
      const entry = this.tracked.get(obj.id);
      if (entry && entry.current === null) continue;

      // Lock guard
      if (this._isLocked(obj.id)) continue;

      // Use the latest version (tracked or state)
      const currentObj = entry?.current || obj;
      if (!currentObj.points || currentObj.points.length < 2) continue;

      // Expand eraser radius by the stroke's half-width so the eraser
      // interacts with the visible edge of the stroke, not just its
      // mathematical center-line.  This makes thick strokes much easier
      // to erase — the user only needs to touch the painted area.
      const strokeHalf = (currentObj.strokeWidth || 2) / 2;
      const radius = baseRadius + strokeHalf;

      // ── Fast bounding-box reject ──
      const bounds = this._getDrawingBounds(currentObj);
      if (!circleIntersectsBounds(center, radius, bounds)) continue;

      // ── Split polyline ──
      const segments = splitPolylineByCircle(currentObj.points, center, radius);

      if (segments.length === 0) {
        // ▸ Fully erased
        if (!entry) {
          this.tracked.set(obj.id, {
            original: cloneCanvasObject(obj),
            current: null,
            isNew: false,
          });
        } else {
          entry.current = null;
        }
        objects.splice(i, 1);
        liveChanges.deletedIds.push(obj.id);

      } else if (this._hasChanged(currentObj.points, segments)) {
        // ▸ Partially erased
        if (!entry) {
          this.tracked.set(obj.id, {
            original: cloneCanvasObject(obj),
            current: null, // will be set below
            isNew: false,
          });
        }

        // First segment replaces the original object
        const modified = cloneCanvasObject(currentObj);
        modified.id = obj.id; // keep original id
        modified.points = segments[0];
        objects[i] = modified;
        this.tracked.get(obj.id).current = modified;
        liveChanges.modifiedObjects.push(cloneCanvasObject(modified));

        // Additional segments become new objects
        for (let s = 1; s < segments.length; s++) {
          const newObj = cloneCanvasObject(currentObj);
          newObj.id = generateId();
          newObj.points = segments[s];
          objects.push(newObj);
          this.tracked.set(newObj.id, {
            original: null,
            current: newObj,
            isNew: true,
          });
          liveChanges.addedObjects.push(cloneCanvasObject(newObj));
        }
      }
    }

    this.canvasManager.requestRender();

    // Broadcast live changes so remote clients see erasure immediately
    if (liveChanges.deletedIds.length > 0 ||
        liveChanges.modifiedObjects.length > 0 ||
        liveChanges.addedObjects.length > 0) {
      this.canvasManager.emit('eraser:live', liveChanges);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  _getDrawingBounds(obj) {
    if (!obj?.points || obj.points.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of obj.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const sw = (obj.strokeWidth || 2) / 2;
    return {
      x: minX - sw,
      y: minY - sw,
      width: maxX - minX + sw * 2,
      height: maxY - minY + sw * 2,
    };
  }

  /** Check if splitPolylineByCircle produced a real change. */
  _hasChanged(originalPoints, segments) {
    if (segments.length !== 1) return true;
    return segments[0].length !== originalPoints.length;
  }

  /** Roll back live state mutations (used on deactivate mid-drag). */
  _rollback() {
    if (!this.canvasManager || this.tracked.size === 0) {
      this.tracked = new Map();
      return;
    }

    const objects = this.canvasManager.state.objects;

    // Remove new segments
    for (const [id, entry] of this.tracked) {
      if (entry.isNew) {
        const idx = objects.findIndex((o) => o.id === id);
        if (idx >= 0) objects.splice(idx, 1);
      }
    }

    // Restore originals
    for (const [, entry] of this.tracked) {
      if (entry.isNew || !entry.original) continue;
      const idx = objects.findIndex((o) => o.id === entry.original.id);
      if (idx >= 0) {
        objects[idx] = cloneCanvasObject(entry.original);
      } else {
        // Was fully erased — re-add
        objects.push(cloneCanvasObject(entry.original));
      }
    }

    this.tracked = new Map();
    this.canvasManager.requestRender();
  }

  /* ------------------------------------------------------------------ */
  /*  UI config                                                          */
  /* ------------------------------------------------------------------ */

  getUIConfig() {
    return {
      name: this.name,
      description: 'Erase parts of strokes (precision eraser)',
      cursor: this.cursor,
      hasOptions: true,
    };
  }
}

export default PrecisionEraserTool;
