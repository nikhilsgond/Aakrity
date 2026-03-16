import { useUIStore } from '@app/state/uiStore';

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

export function createRoomSnapshot(canvasManager) {
  if (!canvasManager) {
    return null;
  }

  const objects = canvasManager.getObjects().map((object) => {
    const safeObject = cloneJson(object);
    delete safeObject.imageElement;
    return safeObject;
  });

  return {
    version: 1,
    boardTitle: useUIStore.getState().boardTitle || 'Untitled Board',
    state: {
      objects,
      viewport: { ...canvasManager.state.viewport },
      gridStyle: canvasManager.state.gridStyle || 'lines',
      darkMode: !!canvasManager.state.darkMode,
    },
    savedAt: new Date().toISOString(),
  };
}

export function loadRoomSnapshot(canvasManager, snapshot) {
  if (!canvasManager || !snapshot) {
    return false;
  }

  const nextState = snapshot.state && typeof snapshot.state === 'object'
    ? snapshot.state
    : snapshot;

  canvasManager.state.objects = Array.isArray(nextState.objects)
    ? cloneJson(nextState.objects)
    : [];
  canvasManager.state.selection = [];

  if (canvasManager.selectionManager?.clear) {
    canvasManager.selectionManager.clear();
  }

  if (nextState.viewport && typeof nextState.viewport === 'object') {
    canvasManager.state.viewport = {
      ...canvasManager.state.viewport,
      ...nextState.viewport,
    };
  }

  if (nextState.gridStyle) {
    canvasManager.state.gridStyle = nextState.gridStyle;
  }

  if (typeof nextState.darkMode === 'boolean') {
    canvasManager.state.darkMode = nextState.darkMode;
  }

  canvasManager.historyManager?.clear?.();
  canvasManager.previewObject = null;
  canvasManager.remotePreviewObjects?.clear?.();
  canvasManager.updateObjectIndex?.();
  canvasManager.requestRender?.();

  if (snapshot.boardTitle) {
    useUIStore.setState({ boardTitle: snapshot.boardTitle });
  }

  return true;
}
