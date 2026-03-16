// src/canvas/commands/PencilCommand.js
import { BaseCommand } from '../history/BaseCommand';
import { DEFAULT_TOOL_OPTIONS } from '@shared/constants';
import { roundPoints, simplifyPoints } from '@shared/lib/geometrySimplifier';

export class PencilCommand extends BaseCommand {
  constructor(points, options) {
    super();
    this.operation = 'create';

    const tolerance = options.simplifyTolerance || 2;

    let simplifiedPoints = points;
    if (options.simplify !== false) {  // Allow turning off simplification
      simplifiedPoints = simplifyPoints(points, tolerance);
    }

    if (options.round !== false) {
      simplifiedPoints = roundPoints(simplifiedPoints);
    }

    this.points = simplifiedPoints.map(p => ({ ...p }));

    // Log how much we saved (for debugging)
    // if (points.length > 0) {
    //   const saved = ((1 - simplifiedPoints.length / points.length) * 100).toFixed(1);
    //   console.log(`RDP: ${points.length} → ${simplifiedPoints.length} points (${saved}% reduction)`);
    // }


    // Store drawing options
    this.strokeColor = options.strokeColor || DEFAULT_TOOL_OPTIONS["pencil"].color;
    this.strokeWidth = options.strokeWidth || DEFAULT_TOOL_OPTIONS["pencil"].width;
    this.opacity = options.opacity || DEFAULT_TOOL_OPTIONS["pencil"].opacity;
    this.layer = options.layer || DEFAULT_TOOL_OPTIONS["pencil"].layer;

    // Generate unique ID for this drawing
    this.objectId = options.id || `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store tolerance used (for debugging)
    this.simplifyTolerance = tolerance;
    this.originalPointCount = points.length;

  }

  execute(state) {
    // Check if drawing already exists (idempotent)
    const exists = state.objects.some(obj => obj.id === this.objectId);
    if (exists) {
      console.warn(`Drawing ${this.objectId} already exists, skipping execute`);
      return;
    }

    // We can move this drawing creation logic to a factory if needed and add more pencils later
    // For now we have a single pencil tool implementation here 
    // Create drawing object
    const drawing = {
      id: this.objectId,
      type: 'drawing',
      points: this.points.map(p => ({ ...p })), // Clone again for safety
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
      opacity: this.opacity,
      layer: this.layer,
      visible: true,
      createdAt: Date.now(),
    };

    state.objects.push(drawing);
  }

  undo(state) {
    // Remove by ID
    const index = state.objects.findIndex(obj => obj.id === this.objectId);
    if (index !== -1) {
      state.objects.splice(index, 1);
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      type: 'PencilCommand',
      points: this.points,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
      opacity: this.opacity,
      layer: this.layer,
      objectId: this.objectId,
    };
  }

  static deserialize(data) {
    const command = new PencilCommand(data.points, {
      strokeColor: data.strokeColor,
      strokeWidth: data.strokeWidth,
      opacity: data.opacity,
      layer: data.layer,
      id: data.objectId,
    });

    command.id = data.id;
    command.timestamp = data.timestamp;
    command.userId = data.userId;
    return command;
  }
}

// Factory for creating pencil commands
export class PencilCommandFactory {
  static generateDrawingId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `drawing_${timestamp}_${random}`;
  }

  static create(points, options) {
    return new PencilCommand(points, {
      strokeColor: options.strokeColor || DEFAULT_TOOL_OPTIONS["pencil"].color,
      strokeWidth: options.strokeWidth || DEFAULT_TOOL_OPTIONS["pencil"].width,
      opacity: options.opacity || DEFAULT_TOOL_OPTIONS["pencil"].opacity,
      layer: options.layer || DEFAULT_TOOL_OPTIONS["pencil"].layer,
      id: this.generateDrawingId(),
    });
  }
}

export default PencilCommand;