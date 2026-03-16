// src/canvas/commands/ViewportCommands.js
import { BaseCommand } from '../history/BaseCommand';

export class PanViewportCommand extends BaseCommand {
  constructor(deltaX, deltaY) {
    super();
    this.deltaX = deltaX;
    this.deltaY = deltaY;
    this.previousPanX = null;
    this.previousPanY = null;
  }

  execute(state) {  
    // Store previous values for undo
    this.previousPanX = state.viewport.panX;
    this.previousPanY = state.viewport.panY;

    // Apply pan
    state.viewport.panX += this.deltaX;
    state.viewport.panY += this.deltaY;
  }

  undo(state) {
    // Restore previous values
    if (this.previousPanX !== null && this.previousPanY !== null) {
      state.viewport.panX = this.previousPanX;
      state.viewport.panY = this.previousPanY;
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      type: 'PanViewportCommand',
      deltaX: this.deltaX,
      deltaY: this.deltaY,
      previousPanX: this.previousPanX,
      previousPanY: this.previousPanY,
    };
  }

  static deserialize(data) {
    const command = new PanViewportCommand(data.deltaX, data.deltaY);
    command.id = data.id;
    command.timestamp = data.timestamp;
    command.userId = data.userId;
    command.previousPanX = data.previousPanX;
    command.previousPanY = data.previousPanY;
    return command;
  }
}

export class ZoomViewportCommand extends BaseCommand {
  constructor(zoom, centerX, centerY, previousZoom = null) {
    super();
    this.zoom = zoom;
    this.centerX = centerX;
    this.centerY = centerY;
    this.previousZoom = previousZoom;
    this.previousPanX = null;
    this.previousPanY = null;
  }

  execute(state) {
    // Store previous values for undo
    this.previousZoom = state.viewport.zoom;
    this.previousPanX = state.viewport.panX;
    this.previousPanY = state.viewport.panY;

    // Calculate new pan to zoom toward center point
    const worldX = (this.centerX - this.previousPanX) / this.previousZoom;
    const worldY = (this.centerY - this.previousPanY) / this.previousZoom;

    state.viewport.zoom = this.zoom;
    state.viewport.panX = this.centerX - worldX * this.zoom;
    state.viewport.panY = this.centerY - worldY * this.zoom;
  }

  undo(state) {
    // Restore previous values
    if (this.previousZoom !== null && this.previousPanX !== null && this.previousPanY !== null) {
      state.viewport.zoom = this.previousZoom;
      state.viewport.panX = this.previousPanX;
      state.viewport.panY = this.previousPanY;
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      type: 'ZoomViewportCommand',
      zoom: this.zoom,
      centerX: this.centerX,
      centerY: this.centerY,
      previousZoom: this.previousZoom,
      previousPanX: this.previousPanX,
      previousPanY: this.previousPanY,
    };
  }

  static deserialize(data) {
    const command = new ZoomViewportCommand(
      data.zoom,
      data.centerX,
      data.centerY,
      data.previousZoom
    );
    command.id = data.id;
    command.timestamp = data.timestamp;
    command.userId = data.userId;
    command.previousPanX = data.previousPanX;
    command.previousPanY = data.previousPanY;
    return command;
  }
}

export class ClearCanvasCommand extends BaseCommand {
  constructor() {
    super();
    this.previousObjects = null;
    this.previousSelection = null;
  }

  execute(state) {
    // Only take snapshot on first execution (not on redo)
    if (!this.previousObjects) {
      this.previousObjects = state.objects.map(obj => JSON.parse(JSON.stringify(obj)));
      this.previousSelection = [...state.selection];
    }

    // Clear canvas
    state.objects = [];
    state.selection = [];
  }

  undo(state) {
    // Restore deep copies so mutations don't corrupt the backup
    if (this.previousObjects) {
      state.objects = this.previousObjects.map(obj => JSON.parse(JSON.stringify(obj)));
      state.selection = [...this.previousSelection];
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      type: 'ClearCanvasCommand',
      // Include full state for proper deserialization
      previousObjects: this.previousObjects,
      previousSelection: this.previousSelection,
      previousStateSize: this.previousObjects?.length || 0,
    };
  }

  static deserialize(data) {
    const command = new ClearCanvasCommand();
    command.id = data.id;
    command.timestamp = data.timestamp;
    command.userId = data.userId;
    command.previousObjects = data.previousObjects || [];
    command.previousSelection = data.previousSelection || [];
    return command;
  }
}

export class ResetViewportCommand extends BaseCommand {
  constructor() {
    super();
    this.previousZoom = null;
    this.previousPanX = null;
    this.previousPanY = null;
  }

  execute(state) {
    // Store previous values
    this.previousZoom = state.viewport.zoom;
    this.previousPanX = state.viewport.panX;
    this.previousPanY = state.viewport.panY;

    // Reset to defaults
    state.viewport.zoom = 1;
    state.viewport.panX = 0;
    state.viewport.panY = 0;
  }

  undo(state) {
    // Restore previous values
    if (this.previousZoom !== null) {
      state.viewport.zoom = this.previousZoom;
      state.viewport.panX = this.previousPanX;
      state.viewport.panY = this.previousPanY;
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      type: 'ResetViewportCommand',
      previousZoom: this.previousZoom,
      previousPanX: this.previousPanX,
      previousPanY: this.previousPanY,
    };
  }

  static deserialize(data) {
    const command = new ResetViewportCommand();
    command.id = data.id;
    command.timestamp = data.timestamp;
    command.userId = data.userId;
    command.previousZoom = data.previousZoom;
    command.previousPanX = data.previousPanX;
    command.previousPanY = data.previousPanY;
    return command;
  }
}
