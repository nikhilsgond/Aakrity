import { useEffect, useRef } from "react";
import { KEYBOARD_SHORTCUTS, TOOL_TYPES } from "@shared/constants";
import { generateId } from "@shared/lib/idGenerator";
import useCollaborationStore from "@features/room/state/collaborationStore";
import { CreateObjectsCommand, DeleteObjectsCommand } from "@features/canvas/engine/commands/ObjectCommands";
import { MoveCommand } from "@features/canvas/engine/commands/MoveCommand";
import { LayerOrderCommand } from "@features/canvas/engine/commands/LayerOrderCommand";
import ObjectGeometry from "@features/canvas/engine/geometry/ObjectGeometry";

export function useRoomKeyboardShortcuts({
  isTextEditing,
  performUndo,
  performRedo,
  setActiveToolType,
  canvasManager,
  toggleGridMode,
  zoomIn,
  zoomOut,
  resetViewport,
  handleFinishTextEditing,
}) {
  const clipboardRef = useRef({ objects: [] });

  useEffect(() => {
    const isSelectedByOther = (id) => {
      const { remoteSelections, currentUser } = useCollaborationStore.getState();
      if (!remoteSelections) return false;
      for (const [uid, ids] of remoteSelections.entries()) {
        if (uid !== currentUser?.id && Array.isArray(ids) && ids.includes(id)) {
          return true;
        }
      }
      return false;
    };

    const getDeletableSelection = () => {
      if (!canvasManager) return [];
      const selectedIds = canvasManager.getSelection?.() || [];
      const { isLockedByOther } = useCollaborationStore.getState();

      return selectedIds.filter((id) => !isLockedByOther?.(id) && !isSelectedByOther(id));
    };

    const getMoveableSelection = () => {
      if (!canvasManager) return [];
      const selectedIds = canvasManager.getSelection?.() || [];
      const { isLockedByOther } = useCollaborationStore.getState();
      return selectedIds.filter((id) => !isLockedByOther?.(id) && !isSelectedByOther(id));
    };

    const getLayerableSelection = () => {
      if (!canvasManager) return [];
      const selectedIds = canvasManager.getSelection?.() || [];
      const { isLockedByOther } = useCollaborationStore.getState();
      return selectedIds.filter((id) => !isLockedByOther?.(id) && !isSelectedByOther(id));
    };

    const buildMovePositions = (ids) => {
      if (!canvasManager) return [];
      return ids
        .map((id) => {
          const obj = canvasManager.getObjectById?.(id);
          if (!obj) return null;
          const snapshot = { id };
          ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'rotation', 'radius', 'radiusX', 'radiusY', 'flipX', 'flipY']
            .forEach((k) => { if (obj[k] !== undefined) snapshot[k] = obj[k]; });
          if (Array.isArray(obj.points)) {
            snapshot.points = obj.points.map((p) => ({ ...p }));
          }
          return snapshot;
        })
        .filter(Boolean);
    };

    const cloneObject = (obj) => {
      const cloned = JSON.parse(JSON.stringify(obj));
      delete cloned.imageElement;
      delete cloned.isPreview;
      delete cloned.isRemotePreview;
      delete cloned.userId;
      return cloned;
    };

    const offsetObject = (obj, dx, dy) => {
      if (typeof obj.x === 'number') obj.x += dx;
      if (typeof obj.y === 'number') obj.y += dy;
      if (typeof obj.x1 === 'number') obj.x1 += dx;
      if (typeof obj.y1 === 'number') obj.y1 += dy;
      if (typeof obj.x2 === 'number') obj.x2 += dx;
      if (typeof obj.y2 === 'number') obj.y2 += dy;
      if (Array.isArray(obj.points)) {
        obj.points = obj.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
      }
      return obj;
    };

    const getObjectsBounds = (objects) => {
      if (!Array.isArray(objects) || objects.length === 0) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      objects.forEach((obj) => {
        const bounds = ObjectGeometry.getBounds(obj);
        if (!bounds) return;
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
      });

      if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
        return null;
      }

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    };

    const copySelectionToClipboard = () => {
      if (!canvasManager) return [];
      const ids = getDeletableSelection();
      if (ids.length === 0) return [];
      const objects = ids
        .map((id) => canvasManager.getObjectById(id))
        .filter((obj) => obj);
      const cloned = objects.map((obj) => cloneObject(obj));
      clipboardRef.current = { objects: cloned };
      return ids;
    };

    const pasteClipboard = () => {
      if (!canvasManager) return;
      const clipboard = clipboardRef.current;
      if (!clipboard?.objects || clipboard.objects.length === 0) return;

      const currentUserId = useCollaborationStore.getState().currentUser?.id || null;

      const idMap = new Map();
      const cursorWorld = canvasManager.getLastPointerWorld?.();
      const bounds = getObjectsBounds(clipboard.objects);
      let dx = 20;
      let dy = 20;
      if (cursorWorld && bounds) {
        dx = cursorWorld.x - (bounds.x + bounds.width / 2);
        dy = cursorWorld.y - (bounds.y + bounds.height / 2);
      }

      const pasted = clipboard.objects.map((obj) => {
        const next = cloneObject(obj);
        const oldId = next.id;
        const newId = generateId();
        idMap.set(oldId, newId);
        next.id = newId;
        next.creationSource = 'paste';
        next.createdAt = Date.now();
        next.updatedAt = Date.now();
        if (currentUserId) {
          next.lastEditedBy = currentUserId;
          next.lastEditedAt = Date.now();
        }
        return offsetObject(next, dx, dy);
      });

      pasted.forEach((obj) => {
        if (obj.fromObjectId && idMap.has(obj.fromObjectId)) {
          obj.fromObjectId = idMap.get(obj.fromObjectId);
        }
        if (obj.toObjectId && idMap.has(obj.toObjectId)) {
          obj.toObjectId = idMap.get(obj.toObjectId);
        }
      });

      const cmd = new CreateObjectsCommand(pasted);
      canvasManager.executeLocalCommand(cmd);
      canvasManager.setSelection(pasted.map((obj) => obj.id));
      canvasManager.requestRender();
    };

    const handleKeyDown = (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      ) {
        return;
      }

      if (isTextEditing && !e.ctrlKey && !e.metaKey && e.key !== "Escape") {
        return;
      }

      const hasModifier = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        performUndo();
        return;
      }

      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") ||
        ((e.ctrlKey || e.metaKey) && e.key === "y")
      ) {
        e.preventDefault();
        performRedo();
        return;
      }

      if (!hasModifier) {
        switch (e.key.toLowerCase()) {
          case KEYBOARD_SHORTCUTS.SELECT:
            e.preventDefault();
            setActiveToolType(TOOL_TYPES.SELECT);
            return;
          case KEYBOARD_SHORTCUTS.PENCIL:
            e.preventDefault();
            setActiveToolType(TOOL_TYPES.PENCIL);
            return;
          case KEYBOARD_SHORTCUTS.SHAPE:
            e.preventDefault();
            setActiveToolType(TOOL_TYPES.SHAPE);
            return;
          case KEYBOARD_SHORTCUTS.TEXT:
            e.preventDefault();
            setActiveToolType(TOOL_TYPES.TEXT);
            return;
          case KEYBOARD_SHORTCUTS.EMOJI:
            e.preventDefault();
            setActiveToolType(TOOL_TYPES.EMOJI);
            return;
          case KEYBOARD_SHORTCUTS.STICKY:
            e.preventDefault();
            setActiveToolType(TOOL_TYPES.STICKY);
            return;
          // Connector is now hover-triggered (no toolbar shortcut)
          case KEYBOARD_SHORTCUTS.TOGGLE_GRID:
            e.preventDefault();
            toggleGridMode();
            return;
          case KEYBOARD_SHORTCUTS.DELETE:
          case 'backspace':
            e.preventDefault();
            if (!canvasManager) return;
            {
              const ids = getDeletableSelection();
              if (ids.length === 0) return;
              const objects = ids
                .map((id) => canvasManager.getObjectById(id))
                .filter((obj) => obj);
              const cmd = new DeleteObjectsCommand(objects);
              canvasManager.executeLocalCommand(cmd);
              canvasManager.clearSelection();
            }
            return;
          default:
            break;
        }
      }

      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        if (isTextEditing) return;
        if (!canvasManager) return;
        if (canvasManager.isTransformActive?.()) return;
        if (e.altKey) return;

        const step = (e.ctrlKey || e.metaKey) ? 0.5 : (e.shiftKey ? 10 : 1);
        const delta = { x: 0, y: 0 };
        switch (e.key) {
          case "ArrowUp":
            delta.y = -step;
            break;
          case "ArrowDown":
            delta.y = step;
            break;
          case "ArrowLeft":
            delta.x = -step;
            break;
          case "ArrowRight":
            delta.x = step;
            break;
          default:
            break;
        }

        const ids = getMoveableSelection().filter((id) => canvasManager.getObjectById?.(id));
        if (ids.length === 0) return;

        e.preventDefault();
        const cmd = new MoveCommand(ids, delta);
        canvasManager.executeLocalCommand(cmd);

        const positions = buildMovePositions(ids);
        if (positions.length > 0) {
          canvasManager.emit('move:final', { objectIds: ids, positions });
        }
        return;
      }

      if (e.key >= "1" && e.key <= "9" && !hasModifier) {
        const index = parseInt(e.key, 10) - 1;
        const tools = [
          TOOL_TYPES.SELECT,
          TOOL_TYPES.PENCIL,
          TOOL_TYPES.SHAPE,
          TOOL_TYPES.TEXT,
          TOOL_TYPES.ERASER,
          TOOL_TYPES.FILL,
          TOOL_TYPES.IMAGE,
        ];
        if (tools[index]) {
          e.preventDefault();
          setActiveToolType(tools[index]);
          return;
        }
      }

      if (e.key === "Escape" && !hasModifier) {
        e.preventDefault();
        if (isTextEditing) {
          handleFinishTextEditing();
          return;
        }
        if (canvasManager) {
          canvasManager.clearSelection();
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'a') {
          e.preventDefault();
          if (!canvasManager) return;
          const { isLockedByOther } = useCollaborationStore.getState();
          const selected = [];
          const objects = canvasManager.getObjects?.() || [];
          for (const obj of objects) {
            if (!obj?.id) continue;
            if (isLockedByOther?.(obj.id)) continue;
            if (isSelectedByOther(obj.id)) continue;
            selected.push(obj.id);
            if (selected.length >= 100) break;
          }
          if (selected.length > 0) {
            canvasManager.setSelection(selected);
            canvasManager.requestRender();
          }
          return;
        }
        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          copySelectionToClipboard();
          return;
        }
        if (e.key.toLowerCase() === 'x') {
          e.preventDefault();
          if (!canvasManager) return;
          const ids = copySelectionToClipboard();
          if (!ids.length) return;
          const objects = ids
            .map((id) => canvasManager.getObjectById(id))
            .filter((obj) => obj);
          const cmd = new DeleteObjectsCommand(objects);
          canvasManager.executeLocalCommand(cmd);
          canvasManager.clearSelection();
          return;
        }
        if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          pasteClipboard();
          return;
        }
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          zoomIn();
          return;
        }
        if (e.key === "-") {
          e.preventDefault();
          zoomOut();
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          resetViewport();
        }

        if (e.key === "]" || e.key === "[") {
          e.preventDefault();
          if (!canvasManager) return;
          if (isTextEditing) return;
          const ids = getLayerableSelection().filter((id) => canvasManager.getObjectById?.(id));
          if (ids.length === 0) return;
          const direction = e.key === "]" ? 'front' : 'back';
          const cmd = new LayerOrderCommand(ids, direction);
          canvasManager.executeLocalCommand(cmd);
          canvasManager.requestRender();
          return;
        }
      }
    };

    const handleKeyUp = () => {};

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    canvasManager,
    handleFinishTextEditing,
    isTextEditing,
    performRedo,
    performUndo,
    resetViewport,
    setActiveToolType,
    toggleGridMode,
    zoomIn,
    zoomOut,
  ]);
}
