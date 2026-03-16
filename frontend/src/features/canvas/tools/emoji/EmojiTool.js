// src/canvas/tools/emoji/EmojiTool.js
import { AddShapeCommand, ShapeCommandFactory } from '../../engine/commands/ShapeCommands';

const DEFAULT_EMOJI_SIZE = 64;

export default class EmojiTool {
  constructor(options = {}) {
    this.name = 'emoji';
    this.toolType = 'emoji';
    this.cursor = 'crosshair';
    this.canvasManager = null;
    this.options = {
      emoji: options.emoji || '😀',
      opacity: options.opacity ?? 1.0,
    };
  }

  getCursor() {
    return this.cursor;
  }

  activate(canvasManager, toolOptions) {
    this.canvasManager = canvasManager;
    if (toolOptions) {
      this.setOptions(toolOptions);
    }
  }

  deactivate() {
    this.canvasManager = null;
  }

  setOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }

  getUIConfig() {
    return {
      name: this.name,
      cursor: this.cursor,
    };
  }

  onPointerDown(event) {
    if (!this.canvasManager) return null;

    // Compensate for zoom so the emoji always appears the same visual size on screen
    const bounds = this.canvasManager.state.canvasBounds;
    const zoom = this.canvasManager.state?.viewport?.zoom || 1;
    const size = DEFAULT_EMOJI_SIZE / zoom;
    let x = event.x - size / 2;
    let y = event.y - size / 2;

    x = Math.max(bounds.minX, Math.min(bounds.maxX - size, x));
    y = Math.max(bounds.minY, Math.min(bounds.maxY - size, y));

    const shapeData = {
      id: ShapeCommandFactory.generateShapeId(),
      type: 'emoji',
      x,
      y,
      width: size,
      height: size,
      emoji: this.options.emoji || '😀',
      rotation: 0,
      opacity: this.options.opacity ?? 1.0,
      visible: true,
      lockedBy: null,
      createdAt: Date.now(),
    };

    const command = new AddShapeCommand(shapeData);

    // Selection + tool switch are handled by handlePointerDown in useCanvas

    return { command };
  }

  onPointerMove() {
    return null;
  }

  onPointerUp() {
    return null;
  }
}
