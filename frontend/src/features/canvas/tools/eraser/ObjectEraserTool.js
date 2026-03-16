// ObjectEraserTool.js
// ──────────────────────────────────────────────────────────────────────
// Object (full-delete) eraser — removes entire objects on contact,
// like Miro's object eraser mode.
//
// Architecture:
//   • World-coordinate only — zoom-safe at 1 %–400 %
//   • Live state mutation during drag   (matches TransformController pattern)
//   • Single ApplyEraserCommand on pointerUp via registerWithoutExecuting
//   • Lock-safe — skips objects locked by other users
//   • Throttled pointermove (16 ms ≈ 60 fps)
//   • Uses ObjectGeometry.hitTest for all object types
// ──────────────────────────────────────────────────────────────────────

import ObjectGeometry from '../../engine/geometry/ObjectGeometry.js';
import { cloneCanvasObject } from './lib/eraserMath.js';
import { ApplyEraserCommand } from '../../engine/commands/EraserCommands.js';
import useCollaborationStore from '@features/room/state/collaborationStore';

const THROTTLE_MS = 16;

export class ObjectEraserTool {
  constructor(options = {}) {
    this.name = 'object-eraser';
    this.cursor = 'none';
    this.options = { width: 10, ...options };

    this.canvasManager = null;
    this.isErasing = false;
    this.lastMoveTime = 0;

    // ── per-drag tracking ──
    this.deletedSnapshots = []; // cloned originals in deletion order
    this.deletedIds = new Set();
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

  /** Hit-test tolerance in world units — shrinks as zoom increases. */
  _getWorldTolerance() {
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
    this.deletedSnapshots = [];
    this.deletedIds = new Set();

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

    if (this.deletedSnapshots.length === 0) return null;

    // ── Build command — all objects fully deleted ──
    const command = new ApplyEraserCommand({
      beforeObjects: this.deletedSnapshots.map((s) => cloneCanvasObject(s)),
      afterObjects: [],   // nothing replaces them
      addedObjects: [],
      meta: { tool: 'object-eraser' },
    });

    // State was already mutated during the drag — register without re-executing
    this.canvasManager.historyManager.registerWithoutExecuting(command);
    this.canvasManager.updateObjectIndex();
    this.canvasManager.emit('state:changed', { type: 'local', command });

    this.deletedSnapshots = [];
    this.deletedIds = new Set();
    return null; // command already registered
  }

  /* ------------------------------------------------------------------ */
  /*  Core erase logic                                                   */
  /* ------------------------------------------------------------------ */

  _eraseAt(worldX, worldY) {
    const point = { x: worldX, y: worldY };
    const tolerance = this._getWorldTolerance();
    const objects = this.canvasManager.state.objects;
    const newlyDeletedIds = [];

    // Iterate backwards for safe splicing
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (!obj || !obj.id) continue;
      if (this.deletedIds.has(obj.id)) continue;
      if (this._isLocked(obj.id)) continue;

      if (ObjectGeometry.hitTest(point, obj, tolerance)) {
        this.deletedSnapshots.push(cloneCanvasObject(obj));
        this.deletedIds.add(obj.id);
        newlyDeletedIds.push(obj.id);
        objects.splice(i, 1);
      }
    }

    this.canvasManager.requestRender();

    // Broadcast live deletion so remote clients see objects disappear immediately
    if (newlyDeletedIds.length > 0) {
      this.canvasManager.emit('eraser:live', {
        deletedIds: newlyDeletedIds,
        modifiedObjects: [],
        addedObjects: [],
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Roll back live state mutations                                     */
  /* ------------------------------------------------------------------ */

  _rollback() {
    if (!this.canvasManager || this.deletedSnapshots.length === 0) {
      this.deletedSnapshots = [];
      this.deletedIds = new Set();
      return;
    }

    const objects = this.canvasManager.state.objects;
    for (const snapshot of this.deletedSnapshots) {
      objects.push(cloneCanvasObject(snapshot));
    }

    this.deletedSnapshots = [];
    this.deletedIds = new Set();
    this.canvasManager.requestRender();
  }

  /* ------------------------------------------------------------------ */
  /*  UI config                                                          */
  /* ------------------------------------------------------------------ */

  getUIConfig() {
    return {
      name: this.name,
      description: 'Erase entire objects',
      cursor: this.cursor,
      hasOptions: true,
    };
  }
}

export default ObjectEraserTool;
