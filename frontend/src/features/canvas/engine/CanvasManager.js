// src/canvas/CanvasManager.js
import { HistoryManager } from './history/index.js';
import {
  PanViewportCommand,
  ZoomViewportCommand,
  ResetViewportCommand,
} from './commands/index.js';
import SelectionOverlayRenderer from './renderers/SelectionOverlayRenderer.js';
import {
  applyPanBoundaries as applyPanBoundariesHelper,
  isWithinBoundaries as isWithinBoundariesHelper,
  clampPointToBounds as clampPointToBoundsHelper,
  clampObjectToBounds as clampObjectToBoundsHelper,
  isObjectWithinBounds as isObjectWithinBoundsHelper,
  enforceCanvasBounds as enforceCanvasBoundsHelper,
  getVisibleBoundaries as getVisibleBoundariesHelper,
} from './helpers/canvasViewportBounds.js';
import {
  getObjectOBB as getObjectOBBHelper,
  getMultipleObjectOBB as getMultipleObjectOBBHelper,
  getObjectsAtPoint as getObjectsAtPointHelper,
  getObjectBounds as getObjectBoundsHelper,
  getMultipleObjectBounds as getMultipleObjectBoundsHelper,
  isPointInBounds as isPointInBoundsHelper,
  getObjectsInRect as getObjectsInRectHelper,
} from './helpers/canvasSelectionGeometry.js';
import {
  drawText as drawTextHelper,
  drawImage as drawImageHelper,
  roundRect as roundRectHelper,
} from './helpers/canvasTextImageDrawing.js';
import {
  drawPath as drawPathHelper,
  drawPressureSensitivePath as drawPressureSensitivePathHelper,
  drawRectangle as drawRectangleHelper,
  drawCircle as drawCircleHelper,
  drawLine as drawLineHelper,
  drawRoundedRectangle as drawRoundedRectangleHelper,
  drawEllipse as drawEllipseHelper,
  drawArrow as drawArrowHelper,
  drawTriangle as drawTriangleHelper,
  drawPolygon as drawPolygonHelper,
  drawEmoji as drawEmojiHelper,
  drawStickyNote as drawStickyNoteHelper,
} from './helpers/canvasShapeDrawing.js';
import {
  startRenderLoop as startRenderLoopHelper,
  requestRender as requestRenderHelper,
  renderCanvas as renderCanvasHelper,
  drawObject as drawObjectHelper,
} from './helpers/canvasRenderCore.js';
import {
  drawCanvasBoundary as drawCanvasBoundaryHelper,
  drawGrid as drawGridHelper,
  drawMultiLevelLineGrid as drawMultiLevelLineGridHelper,
} from './helpers/canvasGridRendering.js';
import {
  handlePointerDown as handlePointerDownHelper,
  handlePointerMove as handlePointerMoveHelper,
  handlePointerUp as handlePointerUpHelper,
  onEvent as onEventHelper,
  offEvent as offEventHelper,
  emitEvent as emitEventHelper,
  serializeManager as serializeManagerHelper,
  deserializeManager as deserializeManagerHelper,
  destroyManager as destroyManagerHelper,
} from './helpers/canvasLifecycle.js';
import { SmartGuideState } from './smartGuides/index.js';
import useCollaborationStore from '@features/room/state/collaborationStore.js';

export default class CanvasManager {
  constructor(containerElement, selectionManager, toolManager) {
    // Canvas rendering
    this.container = containerElement;
    this.canvas = null;
    this.ctx = null;

    // Canvas bounds configuration (finite canvas)
    this.canvasBounds = {
      minX: -500000,
      maxX: 500000,
      minY: -500000,
      maxY: 500000,
    };

    // State (single source of truth)
    this.state = {
      objects: [],           // All drawable objects
      selection: [],         // Selected object IDs
      viewport: {           // Camera transform
        zoom: 1,
        panX: 0,
        panY: 0
      },
      canvasBounds: this.canvasBounds,
      gridStyle: 'lines',   // 'none', 'lines' 
      darkMode: false,       // Dark mode flag
    };

    // Systems
    this.historyManager = new HistoryManager();
    this.activeTool = null;
    this.selectionManager = selectionManager;

    // Tool management
    this.toolManager = toolManager;
    this.toolManager.setSelectionManager(selectionManager);

    // Rendering systems
    this.selectionOverlayRenderer = null;
    this.transformOverlay = null;
    this.transformController = null;
    this.selectionOverlayRenderer = new SelectionOverlayRenderer(selectionManager, this);

    // Preview system
    this.previewObject = null; // Single preview object (local)
    this.remotePreviewObjects = new Map(); // userId → preview object

    // Smart Guides
    this.smartGuideState = new SmartGuideState();

    // Rendering
    this.needsRender = true;
    this.renderRequestId = null; // For requestAnimationFrame

    // Object indexing 
    this.objectsById = new Map();

    // Track last pointer position in world space (used for paste positioning)
    this.lastPointerWorld = null;

    // Event system placeholder
    this.eventListeners = new Map();
    this.boundResize = this.resize.bind(this);
  }

