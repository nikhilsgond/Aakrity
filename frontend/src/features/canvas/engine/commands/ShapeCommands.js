// src/canvas/commands/ShapeCommands.js - FIXED
import { BaseCommand } from '../history/BaseCommand';
import { TOOL_TYPES } from '@shared/constants';
import { SHAPE_TYPES } from '@shared/constants';
import { DEFAULT_TOOL_OPTIONS } from '@shared/constants';

export class AddShapeCommand extends BaseCommand {
  constructor(shapeData) {
    super();
    // Clone shapeData to avoid mutation issues
    this.shapeData = { ...shapeData };
    // Use the ID from shapeData (generated in factory)
    this.objectId = shapeData.id;

    if (!this.objectId) {
      console.warn('AddShapeCommand created without ID, generating one');
      this.objectId = `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  execute(state) {
    // Check if shape already exists (idempotent operation)
    const exists = state.objects.some(obj => obj.id === this.objectId);
    if (exists) {
      console.warn(`Shape ${this.objectId} already exists, skipping execute`);
      return;
    }

    // Add shape with cloned data
    state.objects.push({
      ...this.shapeData,
      id: this.objectId,
    });
  }

  undo(state) {
    // Remove by ID (correct way)
    const index = state.objects.findIndex(obj => obj.id === this.objectId);
    if (index !== -1) {
      state.objects.splice(index, 1);
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      type: 'AddShapeCommand',
      shapeData: this.shapeData,
      objectId: this.objectId,
    };
  }

  static deserialize(data) {
    const command = new AddShapeCommand(data.shapeData);
    command.id = data.id;
    command.timestamp = data.timestamp;
    command.userId = data.userId;
    // Ensure objectId is preserved during deserialization
    command.objectId = data.objectId || data.shapeData.id;
    return command;
  }
}

// Helper to create specific shape commands
export class ShapeCommandFactory {
  static getShapeTextDefaults() {
    return {
      text: {
        text: "",
        fontFamily: "Arial, sans-serif",
        fontSize: 14,
        textColor: "#111827",
        weight: "normal",
        padding: 12,
        textAlign: "center",
        textBaseline: "middle",
        style: "normal",
        underline: false,
        strikethrough: false,
        listType: null,

      }
    };
  }

  static generateShapeId() {
    // Generate deterministic-ish ID for shapes
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);

    // Try crypto.randomUUID if available, otherwise fallback
    let uuid;
    try {
      uuid = crypto.randomUUID?.() || `id_${timestamp}_${random}`;
    } catch {
      uuid = `id_${timestamp}_${random}`;
    }

    return `shape_${uuid}`;
  }

  static createRectangle(x, y, width, height, options) {
    const shapeData = {
      id: this.generateShapeId(),
      type: TOOL_TYPES.SHAPE,
      shapeType: SHAPE_TYPES.RECTANGLE,
      creationSource: options.creationSource || 'create',
      x,
      y,
      width,
      height,
      strokeColor: options.strokeColor || DEFAULT_TOOL_OPTIONS["shape"].color,
      strokeWidth: options.strokeWidth || DEFAULT_TOOL_OPTIONS["shape"].width,
      fillColor: options.fillColor || DEFAULT_TOOL_OPTIONS["shape"].fillColor,
      opacity: options.opacity || DEFAULT_TOOL_OPTIONS["shape"].opacity,
      createdAt: Date.now(),
      ...this.getShapeTextDefaults(),
    };

    return new AddShapeCommand(shapeData);
  }

  static createCircle(centerX, centerY, radius, options) {
    const shapeData = {
      id: this.generateShapeId(),
      type: TOOL_TYPES.SHAPE,
      shapeType: SHAPE_TYPES.CIRCLE,
      creationSource: options.creationSource || 'create',
      x: centerX,
      y: centerY,
      radius,
      strokeColor: options.strokeColor || DEFAULT_TOOL_OPTIONS["shape"].color,
      strokeWidth: options.strokeWidth || DEFAULT_TOOL_OPTIONS["shape"].width,
      fillColor: options.fillColor || DEFAULT_TOOL_OPTIONS["shape"].fillColor,
      opacity: options.opacity || DEFAULT_TOOL_OPTIONS["shape"].opacity,
      createdAt: Date.now(),
      ...this.getShapeTextDefaults(),
    };

    return new AddShapeCommand(shapeData);
  }

  static createLine(x1, y1, x2, y2, options) {
    const shapeData = {
      id: this.generateShapeId(),
      type: TOOL_TYPES.SHAPE,
      shapeType: SHAPE_TYPES.LINE,
      creationSource: options.creationSource || 'create',
      x1,
      y1,
      x2,
      y2,
      strokeColor: options.strokeColor || DEFAULT_TOOL_OPTIONS["shape"].color,
      strokeWidth: options.strokeWidth || DEFAULT_TOOL_OPTIONS["shape"].width,
      opacity: options.opacity || DEFAULT_TOOL_OPTIONS["shape"].opacity,
      createdAt: Date.now(),
    };

    return new AddShapeCommand(shapeData);
  }

  static createEllipse(x, y, radiusX, radiusY, options) {
    const shapeData = {
      id: this.generateShapeId(),
      type: TOOL_TYPES.SHAPE,
      shapeType: SHAPE_TYPES.ELLIPSE,
      creationSource: options.creationSource || 'create',
      x,
      y,
      radiusX,
      radiusY,
      strokeColor: options.strokeColor || DEFAULT_TOOL_OPTIONS["shape"].color,
      strokeWidth: options.strokeWidth || DEFAULT_TOOL_OPTIONS["shape"].width,
      fillColor: options.fillColor || DEFAULT_TOOL_OPTIONS["shape"].fillColor,
      opacity: options.opacity || DEFAULT_TOOL_OPTIONS["shape"].opacity,
      createdAt: Date.now(),
      ...this.getShapeTextDefaults(),
    };

    return new AddShapeCommand(shapeData);
  }

  static createArrow(x1, y1, x2, y2, options) {
    const shapeData = {
      id: this.generateShapeId(),
      type: TOOL_TYPES.SHAPE,
      shapeType: SHAPE_TYPES.ARROW,
      creationSource: options.creationSource || 'create',
      x1,
      y1,
      x2,
      y2,
      arrowSize: options.arrowSize || 20,
      strokeColor: options.strokeColor || '#000000',
      strokeWidth: options.strokeWidth || 2,
      fillColor: options.fillColor || 'transparent',
      opacity: options.opacity || 1.0,
      createdAt: Date.now(),
    };

    return new AddShapeCommand(shapeData);
  }

  static createTriangle(points, options) {
    const shapeData = {
      id: this.generateShapeId(),
      type: TOOL_TYPES.SHAPE,
      shapeType: SHAPE_TYPES.TRIANGLE,
      creationSource: options.creationSource || 'create',
      points: [...points], // Clone array
      strokeColor: options.strokeColor || DEFAULT_TOOL_OPTIONS["shape"].color,
      strokeWidth: options.strokeWidth || DEFAULT_TOOL_OPTIONS["shape"].width,
      fillColor: options.fillColor || DEFAULT_TOOL_OPTIONS["shape"].fillColor,
      opacity: options.opacity || DEFAULT_TOOL_OPTIONS["shape"].opacity,
      createdAt: Date.now(),
      ...this.getShapeTextDefaults(),
    };

    return new AddShapeCommand(shapeData);
  }

  static createDiamond(points, options) {
    const shapeData = {
      id: this.generateShapeId(),
      type: TOOL_TYPES.SHAPE,
      shapeType: SHAPE_TYPES.DIAMOND,
      creationSource: options.creationSource || 'create',
      points: [...points], // Diamond is a polygon with 4 points
      strokeColor: options.strokeColor || DEFAULT_TOOL_OPTIONS["shape"].color,
      strokeWidth: options.strokeWidth || DEFAULT_TOOL_OPTIONS["shape"].width,
      fillColor: options.fillColor || DEFAULT_TOOL_OPTIONS["shape"].fillColor,
      opacity: options.opacity || DEFAULT_TOOL_OPTIONS["shape"].opacity,
      createdAt: Date.now(),
      ...this.getShapeTextDefaults(),
    };

    return new AddShapeCommand(shapeData);
  }

  static createStar(points, options) {
    const shapeData = {
      id: this.generateShapeId(),
      type: TOOL_TYPES.SHAPE,
      shapeType: SHAPE_TYPES.STAR,
      creationSource: options.creationSource || 'create',
      points: [...points],
      strokeColor: options.strokeColor || DEFAULT_TOOL_OPTIONS["shape"].color,
      strokeWidth: options.strokeWidth || DEFAULT_TOOL_OPTIONS["shape"].width,
      fillColor: options.fillColor || DEFAULT_TOOL_OPTIONS["shape"].fillColor,
      opacity: options.opacity || DEFAULT_TOOL_OPTIONS["shape"].opacity,
      createdAt: Date.now(),
      ...this.getShapeTextDefaults(),
    };

    return new AddShapeCommand(shapeData);
  }

  static createHexagon(points, options) {
    const shapeData = {
      id: this.generateShapeId(),
      type: TOOL_TYPES.SHAPE,
      shapeType: SHAPE_TYPES.HEXAGON,
      creationSource: options.creationSource || 'create',
      points: [...points],
      strokeColor: options.strokeColor || DEFAULT_TOOL_OPTIONS["shape"].color,
      strokeWidth: options.strokeWidth || DEFAULT_TOOL_OPTIONS["shape"].width,
      fillColor: options.fillColor || DEFAULT_TOOL_OPTIONS["shape"].fillColor,
      opacity: options.opacity || DEFAULT_TOOL_OPTIONS["shape"].opacity,
      createdAt: Date.now(),
      ...this.getShapeTextDefaults(),
    };

    return new AddShapeCommand(shapeData);
  }

  static createPentagon(points, options) {
    const shapeData = {
      id: this.generateShapeId(),
      type: TOOL_TYPES.SHAPE,
      shapeType: SHAPE_TYPES.PENTAGON,
      creationSource: options.creationSource || 'create',
      points: [...points],
      strokeColor: options.strokeColor || DEFAULT_TOOL_OPTIONS["shape"].color,
      strokeWidth: options.strokeWidth || DEFAULT_TOOL_OPTIONS["shape"].width,
      fillColor: options.fillColor || DEFAULT_TOOL_OPTIONS["shape"].fillColor,
      opacity: options.opacity || DEFAULT_TOOL_OPTIONS["shape"].opacity,
      createdAt: Date.now(),
      ...this.getShapeTextDefaults(),
    };

    return new AddShapeCommand(shapeData);
  }

}
