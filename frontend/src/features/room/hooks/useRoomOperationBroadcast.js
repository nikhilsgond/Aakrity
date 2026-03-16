import { useEffect } from "react";
import { TOOL_TYPES } from "@shared/constants";

export function useRoomOperationBroadcast({
  isReady,
  canvasManager,
  sendOperation,
  isRemoteOperationRef,
  modifyDebounceRef,
  modifyPendingRef,
  setActiveToolType,
}) {
  useEffect(() => {
    if (!isReady || !canvasManager || !sendOperation) return;

    const handleStateChanged = (e) => {
      if (isRemoteOperationRef.current) return;
      if (e.type === "local" && e.command) {
        const cmdName = e.command?.constructor?.name || '';
        if (cmdName === 'DeleteObjectsCommand') {
          sendOperation({
            type: 'delete_objects',
            objectIds: e.command.objectIds || [],
            timestamp: Date.now(),
          });
          return;
        }
        if (cmdName === 'CreateObjectsCommand') {
          const objects = (e.command.objects || []).map((obj) => {
            const safe = { ...obj };
            delete safe.imageElement;
            return safe;
          });
          sendOperation({
            type: 'create_objects',
            objects,
            timestamp: Date.now(),
          });
          return;
        }
        const serialized = e.command.serialize ? e.command.serialize() : e.command;
        const payload = {
          type: "command",
          command: serialized,
          timestamp: Date.now(),
        };
        // For creation commands, include a full object snapshot with all properties
        // (x, y, width, height, type, etc.) to guarantee remote clients have
        // complete dimension data even if command deserialization is lossy.
        if (e.command.objectId && canvasManager) {
          const obj = canvasManager.getObjectById(e.command.objectId);
          if (obj) {
            payload.objectSnapshot = { ...obj };
            // Strip non-serializable properties
            delete payload.objectSnapshot.imageElement;
          }
        }
        sendOperation(payload);
      }
    };

    const handleObjectAdded = (e) => {
      if (isRemoteOperationRef.current) return;
      const obj = e.object?.toObject ? e.object.toObject() : e.object;
      if (obj?.type === 'image') {
        sendOperation({
          type: 'create_image',
          object: obj,
          timestamp: Date.now(),
        });
      }
      sendOperation({
        type: "add",
        object: obj,
        timestamp: Date.now(),
      });

      if (
        obj &&
        (obj.type === "rectangle" ||
          obj.type === "circle" ||
          obj.type === "ellipse" ||
          obj.type === "line" ||
          obj.type === "arrow" ||
          obj.type === "triangle" ||
          obj.type === "diamond" ||
          obj.type === "hexagon" ||
          obj.type === "pentagon" ||
          obj.type === "star" ||
          obj.type === "polygon" ||
          obj.type === "text" ||
          obj.type === "image" ||
          obj.type === "drawing" ||
          obj.type === "emoji" ||
          obj.type === "sticky")
      ) {
        setActiveToolType(TOOL_TYPES.SELECT);
        if (obj.id) {
          canvasManager.setSelection([obj.id]);
        }
      }
    };

    const handleObjectModified = (e) => {
      if (isRemoteOperationRef.current) return;
      const obj = e.target?.toObject ? e.target.toObject() : e.target;
      if (!obj || !obj.id) return;

      modifyPendingRef.current[obj.id] = obj;
      const prev = modifyDebounceRef.current.get(obj.id);
      if (prev) clearTimeout(prev);

      const t = setTimeout(() => {
        const latest = modifyPendingRef.current[obj.id];
        if (!latest) return;
        sendOperation({
          type: "modify",
          object: latest,
          timestamp: Date.now(),
        });
        modifyDebounceRef.current.delete(obj.id);
        delete modifyPendingRef.current[obj.id];
      }, 300);

      modifyDebounceRef.current.set(obj.id, t);
    };

    const handleObjectRemoved = (e) => {
      if (isRemoteOperationRef.current) return;
      sendOperation({
        type: "remove",
        objectId: e.target?.id || e.target?.objectId,
        timestamp: Date.now(),
      });
    };

    const handleDrawingStart = (e) => {
      if (isRemoteOperationRef.current) return;
      sendOperation({
        type: "drawing:start",
        points: e.points,
        color: e.color,
        width: e.width,
        opacity: e.opacity,
        style: e.style,
        timestamp: Date.now(),
      });
    };

    const handleDrawingPoint = (e) => {
      if (isRemoteOperationRef.current) return;
      sendOperation({
        type: "drawing:point",
        points: e.points,
        timestamp: Date.now(),
      });
    };

    const handleDrawingEnd = () => {
      if (isRemoteOperationRef.current) return;
      sendOperation({
        type: "drawing:end",
        timestamp: Date.now(),
      });
    };

    const handleMoveUpdate = (e) => {
      if (isRemoteOperationRef.current) return;
      sendOperation({
        type: "move:update",
        objectIds: e.objectIds,
        positions: e.positions,
        timestamp: Date.now(),
      });
    };

    const handleMoveFinal = (e) => {
      if (isRemoteOperationRef.current) return;
      sendOperation({
        type: "move:final",
        objectIds: e.objectIds,
        positions: e.positions,
        timestamp: Date.now(),
      });
    };

    const handleTransformUpdate = (e) => {
      if (isRemoteOperationRef.current) return;
      sendOperation({
        type: "transform:update",
        objectIds: e.objectIds,
        transformType: e.transformType,
        states: e.states,
        transformData: e.transformData,
        timestamp: Date.now(),
      });
    };

    const handleTransformFinal = (e) => {
      if (isRemoteOperationRef.current) return;
      sendOperation({
        type: "transform:final",
        objectIds: e.objectIds,
        transformType: e.transformType,
        states: e.states,
        timestamp: Date.now(),
      });
    };

    const handleShapePreview = (e) => {
      if (isRemoteOperationRef.current) return;
      const payload = { type: "shape:preview", timestamp: Date.now() };
      if (e.preview) {
        payload.preview = e.preview;
      } else {
        payload.startPoint = e.startPoint;
        payload.currentPoint = e.currentPoint;
        payload.shapeType = e.shapeType;
        payload.options = e.options;
      }
      sendOperation(payload);
    };

    const handleEraserLive = (e) => {
      if (isRemoteOperationRef.current) return;
      sendOperation({
        type: "eraser:live",
        deletedIds: e.deletedIds || [],
        modifiedObjects: e.modifiedObjects || [],
        addedObjects: e.addedObjects || [],
        timestamp: Date.now(),
      });
    };

    const handleObjectReordered = (e) => {
      if (isRemoteOperationRef.current) return;
      sendOperation({
        type: "layer-change",
        orderedIds: e.orderedIds,
        timestamp: Date.now(),
      });
    };

    const handleShapePreviewClear = () => {
      if (isRemoteOperationRef.current) return;
      sendOperation({
        type: "shape:preview:clear",
        timestamp: Date.now(),
      });
    };

    const handleToolChanged = (e) => {
      const t = e?.toolType;
      if (t) {
        setActiveToolType(t);
      }
    };

    canvasManager.on("state:changed", handleStateChanged);
    canvasManager.on("object:added", handleObjectAdded);
    canvasManager.on("object:modified", handleObjectModified);
    canvasManager.on("object:removed", handleObjectRemoved);
    canvasManager.on("drawing:start", handleDrawingStart);
    canvasManager.on("drawing:point", handleDrawingPoint);
    canvasManager.on("drawing:end", handleDrawingEnd);
    canvasManager.on("move:update", handleMoveUpdate);
    canvasManager.on("move:final", handleMoveFinal);
    canvasManager.on("transform:update", handleTransformUpdate);
    canvasManager.on("transform:final", handleTransformFinal);
    canvasManager.on("shape:preview", handleShapePreview);
    canvasManager.on("shape:preview:clear", handleShapePreviewClear);
    canvasManager.on("eraser:live", handleEraserLive);
    canvasManager.on("object:reordered", handleObjectReordered);
    canvasManager.on("tool:changed", handleToolChanged);

    return () => {
      canvasManager.off("state:changed", handleStateChanged);
      canvasManager.off("object:added", handleObjectAdded);
      canvasManager.off("object:modified", handleObjectModified);
      canvasManager.off("object:removed", handleObjectRemoved);
      canvasManager.off("drawing:start", handleDrawingStart);
      canvasManager.off("drawing:point", handleDrawingPoint);
      canvasManager.off("drawing:end", handleDrawingEnd);
      canvasManager.off("move:update", handleMoveUpdate);
      canvasManager.off("move:final", handleMoveFinal);
      canvasManager.off("transform:update", handleTransformUpdate);
      canvasManager.off("transform:final", handleTransformFinal);
      canvasManager.off("shape:preview", handleShapePreview);
      canvasManager.off("shape:preview:clear", handleShapePreviewClear);
      canvasManager.off("eraser:live", handleEraserLive);
      canvasManager.off("object:reordered", handleObjectReordered);
      canvasManager.off("tool:changed", handleToolChanged);
      modifyDebounceRef.current.forEach((t) => clearTimeout(t));
      modifyDebounceRef.current.clear();
    };
  }, [
    isReady,
    canvasManager,
    sendOperation,
    isRemoteOperationRef,
    modifyDebounceRef,
    modifyPendingRef,
    setActiveToolType,
  ]);
}
