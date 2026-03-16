// src/canvas/tools/pencil/PencilTool.js - UPDATED VERSION

import { PencilCommandFactory } from '../../engine/commands/PencilCommands';
import { Pencil } from 'lucide-react';

// Pencil style configurations
const PENCIL_STYLES = {
  SKETCH: 'sketch',
  SMOOTH: 'smooth',
  HIGHLIGHTER: 'highlighter'
};

// Highlighter color palette
const HIGHLIGHTER_COLORS = {
  YELLOW: '#FFEB3B',
  GREEN: '#4CAF50',
  PINK: '#FF4081'
};

// Pencil configuration
const PENCIL_CONFIG = {
  SKETCH: {
    jitterAmount: 0.3,
    widthNoise: 0.15,
    smoothingFactor: 0.3
  },
  SMOOTH: {
    jitterAmount: 0,
    widthNoise: 0,
    smoothingFactor: 0.5
  },
  HIGHLIGHTER: {
    jitterAmount: 0,
    widthNoise: 0,
    smoothingFactor: 0.4,
    defaultWidth: 12,
    defaultOpacity: 0.3,
    maxOpacity: 0.5
  }
};

export class PencilTool {
  constructor(options = {}) {
    this.name = 'pencil';
    this.description = 'Draw freehand lines';
    this.icon = Pencil;
    this.cursor = 'crosshair';

    this.options = {
      style: PENCIL_STYLES.SMOOTH,
      color: 'auto',
      width: 2,
      opacity: 1.0,
      highlighterColor: 'yellow',
      ...options
    };

    // Drawing state
    this.isDrawing = false;
    this.currentPoints = [];
    this.smoothedPoints = [];
    this.startTime = null;
    this.canvasManager = null;
    this.lastPoint = null;
    
    // Collaboration hook reference (NEW)
    this.collaborationHook = null;
  }

  getCursor() {
    return this.cursor;
  }

  // NEW: Set collaboration hook
  setCollaborationHook(hook) {
    this.collaborationHook = hook;
  }

  activate(canvasManager, toolOptions) {
    this.canvasManager = canvasManager;
    this.options = { ...this.options, ...toolOptions };

    // Try to get collaboration hook from canvasManager if available
    if (canvasManager.collaborationHook) {
      this.collaborationHook = canvasManager.collaborationHook;
    }

    this.updateCursor();
    console.log('PencilTool activated with style:', this.options.style);
  }

  deactivate() {
    this.clearPreview();
    this.canvasManager = null;
    this.collaborationHook = null; // Clear reference
    this.resetDrawingState();
    console.log('PencilTool deactivated');
  }

  updateCursor() {
    if (this.options.style === PENCIL_STYLES.HIGHLIGHTER) {
      this.cursor = 'cell';
    } else {
      this.cursor = 'crosshair';
    }
  }

