// src/canvas/tools/shapes/ShapeTool.js - FIXED VERSION
import { SHAPE_TYPES, TOOL_OPTIONS } from '@shared/constants';
import { ShapeCommandFactory } from '../../engine/commands/ShapeCommands';

export class ShapeTool {
  constructor(options = {}) {
    this.name = 'shape';
    this.description = 'Draw shapes (rectangle, circle, line, triangle, etc.)';

    this.currentShapeType = options[TOOL_OPTIONS.SHAPE_TYPE] || SHAPE_TYPES.RECTANGLE;

    this.icon = 'square';
    this.cursor = 'crosshair';

    // Options passed from CanvasManager
    this.options = { ...options };

    // Drawing state
    this.isDrawing = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.canvasManager = null;
    this.isEditing = false;

    // Update icon based on initial shape type
    this.updateIcon();
  }

  getCursor() {
    return this.cursor;
  }

  setOptions(newOptions) {
    console.log('ShapeTool.setOptions called with:', newOptions);

    // IMPORTANT: Update currentShapeType if shapeType is provided
    if (TOOL_OPTIONS.SHAPE_TYPE in newOptions) {
      this.currentShapeType = newOptions[TOOL_OPTIONS.SHAPE_TYPE];
      this.updateIcon();
      console.log('Shape type updated to:', this.currentShapeType);
    }

    // Merge all options
    this.options = { ...this.options, ...newOptions };
  }

  activate(canvasManager, toolOptions) {
    this.canvasManager = canvasManager;

    // IMPORTANT: Set options first, which will update currentShapeType
    this.setOptions(toolOptions);

    console.log('ShapeTool activated');
    console.log('Current shape type:', this.currentShapeType);
    console.log('Tool options:', toolOptions);
    console.log('All options:', this.options);
  }

  deactivate() {
    this.clearPreview();
    this.canvasManager = null;
  }

