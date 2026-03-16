// src/canvas/commands/SelectionCommands.js
import { BaseCommand } from '../history/BaseCommand';

export class ClearSelectionCommand extends BaseCommand {
  constructor() {
    super();
    this.previousSelection = [];
  }

  execute(state) {
    // Store previous selection for undo
    this.previousSelection = [...state.selection];

    // Clear selection
    state.selection = [];
  }

  undo(state) {
    // Restore previous selection
    state.selection = [...this.previousSelection];
  }

  serialize() {
    return {
      ...super.serialize(),
      type: 'ClearSelectionCommand',
      previousSelection: this.previousSelection,
      previousSelectionCount: this.previousSelection.length,
    };
  }

  static deserialize(data) {
    const command = new ClearSelectionCommand();
    command.id = data.id;
    command.timestamp = data.timestamp;
    command.userId = data.userId;
    // Note: Can't restore actual IDs without full context
    return command;
  }
}

export class SelectObjectsCommand extends BaseCommand {
  constructor(objectIds, clearPrevious = true) {
    super();
    this.objectIds = Array.isArray(objectIds) ? [...objectIds] : [];
    this.clearPrevious = clearPrevious;
    this.previousSelection = [];
  }

  execute(state) {
    // Store previous selection for undo
    this.previousSelection = [...state.selection];

    // Set new selection
    if (this.clearPrevious) {
      state.selection = [...this.objectIds];
    } else {
      // Add to existing selection
      const newSelection = new Set([...state.selection, ...this.objectIds]);
      state.selection = Array.from(newSelection);
    }
  }

  undo(state) {
    // Restore previous selection
    state.selection = [...this.previousSelection];
  }

  serialize() {
    return {
      ...super.serialize(),
      type: 'SelectObjectsCommand',
      objectIds: this.objectIds,
      clearPrevious: this.clearPrevious,
      previousSelectionCount: this.previousSelection.length,
    };
  }

  static deserialize(data) {
    const command = new SelectObjectsCommand(data.objectIds, data.clearPrevious);
    command.id = data.id;
    command.timestamp = data.timestamp;
    command.userId = data.userId;
    return command;
  }
}

export class DeselectObjectsCommand extends BaseCommand {
  constructor(objectIds) {
    super();
    this.objectIds = Array.isArray(objectIds) ? [...objectIds] : [];
    this.previousSelection = [];
  }

  execute(state) {
    // Store previous selection for undo
    this.previousSelection = [...state.selection];

    // Remove objects from selection
    state.selection = state.selection.filter(id => !this.objectIds.includes(id));
  }

  undo(state) {
    // Restore previous selection
    state.selection = [...this.previousSelection];
  }

  serialize() {
    return {
      ...super.serialize(),
      type: 'DeselectObjectsCommand',
      objectIds: this.objectIds,
      previousSelectionCount: this.previousSelection.length,
    };
  }

  static deserialize(data) {
    const command = new DeselectObjectsCommand(data.objectIds);
    command.id = data.id;
    command.timestamp = data.timestamp;
    command.userId = data.userId;
    return command;
  }
}

// Factory for selection commands - Optional (For more simplicity in usage)
export class SelectionCommandFactory {
  static clearSelection() {
    return new ClearSelectionCommand();
  }

  static selectObjects(objectIds, clearPrevious = true) {
    if (!Array.isArray(objectIds) || objectIds.length === 0) {
      throw new Error('selectObjects requires a non-empty array of object IDs');
    }
    return new SelectObjectsCommand(objectIds, clearPrevious);
  }

  static deselectObjects(objectIds) {
    if (!Array.isArray(objectIds) || objectIds.length === 0) {
      throw new Error('deselectObjects requires a non-empty array of object IDs');
    }
    return new DeselectObjectsCommand(objectIds);
  }
}