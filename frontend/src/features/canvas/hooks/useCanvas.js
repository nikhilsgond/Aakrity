import { useEffect, useRef, useState, useCallback } from 'react';
import { BaseCommand } from '../engine/history/BaseCommand';
import { ClearCanvasCommand } from '../engine/commands/ViewportCommands';
import { ImageCommandFactory } from '../engine/commands/ImageCommands';
import { TOOL_TYPES, SHAPE_TYPES } from '@shared/constants';
import { useReady } from './useReady';
import { useCanvasContextToolbar } from './useCanvasContextToolbar';
import { useCanvasTextEvents } from './useCanvasTextEvents';
import { useCanvasStickyEvents } from './useCanvasStickyEvents';
import { useCanvasImageToolbar } from './useCanvasImageToolbar';
import { useCanvasShapeTextEvents } from './useCanvasShapeTextEvents';
import { useCanvasSetup } from './useCanvasSetup';
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts';
import { useCanvasDomEvents } from './useCanvasDomEvents';
import { useUIStore } from '@app/state/uiStore';
import useCollaborationStore from '@features/room/state/collaborationStore';

const AUTO_SWITCH_TO_SELECT = new Set([
  TOOL_TYPES.SHAPE,
  TOOL_TYPES.TEXT,
  TOOL_TYPES.IMAGE,
  TOOL_TYPES.EMOJI,
  TOOL_TYPES.STICKY,
]);

const SHAPE_TEXT_TYPES = new Set([
  SHAPE_TYPES.RECTANGLE,
  SHAPE_TYPES.CIRCLE,
  SHAPE_TYPES.ELLIPSE,
  SHAPE_TYPES.TRIANGLE,
  SHAPE_TYPES.DIAMOND,
  SHAPE_TYPES.STAR,
  SHAPE_TYPES.HEXAGON,
  SHAPE_TYPES.PENTAGON,
  SHAPE_TYPES.POLYGON,
]);

