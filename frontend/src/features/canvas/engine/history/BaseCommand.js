import { Bounds } from '../../../../shared/lib/canvasBounds';

export class BaseCommand {
  constructor() {
    this.id = Date.now() + Math.random().toString(36).substr(2, 9);
    this.timestamp = Date.now();
    this.userId = null; // For collaboration
    this.type = this.constructor.name;
  }

  /**
   * Execute the command - MUTATES state directly
   * @param {Object} state - The canvas state object
   */
  execute(state) {
    throw new Error('execute() must be implemented');
  }

  /**
   * Undo the command - MUTATES state directly
   * @param {Object} state - The canvas state object
   */
  undo(state) {
    throw new Error('undo() must be implemented');
  }

  clampPosition(x, y) {
    return Bounds.clampPoint(x, y);
  }

  clampObject(obj) {
    return Bounds.clampObject(obj);
  }

  /**
   * Serialize for storage/transmission
   */
  serialize() {
    return {
      type: this.type,
      id: this.id,
      timestamp: this.timestamp,
      userId: this.userId,
      operation: this.operation,
      objectId: this.objectId,
      objectIds: this.objectIds,
    };
  }

  /**
   * Deserialize from JSON - must be implemented by subclasses
   */
  static deserialize(data) {
    throw new Error('deserialize() must be implemented');
  }
}