  /* -------------------- INITIALIZATION -------------------- */

  /**
   * Configure the finite canvas bounds (call before init())
   * @param {Object} bounds - { minX, maxX, minY, maxY }
   */
  setCanvasBounds(bounds) {
    if (bounds && typeof bounds === 'object') {
      const { minX, maxX, minY, maxY } = bounds;

      // Validate bounds
      if (minX !== undefined && maxX !== undefined && minX < maxX &&
        minY !== undefined && maxY !== undefined && minY < maxY) {

        this.canvasBounds = {
          minX,
          maxX,
          minY,
          maxY,
        };

        // Update state reference
        this.state.canvasBounds = this.canvasBounds;

        return true;
      } else {
        console.warn('Invalid canvas bounds provided');
        return false;
      }
    }
    return false;
  }

  /**
   * Get the current canvas bounds
   */
  getCanvasBounds() {
    return { ...this.canvasBounds };
  }

  init() {
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.container.appendChild(this.canvas);

    // Get 2D context
    this.ctx = this.canvas.getContext('2d');

    // Set initial size
    this.resize();

    // Center viewport on canvas bounds so the finite canvas appears centered
    this.centerViewport();

    // Start render loop
    this.startRenderLoop();

    // Listen for window resize
    window.addEventListener('resize', this.boundResize);

  }

  /**
   * Center the viewport on the finite canvas bounds (keeps canvas centered on screen)
   */
  centerViewport() {
    if (!this.canvasBounds || !this.container) return;

    // Get screen size
    const screenWidth = this.container.clientWidth || 800;
    const screenHeight = this.container.clientHeight || 600;

    // World center is (0,0) because bounds are -5000 to 5000
    const worldCenterX = 0;
    const worldCenterY = 0;

    const zoom = this.state.viewport.zoom || 1;

    // Calculate pan so world center (0,0) is at screen center
    const panX = screenWidth / 2 - worldCenterX * zoom;
    const panY = screenHeight / 2 - worldCenterY * zoom;

    this.state.viewport.panX = panX;
    this.state.viewport.panY = panY;

    this.requestRender();
  }

  /* -------------------- COMMAND EXECUTION -------------------- */

  /**
   * Execute a LOCAL command (pushes to undo stack)
   */
  executeLocalCommand(command) {
    if (command && !command.userId) {
      command.userId = useCollaborationStore.getState().currentUser?.id || null;
    }
    // Execute through history manager (will push to undo stack)
    this.historyManager.execute(command, this.state);

    // Update Map based on command type
    if (this.isSimpleCommand(command)) {
      this.updateMapForCommand(command);
    } else {
      // Complex command, rebuild entire Map
      this.updateObjectIndex();
    }

    // Enforce canvas bounds on all objects
    this.enforceCanvasBounds();

    // Trigger render
    this.requestRender();

    // Emit state change event
    this.emit('state:changed', { type: 'local', command });

    // Sync selection after delete commands so UI toolbars hide immediately.
    const cmdName = command.constructor?.name || '';
    if (cmdName === 'DeleteCommand' || cmdName === 'DeleteObjectsCommand') {
      this.setSelection(this.state.selection);
    }

    // If command is a layer reorder, emit explicit object:reordered event for collaboration
    if (command.constructor?.name === 'LayerOrderCommand') {
      this.emit('object:reordered', {
        orderedIds: this.state.objects.map(o => o.id),
        direction: command.direction,
        objectIds: command.objectIds,
        timestamp: Date.now()
      });
    }

    // If command modified an object, emit update event
    if (command.objectId && command.type !== 'create') {
      this.emit('object:updated', {
        objectId: command.objectId,
        commandType: command.constructor?.name,
        timestamp: Date.now()
      });
    }

    // If command created an object, emit object:created event for auto-selection
    if (command.objectId) {
      // Include full object data so listeners can broadcast complete dimensions
      const createdObj = this.objectsById.get(command.objectId);
      this.emit('object:created', {
        objectId: command.objectId,
        object: createdObj ? { ...createdObj } : null,
        commandType: command.constructor?.name || 'Unknown',
        timestamp: Date.now()
      });
    }

    return {
      command: command.serialize(),
      type: 'local',
      objectId: command.objectId // Include objectId in result
    };
  }

  /**
 * Execute command for LIVE PREVIEW only (does NOT push to history)
 * Used for smooth dragging, resizing, rotating during interaction
 */
  executeCommandForPreview(command) {
    // Execute the command on current state
    const executed = command.execute(this.state);

    if (executed) {
      // Update object index for any new objects
      this.updateObjectIndex();

      // Request render to show changes
      this.requestRender();

      // Emit preview event (optional)
      this.emit('command:preview', { command });

      return true;
    }

    return false;
  }

  /* -------------------- ADD TO SELECTION SECTION -------------------- */

