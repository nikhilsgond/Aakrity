// src/canvas/commands/UpdateStyleCommand.js
import { BaseCommand } from '../history/BaseCommand.js';

/**
 * UpdateStyleCommand — Undoable style changes on one or more canvas objects.
 *
 * Supports any visual property: strokeColor, fillColor, opacity, strokeWidth,
 * cornerRadius, dashArray, fontStyle, fontWeight, etc.
 *
 * Usage:
 *   new UpdateStyleCommand(objectIds, { strokeColor: '#FF0000', opacity: 0.5 })
 */
export class UpdateStyleCommand extends BaseCommand {
  /**
   * @param {string[]} objectIds - IDs of the objects to update
   * @param {Object} styleChanges - key/value pairs of style properties to set
   */
  constructor(objectIds, styleChanges) {
    super();
    this.objectIds = Array.isArray(objectIds) ? [...objectIds] : [objectIds];
    this.styleChanges = { ...styleChanges };
    /** @type {Map<string, Object>|null} captured on first execute */
    this.previousStyles = null;
    this.operation = 'style_change';
  }

  execute(state) {
    // On first execution capture the previous values so undo can restore them
    if (!this.previousStyles) {
      this.previousStyles = new Map();
      for (const id of this.objectIds) {
        const obj = state.objects.find(o => o.id === id);
        if (!obj) continue;
        const snapshot = {};
        for (const key of Object.keys(this.styleChanges)) {
          // Deep-copy arrays (dashArray) and plain values
          const val = obj[key];
          snapshot[key] = Array.isArray(val) ? [...val] : val;
        }
        this.previousStyles.set(id, snapshot);
      }
    }

    let changed = false;
    for (const id of this.objectIds) {
      const obj = state.objects.find(o => o.id === id);
      if (!obj) continue;

      for (const [key, value] of Object.entries(this.styleChanges)) {
        obj[key] = Array.isArray(value) ? [...value] : value;
      }
      changed = true;
    }
    return changed;
  }

  undo(state) {
    if (!this.previousStyles) return false;

    let reverted = false;
    for (const id of this.objectIds) {
      const obj = state.objects.find(o => o.id === id);
      if (!obj) continue;

      const prev = this.previousStyles.get(id);
      if (!prev) continue;

      for (const [key, value] of Object.entries(prev)) {
        obj[key] = Array.isArray(value) ? [...value] : value;
      }
      reverted = true;
    }
    return reverted;
  }

  serialize() {
    const prevObj = {};
    if (this.previousStyles) {
      for (const [id, snap] of this.previousStyles.entries()) {
        prevObj[id] = snap;
      }
    }
    return {
      ...super.serialize(),
      type: 'UpdateStyleCommand',
      objectIds: this.objectIds,
      styleChanges: this.styleChanges,
      previousStyles: prevObj,
    };
  }

  static deserialize(data) {
    const cmd = new UpdateStyleCommand(data.objectIds, data.styleChanges);
    cmd.id = data.id;
    cmd.timestamp = data.timestamp;
    cmd.userId = data.userId;
    if (data.previousStyles) {
      cmd.previousStyles = new Map(Object.entries(data.previousStyles));
    }
    return cmd;
  }
}
