export function handlePointerDown(manager, event) {
  if (manager.isTransformActive()) {
    return manager.handleTransformPointerDown(event);
  }

  // Allow resize handles while text tool is editing
  const activeTool = manager.activeTool;
  if (activeTool?.name === 'text' && activeTool?.isEditing && manager.transformController) {
    const handled = manager.handleTransformPointerDown(event);
    if (handled) {
      // Reposition textarea after transform starts
      if (activeTool.positionTextarea) {
        const positionUpdate = () => {
          if (activeTool.positionTextarea) activeTool.positionTextarea();
          if (manager.isTransformActive()) {
            requestAnimationFrame(positionUpdate);
          }
        };
        requestAnimationFrame(positionUpdate);
      }
      return handled;
    }
  }

  return activeTool?.onPointerDown?.(event);
}

export function handlePointerMove(manager, event) {
  if (manager.isTransformActive()) {
    const result = manager.handleTransformPointerMove(event);
    // Reposition textarea during resize
    const activeTool = manager.activeTool;
    if (activeTool?.name === 'text' && activeTool?.isEditing && activeTool?.positionTextarea) {
      activeTool.positionTextarea();
    }
    return result;
  }

  return manager.activeTool?.onPointerMove?.(event);
}

export function handlePointerUp(manager, event) {
  if (manager.isTransformActive()) {
    const result = manager.handleTransformPointerUp(event);
    // Final reposition after resize
    const activeTool = manager.activeTool;
    if (activeTool?.name === 'text' && activeTool?.isEditing && activeTool?.positionTextarea) {
      activeTool.positionTextarea();
    }
    return result;
  }

  return manager.activeTool?.onPointerUp?.(event);
}

export function onEvent(manager, event, callback) {
  if (!manager.eventListeners.has(event)) {
    manager.eventListeners.set(event, []);
  }
  manager.eventListeners.get(event).push(callback);
}

export function offEvent(manager, event, callback) {
  if (!manager.eventListeners.has(event)) return;

  const listeners = manager.eventListeners.get(event);
  const index = listeners.indexOf(callback);
  if (index > -1) {
    listeners.splice(index, 1);
  }
}

export function emitEvent(manager, event, data) {
  if (!manager.eventListeners.has(event)) return;

  manager.eventListeners.get(event).forEach((callback) => {
    try {
      callback(data);
    } catch (error) {
      console.error(`Error in event listener for ${event}:`, error);
    }
  });
}

export function serializeManager(manager) {
  return {
    state: manager.getState(),
    history: manager.historyManager.serialize(),
    timestamp: Date.now(),
  };
}

export function deserializeManager() {
  // TODO: Implement proper deserialization with command registry
  console.warn('Deserialization not fully implemented yet');
}

export function destroyManager(manager) {
  if (manager.renderRequestId) {
    cancelAnimationFrame(manager.renderRequestId);
  }

  if (manager.activeTool && manager.activeTool.deactivate) {
    manager.activeTool.deactivate();
  }

  if (manager.transformController) {
    manager.transformController.cancel();
  }

  if (manager.canvas && manager.container.contains(manager.canvas)) {
    manager.container.removeChild(manager.canvas);
  }

  window.removeEventListener('resize', manager.boundResize);
  manager.eventListeners.clear();

  manager.canvas = null;
  manager.ctx = null;
  manager.activeTool = null;
  manager.historyManager = null;
  manager.objectsById.clear();
  manager.previewObject = null;
  manager.transformOverlay = null;
  manager.transformController = null;

  console.log('CanvasManager destroyed');
}