  /**
   * Select objects by IDs (sync with external selection store)
   * @param {string[]} objectIds - Array of object IDs to select
   */
  setSelection(objectIds) {
    if (!Array.isArray(objectIds)) {
      console.warn('setSelection: objectIds must be an array');
      return;
    }

    // Validate all IDs exist
    const validIds = objectIds.filter(id => this.objectsById.has(id));

    if (validIds.length !== objectIds.length) {
      console.warn('setSelection: Some object IDs do not exist');
    }

    // Update selection
    this.state.selection = validIds;
    if (this.selectionManager) {
      this.selectionManager.set(validIds);
    }

    // Request render to show selection outline
    this.requestRender();

    // Emit selection changed event
    this.emit('selection:changed', {
      selectedIds: [...validIds],
      count: validIds.length
    });

    console.log('Selection updated:', validIds);
  }

  /**
   * Clear selection
   */
  clearSelection() {
    if (this.state.selection.length === 0) return;

    this.state.selection = [];
    if (this.selectionManager) {
      this.selectionManager.clear();
    }
    this.requestRender();

    this.emit('selection:changed', {
      selectedIds: [],
      count: 0
    });

    console.log('Selection cleared');
  }

  /**
   * Add object to selection
   * @param {string} objectId - Object ID to add
   */
  addToSelection(objectId) {
    if (!objectId || !this.objectsById.has(objectId)) {
      console.warn('addToSelection: Invalid object ID');
      return;
    }

    if (this.state.selection.includes(objectId)) {
      return; // Already selected
    }

    this.state.selection.push(objectId);
    if (this.selectionManager) {
      this.selectionManager.set(this.state.selection);
    }
    this.requestRender();

    this.emit('selection:changed', {
      selectedIds: [...this.state.selection],
      count: this.state.selection.length
    });
  }

  /**
   * Remove object from selection
   * @param {string} objectId - Object ID to remove
   */
  removeFromSelection(objectId) {
    const index = this.state.selection.indexOf(objectId);
    if (index === -1) return;

    this.state.selection.splice(index, 1);
    if (this.selectionManager) {
      this.selectionManager.set(this.state.selection);
    }
    this.requestRender();

    this.emit('selection:changed', {
      selectedIds: [...this.state.selection],
      count: this.state.selection.length
    });
  }

  /**
   * Check if object is selected
   * @param {string} objectId - Object ID to check
   * @returns {boolean}
   */
  isObjectSelected(objectId) {
    return this.state.selection.includes(objectId);
  }

  /**
   * Execute a REMOTE command (does NOT push to undo stack)
   */
  executeRemoteCommand(command) {
    console.log('Executing REMOTE command:', command.constructor?.name || 'Unknown');

    // Execute directly without history
    command.execute(this.state);

    // Update Map the same way as local commands
    if (this.isSimpleCommand(command)) {
      this.updateMapForCommand(command);
    } else {
      this.updateObjectIndex();
    }

    // Trigger render
    this.requestRender();

    // Emit state change event
    this.emit('state:changed', { type: 'remote', command });

    const cmdName = command.constructor?.name || '';
    if (cmdName === 'DeleteCommand' || cmdName === 'DeleteObjectsCommand') {
      this.setSelection(this.state.selection);
    }

    return {
      command: command.serialize(),
      type: 'remote'
    };
  }

  /**
   * Execute a viewport command (does NOT go to history)
   */
  executeViewportCommand(command) {
    console.log('Executing VIEWPORT command:', command.constructor?.name || 'Unknown');

    // Execute directly without history
    command.execute(this.state);

    // Ensure viewport zoom and pan stay within canvas bounds after any viewport change
    if (this.canvasBounds && this.container) {
      // Clamp zoom so the finite canvas always covers the viewport (prevent showing outside area)
      const canvasCSSWidth = this.container.clientWidth || 800;
      const canvasCSSHeight = this.container.clientHeight || 600;
      const effectiveMinZoom = 0.01;

      if (this.state.viewport.zoom < effectiveMinZoom) {
        // Keep the current screen center in world coordinates and zoom toward it
        const screenCenterX = canvasCSSWidth / 2;
        const screenCenterY = canvasCSSHeight / 2;
        const worldCenter = this.screenToWorld(screenCenterX, screenCenterY);

        this.state.viewport.zoom = effectiveMinZoom;

        // Recompute pan so worldCenter maps to screen center under new zoom
        this.state.viewport.panX = screenCenterX - worldCenter.x * this.state.viewport.zoom;
        this.state.viewport.panY = screenCenterY - worldCenter.y * this.state.viewport.zoom;
      }

      // Finally clamp pan to bounds
      const clamped = this.applyPanBoundaries(this.state.viewport.panX, this.state.viewport.panY);
      this.state.viewport.panX = clamped.panX;
      this.state.viewport.panY = clamped.panY;
    }

    // Trigger render
    this.requestRender();

    // Emit viewport change event
    this.emit('viewport:changed', { viewport: this.state.viewport });

    return {
      type: 'viewport',
      viewport: { ...this.state.viewport }
    };
  }