  onPointerDown(event) {
    if (!this.canvasManager) return null;

    this.isDrawing = true;
    const bounds = this.canvasManager.state.canvasBounds;
    this.startPoint = {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, event.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, event.y))
    };
    this.currentPoint = { ...this.startPoint };

    // Create initial preview
    this.updatePreview();

    const previewObj = this.createPreviewObject();
    if (previewObj && this.canvasManager) {
      this.canvasManager.emit('shape:preview', { preview: previewObj });
    }

    return null; // No command yet
  }

  onPointerMove(event) {
    if (!this.isDrawing || !this.canvasManager) return;

    const bounds = this.canvasManager.state.canvasBounds;
    this.currentPoint = {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, event.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, event.y))
    };

    this.updatePreview();

    const previewObj = this.createPreviewObject();
    if (previewObj && this.canvasManager) {
      this.canvasManager.emit('shape:preview', { preview: previewObj });
    }
  }

  onPointerUp(event) {
    if (!this.isDrawing || !this.canvasManager) return null;

    const bounds = this.canvasManager.state.canvasBounds;
    this.currentPoint = {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, event.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, event.y))
    };

    // Check if shape is large enough (minimum 3px in any dimension)
    const width = Math.abs(this.currentPoint.x - this.startPoint.x);
    const height = Math.abs(this.currentPoint.y - this.startPoint.y);
    const minSize = 3;

    if (width > minSize || height > minSize) {
      const command = this.createShapeCommand();

      // Clear preview
      this.clearPreview();

      // broadcast preview end
      this.canvasManager.emit('shape:preview:clear', {
        userId: this.canvasManager.state.currentUser?.id
      });

      // reset default shape type after drawing
      if (this.baseShapeType && this.currentShapeType !== this.baseShapeType) {
        this.currentShapeType = this.baseShapeType;
        // sync UI state if possible
        if (this.canvasManager && this.canvasManager.toolManager) {
          this.canvasManager.toolManager.setShapeType(this.baseShapeType);
        }
      }

      // Reset drawing state
      this.isDrawing = false;
      this.startPoint = null;
      this.currentPoint = null;

      if (this.canvasManager && command) {
        const shapeId = command.objectId || command.shapeData?.id;
        if (shapeId) {
          this.canvasManager.setSelection([shapeId]);
        }
        // Switch to select tool
        if (this.canvasManager.toolManager) {
          const selectTool = this.canvasManager.toolManager.getToolInstance('select');
          if (selectTool) {
            this.canvasManager.setActiveTool(selectTool);
          }
        }
      }

      return {
        command,
      };
    }

    const DEFAULT_OFFSET = 80;
    const savedStart = { ...this.startPoint };
    this.currentPoint = {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, savedStart.x + DEFAULT_OFFSET)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, savedStart.y + DEFAULT_OFFSET))
    };

    const defaultCommand = this.createShapeCommand();
    this.clearPreview();
    this.canvasManager.emit('shape:preview:clear', {
      userId: this.canvasManager.state.currentUser?.id,
    });
    if (this.baseShapeType && this.currentShapeType !== this.baseShapeType) {
      this.currentShapeType = this.baseShapeType;
      if (this.canvasManager?.toolManager) {
        this.canvasManager.toolManager.setShapeType(this.baseShapeType);
      }
    }
    this.isDrawing = false;
    this.startPoint = null;
    this.currentPoint = null;

    if (this.canvasManager && defaultCommand) {
      const shapeId = defaultCommand.objectId || defaultCommand.shapeData?.id;
      if (shapeId) this.canvasManager.setSelection([shapeId]);
      if (this.canvasManager.toolManager) {
        const selectTool = this.canvasManager.toolManager.getToolInstance('select');
        if (selectTool) this.canvasManager.setActiveTool(selectTool);
      }
    }
    return { command: defaultCommand };
  }

  createShapeCommand() {
    console.log('Creating shape command for type:', this.currentShapeType);

    const shapeOptions = {
      strokeColor: this.options[TOOL_OPTIONS.COLOR] || '#000000',
      strokeWidth: this.options[TOOL_OPTIONS.WIDTH] || 2,
      fillColor: this.options[TOOL_OPTIONS.FILL_COLOR] || 'transparent',
      opacity: this.options[TOOL_OPTIONS.OPACITY] || 1.0,
      layer: this.canvasManager.state.currentLayer || 'default',
      cornerRadius: this.options.cornerRadius || 10,
      arrowSize: this.options.arrowSize || 10,
      creationSource: 'create',
    };

    // For most shapes, we create from the drag rectangle
    const x = Math.min(this.startPoint.x, this.currentPoint.x);
    const y = Math.min(this.startPoint.y, this.currentPoint.y);
    const width = Math.abs(this.currentPoint.x - this.startPoint.x);
    const height = Math.abs(this.currentPoint.y - this.startPoint.y);

    switch (this.currentShapeType) {
      case SHAPE_TYPES.RECTANGLE:
        // 🎯 UPDATED: Rectangle now supports corner radius (previously was separate tool)
        return ShapeCommandFactory.createRectangle(x, y, width, height, shapeOptions);

      case SHAPE_TYPES.CIRCLE: {
        // Bug #4 fix: startPoint is the center, drag distance is the radius
        const circleDX = this.currentPoint.x - this.startPoint.x;
        const circleDY = this.currentPoint.y - this.startPoint.y;
        const circleRadius = Math.sqrt(circleDX * circleDX + circleDY * circleDY);
        return ShapeCommandFactory.createCircle(this.startPoint.x, this.startPoint.y, circleRadius, shapeOptions);
      }

      case SHAPE_TYPES.ELLIPSE: {
        // Bug #4 fix: startPoint is the center; radiusX/Y derived from drag delta
        const ellipseRadiusX = Math.abs(this.currentPoint.x - this.startPoint.x);
        const ellipseRadiusY = Math.abs(this.currentPoint.y - this.startPoint.y);
        return ShapeCommandFactory.createEllipse(this.startPoint.x, this.startPoint.y, ellipseRadiusX, ellipseRadiusY, shapeOptions);
      }

      case SHAPE_TYPES.LINE:
        return ShapeCommandFactory.createLine(
          this.startPoint.x,
          this.startPoint.y,
          this.currentPoint.x,
          this.currentPoint.y,
          shapeOptions
        );

      case SHAPE_TYPES.ARROW:
        return ShapeCommandFactory.createArrow(
          this.startPoint.x,
          this.startPoint.y,
          this.currentPoint.x,
          this.currentPoint.y,
          shapeOptions
        );

      case SHAPE_TYPES.TRIANGLE:
        const trianglePoints = this.calculateTrianglePoints(x, y, width, height);
        return ShapeCommandFactory.createTriangle(trianglePoints, shapeOptions);

      case SHAPE_TYPES.DIAMOND:
        const diamondPoints = this.calculateDiamondPoints(x, y, width, height);
        return ShapeCommandFactory.createDiamond(diamondPoints, shapeOptions);

      case SHAPE_TYPES.HEXAGON: {
        // Bug #4 fix: startPoint is center, max drag axis sets circumradius
        const hexR = Math.max(Math.abs(this.currentPoint.x - this.startPoint.x), Math.abs(this.currentPoint.y - this.startPoint.y));
        const hexagonPoints = this.calculateHexagonPoints(this.startPoint.x - hexR, this.startPoint.y - hexR, hexR * 2, hexR * 2);
        return ShapeCommandFactory.createHexagon(hexagonPoints, shapeOptions);
      }

      case SHAPE_TYPES.PENTAGON: {
        // Bug #4 fix: startPoint is center
        const penR = Math.max(Math.abs(this.currentPoint.x - this.startPoint.x), Math.abs(this.currentPoint.y - this.startPoint.y));
        const pentagonPoints = this.calculatePentagonPoints(this.startPoint.x - penR, this.startPoint.y - penR, penR * 2, penR * 2);
        return ShapeCommandFactory.createPentagon(pentagonPoints, shapeOptions);
      }

      case SHAPE_TYPES.STAR: {
        // Bug #4 fix: startPoint is center
        const starR = Math.max(Math.abs(this.currentPoint.x - this.startPoint.x), Math.abs(this.currentPoint.y - this.startPoint.y));
        const starPoints = this.calculateStarPoints(this.startPoint.x - starR, this.startPoint.y - starR, starR * 2, starR * 2);
        return ShapeCommandFactory.createStar(starPoints, shapeOptions);
      }

      default:
        return ShapeCommandFactory.createRectangle(x, y, width, height, shapeOptions);
    }
  }

  updatePreview() {
    if (!this.canvasManager || !this.isDrawing || !this.startPoint || !this.currentPoint) {
      return;
    }

    const previewObject = this.createPreviewObject();
    if (previewObject) {
      this.canvasManager.setPreviewObject(previewObject);
    }
  }

  createPreviewObject() {
    const x = Math.min(this.startPoint.x, this.currentPoint.x);
    const y = Math.min(this.startPoint.y, this.currentPoint.y);
    const width = Math.abs(this.currentPoint.x - this.startPoint.x);
    const height = Math.abs(this.currentPoint.y - this.startPoint.y);

    const previewOptions = {
      strokeColor: this.options[TOOL_OPTIONS.COLOR] || '#000000',
      strokeWidth: this.options[TOOL_OPTIONS.WIDTH] || 2,
      fillColor: 'transparent',
      opacity: 0.5,
      dashArray: [5, 5],
    };

    switch (this.currentShapeType) {
      case SHAPE_TYPES.RECTANGLE:
        return {
          type: 'rectangle',
          x,
          y,
          width,
          height,
          cornerRadius: this.options.cornerRadius || 0,
          ...previewOptions,
          isPreview: true,
        };

      case SHAPE_TYPES.CIRCLE: {
        const previewDX = this.currentPoint.x - this.startPoint.x;
        const previewDY = this.currentPoint.y - this.startPoint.y;
        const previewRadius = Math.sqrt(previewDX * previewDX + previewDY * previewDY);
        return {
          type: 'circle',
          x: this.startPoint.x,
          y: this.startPoint.y,
          radius: previewRadius,
          ...previewOptions,
          isPreview: true,
        };
      }

      case SHAPE_TYPES.ELLIPSE: {
        const previewRadiusX = Math.abs(this.currentPoint.x - this.startPoint.x);
        const previewRadiusY = Math.abs(this.currentPoint.y - this.startPoint.y);
        return {
          type: 'ellipse',
          x: this.startPoint.x,
          y: this.startPoint.y,
          radiusX: previewRadiusX,
          radiusY: previewRadiusY,
          ...previewOptions,
          isPreview: true,
        };
      }

      case SHAPE_TYPES.LINE:
        return {
          type: 'line',
          x1: this.startPoint.x,
          y1: this.startPoint.y,
          x2: this.currentPoint.x,
          y2: this.currentPoint.y,
          ...previewOptions,
          isPreview: true,
        };

      case SHAPE_TYPES.ARROW:
        return {
          type: 'arrow',
          x1: this.startPoint.x,
          y1: this.startPoint.y,
          x2: this.currentPoint.x,
          y2: this.currentPoint.y,
          arrowSize: this.options.arrowSize || 10,
          ...previewOptions,
          isPreview: true,
        };

      case SHAPE_TYPES.TRIANGLE:
        const trianglePoints = this.calculateTrianglePoints(x, y, width, height);
        return {
          type: 'triangle',
          points: trianglePoints,
          ...previewOptions,
          isPreview: true,
        };

      case SHAPE_TYPES.DIAMOND:
        const diamondPoints = this.calculateDiamondPoints(x, y, width, height);
        return {
          type: 'diamond',
          points: diamondPoints,
          ...previewOptions,
          isPreview: true,
        };

      case SHAPE_TYPES.HEXAGON: {
        const prevHexR = Math.max(Math.abs(this.currentPoint.x - this.startPoint.x), Math.abs(this.currentPoint.y - this.startPoint.y));
        const hexagonPoints = this.calculateHexagonPoints(this.startPoint.x - prevHexR, this.startPoint.y - prevHexR, prevHexR * 2, prevHexR * 2);
        return { type: 'hexagon', points: hexagonPoints, ...previewOptions, isPreview: true };
      }

      case SHAPE_TYPES.PENTAGON: {
        const prevPenR = Math.max(Math.abs(this.currentPoint.x - this.startPoint.x), Math.abs(this.currentPoint.y - this.startPoint.y));
        const pentagonPoints = this.calculatePentagonPoints(this.startPoint.x - prevPenR, this.startPoint.y - prevPenR, prevPenR * 2, prevPenR * 2);
        return { type: 'pentagon', points: pentagonPoints, ...previewOptions, isPreview: true };
      }

      case SHAPE_TYPES.STAR: {
        const prevStarR = Math.max(Math.abs(this.currentPoint.x - this.startPoint.x), Math.abs(this.currentPoint.y - this.startPoint.y));
        const starPoints = this.calculateStarPoints(this.startPoint.x - prevStarR, this.startPoint.y - prevStarR, prevStarR * 2, prevStarR * 2);
        return { type: 'star', points: starPoints, ...previewOptions, isPreview: true };
      }

      default:
        return null;
    }
  }

  clearPreview() {
    if (this.canvasManager) {
      this.canvasManager.clearPreview();
    }
  }

  updateIcon() {
    const iconMap = {
      [SHAPE_TYPES.RECTANGLE]: 'square',
      [SHAPE_TYPES.CIRCLE]: 'circle',
      [SHAPE_TYPES.ELLIPSE]: 'circle',
      [SHAPE_TYPES.LINE]: 'minus',
      [SHAPE_TYPES.ARROW]: 'arrow-right',
      [SHAPE_TYPES.TRIANGLE]: 'triangle',
      [SHAPE_TYPES.DIAMOND]: 'octagon',
      [SHAPE_TYPES.HEXAGON]: 'hexagon',
      [SHAPE_TYPES.PENTAGON]: 'pentagon',
      [SHAPE_TYPES.STAR]: 'star',
    };

    this.icon = iconMap[this.currentShapeType] || 'square';
    console.log('Icon updated to:', this.icon, 'for shape:', this.currentShapeType);
  }

  getUIConfig() {
    this.updateIcon();

    return {
      name: this.name,
      description: this.description,
      icon: this.icon,
      cursor: this.cursor,
      hasOptions: true,
    };
  }

  // Helper methods for shape points (keep existing)
  calculateTrianglePoints(x, y, width, height) {
    return [
      { x: x + width / 2, y: y },
      { x: x, y: y + height },
      { x: x + width, y: y + height },
    ];
  }

  calculateDiamondPoints(x, y, width, height) {
    return [
      { x: x + width / 2, y: y },
      { x: x + width, y: y + height / 2 },
      { x: x + width / 2, y: y + height },
      { x: x, y: y + height / 2 },
    ];
  }

  calculateHexagonPoints(x, y, width, height) {
    const points = [];
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radius = Math.min(width, height) / 2;

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    }
    return points;
  }

  calculatePentagonPoints(x, y, width, height) {
    const points = [];
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radius = Math.min(width, height) / 2;

    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
      points.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    }
    return points;
  }

  calculateStarPoints(x, y, width, height) {
    const points = [];
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const outerRadius = Math.min(width, height) / 2;
    const innerRadius = outerRadius / 2;
    const starPoints = 5;

    for (let i = 0; i < starPoints * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI / starPoints) * i - Math.PI / 2;
      points.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    }
    return points;
  }
}

export default ShapeTool;