  onPointerDown(event) {
    if (!this.canvasManager) return null;

    this.isDrawing = true;
    this.startTime = Date.now();
    this.lastPoint = null;

    const bounds = this.canvasManager.state.canvasBounds;
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, event.x));
    const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, event.y));

    const point = {
      x: clampedX,
      y: clampedY,
      pressure: 0.5,
      timestamp: 0
    };

    this.currentPoints = [point];
    this.smoothedPoints = [point];
    this.lastPoint = point;

    // Create initial preview
    this.updatePreview();

    // UPDATED: Use collaboration hook if available
    if (this.collaborationHook && this.collaborationHook.trackOperation) {
      this.collaborationHook.trackOperation({
        type: 'drawing:start',
        point,
        color: this.getActiveColor(),
        width: this.getActiveWidth(),
        opacity: this.getActiveOpacity(),
        style: this.options.style
      });
    } 
    // Fallback to canvasManager emit (for backward compatibility)
    else if (this.canvasManager) {
      this.canvasManager.emit('drawing:start', {
        points: [point],
        color: this.getActiveColor(),
        width: this.getActiveWidth(),
        opacity: this.getActiveOpacity(),
        style: this.options.style
      });
    }

    return null;
  }

  onPointerMove(event) {
    if (!this.isDrawing || !this.canvasManager) return;

    const bounds = this.canvasManager.state.canvasBounds;
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, event.x));
    const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, event.y));

    const newPoint = {
      x: clampedX,
      y: clampedY,
      pressure: 0.5,
      timestamp: Date.now() - this.startTime
    };

    this.currentPoints.push(newPoint);

    const smoothed = this.applySmoothingAndStyle(newPoint);
    if (smoothed) {
      this.smoothedPoints.push(smoothed);
    }

    this.lastPoint = newPoint;

    this.updatePreview();

    // UPDATED: Use collaboration hook if available
    if (this.collaborationHook && this.collaborationHook.trackOperation) {
      this.collaborationHook.trackOperation({
        type: 'drawing:point',
        point: smoothed || newPoint,
        color: this.getActiveColor(),
        width: this.getActiveWidth(),
        opacity: this.getActiveOpacity(),
        style: this.options.style
      });
    }
    // Fallback to canvasManager emit
    else if (this.canvasManager) {
      const last = this.smoothedPoints.slice(-1);
      this.canvasManager.emit('drawing:point', {
        points: last,
        color: this.getActiveColor(),
        width: this.getActiveWidth(),
        opacity: this.getActiveOpacity(),
        style: this.options.style
      });
    }
  }

  onPointerUp(event) {
    if (!this.isDrawing || !this.canvasManager) return null;

    const bounds = this.canvasManager.canvasBounds;
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, event.x));
    const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, event.y));

    const finalPoint = {
      x: clampedX,
      y: clampedY,
      pressure: 0.5,
      timestamp: Date.now() - this.startTime
    };

    this.currentPoints.push(finalPoint);

    const smoothed = this.applySmoothingAndStyle(finalPoint);
    if (smoothed) {
      this.smoothedPoints.push(smoothed);
    }

    this.clearPreview();

    // UPDATED: Use collaboration hook if available
    if (this.collaborationHook && this.collaborationHook.trackOperation) {
      this.collaborationHook.trackOperation({
        type: 'drawing:end'
      });
    }
    // Fallback to canvasManager emit
    else if (this.canvasManager) {
      this.canvasManager.emit('drawing:end', {
        userId: this.canvasManager.state.currentUser?.id
      });
    }

    // Create command if we have enough points
    if (this.smoothedPoints.length >= 2) {
      const color = this.getActiveColor();
      const width = this.getActiveWidth();
      const opacity = this.getActiveOpacity();

      const drawingOptions = {
        strokeColor: color,
        strokeWidth: width,
        opacity: opacity,
        layer: this.canvasManager.state.currentLayer || 'default',
        style: this.options.style,
      };

      const command = PencilCommandFactory.create(
        this.smoothedPoints,
        drawingOptions
      );

      this.resetDrawingState();

      return {
        command
      };
    }

    this.resetDrawingState();
    return null;
  }

  applySmoothingAndStyle(newPoint) {
    if (!this.lastPoint) return newPoint;

    const config = PENCIL_CONFIG[this.options.style.toUpperCase()] || PENCIL_CONFIG.SMOOTH;

    const smoothed = this.applySmoothing(newPoint, this.lastPoint, config.smoothingFactor);

    if (this.options.style === PENCIL_STYLES.SKETCH) {
      return this.applySketchEffect(smoothed, config);
    }

    return smoothed;
  }

  applySmoothing(newPoint, lastPoint, factor) {
    return {
      x: lastPoint.x + (newPoint.x - lastPoint.x) * factor,
      y: lastPoint.y + (newPoint.y - lastPoint.y) * factor,
      pressure: lastPoint.pressure + (newPoint.pressure - lastPoint.pressure) * factor,
      timestamp: newPoint.timestamp
    };
  }

  applySketchEffect(point, config) {
    const jitter = config.jitterAmount;
    const widthNoise = config.widthNoise;

    return {
      x: point.x + (Math.random() - 0.5) * jitter,
      y: point.y + (Math.random() - 0.5) * jitter,
      pressure: point.pressure * (1 + (Math.random() - 0.5) * widthNoise),
      timestamp: point.timestamp
    };
  }

  getActiveColor() {
    const style = this.options.style;

    if (style === PENCIL_STYLES.HIGHLIGHTER) {
      const colorKey = this.options.highlighterColor?.toUpperCase() || 'YELLOW';
      return HIGHLIGHTER_COLORS[colorKey] || HIGHLIGHTER_COLORS.YELLOW;
    }

    if (this.options.color === 'auto') {
      const isDarkMode = this.canvasManager?.state?.darkMode || false;
      return isDarkMode ? '#E0E0E0' : '#333333';
    }

    return this.options.color || '#000000';
  }

  getActiveWidth() {
    const style = this.options.style;

    if (style === PENCIL_STYLES.HIGHLIGHTER) {
      return this.options.width || PENCIL_CONFIG.HIGHLIGHTER.defaultWidth;
    }

    return this.options.width || 2;
  }

  getActiveOpacity() {
    const style = this.options.style;

    if (style === PENCIL_STYLES.HIGHLIGHTER) {
      const maxOpacity = PENCIL_CONFIG.HIGHLIGHTER.maxOpacity;
      return Math.min(this.options.opacity || PENCIL_CONFIG.HIGHLIGHTER.defaultOpacity, maxOpacity);
    }

    return this.options.opacity || 1.0;
  }

  calculateStrokeWidth(point, baseWidth) {
    if (this.options.style === PENCIL_STYLES.HIGHLIGHTER) {
      return baseWidth;
    }

    const pressure = point.pressure || 0.5;
    const variation = 0.7 + (pressure * 0.6);
    return baseWidth * variation;
  }

  updatePreview() {
    if (!this.canvasManager || !this.isDrawing || this.smoothedPoints.length < 2) {
      return;
    }

    const color = this.getActiveColor();
    const width = this.getActiveWidth();
    const opacity = this.getActiveOpacity();

    const previewDrawing = {
      type: 'drawing',
      points: this.smoothedPoints.map(p => ({ ...p })),
      strokeColor: color,
      strokeWidth: width,
      opacity: opacity * 0.7,
      style: this.options.style,
      isPreview: true
    };

    this.canvasManager.setPreviewObject(previewDrawing);
  }

  clearPreview() {
    if (this.canvasManager) {
      this.canvasManager.clearPreview();
    }
  }

  resetDrawingState() {
    this.isDrawing = false;
    this.currentPoints = [];
    this.smoothedPoints = [];
    this.startTime = null;
    this.lastPoint = null;
  }

  setOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    this.updateCursor();
  }

  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    this.updateCursor();
  }

  getUIConfig() {
    return {
      name: this.name,
      description: this.description,
      icon: this.icon,
      cursor: this.cursor,
      hasOptions: true,
      styles: Object.values(PENCIL_STYLES),
      highlighterColors: Object.keys(HIGHLIGHTER_COLORS).map(k => k.toLowerCase()),
      widthPresets: [2, 4, 8],
      supportsColor: this.options.style !== PENCIL_STYLES.HIGHLIGHTER,
      supportsPressure: this.options.style !== PENCIL_STYLES.HIGHLIGHTER,
    };
  }

  getStyleConfig() {
    return {
      currentStyle: this.options.style,
      isHighlighter: this.options.style === PENCIL_STYLES.HIGHLIGHTER,
      isSketch: this.options.style === PENCIL_STYLES.SKETCH,
      isSmooth: this.options.style === PENCIL_STYLES.SMOOTH,
    };
  }
}

export { PENCIL_STYLES, HIGHLIGHTER_COLORS, PENCIL_CONFIG };
export default PencilTool;