  /**
   * Convenience method for UI , only works for local commands 
   */
  executeCommand(command) {
    return this.executeLocalCommand(command);
  }

  updateCursor() {
    if (!this.canvas) return;

    // Get cursor from active tool
    let cursor = 'default';

    if (this.activeTool && typeof this.activeTool.getCursor === 'function') {
      cursor = this.activeTool.getCursor();
    }

    // Apply cursor to canvas
    this.canvas.style.cursor = cursor;
  }

  /* -------------------- VIEWPORT CONTROLS -------------------- */

  /**
   * Clamp pan values to keep viewport within canvas bounds
   * Ensures the entire canvas is always visible (or mostly visible at low zoom)
   */
  applyPanBoundaries(targetPanX, targetPanY) {
    return applyPanBoundariesHelper(this, targetPanX, targetPanY);
  }

  /**
   * Check if a point is within canvas bounds
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   * @returns {boolean}
   */
  isWithinBoundaries(x, y) {
    return isWithinBoundariesHelper(this, x, y);
  }

  /**
   * Clamp a point to be within canvas bounds
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   * @returns {Object} Clamped point {x, y}
   */
  clampPointToBounds(x, y) {
    return clampPointToBoundsHelper(this, x, y);
  }

  /**
   * Clamp an object position to be within canvas bounds, considering its size
   * @param {Object} obj - Object with x, y, width, height properties
   * @returns {Object} Clamped position {x, y}
   */
  clampObjectToBounds(obj) {
    return clampObjectToBoundsHelper(this, obj);
  }

  /**
   * Check if an object is within canvas bounds
   * @param {Object} obj - Object to check
   * @returns {boolean}
   */
  isObjectWithinBounds(obj) {
    return isObjectWithinBoundsHelper(this, obj);
  }

  /**
   * Enforce canvas bounds on all objects (clamp to boundaries)
   */
  enforceCanvasBounds() {
    enforceCanvasBoundsHelper(this);
  }

  /**
   * Get the visible world boundaries (accounting for viewport)
   * @returns {Object} Visible boundaries
   */
  getVisibleBoundaries() {
    return getVisibleBoundariesHelper(this);
  }

  pan(deltaX, deltaY) {
    // Calculate target pan
    const targetPanX = this.state.viewport.panX + deltaX;
    const targetPanY = this.state.viewport.panY + deltaY;

    // Apply boundaries
    const { panX, panY } = this.applyPanBoundaries(targetPanX, targetPanY);

    // Only create command if pan actually changed
    if (panX !== this.state.viewport.panX || panY !== this.state.viewport.panY) {
      const command = new PanViewportCommand(panX - this.state.viewport.panX, panY - this.state.viewport.panY);
      const result = this.executeViewportCommand(command);

      // Emit viewport change event
      this.emit('viewport:changed', { viewport: this.state.viewport });

      return result;
    }

    return null;
  }

  zoomAt(zoom, centerX, centerY) {
    const currentZoom = this.state.viewport.zoom;
    const command = new ZoomViewportCommand(zoom, centerX, centerY, currentZoom);
    return this.executeViewportCommand(command);
  }

  resetViewport() {
    const command = new ResetViewportCommand();
    return this.executeViewportCommand(command);
  }

  setZoom(newZoom, centerX, centerY) {
    const MIN_ZOOM = 0.01;
    const MAX_ZOOM = 4.0;

    // Clamp requested zoom between computed min and max
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

    // Apply zoom (ZoomViewportCommand will set pan to keep focal point)
    this.zoomAt(clampedZoom, centerX, centerY);

    // Ensure pan remains within bounds after zoom
    const clamped = this.applyPanBoundaries(this.state.viewport.panX, this.state.viewport.panY);
    this.state.viewport.panX = clamped.panX;
    this.state.viewport.panY = clamped.panY;

    return clampedZoom;
  }

  zoomIn(step = 0.1, centerX, centerY) {
    const currentZoom = this.state.viewport.zoom;
    const newZoom = currentZoom * (1 + step);
    return this.setZoom(newZoom, centerX, centerY);
  }

  zoomOut(step = 0.1, centerX, centerY) {
    const currentZoom = this.state.viewport.zoom;
    const newZoom = currentZoom * (1 - step);
    return this.setZoom(newZoom, centerX, centerY);
  }

  setZoomPercent(percent, centerX, centerY) {
    const zoom = percent / 100;
    return this.setZoom(zoom, centerX, centerY);
  }

  /**
   * Configure pan boundaries (useful for different canvas sizes)
   * @param {number} minX - Minimum X world coordinate
   * @param {number} maxX - Maximum X world coordinate
   * @param {number} minY - Minimum Y world coordinate
   * @param {number} maxY - Maximum Y world coordinate
   */
  setPanBoundaries(minX, maxX, minY, maxY) {
    this.state.viewport.minX = minX;
    this.state.viewport.maxX = maxX;
    this.state.viewport.minY = minY;
    this.state.viewport.maxY = maxY;
    console.log(`Pan boundaries set to: X[${minX}, ${maxX}], Y[${minY}, ${maxY}]`);
  }