//  Accept activeToolType as parameter from UI
export const useCanvas = (containerRef, activeToolType) => {
  const canvasManagerRef = useRef(null);
  const toolManagerRef = useRef(null);
  const selectionManagerRef = useRef(null);
  const moveControllerRef = useRef(null);
  const transformControllerRef = useRef(null);
  const isInitializedRef = useRef(false);
  const dragDepthRef = useRef(0);

  // Add refs for pinch zoom tracking
  const pinchZoomRef = useRef({
    isPinching: false,
    initialDistance: 0,
    initialZoom: 1,
    centerX: 0,
    centerY: 0,
  });

  const { ready, whenReady } = useReady(containerRef);

  const [isInternalReady, setIsInternalReady] = useState(false);
  const isReady = isInternalReady && ready;
  const [canvasState, setCanvasState] = useState({
    objectsCount: 0,
    selectionCount: 0,
    canUndo: false,
    canRedo: false,
    viewport: { zoom: 1, panX: 0, panY: 0 },
  });

  const updateCanvasState = useCallback(() => {
    if (!canvasManagerRef.current) return;

    const canvasManager = canvasManagerRef.current;
    const historyManager = canvasManager.historyManager;
    const currentUserId = useCollaborationStore.getState().currentUser?.id;

    if (!historyManager) {
      return;
    }

    setCanvasState(prev => {
      const newState = {
        objectsCount: canvasManager.state.objects.length,
        selectionCount: canvasManager.state.selection.length,
        canUndo: historyManager.canUndo(canvasManager.state, currentUserId),
        canRedo: historyManager.canRedo(canvasManager.state, currentUserId),
        viewport: { ...canvasManager.state.viewport },
      };

      if (
        prev.objectsCount !== newState.objectsCount ||
        prev.selectionCount !== newState.selectionCount ||
        prev.canUndo !== newState.canUndo ||
        prev.canRedo !== newState.canRedo ||
        prev.viewport.zoom !== newState.viewport.zoom ||
        prev.viewport.panX !== newState.viewport.panX ||
        prev.viewport.panY !== newState.viewport.panY
      ) {
        return newState;
      }

      return prev;
    });
  }, []);

  // Helper function to calculate distance between two touches
  const getTouchDistance = useCallback((touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Helper function to calculate center point between two touches
  const getTouchCenter = useCallback((touch1, touch2) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }, []);

  useCanvasSetup({
    containerRef,
    whenReady,
    isInitializedRef,
    canvasManagerRef,
    toolManagerRef,
    selectionManagerRef,
    moveControllerRef,
    transformControllerRef,
    setIsInternalReady,
    updateCanvasState,
  });

  const selectionContext = useCanvasContextToolbar({
    isReady,
    canvasManagerRef
  });

  // Sync ToolManager UI state → CanvasManager runtime
  useEffect(() => {
    // Switch Tool instance
    if (!isReady || !canvasManagerRef.current || !toolManagerRef.current) {
      return;
    }

    if (!activeToolType) return;

    const currentTool = canvasManagerRef.current.getActiveTool?.();
    if (currentTool && currentTool.toolType === activeToolType) {
      return;
    }

    try {
      const toolInstance = toolManagerRef.current.getToolInstance(activeToolType);
      toolInstance?.setOptions?.(
        toolManagerRef.current.getActiveToolOptions()
      );
      canvasManagerRef.current.setActiveTool(toolInstance);
    } catch (error) {
      console.error(`Failed to switch to tool ${activeToolType}:`, error);
    }
  }, [isReady, activeToolType]);

  useCanvasTextEvents({
    isReady,
    canvasManagerRef,
  });

  useCanvasStickyEvents({
    isReady,
    canvasManagerRef,
  });

  useCanvasShapeTextEvents({
    isReady,
    canvasManagerRef,
  });

  const [imageToolbar, setImageToolbar] = useState({
    visible: false,
    imageId: null,
    imageObject: null,
    position: null,
  });
  const [dragDropState, setDragDropState] = useState({
    active: false,
    isValid: true,
    x: 0,
    y: 0,
  });

  useCanvasImageToolbar({
    isReady,
    canvasManagerRef,
    imageToolbarVisible: imageToolbar.visible,
    setImageToolbar,
    updateCanvasState,
  });

  // Handle image tool ready event — create the image object when file data is loaded
  useEffect(() => {
    if (!isReady || !canvasManagerRef.current) return;
    const canvasManager = canvasManagerRef.current;

    const handleImageReady = ({ imageData, worldPos, options, tool }) => {
      if (!imageData) return;

      const img = new Image();
      img.onload = () => {
        const maxDim = 600;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        const cmd = ImageCommandFactory.createImage(imageData, worldPos.x - w / 2, worldPos.y - h / 2, {
          width: w,
          height: h,
          opacity: options.opacity ?? 1,
          borderWidth: options.borderWidth ?? 0,
          borderColor: options.borderColor ?? '#000000',
          borderRadius: options.borderRadius ?? 0,
          imageStatus: 'loaded',
        });

        canvasManager.executeCommand(cmd);
        canvasManager.updateObjectIndex?.();

        const imageId = cmd.imageObject?.id;
        if (imageId) {
          canvasManager.setSelection([imageId]);
          canvasManager.emit('image:created', { imageId });
          canvasManager.emit('object:added', { object: cmd.imageObject });
        }

        // Switch to select tool
        const selectTool = canvasManager.toolManager?.getToolInstance?.('select');
        if (selectTool) canvasManager.setActiveTool(selectTool);
        canvasManager.emit('tool:changed', { toolType: TOOL_TYPES.SELECT });

        tool?._revertToSelectTool?.();
        updateCanvasState();
      };

      img.onerror = () => {
        useUIStore.getState().pushNotification({
          type: 'error',
          title: 'Image failed',
          message: 'Could not load the selected image.',
        });
        tool?._revertToSelectTool?.();
      };

      img.src = imageData;
    };

    canvasManager.on('tool:image:ready', handleImageReady);
    return () => canvasManager.off('tool:image:ready', handleImageReady);
  }, [isReady, updateCanvasState]);


  // Subscribe to CanvasManager events
  const onCanvasEvent = useCallback((event, cb) => {
    canvasManagerRef.current?.on(event, cb);
    return () => canvasManagerRef.current?.off(event, cb);
  }, []);

  // Select object
  const selectObject = useCallback((objectId) => {
    canvasManagerRef.current?.setSelection([objectId]);
  }, []);

  const executeLocalCommand = useCallback((command) => {
    if (!isReady || !canvasManagerRef.current) {
      return null;
    }

    if (!(command instanceof BaseCommand)) {
      console.error('Command must be an instance of BaseCommand');
      return null;
    }

    try {
      if (!command.userId) {
        command.userId = useCollaborationStore.getState().currentUser?.id || null;
      }
      const result = canvasManagerRef.current.executeLocalCommand(command);
      updateCanvasState();
      return result;
    } catch (error) {
      console.error('Failed to execute command:', error);
      return null;
    }
  }, [isReady, updateCanvasState]);


  // Listen for endpoint:click from TransformController (removed: connector suggestion popup)
  const undo = useCallback(() => {
    if (!isReady || !canvasManagerRef.current) return false;

    const currentUserId = useCollaborationStore.getState().currentUser?.id || null;
    const result = canvasManagerRef.current.undo(currentUserId);
    updateCanvasState();

    return result?.success || false;
  }, [isReady, updateCanvasState]);

  const redo = useCallback(() => {
    if (!isReady || !canvasManagerRef.current) return false;

    const currentUserId = useCollaborationStore.getState().currentUser?.id || null;
    const result = canvasManagerRef.current.redo(currentUserId);
    updateCanvasState();

    return result?.success || false;
  }, [isReady, updateCanvasState]);

  const clearCanvas = useCallback(() => {
    if (!isReady || !canvasManagerRef.current) return;

    const clearCommand = new ClearCanvasCommand();
    executeLocalCommand(clearCommand);
  }, [isReady, executeLocalCommand]);

  const resetViewport = useCallback(() => {
    if (!isReady || !canvasManagerRef.current) return;

    canvasManagerRef.current.resetViewport();
    updateCanvasState();
  }, [isReady, updateCanvasState]);

  // Connector interaction removed

  const exportCanvas = useCallback((format = 'png') => {
    if (!isReady || !canvasManagerRef.current || !canvasManagerRef.current.canvas) {
      return null;
    }

    const canvas = canvasManagerRef.current.canvas;

    switch (format) {
      case 'png':
        return canvas.toDataURL('image/png');
      case 'jpeg':
        return canvas.toDataURL('image/jpeg', 0.9);
      case 'json':
        return JSON.stringify({
          objects: canvasManagerRef.current.getObjects(),
          viewport: { ...canvasManagerRef.current.state.viewport },
          layers: canvasManagerRef.current.state.layers,
          timestamp: Date.now(),
          toolState: toolManagerRef.current?.exportState() || {},
        });
      default:
        console.warn(`Unsupported export format: ${format}`);
        return null;
    }
  }, [isReady]);

  const handlePointerDown = useCallback(whenReady((event) => {
    event.preventDefault();
    event.stopPropagation();

    const canvasManager = canvasManagerRef.current;
    const activeTool = canvasManager.getActiveTool();

    // Signal that the canvas was interacted with (sub-toolbars listen to dismiss)
    canvasManager.emit('canvas:interacted');

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const worldPos = canvasManager.screenToWorld(x, y);
    canvasManager.setLastPointerWorld?.(worldPos);

    // ── Transform handles take highest priority so resize/rotate beats connector
    // port hit-detection even on small objects where they overlap. ──
    if (transformControllerRef.current?.onPointerDown({
      x, y, clientX: event.clientX, clientY: event.clientY, originalEvent: event
    })) {
      return;
    }

    // Connector port intercept removed

    if (moveControllerRef.current?.onPointerDown({
      x, y, clientX: event.clientX, clientY: event.clientY, originalEvent: event
    })) {
      return;
    }

    if (activeTool && typeof activeTool.onPointerDown === 'function') {

      const result = activeTool.onPointerDown({
        x: worldPos.x,
        y: worldPos.y,
        originalEvent: event,
        screenX: x,
        screenY: y,
        pressure: event.pressure || 0.5,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      });

      if (result && result.command && result.command instanceof BaseCommand) {
        const { objectId } = result.command;
        executeLocalCommand(result.command);

        // For tools that create objects on pointerDown (sticky, emoji),
        // auto-select + switch to select + close sub-bar
        const toolName = activeTool?.toolType || activeTool?.name;
        if (objectId && AUTO_SWITCH_TO_SELECT.has(toolName)) {
          const sm = selectionManagerRef.current;
          if (sm) sm.set([objectId]);
          canvasManager.setSelection([objectId]);

          // Switch to select tool instance
          const selectTool = toolManagerRef.current?.getToolInstance?.('select');
          if (selectTool) canvasManager.setActiveTool(selectTool);

          // Emit tool:changed so the UI state (activeToolType) updates → closes sub-bar
          canvasManager.emit('tool:changed', { toolType: TOOL_TYPES.SELECT });
          canvasManager.requestRender();

          // Auto-open text editor for sticky notes
          if (toolName === 'sticky' && result.autoEdit) {
            requestAnimationFrame(() => {
              canvasManager.emit('sticky:edit', { objectId, point: null });
            });
          }
        }
      }
    }
  }, [whenReady, containerRef, executeLocalCommand]));

  const handlePointerMove = useCallback(whenReady((event) => {
    event.preventDefault();

    const canvasManager = canvasManagerRef.current;
    const activeTool = canvasManager.getActiveTool();

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const worldPos = canvasManager.screenToWorld(x, y);
    canvasManager.setLastPointerWorld?.(worldPos);

    // Connector draft drag removed

    if (transformControllerRef.current?.isActive()) {
      transformControllerRef.current.onPointerMove({
        x, y, clientX: event.clientX, clientY: event.clientY
      });
      return;
    }

    if (moveControllerRef.current?.isActive()) {
      moveControllerRef.current.onPointerMove({
        x, y, clientX: event.clientX, clientY: event.clientY
      });
      return;
    }

    if (activeTool && typeof activeTool.onPointerMove === 'function') {

      activeTool.onPointerMove({
        x: worldPos.x,
        y: worldPos.y,
        originalEvent: event,
        screenX: x,
        screenY: y,
        pressure: event.pressure || 0.5,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      });
    }

    // Connector hover tracking removed
  }, [whenReady, containerRef]));

  const handlePointerUp = useCallback(whenReady((event) => {
    event.preventDefault();

    const canvasManager = canvasManagerRef.current;
    const selectionManager = selectionManagerRef.current;
    const activeTool = canvasManager.getActiveTool();

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Connector draft finalization removed

    // Transform interaction ends
    if (transformControllerRef.current?.isActive()) {
      transformControllerRef.current.onPointerUp({
        x, y, clientX: event.clientX, clientY: event.clientY
      });
      updateCanvasState();
      return;
    }

    // Move interaction ends
    if (moveControllerRef.current?.isActive()) {
      moveControllerRef.current.onPointerUp({
        x, y, clientX: event.clientX, clientY: event.clientY, originalEvent: event
      });
      updateCanvasState();
      return;
    }

    if (activeTool && typeof activeTool.onPointerUp === 'function') {
      const worldPos = canvasManager.screenToWorld(x, y);

      const result = activeTool.onPointerUp({
        x: worldPos.x,
        y: worldPos.y,
        originalEvent: event,
        screenX: x,
        screenY: y,
        pressure: event.pressure || 0.5,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      });

      // FINALIZE OBJECT CREATION
      if (result?.command && result.command instanceof BaseCommand) {
        const { objectId } = result.command;

        executeLocalCommand(result.command);

        // Auto-select newly created object
        if (objectId && AUTO_SWITCH_TO_SELECT.has(activeTool?.toolType)) {
          selectionManager.set([objectId]);
          canvasManager.setSelection([objectId]);
          // Render is now triggered automatically by SelectionManager
        }

        if (objectId) {
          const createdObj = canvasManager.getObjectById(objectId);
          const shouldEditShape = createdObj
            && createdObj.type === 'shape'
            && createdObj.creationSource === 'create'
            && SHAPE_TEXT_TYPES.has(createdObj.shapeType);
          if (shouldEditShape) {
            requestAnimationFrame(() => {
              canvasManager.emit('shape:textedit:start', { objectId });
            });
          }
        }
      }

      updateCanvasState();
    }
  }, [
    whenReady,
    containerRef,
    executeLocalCommand,
    updateCanvasState
  ]));

  const handleWheel = useCallback(whenReady((event) => {
    event.preventDefault();

    const canvasManager = canvasManagerRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Check for pinch zoom (ctrlKey is often set during pinch gestures on trackpads)
    if (event.ctrlKey) {
      // PINCH ZOOM MODE: Ctrl + wheel = zoom in/out (handles trackpad pinch gestures)
      const zoomFactor = 0.002;
      const delta = -event.deltaY * 10; // Invert for natural pinch feeling
      const currentZoom = canvasManager.state.viewport.zoom;

      let newZoom = currentZoom + delta * zoomFactor * currentZoom;
      newZoom = Math.max(0.01, Math.min(4.0, newZoom));

      canvasManager.zoomAt(newZoom, mouseX, mouseY);
    } else if (event.altKey) {
      // ALT ZOOM MODE: Alt + wheel = zoom in/out
      const zoomFactor = 0.002;
      const delta = event.deltaY;
      const currentZoom = canvasManager.state.viewport.zoom;

      let newZoom = currentZoom - delta * zoomFactor * currentZoom;
      newZoom = Math.max(0.01, Math.min(4.0, newZoom));

      canvasManager.zoomAt(newZoom, mouseX, mouseY);
    } else {
      // PAN MODE: Default wheel behavior = pan canvas
      const deltaX = -event.deltaX;
      const deltaY = -event.deltaY;

      // Calculate target pan
      const targetPanX = canvasManager.state.viewport.panX + deltaX;
      const targetPanY = canvasManager.state.viewport.panY + deltaY;

      // Apply boundaries before panning
      const { panX, panY } = canvasManager.applyPanBoundaries(targetPanX, targetPanY);

      // Only pan if within boundaries
      if (panX !== canvasManager.state.viewport.panX || panY !== canvasManager.state.viewport.panY) {
        canvasManager.pan(panX - canvasManager.state.viewport.panX, panY - canvasManager.state.viewport.panY);
      }
    }

    updateCanvasState();
  }, [whenReady, containerRef, updateCanvasState]));


  // Add touch event handlers for multi-touch pinch zoom on mobile devices
  const handleTouchStart = useCallback(whenReady((event) => {
    if (event.touches.length === 2) {
      event.preventDefault();

      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = getTouchDistance(touch1, touch2);
      const center = getTouchCenter(touch1, touch2);

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = center.x - rect.left;
      const centerY = center.y - rect.top;

      pinchZoomRef.current = {
        isPinching: true,
        initialDistance: distance,
        initialZoom: canvasManagerRef.current.state.viewport.zoom,
        centerX,
        centerY,
      };
    }
  }, [whenReady, containerRef, getTouchDistance, getTouchCenter]));

  const handleTouchMove = useCallback(whenReady((event) => {
    if (event.touches.length === 2 && pinchZoomRef.current.isPinching) {
      event.preventDefault();

      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = getTouchDistance(touch1, touch2);
      const center = getTouchCenter(touch1, touch2);

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = center.x - rect.left;
      const centerY = center.y - rect.top;

      const scale = distance / pinchZoomRef.current.initialDistance;
      let newZoom = pinchZoomRef.current.initialZoom * scale;
      newZoom = Math.max(0.01, Math.min(4.0, newZoom));

      canvasManagerRef.current.zoomAt(newZoom, centerX, centerY);
      updateCanvasState();
    }
  }, [whenReady, containerRef, getTouchDistance, getTouchCenter, updateCanvasState]));

  const handleTouchEnd = useCallback(whenReady((event) => {
    if (event.touches.length < 2) {
      pinchZoomRef.current.isPinching = false;
    }
  }, []));

  const isImageFile = useCallback((file) => {
    if (!file) return false;
    if (typeof file.type === 'string' && /^image\/(png|jpe?g|webp)$/i.test(file.type)) return true;
    return /\.(png|jpe?g|webp)$/i.test(file.name || '');
  }, []);

  const getImageFilesFromTransfer = useCallback((dataTransfer) => {
    if (!dataTransfer) return [];

    const files = Array.from(dataTransfer.files || []);
    const results = [];
    const seen = new Set();

    files.forEach((file) => {
      if (!isImageFile(file)) return;
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (seen.has(key)) return;
      seen.add(key);
      results.push(file);
    });

    const items = Array.from(dataTransfer.items || []);
    items.forEach((item) => {
      if (item.kind !== 'file') return;
      const file = item.getAsFile?.();
      if (!file || !isImageFile(file)) return;
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (seen.has(key)) return;
      seen.add(key);
      results.push(file);
    });

    return results;
  }, [isImageFile]);

  const hasFilePayload = useCallback((dataTransfer) => {
    if (!dataTransfer) return false;
    if ((dataTransfer.files || []).length > 0) return true;
    if ((dataTransfer.items || []).some((item) => item.kind === 'file')) return true;
    return (dataTransfer.types || []).includes('Files');
  }, []);

  const hideDragDropOverlay = useCallback(() => {
    dragDepthRef.current = 0;
    setDragDropState((prev) => ({ ...prev, active: false }));
  }, []);

  const updateDragStateFromEvent = useCallback((event) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const files = getImageFilesFromTransfer(event.dataTransfer);
    const file = files[0];
    const hasFiles = hasFilePayload(event.dataTransfer);
    const items = Array.from(event.dataTransfer?.items || []);
    const knownFileTypes = items
      .filter((item) => item.kind === 'file' && item.type)
      .map((item) => item.type);
    const isUnknownYet = hasFiles && !file && knownFileTypes.length === 0;
    setDragDropState({
      active: hasFiles,
      isValid: !!file || isUnknownYet,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }, [containerRef, getImageFilesFromTransfer, hasFilePayload]);

  const handleDragEnter = useCallback(whenReady((event) => {
    event.preventDefault();
    dragDepthRef.current += 1;
    updateDragStateFromEvent(event);
  }, [whenReady, updateDragStateFromEvent]));

  const handleDragOver = useCallback(whenReady((event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      const files = getImageFilesFromTransfer(event.dataTransfer);
      const hasFiles = hasFilePayload(event.dataTransfer);
      event.dataTransfer.dropEffect = files.length > 0 || hasFiles ? 'copy' : 'none';
    }
    updateDragStateFromEvent(event);
  }, [whenReady, getImageFilesFromTransfer, hasFilePayload, updateDragStateFromEvent]));

  const handleDragLeave = useCallback(whenReady((event) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      hideDragDropOverlay();
    }
  }, [whenReady, hideDragDropOverlay]));

  const handleDrop = useCallback(whenReady((event) => {
    if (!toolManagerRef.current) return;
    event.preventDefault();
    hideDragDropOverlay();

    const files = getImageFilesFromTransfer(event.dataTransfer);
    if (!files.length) {
      useUIStore.getState().pushNotification({
        type: 'error',
        title: 'Upload failed',
        message: 'Only image files are supported.',
      });
      return;
    }

    const imageTool = toolManagerRef.current.getToolInstance(TOOL_TYPES.IMAGE);
    if (!imageTool || typeof imageTool.handleImageFile !== 'function') return;

    const rect = containerRef.current.getBoundingClientRect();
    const screenPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    files.forEach((file, index) => {
      imageTool.handleImageFile(file, {
        screenPoint: {
          x: screenPoint.x + index * 24,
          y: screenPoint.y + index * 24,
        },
      });
    });
  }, [whenReady, containerRef, getImageFilesFromTransfer, hideDragDropOverlay]));

  const zoomIn = useCallback(whenReady(() => {
    const canvasManager = canvasManagerRef.current;
    const rect = containerRef.current.getBoundingClientRect();

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    canvasManager.zoomIn(0.1, centerX, centerY);
    updateCanvasState();
  }, [whenReady, containerRef, updateCanvasState]));

  const zoomOut = useCallback(whenReady(() => {
    const canvasManager = canvasManagerRef.current;
    const rect = containerRef.current.getBoundingClientRect();

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    canvasManager.zoomOut(0.1, centerX, centerY);
    updateCanvasState();
  }, [whenReady, containerRef, updateCanvasState]));

  const setZoomPercent = useCallback(whenReady((percent) => {
    const canvasManager = canvasManagerRef.current;
    const rect = containerRef.current.getBoundingClientRect();

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const clampedPercent = Math.max(1, Math.min(400, percent));
    canvasManager.setZoomPercent(clampedPercent, centerX, centerY);
    updateCanvasState();

    return clampedPercent;
  }, [whenReady, containerRef, updateCanvasState]));

  useCanvasKeyboardShortcuts({ zoomIn, zoomOut, resetViewport });

  const getCanvasManager = useCallback(() => {
    return canvasManagerRef.current;
  }, []);

  const getToolManagerRef = useCallback(() => {
    return toolManagerRef.current;
  }, []);

  useCanvasDomEvents({
    isReady,
    containerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  });

  return {
    isReady,
    canvasState,
    executeLocalCommand,
    undo,
    redo,
    clearCanvas,
    resetViewport,
    exportCanvas,
    zoomIn,
    zoomOut,
    setZoomPercent,
    getCanvasManager,
    getToolManagerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    updateCanvasState,
    onCanvasEvent,
    selectObject,
    imageToolbar,
    setImageToolbar,
    dragDropState,
    selectionContext,

    // expose the low‑level selection manager for external synchronization
    selectionManager: selectionManagerRef.current,
  };
};

export default useCanvas;
