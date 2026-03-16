// src/canvas/tools/sticky-note/StickyNoteTool.js — click-to-place sticky note
import { AddShapeCommand, ShapeCommandFactory } from '../../engine/commands/ShapeCommands';

const DEFAULT_STICKY_SIZE = 200;

const NOTE_COLORS = {
  yellow: { bg: '#FFF176', text: '#111111' },
  pink: { bg: '#F48FB1', text: '#111111' },
  blue: { bg: '#90CAF9', text: '#111111' },
  green: { bg: '#A5D6A7', text: '#111111' },
  orange: { bg: '#FFCC80', text: '#111111' },
  purple: { bg: '#CE93D8', text: '#111111' },
  coral: { bg: '#FFAB91', text: '#111111' },
  teal: { bg: '#80CBC4', text: '#111111' },
  lavender: { bg: '#B39DDB', text: '#111111' },
  lime: { bg: '#C5E1A5', text: '#111111' },
  peach: { bg: '#FFCCBC', text: '#111111' },
  slate: { bg: '#B0BEC5', text: '#111111' },
};

export default class StickyNoteTool {
  constructor() {
    this.name = 'sticky';
    this.cursor = 'crosshair';
    this.canvasManager = null;
    this.options = { noteColor: 'yellow', fontSize: 14, opacity: 1.0 };
    this.isEditing = false;
  }

  getCursor() {
    return this.cursor;
  }

  activate(canvasManager, toolOptions = {}) {
    this.canvasManager = canvasManager;
    if (toolOptions) this.setOptions(toolOptions);
  }

  deactivate() {
    this.canvasManager = null;
  }

  setOptions(opts) {
    this.options = { ...this.options, ...opts };
  }

  getUIConfig() {
    return { name: this.name, cursor: this.cursor };
  }

  // --- pointer events ---

  onPointerDown(event) {
    if (!this.canvasManager) return null;

    // event.x / event.y are already in world coordinates (from useCanvas)
    const worldPos = { x: event.x, y: event.y };
    const colorKey = this.options.noteColor || 'yellow';
    const palette = NOTE_COLORS[colorKey] || NOTE_COLORS.yellow;
    // Compensate for zoom so the sticky note always appears the same visual size on screen
    const zoom = this.canvasManager.state?.viewport?.zoom || 1;
    const size = DEFAULT_STICKY_SIZE / zoom;

    const bounds = this.canvasManager.state.canvasBounds;

    // Calculate position (centered on click)
    let x = worldPos.x - size / 2;
    let y = worldPos.y - size / 2;

    x = Math.max(bounds.minX, Math.min(bounds.maxX - size, x));
    y = Math.max(bounds.minY, Math.min(bounds.maxY - size, y));


    const shapeData = {
      id: ShapeCommandFactory.generateShapeId(),
      type: 'sticky',
      x: worldPos.x - size / 2,
      y: worldPos.y - size / 2,
      width: size,
      height: size,
      text: '',
      noteColor: palette.bg,
      textColor: palette.text,
      fontSize: this.options.fontSize || 14,
      opacity: this.options.opacity ?? 1.0,
      rotation: 0,
      layer: 'default',
      visible: true,
      createdAt: Date.now(),
    };

    const command = new AddShapeCommand(shapeData);

    // Selection + tool switch + auto-edit are handled by handlePointerDown in useCanvas

    return { command, autoEdit: true };
  }

  onPointerMove() { return null; }
  onPointerUp() { return null; }
}

export { NOTE_COLORS, DEFAULT_STICKY_SIZE };