  /**
   * Get current pan boundaries
   */
  getPanBoundaries() {
    return {
      minX: this.state.viewport.minX,
      maxX: this.state.viewport.maxX,
      minY: this.state.viewport.minY,
      maxY: this.state.viewport.maxY
    };
  }

  /* -------------------- HISTORY -------------------- */

  undo() {
    if (!this.historyManager.canUndo()) {
      console.log('Nothing to undo');
      return null;
    }

    console.log('Undoing last command');
    const command = this.historyManager.undo(this.state);

    if (command) {
      // Update object index
      this.updateObjectIndex();

      // Trigger render
      this.requestRender();

      // Emit undo event
      this.emit('history:undo', { command });

      return {
        type: 'undo',
        success: true,
        command: command.serialize(),
        historyInfo: this.historyManager.getHistoryInfo()
      };
    }

    return null;
  }

  redo() {
    if (!this.historyManager.canRedo()) {
      console.log('Nothing to redo');
      return null;
    }

    console.log('Redoing command');
    const command = this.historyManager.redo(this.state);

    if (command) {
      // Update object index
      this.updateObjectIndex();

      // Trigger render
      this.requestRender();

      // Emit redo event
      this.emit('history:redo', { command });

      return {
        type: 'redo',
        success: true,
        command: command.serialize(),
        historyInfo: this.historyManager.getHistoryInfo()
      };
    }

    return null;
  }

  /* -------------------- PREVIEW SYSTEM -------------------- */

  setPreviewObject(object) {
    this.previewObject = object;
    this.requestRender();
  }

  clearPreview() {
    this.previewObject = null;
    this.requestRender();
  }

  updatePreviewObject(updates) {
    if (this.previewObject) {
      Object.assign(this.previewObject, updates);
      this.requestRender();
    }
  }

  /* -------------------- RENDERING -------------------- */

  startRenderLoop() {
    return startRenderLoopHelper(this);
  }

  requestRender() {
    return requestRenderHelper(this);
  }

  render() {
    return renderCanvasHelper(this);
  }

  drawObject(obj) {
    return drawObjectHelper(this, obj);
  }
  drawPath(obj) {
    return drawPathHelper(this, obj);
  }

  drawPressureSensitivePath(points, baseWidth) {
    return drawPressureSensitivePathHelper(this, points, baseWidth);
  }

  drawRectangle(obj) {
    return drawRectangleHelper(this, obj);
  }

  drawCircle(obj) {
    return drawCircleHelper(this, obj);
  }

  drawText(obj) {
    return drawTextHelper(this, obj);
  }

  drawImage(obj) {
    return drawImageHelper(this, obj);
  }

  roundRect(x, y, w, h, r) {
    return roundRectHelper(this, x, y, w, h, r);
  }
  drawLine(obj) {
    return drawLineHelper(this, obj);
  }

  drawRoundedRectangle(obj) {
    return drawRoundedRectangleHelper(this, obj);
  }

  drawEllipse(obj) {
    return drawEllipseHelper(this, obj);
  }

  drawEmoji(obj) {
    return drawEmojiHelper(this, obj);
  }

  drawStickyNote(obj) {
    return drawStickyNoteHelper(this, obj);
  }


  drawArrow(obj) {
    return drawArrowHelper(this, obj);
  }

  drawTriangle(obj) {
    return drawTriangleHelper(this, obj);
  }

  drawPolygon(obj) {
    return drawPolygonHelper(this, obj);
  }

  /* -------------------- CANVAS BOUNDARY VISUALIZATION -------------------- */

  /**
   * Draw the canvas boundary/frame to show the finite canvas extent
   */
  drawCanvasBoundary() {
    return drawCanvasBoundaryHelper(this);
  }

  setGridMode(mode) {
    this.state.gridStyle = mode;
    this.requestRender();
  }

  /* -------------------- OPTIMIZED MULTI-LEVEL LINE GRID -------------------- */

  drawGrid() {
    return drawGridHelper(this);
  }

  drawMultiLevelLineGrid(worldLeft, worldTop, worldRight, worldBottom,
    gridSize, subLevel, subProgress, zoom, panX, panY, width, height, isDarkMode) {
    return drawMultiLevelLineGridHelper(
      this,
      worldLeft,
      worldTop,
      worldRight,
      worldBottom,
      gridSize,
      subLevel,
      subProgress,
      zoom,
      panX,
      panY,
      width,
      height,
      isDarkMode
    );
  }

  setDarkMode(isDark) {
    this.state.darkMode = isDark;
    this.requestRender();
  }
  /* -------------------- UTILITY -------------------- */

  setLastPointerWorld(point) {
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return;
    this.lastPointerWorld = { x: point.x, y: point.y };
  }

