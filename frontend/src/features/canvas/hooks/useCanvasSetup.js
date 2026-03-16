import { useEffect } from 'react';
import CanvasManager from '../engine/CanvasManager';
import ToolManager from '../tools/ToolManager';
import SelectionManager from '../engine/SelectionManager';
import MoveController from '../engine/controllers/MoveController';
import TransformOverlay from '../engine/transform/TransformOverlay';
import TransformController from '../engine/transform/TransformController';

export function useCanvasSetup({
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
}) {
  useEffect(() => {
    const runWhenReady = whenReady(() => {
      // Now containerRef.current is guaranteed to exist!
      
      if (isInitializedRef.current) {
        console.log('useCanvasSetup: Already initialized');
        return;
      }

      console.log('🚀 Initializing canvas...');
      
      try {
        const selectionManager = new SelectionManager();
        selectionManagerRef.current = selectionManager;

        const toolManager = new ToolManager();
        toolManager.setSelectionManager(selectionManager);
        toolManagerRef.current = toolManager;

        canvasManagerRef.current = new CanvasManager(containerRef.current, selectionManager, toolManager);
        canvasManagerRef.current.init();

        selectionManager.setRenderCallback(() => {
          if (canvasManagerRef.current) {
            canvasManagerRef.current.requestRender();
          }
        });

        const moveController = new MoveController(canvasManagerRef.current, selectionManager);
        moveControllerRef.current = moveController;

        const transformOverlay = new TransformOverlay(selectionManager, canvasManagerRef.current);
        const transformController = new TransformController(
          selectionManager,
          canvasManagerRef.current,
          transformOverlay
        );
        transformControllerRef.current = transformController;

        canvasManagerRef.current.moveController = moveController;
        canvasManagerRef.current.transformOverlay = transformOverlay;
        canvasManagerRef.current.transformController = transformController;

        isInitializedRef.current = true;
        setIsInternalReady(true);
        updateCanvasState();
        
        console.log('✅ Canvas initialization complete');
      } catch (error) {
        console.error('Failed to initialize canvas:', error);
      }
    });

    // Execute the safe function
    runWhenReady();

    return () => {
      if (canvasManagerRef.current) {
        canvasManagerRef.current.destroy();
        canvasManagerRef.current = null;

        if (toolManagerRef.current) {
          toolManagerRef.current.destroy();
          toolManagerRef.current = null;
        }

        selectionManagerRef.current = null;
        moveControllerRef.current = null;
        transformControllerRef.current = null;

        isInitializedRef.current = false;
        setIsInternalReady(false);
      }
    };
  }, [
    whenReady, 
    containerRef,
    isInitializedRef,
    canvasManagerRef,
    toolManagerRef,
    selectionManagerRef,
    moveControllerRef,
    transformControllerRef,
    setIsInternalReady,
    updateCanvasState,
  ]);
}