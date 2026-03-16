  // src/canvas/tools/ToolManager.js
  import { useState, useEffect, useCallback } from 'react';
  import PencilTool from './pencil/PencilTool';
  import ShapeTool from './shapes/ShapeTool';
  import SelectTool from './select/SelectTool';
  import TextTool from './text/TextTool';
  import ImageTool from './image/ImageTool';
  import PrecisionEraserTool from './eraser/PrecisionEraserTool';
  import ObjectEraserTool from './eraser/ObjectEraserTool';
  import EmojiTool from './emoji/EmojiTool';
  import StickyNoteTool from './sticky-note/StickyNoteTool';
  import {
    TOOL_TYPES,
    TOOL_OPTIONS,
    SHAPE_TYPES,
    DEFAULT_TOOL_OPTIONS,
    BASE_TOOL_OPTIONS
  } from '@shared/constants';

  export class ToolManager {
    constructor() {
      this.toolRegistry = new Map();
      this.toolInstances = new Map();
      this.selectionManager = null;

      // Tool UI state
      this._toolState = {
        activeToolType: TOOL_TYPES.PENCIL,
        options: {
          ...BASE_TOOL_OPTIONS,
          ...(DEFAULT_TOOL_OPTIONS[TOOL_TYPES.PENCIL] || {})
        }
      };

      // Listeners for UI updates
      this.listeners = new Set();

      this.registerDefaultTools();
    }

    setSelectionManager(selectionManager) {
      this.selectionManager = selectionManager;
    }

    // ===== Tool UI State Management =====

    /**
     * Get current tool UI state
     */
    getToolState() {
      return {
        activeTool: this._toolState.activeToolType,
        options: { ...this._toolState.options }
      };
    }

    /**
     * Options that persist across tool switches (user-selected values carry over).
     * Everything else resets to defaults when switching tools.
     */
    static STICKY_OPTIONS = ['opacity', 'color'];

    /**
     * Set active tool UI state (intent only)
     * Preserves sticky options (color, opacity) from current state.
     */
    setActiveTool(toolType, options = {}) {
      // Extract sticky values from current state before resetting
      const stickyValues = {};
      for (const key of ToolManager.STICKY_OPTIONS) {
        if (this._toolState.options[key] !== undefined) {
          stickyValues[key] = this._toolState.options[key];
        }
      }

      // Update internal UI state — sticky values are preserved unless overridden
      this._toolState.activeToolType = toolType;
      this._toolState.options = {
        ...BASE_TOOL_OPTIONS,
        ...(DEFAULT_TOOL_OPTIONS[toolType] || {}),
        ...stickyValues,
        ...options
      };

      this._notifyListeners();
      return this.getToolState();
    }

    /**
     * Update tool options UI state
     */
    updateOptions(updates) {
      this._toolState.options = {
        ...this._toolState.options,
        ...updates
      };

      const activeInstance = this.toolInstances.get(this._toolState.activeToolType);
      if (activeInstance?.setOptions) {
        activeInstance.setOptions(this.getActiveToolOptions());
      }

      this._notifyListeners();
    }

    /**
     * Update single option UI state
     */
    setOption(key, value) {
      this.updateOptions({ [key]: value });
    }

    /**
     * Reset options to defaults for current tool UI state
     */
    resetOptions() {
      const toolType = this._toolState.activeToolType;
      this._toolState.options = {
        ...BASE_TOOL_OPTIONS,
        ...(DEFAULT_TOOL_OPTIONS[toolType] || {})
      };

      // Update active tool instance with reset options
      const activeInstance = this.toolInstances.get(toolType);
      if (activeInstance?.setOptions) {
        activeInstance.setOptions(this.getActiveToolOptions());
      }

      this._notifyListeners();
    }

    /**
     * Set shape type UI state (convenience method)
     */
    setShapeType(shapeType) {
      this.setOption(TOOL_OPTIONS.SHAPE_TYPE, shapeType);
    }

    /**
     * Get shape type UI state (convenience method)
     */
    getShapeType() {
      return this._toolState.options[TOOL_OPTIONS.SHAPE_TYPE] || SHAPE_TYPES.RECTANGLE;
    }

    setSelectionManager(selectionManager) {
      this.selectionManager = selectionManager;
    }

    /**
     * Get options for specific tool UI state
     */
    getOptionsForTool(toolType) {
      const defaults = DEFAULT_TOOL_OPTIONS[toolType] || {};

      return Object.keys(defaults).reduce((acc, key) => {
        if (this._toolState.options[key] !== undefined) {
          acc[key] = this._toolState.options[key];
        }
        return acc;
      }, {});
    }

    /**
     * Get options for current active tool UI state
     */
    getActiveToolOptions() {
      return this.getOptionsForTool(this._toolState.activeToolType);
    }

    /**
     * Import tool UI state (for undo/redo or loading)
     */
    importState(state) {
      if (!state) return;

      const toolType = state.activeTool || TOOL_TYPES.PENCIL;
      const options = {
        ...BASE_TOOL_OPTIONS,
        ...(DEFAULT_TOOL_OPTIONS[toolType] || {}),
        ...(state.options || {})
      };

      return this.setActiveTool(toolType, options);
    }

    /**
     * Export tool UI state
     */
    exportState() {
      return {
        activeTool: this._toolState.activeToolType,
        options: { ...this._toolState.options }
      };
    }

    // ===== Tool Instance Factory (No Runtime Management) =====

    registerDefaultTools() {
      this.registerTool(TOOL_TYPES.TEXT, TextTool);
      this.registerTool(TOOL_TYPES.PENCIL, PencilTool);
      this.registerTool(TOOL_TYPES.SHAPE, ShapeTool);
      this.registerTool(TOOL_TYPES.SELECT, SelectTool);
      // pan tool removed - select handles panning
      this.registerTool(TOOL_TYPES.IMAGE, ImageTool);
      this.registerTool(TOOL_TYPES.ERASER, PrecisionEraserTool);
      this.registerTool(TOOL_TYPES.OBJECT_ERASER, ObjectEraserTool);
      this.registerTool(TOOL_TYPES.EMOJI, EmojiTool);
      this.registerTool(TOOL_TYPES.STICKY, StickyNoteTool);
      // Connector tool removed
      // Register other tools...
    }

    registerTool(toolType, ToolClass) {
      this.toolRegistry.set(toolType, ToolClass);
    }

    /**
     * Get a tool instance (factory method)
     * Does NOT manage runtime state or lifecycle
     */
    getToolInstance(toolType) {
      if (!toolType) {
        throw new Error('getToolInstance called with null toolType');
      }

      // Use cached instance if available
      if (this.toolInstances.has(toolType)) {
        const instance = this.toolInstances.get(toolType);
        // Update instance with current options
        if (instance.setOptions) {
          instance.setOptions(this.getOptionsForTool(toolType));
        }
        return instance;
      }

      // Create new instance
      const ToolClass = this.toolRegistry.get(toolType);
      if (!ToolClass) {
        throw new Error(`Tool "${toolType}" is not registered`);
      }

      const options = this.getOptionsForTool(toolType);
      let instance;

      if (toolType === TOOL_TYPES.SELECT) {
        if (!this.selectionManager) {
          throw new Error('SelectionManager not set in ToolManager');
        }
        instance = new ToolClass(this.selectionManager, options);
      } else {
        instance = new ToolClass(options);
        if (this.selectionManager && typeof instance.setSelectionManager === 'function') {
          instance.setSelectionManager(this.selectionManager);
        }
      }

      // Add tool identity
      instance.toolType = toolType;

      this.toolInstances.set(toolType, instance);
      return instance;
    }

    destroy() {
      this.listeners.clear();
      this.toolInstances.clear();
      this.toolRegistry.clear();
      this.selectionManager = null;
    }

    // ===== UI Integration =====

    /**
     * Subscribe to tool UI state changes
     */
    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    _notifyListeners() {
      this.listeners.forEach(listener => listener(this.getToolState()));
    }

    /**
     * Get UI config for tool (STATIC - no runtime side effects)
     */
    getToolUIConfig(toolType) {
      const ToolClass = this.toolRegistry.get(toolType);

      // Try static method first
      if (ToolClass?.getUIConfig) {
        return ToolClass.getUIConfig();
      }

      // Fallback to instance method (last resort)
      try {
        const instance = this.getToolInstance(toolType);
        if (instance.getUIConfig) {
          return instance.getUIConfig();
        }
      } catch (error) {
        // Ignore - fall through to default
      }

      return {
        name: toolType,
        description: `${toolType} tool`,
        icon: null,
        cursor: 'default',
        hasOptions: false,
      };
    }

    /**
     * Get all registered tool types
     */
    getRegisteredToolTypes() {
      return [...this.toolRegistry.keys()];
    }

    /**
     * Check if tool is registered
     */
    isToolRegistered(toolType) {
      return this.toolRegistry.has(toolType);
    }

    /**
     * Clear tool instances (for cleanup - called by CanvasManager)
     */
    clearToolInstances() {
      this.toolInstances.clear();
    }

    /**
     * Get active tool type UI state
     */
    getActiveToolType() {
      return this._toolState.activeToolType;
    }

    /**
     * Get active tool options UI state
     */
    getOptions() {
      return { ...this._toolState.options };
    }
  }

  // Updated hook to accept ToolManager instance
  export function useToolManager(toolManager) {
    //  Handle null toolManager gracefully
    const [toolState, setToolState] = useState(
      toolManager ? toolManager.getToolState() : { activeTool: null, options: {} }
    );

    useEffect(() => {
      if (!toolManager) return; //  Guard against null

      const unsubscribe = toolManager.subscribe(setToolState);
      return unsubscribe;
    }, [toolManager]);

    //  Return safe defaults when toolManager is null
    if (!toolManager) {
      return {
        activeTool: null,
        options: {},
        toolState: null,
        setActiveTool: () => { },
        updateOptions: () => { },
        setOption: () => { },
        resetOptions: () => { },
        setShapeType: () => { },
        getShapeType: () => null,
        getActiveToolOptions: () => ({}),
        getToolInstance: () => null,
        toolManager: null,
      };
    }

    return {
      activeTool: toolState.activeTool,
      options: toolState.options,
      toolState,
      setActiveTool: useCallback((toolType, options = {}) => {
        toolManager.setActiveTool(toolType, options);
      }, [toolManager]),
      updateOptions: useCallback((updates) => {
        toolManager.updateOptions(updates);
      }, [toolManager]),
      setOption: useCallback((key, value) => {
        toolManager.setOption(key, value);
      }, [toolManager]),
      resetOptions: useCallback(() => {
        toolManager.resetOptions();
      }, [toolManager]),
      setShapeType: useCallback((shapeType) => {
        toolManager.setShapeType(shapeType);
      }, [toolManager]),
      getShapeType: useCallback(() => toolManager.getShapeType(), [toolManager]),
      getActiveToolOptions: useCallback(() => toolManager.getActiveToolOptions(), [toolManager]),
      getToolInstance: useCallback((toolType) => {
        return toolManager.getToolInstance(toolType);
      }, [toolManager]),
      toolManager,
    };
  }

  export default ToolManager; 