  getLastPointerWorld() {
    return this.lastPointerWorld ? { ...this.lastPointerWorld } : null;
  }

  resize() {
    if (!this.canvas || !this.container) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    // internal resolution (sharp)
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    // visual size (layout)
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    const ctx = this.ctx;
    if (!ctx) return;

    // reset + scale (important)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    this.requestRender();
  }

  screenToWorld(x, y) {
    const zoom = this.state.viewport.zoom;
    return {
      x: (x - this.state.viewport.panX) / zoom,
      y: (y - this.state.viewport.panY) / zoom
    };
  }

  worldToScreen(x, y) {
    const zoom = this.state.viewport.zoom;
    return {
      x: x * zoom + this.state.viewport.panX,
      y: y * zoom + this.state.viewport.panY
    };
  }

  /* -------------------- TOOLS -------------------- */
  // In CanvasManager.js - Update the setActiveTool method

  setActiveTool(tool) {
    if (this.activeTool && this.activeTool.deactivate) {
      this.activeTool.deactivate();
    }

    this.activeTool = tool;
    this.activeToolType = tool?.toolType;

    // Get current options for this tool from ToolManager
    let toolOptions = {};
    if (this.toolManager && tool?.toolType) {
      toolOptions = this.toolManager.getOptionsForTool(tool.toolType);
    }

    // Attach CanvasManager to tool for runtime access
    if (tool && tool.attachCanvas) {
      tool.attachCanvas(this);
    }

    if (tool && tool.activate) {
      // Pass both canvasManager AND tool options
      tool.activate(this, toolOptions);
    }

    this.updateCursor();

    console.log(`CanvasManager: Active tool set to ${tool?.name || 'unknown'}`);
    console.log('Tool options passed:', toolOptions);
    // Notify listeners (UI) that active tool changed
    try {
      this.emit && this.emit('tool:changed', { toolType: this.activeToolType });
    } catch (err) {
      console.warn('Error emitting tool:changed', err);
    }
  }

  getActiveTool() {
    return this.activeTool;
  }
  /* -------------------- OBB SUPPORT -------------------- */

  getObjectOBB(obj) {
    return getObjectOBBHelper(this, obj);
  }

  getMultipleObjectOBB(ids) {
    return getMultipleObjectOBBHelper(this, ids);
  }
  /* -------------------- OBJECT MANAGEMENT -------------------- */

  getObjectById(id) {
    return this.objectsById.get(id);
  }

  hasObject(id) {
    return this.objectsById.has(id);
  }

  getObjectsByIds(ids) {
    return ids
      .map(id => this.objectsById.get(id))
      .filter(obj => obj !== undefined);
  }

  // Update getObjectsAtPoint in CanvasManager.js
  getObjectsAtPoint(x, y, tolerance = 5) {
    return getObjectsAtPointHelper(this, x, y, tolerance);
  }

  getObjectBounds(obj) {
    return getObjectBoundsHelper(this, obj);
  }

  getMultipleObjectBounds(ids) {
    return getMultipleObjectBoundsHelper(this, ids);
  }

  isPointInBounds(point, bounds, tolerance = 0) {
    return isPointInBoundsHelper(this, point, bounds, tolerance);
  }

  getObjectsInRect(rect) {
    return getObjectsInRectHelper(this, rect);
  }


  /**
 * Update an object's properties and emit update event
 */
  updateObject(objectId, updates) {
    const object = this.getObjectById(objectId);
    if (!object) return false;

    // Apply updates
    Object.assign(object, updates);

    // Request render
    this.requestRender();

    // Emit update event for floating toolbars
    this.emit('object:updated', {
      objectId,
      updates,
      timestamp: Date.now()
    });

    return true;
  }

  applyLastEditedBy(objectIds, userId) {
    if (!userId || !Array.isArray(objectIds) || objectIds.length === 0) return;
    objectIds.forEach((id) => {
      const obj = this.getObjectById(id);
      if (obj) {
        const previous = obj.lastEditedBy;
        if (previous && previous !== userId) {
          this.historyManager?.invalidateUndoForObjectIds?.([id], userId);
        }
        obj.lastEditedBy = userId;
        obj.lastEditedAt = Date.now();
      } else {
        this.historyManager?.invalidateUndoForObjectIds?.([id], userId);
      }
    });
  }

  /* -------------------- TRANSFORM CONTROLLER HELPERS -------------------- */

  /**
   * Pass pointer events to transform controller
   * Call this from your main tool handler
   */
  handleTransformPointerDown(event) {
    if (!this.transformController) return false;
    return this.transformController.onPointerDown(event);
  }

  handleTransformPointerMove(event) {
    if (!this.transformController) return false;
    return this.transformController.onPointerMove(event);
  }

  handleTransformPointerUp(event) {
    if (!this.transformController) return false;
    return this.transformController.onPointerUp(event);
  }

  /**
   * Check if transform interaction is active
   * Useful for determining if other tools should be blocked
   */
  isTransformActive() {
    return this.transformController ? this.transformController.isActive() : false;
  }

