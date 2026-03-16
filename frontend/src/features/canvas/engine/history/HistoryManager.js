export class HistoryManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.isUndoing = false;
    this.isRedoing = false;
    this.maxStackSize = 100;
  }

  /**
   * Execute a command and add to history
   * @param {BaseCommand} command - The command to execute
   * @param {Object} state - Canvas state (will be mutated)
   * @returns {BaseCommand} - The executed command
   */
  execute(command, state) {
    this.attachMetadata(command);
    // Clear redo stack when new command is executed
    if (!this.isUndoing && !this.isRedoing) {
      this.redoStack = [];
    }

    // Execute the command (mutates state directly)
    command.execute(state);

    this.applyOwnership(state, command);

    // Add to undo stack (if not undo/redo operation)
    if (!this.isUndoing && !this.isRedoing) {
      this.undoStack.push(command);

      // Limit stack size
      if (this.undoStack.length > this.maxStackSize) {
        this.undoStack.shift();
      }
    }

    return command;
  }

  /**
   *  Register command in history WITHOUT executing it
   * Used when command has already been executed during preview
   * @param {BaseCommand} command - The command to register
   * @returns {BaseCommand} - The registered command
   */
  registerWithoutExecuting(command) {
    this.attachMetadata(command);
    // Clear redo stack when new command is registered
    if (!this.isUndoing && !this.isRedoing) {
      this.redoStack = [];
    }

    // Add to undo stack WITHOUT executing
    if (!this.isUndoing && !this.isRedoing) {
      this.undoStack.push(command);

      // Limit stack size
      if (this.undoStack.length > this.maxStackSize) {
        this.undoStack.shift();
      }
    }

    return command;
  }

  /**
   * Undo last command
   * @param {Object} state - Canvas state (will be mutated)
   * @returns {BaseCommand|null} - The undone command
   */
  undo(state, userId) {
    while (this.undoStack.length > 0) {
      const command = this.undoStack[this.undoStack.length - 1];
      if (!this.canUserUndoCommand(command, state, userId)) {
        this.undoStack.pop();
        continue;
      }

      this.undoStack.pop();
      this.isUndoing = true;

      try {
        command.undo(state);
        this.redoStack.push(command);

        // Limit redo stack size
        if (this.redoStack.length > this.maxStackSize) {
          this.redoStack.shift();
        }

        return command;
      } finally {
        this.isUndoing = false;
      }
    }

    return null;
  }

  /**
   * Redo last undone command
   * @param {Object} state - Canvas state (will be mutated)
   * @returns {BaseCommand|null} - The redone command
   */
  redo(state, userId) {
    while (this.redoStack.length > 0) {
      const command = this.redoStack[this.redoStack.length - 1];
      if (!this.canUserUndoCommand(command, state, userId)) {
        this.redoStack.pop();
        continue;
      }

      this.redoStack.pop();
      this.isRedoing = true;

      try {
        command.execute(state);
        this.undoStack.push(command);
        this.applyOwnership(state, command);
        return command;
      } finally {
        this.isRedoing = false;
      }
    }

    return null;
  }

  /**
   * Clear all history
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Check if undo is available
   */
  canUndo(state, userId) {
    if (!userId || !state) return this.undoStack.length > 0;
    return this.undoStack.some((command) => this.canUserUndoCommand(command, state, userId));
  }

  /**
   * Check if redo is available
   */
  canRedo(state, userId) {
    if (!userId || !state) return this.redoStack.length > 0;
    return this.redoStack.some((command) => this.canUserUndoCommand(command, state, userId));
  }

  /**
   * Get history info for debugging/UI
   */
  getHistoryInfo() {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      lastCommand: this.undoStack[this.undoStack.length - 1]?.constructor.name,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }

  attachMetadata(command) {
    if (!command || typeof command !== 'object') return;
    command.operation = command.operation || command.constructor?.name || 'UnknownCommand';
    if (!command.objectId && Array.isArray(command.objectIds) && command.objectIds.length > 0) {
      command.objectId = command.objectIds[0];
    }
  }

  getCommandObjectIds(command) {
    if (!command) return [];
    if (Array.isArray(command.objectIds)) return [...new Set(command.objectIds)];
    if (command.objectId) return [command.objectId];
    if (command.textObject?.id) return [command.textObject.id];
    if (command.imageObject?.id) return [command.imageObject.id];
    if (Array.isArray(command.objects)) return command.objects.map((obj) => obj?.id).filter(Boolean);
    if (Array.isArray(command.beforeObjects) || Array.isArray(command.afterObjects) || Array.isArray(command.addedObjects)) {
      const ids = new Set();
      (command.beforeObjects || []).forEach((obj) => obj?.id && ids.add(obj.id));
      (command.afterObjects || []).forEach((obj) => obj?.id && ids.add(obj.id));
      (command.addedObjects || []).forEach((obj) => obj?.id && ids.add(obj.id));
      return [...ids];
    }
    return [];
  }

  commandTouchesObject(command, objectIds) {
    if (!command || !objectIds || objectIds.length === 0) return false;
    if (command.commands && Array.isArray(command.commands)) {
      return command.commands.some((child) => this.commandTouchesObject(child, objectIds));
    }
    const ids = this.getCommandObjectIds(command);
    return ids.some((id) => objectIds.includes(id));
  }

  canUserUndoCommand(command, state, userId) {
    if (!userId) return true;
    if (!command) return false;

    if (command.commands && Array.isArray(command.commands)) {
      return command.commands.every((child) => this.canUserUndoCommand(child, state, userId));
    }

    const ids = this.getCommandObjectIds(command);
    if (ids.length === 0) return true;

    return ids.every((id) => {
      const obj = state.objects?.find((o) => o.id === id);
      if (!obj) return false;
      if (!obj.lastEditedBy) return false;
      return obj.lastEditedBy === userId;
    });
  }

  invalidateUndoForObjectIds(objectIds, newOwnerId) {
    if (!Array.isArray(objectIds) || objectIds.length === 0) return;
    const ids = [...new Set(objectIds)];
    const idsSet = new Set(ids);

    const pruneStack = (stack) => stack.filter((command) => this.pruneCommandForOwnership(command, ids, idsSet, newOwnerId));
    this.undoStack = pruneStack(this.undoStack);
    this.redoStack = pruneStack(this.redoStack);
  }

  pruneCommandForOwnership(command, ids, idsSet, newOwnerId) {
    if (!command) return false;

    if (command.commands && Array.isArray(command.commands)) {
      command.commands = command.commands.filter((child) => this.pruneCommandForOwnership(child, ids, idsSet, newOwnerId));
      return command.commands.length > 0;
    }

    if (!this.commandTouchesObject(command, ids)) return true;
    if (!newOwnerId) return false;
    if (command.userId && command.userId === newOwnerId) return true;

    return this.removeObjectIdsFromCommand(command, idsSet);
  }

  removeObjectIdsFromCommand(command, idsSet) {
    if (!command) return false;

    if (command.objectId && idsSet.has(command.objectId)) return false;
    if (command.textObject?.id && idsSet.has(command.textObject.id)) return false;
    if (command.imageObject?.id && idsSet.has(command.imageObject.id)) return false;

    if (Array.isArray(command.objectIds)) {
      command.objectIds = command.objectIds.filter((id) => !idsSet.has(id));
      if (command.objectIds.length === 0) return false;
    }

    const filterObjects = (list) => (
      Array.isArray(list) ? list.filter((obj) => obj?.id && !idsSet.has(obj.id)) : list
    );

    if (Array.isArray(command.objects)) command.objects = filterObjects(command.objects);
    if (Array.isArray(command.beforeObjects)) command.beforeObjects = filterObjects(command.beforeObjects);
    if (Array.isArray(command.afterObjects)) command.afterObjects = filterObjects(command.afterObjects);
    if (Array.isArray(command.addedObjects)) command.addedObjects = filterObjects(command.addedObjects);
    if (Array.isArray(command.deleted)) {
      command.deleted = command.deleted.filter((entry) => entry?.obj?.id && !idsSet.has(entry.obj.id));
    }

    if (command.previousStyles instanceof Map) {
      idsSet.forEach((id) => command.previousStyles.delete(id));
    }

    if (command.initialPositions instanceof Map) {
      idsSet.forEach((id) => command.initialPositions.delete(id));
    }

    if (command.initialStates instanceof Map) {
      idsSet.forEach((id) => command.initialStates.delete(id));
    }

    if (Array.isArray(command.previousOrderIds)) {
      command.previousOrderIds = command.previousOrderIds.filter((id) => !idsSet.has(id));
    }

    if (command.beforeObjects && command.afterObjects && command.addedObjects) {
      const remainingIds = this.getCommandObjectIds(command);
      if (remainingIds.length > 0) {
        command.objectId = remainingIds[0];
      }
    }

    return this.getCommandObjectIds(command).length > 0;
  }

  applyOwnership(state, command) {
    if (!state || !command) return;
    const userId = command.userId;
    if (!userId) return;

    const ids = this.getCommandObjectIds(command);
    if (ids.length === 0) return;

    ids.forEach((id) => {
      const obj = state.objects.find((o) => o.id === id);
      if (!obj) {
        this.invalidateUndoForObjectIds([id], userId);
        return;
      }
      const previous = obj.lastEditedBy;
      if (previous && previous !== userId) {
        this.invalidateUndoForObjectIds([id], userId);
      }
      obj.lastEditedBy = userId;
      obj.lastEditedAt = Date.now();
    });
  }

  /**
   * Batch multiple commands as a single undoable action
   * @param {BaseCommand[]} commands - Array of commands
   * @param {Object} state - Canvas state
   * @returns {BaseCommand} - A composite command
   */
  executeBatch(commands, state) {
    // Create a composite command
    const compositeCommand = new CompositeCommand(commands);
    return this.execute(compositeCommand, state);
  }

  /**
   * Serialize history for saving/loading
   */
  serialize() {
    return {
      undoStack: this.undoStack.map(cmd => cmd.serialize()),
      redoStack: this.redoStack.map(cmd => cmd.serialize()),
    };
  }

  /**
   * Deserialize history from saved data
   */
  deserialize(data, commandRegistry) {
    this.undoStack = data.undoStack.map(cmdData => {
      const CommandClass = commandRegistry[cmdData.type];
      if (!CommandClass) {
        console.warn(`Unknown command type: ${cmdData.type}, creating generic command`);
        return new GenericCommand(cmdData);
      }
      return CommandClass.deserialize(cmdData);
    });

    this.redoStack = data.redoStack.map(cmdData => {
      const CommandClass = commandRegistry[cmdData.type];
      if (!CommandClass) {
        console.warn(`Unknown command type: ${cmdData.type}, creating generic command`);
        return new GenericCommand(cmdData);
      }
      return CommandClass.deserialize(cmdData);
    });
  }
}

/**
 * Composite command for batch operations
 */
class CompositeCommand {
  constructor(commands = []) {
    this.id = Date.now() + Math.random().toString(36).substr(2, 9);
    this.timestamp = Date.now();
    this.commands = commands;
    this.type = 'CompositeCommand';
  }

  execute(state) {
    this.commands.forEach(cmd => cmd.execute(state));
  }

  undo(state) {
    // Undo in reverse order
    [...this.commands].reverse().forEach(cmd => cmd.undo(state));
  }

  serialize() {
    return {
      type: this.type,
      id: this.id,
      timestamp: this.timestamp,
      commands: this.commands.map(cmd => cmd.serialize()),
    };
  }

  static deserialize(data) {
    // Note: This requires commands to already be deserialized
    return new CompositeCommand(data.commands);
  }
}

/**
 * Generic command as fallback for unknown command types
 */
class GenericCommand {
  constructor(data) {
    this.data = data;
    this.type = data.type || 'GenericCommand';
    this.id = data.id;
    this.timestamp = data.timestamp;
  }

  execute() {
    console.warn(`Cannot execute generic command: ${this.type}`);
  }

  undo() {
    console.warn(`Cannot undo generic command: ${this.type}`);
  }

  serialize() {
    return this.data;
  }
}