  /**
   * Cancel any active transform
   */
  cancelTransform() {
    if (this.transformController) {
      this.transformController.cancel();
    }
  }

  /* -------------------- STATE SETTERS -------------------- */

  setTransformOverlay(overlay) {
    this.transformOverlay = overlay;
    this.requestRender();
  }

  setTransformController(controller) {
    this.transformController = controller;
  }

  /* -------------------- STATE GETTERS -------------------- */

  getState() {
    return {
      objects: [...this.state.objects],
      layers: { ...this.state.layers },
      currentLayer: this.state.currentLayer,
      selection: [...this.state.selection],
      viewport: { ...this.state.viewport }
    };
  }

  getObjects() {
    return [...this.state.objects];
  }

  getSelection() {
    return [...this.state.selection];
  }

  /**
   * Add an object to the canvas (used by remote operations)
   */
  addObject(obj) {
    if (!obj || !obj.id) return;
    // Avoid duplicates
    const existing = this.state.objects.find(o => o.id === obj.id);
    if (existing) {
      Object.assign(existing, obj);
    } else {
      this.state.objects.push(obj);
    }
    this.updateObjectIndex();
    this.requestRender();
  }

  /**
   * Remove an object from the canvas by ID (used by remote operations)
   */
  removeObject(objectId) {
    if (!objectId) return;
    const idx = this.state.objects.findIndex(o => o.id === objectId);
    if (idx >= 0) {
      this.state.objects.splice(idx, 1);
      // Also remove from selection if selected
      const nextSelection = this.state.selection.filter(id => id !== objectId);
      const selectionChanged = nextSelection.length !== this.state.selection.length;
      this.state.selection = nextSelection;
      if (this.selectionManager) {
        this.selectionManager.deselect(objectId);
      }
      this.updateObjectIndex();
      this.requestRender();
      if (selectionChanged) {
        this.emit('selection:changed', {
          selectedIds: [...this.state.selection],
          count: this.state.selection.length
        });
      }
    }
  }

  getHistoryInfo() {
    return this.historyManager.getHistoryInfo();
  }

  findCommonProperties(objects, types) {
    if (!objects || objects.length === 0) return {};
    const common = {};
    const firstObj = objects[0];

    if (types.length === 1) {
      const commonProps = this.getBulkEditableProps(types[0]);
      commonProps.forEach(prop => {
        if (objects.every(obj => obj[prop] === objects[0][prop])) {
          common[prop] = objects[0][prop];
        }
      });
      return common;
    }

    let firstTypeProps = this.getBulkEditableProps(types[0]);

    firstTypeProps = firstTypeProps.filter(prop => {
      return types.every(type => {
        return this.getBulkEditableProps(type).includes(prop);
      });
    });

    firstTypeProps.forEach(prop => {
      if (firstObj[prop] !== undefined) {
        const allSame = objects.every(obj => obj[prop] === firstObj[prop]);
        if (allSame) {
          common[prop] = firstObj[prop];
        }
      }
    });

    return common;
  }

  getBulkEditableProps(type) {
    if (!type) return [];
    // Properties to edit in bulk
    const map = {
      'rectangle': ['strokeColor', 'fillColor', 'strokeWidth', 'opacity', 'cornerRadius'],
      'circle': ['strokeColor', 'fillColor', 'strokeWidth', 'opacity'],
      'ellipse': ['strokeColor', 'fillColor', 'strokeWidth', 'opacity'],
      'line': ['strokeColor', 'strokeWidth', 'opacity'],
      'arrow': ['strokeColor', 'strokeWidth', 'opacity'],
      'triangle': ['strokeColor', 'fillColor', 'strokeWidth', 'opacity'],
      'diamond': ['strokeColor', 'fillColor', 'strokeWidth', 'opacity'],
      'pentagon': ['strokeColor', 'fillColor', 'strokeWidth', 'opacity'],
      'star': ['strokeColor', 'fillColor', 'strokeWidth', 'opacity'],
      'hexagon': ['strokeColor', 'fillColor', 'strokeWidth', 'opacity'],
      'drawing': ['strokeColor', 'strokeWidth', 'opacity'],
      'text': ['fontFamily', 'fontSize', 'textColor', 'backgroundColor', 'opacity', 'fontWeight', 'fontStyle', 'underline', 'strikethrough', 'textAlign', 'verticalAlign', 'listType', 'autoWidth', 'autoHeight'],
      'emoji': ['opacity'],
      'sticky': ['noteColor', 'opacity'],
      'image': ['opacity', 'borderWidth', 'borderColor', 'borderRadius']
    };
    return map[type] || [];
  }

  getSelectionContext() {
    if (this.state.selection.length === 0) {
      return { type: 'none', count: 0 };
    }

    // Get all selected objects
    const selectedObjects = this.state.selection
      .map(id => this.getObjectById(id))
      .filter(obj => obj); // Remove any null/undefined

    // Get unique types — use shapeType for shape objects so the toolbar can pick correct props
    const types = [...new Set(selectedObjects.map(obj => obj.type === 'shape' ? obj.shapeType : obj.type))];
    const count = selectedObjects.length;

    const commonProps = this.findCommonProperties(selectedObjects, types);
    // Calculate toolbar position (center above selection)
    const position = this.calculateSelectionPosition(selectedObjects);

    if (count === 1) {
      return {
        type: types[0],
        count: 1,
        objects: selectedObjects,
        commonProps,
        position,
        showAllOptions: true // Show all options for this type
      };
    }

    // Multiple objects of same type
    if (types.length === 1) {
      return {
        type: types[0],
        count,
        objects: selectedObjects,
        commonProps,
        position,
        showAllOptions: false // Only show common props
      };
    }
    // Mixed types
    return {
      type: 'mixed',
      count,
      objects: selectedObjects,
      commonProps,
      position,
      types, // Include all types for UI
      showAllOptions: false
    };
  }

  calculateSelectionPosition(objects) {
    if (!objects || objects.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    objects.forEach(obj => {
      const bounds = this.getObjectBounds(obj);
      if (bounds) {
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
      }
    });

    return {
      worldX: (minX + maxX) / 2,
      worldY: minY - 40 // 40px above
    };
  }
  /* -------------------- INDEXING -------------------- */
  //  Rebuild entire object index from scratch
  //  Use for complex operations or when unsure what changed
  updateObjectIndex() {
    this.objectsById.clear();
    this.state.objects.forEach(obj => {
      if (obj.id) {
        this.objectsById.set(obj.id, obj);
      }
    });
  }
  /**
 * Check if command is simple enough for direct Map update
 */
  isSimpleCommand(command) {
    if (!command) return false;

    const commandName = command.constructor?.name || '';

    // List of simple command types we can handle directly
    const simpleCommands = [
      'PencilCommand',
      'AddShapeCommand',
      'DeleteCommand',
      'UpdateStyleCommand',
      'MoveCommand',
      'ResizeCommand',
      'RotateCommand',
      'TextCommand',
      'ImageCommand',
      'CreateObjectsCommand',
      'DeleteObjectsCommand'
    ];

    return simpleCommands.includes(commandName);
  }


  /**
 * Intelligently update Map based on command type
 */
  updateMapForCommand(command) {
    const commandName = command.constructor?.name;

    switch (commandName) {
      case 'PencilCommand':
      case 'AddShapeCommand':
      case 'TextCommand':
      case 'ImageCommand':
        // These commands CREATE new objects
        if (command.objectId) {
          const newObj = this.state.objects.find(obj => obj.id === command.objectId);
          if (newObj) {
            this.objectsById.set(command.objectId, newObj);
          }
        }
        break;

      case 'DeleteCommand':
        // These commands REMOVE objects
        if (command.objectId) {
          this.objectsById.delete(command.objectId);
        }
        break;

      case 'DeleteObjectsCommand':
        if (Array.isArray(command.objectIds)) {
          command.objectIds.forEach((id) => this.objectsById.delete(id));
        }
        break;

      case 'UpdateStyleCommand':
      case 'MoveCommand':
      case 'ResizeCommand':
      case 'RotateCommand':
        // These commands MODIFY existing objects
        // No Map update needed - reference stays same!
        break;

      case 'CreateObjectsCommand':
        if (Array.isArray(command.objectIds)) {
          command.objectIds.forEach((id) => {
            const newObj = this.state.objects.find((obj) => obj.id === id);
            if (newObj) this.objectsById.set(id, newObj);
          });
        }
        break;

      default:
        // Unknown command, rebuild to be safe
        this.updateObjectIndex();
    }
  }

  /* -------------------- Event Handlers -----------------------*/

  handlePointerDown(event) {
    return handlePointerDownHelper(this, event);
  }

  handlePointerMove(event) {
    return handlePointerMoveHelper(this, event);
  }

  handlePointerUp(event) {
    return handlePointerUpHelper(this, event);
  }

  /* -------------------- EVENT SYSTEM -------------------- */

  on(event, callback) {
    return onEventHelper(this, event, callback);
  }

  off(event, callback) {
    return offEventHelper(this, event, callback);
  }

  emit(event, data) {
    return emitEventHelper(this, event, data);
  }

  /* -------------------- SERIALIZATION -------------------- */

  serialize() {
    return serializeManagerHelper(this);
  }

  deserialize(data) {
    return deserializeManagerHelper(this, data);
  }

  /* -------------------- DESTROY -------------------- */

  destroy() {
    return destroyManagerHelper(this);
  }

  /* -------------------- DEBUG -------------------- */

  logState() {
    console.log('Canvas State:', {
      objects: this.state.objects.length,
      indexedObjects: this.objectsById.size,
      layers: Object.keys(this.state.layers),
      selection: this.state.selection,
      viewport: this.state.viewport,
      history: this.historyManager.getHistoryInfo()
    });
  }
}


