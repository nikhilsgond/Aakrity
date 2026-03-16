import { useEffect } from "react";
import { deserializeCommand } from "@features/canvas/engine/commands";
import useCollaborationStore from "@features/room/state/collaborationStore";
import { useUIStore } from "@app/state/uiStore";
import { smoothMove, smoothAppear, cancelRemoteAnimation } from "@features/room/lib/remoteAnimation";

export function useRoomRemoteOperations({ canvasManager, userId, isRemoteOperationRef }) {
  useEffect(() => {
    if (!canvasManager) return;

    const handleRemoteOp = (data) => {
      if (typeof data === "string") return;
      if (data && data.type && !data.userId) return;

      const { userId: remoteUserId, operation } = data || {};
      if (!remoteUserId || !operation) return;
      if (remoteUserId === userId) return;

      isRemoteOperationRef.current = true;

      try {
        switch (operation.type) {
          case "delete_objects": {
            const ids = operation.objectIds || [];
            if (Array.isArray(ids)) {
              ids.forEach((id) => canvasManager.removeObject(id));
            }
            const { remoteSelections } = useCollaborationStore.getState();
            if (remoteSelections && ids.length > 0) {
              const next = new Map(remoteSelections);
              next.forEach((sel, uid) => {
                if (!Array.isArray(sel)) return;
                const filtered = sel.filter((id) => !ids.includes(id));
                if (filtered.length === 0) next.delete(uid);
                else next.set(uid, filtered);
              });
              useCollaborationStore.setState({ remoteSelections: next });
            }
            canvasManager.requestRender();
            break;
          }
          case "create_objects": {
            const objects = operation.objects || [];
            if (Array.isArray(objects)) {
              objects.forEach((obj) => {
                if (!obj) return;
                const safe = { ...obj };
                delete safe.imageElement;
                  safe.creationSource = 'remote';
                safe.lastEditedBy = remoteUserId;
                safe.lastEditedAt = Date.now();
                canvasManager.addObject(safe);
              });
            }
            const ids = objects.map((obj) => obj?.id).filter(Boolean);
            if (ids.length > 0) {
              canvasManager.applyLastEditedBy?.(ids, remoteUserId);
            }
            canvasManager.updateObjectIndex?.();
            canvasManager.requestRender();
            break;
          }
          case "command":
            if (operation.command) {
              const command = deserializeCommand(operation.command);
              if (command) {
                const cmdName = command.constructor?.name || "";
                // Move / Resize / Rotate commands: register in history only.
                // The corresponding move:final or transform:final event carries
                // the smooth animation, so we must NOT execute the command
                // (which would snap the object instantly and cause flicker).
                if (
                  cmdName === "MoveCommand" ||
                  cmdName === "ResizeCommand" ||
                  cmdName === "RotateCommand" ||
                  cmdName === "ApplyEraserCommand"
                ) {
                  if (canvasManager.historyManager?.registerWithoutExecuting) {
                    canvasManager.historyManager.registerWithoutExecuting(command);
                  }
                  canvasManager.requestRender();
                } else {
                  canvasManager.executeRemoteCommand(command);

                  // Animate newly-created objects so they scale in smoothly
                  if (cmdName === "AddShapeCommand" && command.objectId) {
                    const newObj = canvasManager.state.objects.find(
                      (o) => o.id === command.objectId
                    );
                    if (newObj) {
                      newObj.creationSource = 'remote';
                      // Apply full object snapshot to ensure dimensions are correct
                      if (operation.objectSnapshot) {
                        const snap = operation.objectSnapshot;
                        ['x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2',
                         'radius', 'radiusX', 'radiusY', 'rotation', 'type',
                         'strokeColor', 'strokeWidth', 'fillColor', 'opacity',
                         'noteColor', 'textColor', 'fontSize', 'text',
                         'fromObjectId', 'toObjectId', 'fromPort', 'toPort',
                         'lineStyle', 'imageData',
                        ].forEach((k) => {
                          if (snap[k] !== undefined) newObj[k] = snap[k];
                        });
                        if (Array.isArray(snap.points)) {
                          newObj.points = snap.points.map((p) => ({ ...p }));
                        }
                      }
                      smoothAppear(newObj, canvasManager, 150);
                    }
                  }
                }

                const tempId = `temp-draw-${remoteUserId}`;
                const idx = canvasManager.state.objects.findIndex((o) => o.id === tempId);
                if (idx !== -1) {
                  canvasManager.state.objects.splice(idx, 1);
                  canvasManager.requestRender();
                }
                // Also clean up from remote preview map
                canvasManager.remotePreviewObjects?.delete(remoteUserId);
              }
            }
            break;

          case "add":
            if (canvasManager.addObject) {
              canvasManager.addObject(operation.object);
              if (operation.object?.id) {
                canvasManager.applyLastEditedBy?.([operation.object.id], remoteUserId);
              }
              // Animate the new object appearing
              if (operation.object?.id) {
                const addedObj = canvasManager.state.objects.find(
                  (o) => o.id === operation.object.id
                );
                if (addedObj) {
                  smoothAppear(addedObj, canvasManager, 150);
                }
              }
            }
            break;
          case "create_image":
            if (canvasManager.addObject && operation.object) {
              const safe = { ...operation.object };
              delete safe.imageElement;
              canvasManager.addObject(safe);
              if (safe.id) {
                canvasManager.applyLastEditedBy?.([safe.id], remoteUserId);
              }
              canvasManager.requestRender();
            }
            break;
          case "modify":
            if (canvasManager.updateObject) canvasManager.updateObject(operation.object.id, operation.object);
            if (operation.object?.id) {
              canvasManager.applyLastEditedBy?.([operation.object.id], remoteUserId);
            }
            break;
          case "remove":
            if (canvasManager.removeObject) canvasManager.removeObject(operation.objectId);
            if (operation.objectId) {
              canvasManager.applyLastEditedBy?.([operation.objectId], remoteUserId);
            }
            break;
          case "undo":
            if (typeof canvasManager.undo === "function") canvasManager.undo();
            break;
          case "redo":
            if (typeof canvasManager.redo === "function") canvasManager.redo();
            break;

          case "layer-change": {
            // Reorder objects array to match the sender's new order
            if (Array.isArray(operation.orderedIds) && Array.isArray(canvasManager.state?.objects)) {
              const byId = new Map(canvasManager.state.objects.map(o => [o.id, o]));
              const reordered = [];
              operation.orderedIds.forEach(id => {
                const obj = byId.get(id);
                if (obj) {
                  reordered.push(obj);
                  byId.delete(id);
                }
              });
              // Append any objects not mentioned in orderedIds (safety)
              byId.forEach(obj => reordered.push(obj));
              canvasManager.state.objects = reordered;
              canvasManager.updateObjectIndex?.();
              canvasManager.requestRender();
            }
            break;
          }

          case "drawing:start": {
            const preview = {
              id: `temp-draw-${remoteUserId}`,
              type: "drawing",
              points: operation.points || [],
              strokeColor: operation.color || "#000000",
              strokeWidth: operation.width || 2,
              opacity: operation.opacity || 1,
              style: operation.style || "smooth",
              isPreview: true,
              isRemotePreview: true,
              userId: remoteUserId,
            };
            canvasManager.remotePreviewObjects.set(remoteUserId, preview);
            canvasManager.requestRender();
            break;
          }
          case "drawing:point": {
            const preview = canvasManager.remotePreviewObjects.get(remoteUserId);
            if (preview && Array.isArray(preview.points)) {
              preview.points = preview.points.concat(operation.points || []);
              canvasManager.requestRender();
            }
            break;
          }
          case "drawing:end": {
            canvasManager.remotePreviewObjects.delete(remoteUserId);
            canvasManager.requestRender();
            break;
          }
          case "move:update":
            if (operation.positions && Array.isArray(operation.positions)) {
              operation.positions.forEach((pos) => {
                const obj = canvasManager.state.objects.find((o) => o.id === pos.id);
                if (!obj) return;
                // 45ms ≤ 50ms broadcast interval → animation finishes
                // before next update, giving smooth interpolation.
                const target = {};
                ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'rotation', 'radius', 'radiusX', 'radiusY']
                  .forEach((k) => { if (pos[k] !== undefined) target[k] = pos[k]; });
                if (Array.isArray(pos.points)) target.points = pos.points;
                smoothMove(obj, target, canvasManager, 45);
              });
            }
            break;

          case "move:final":
            if (operation.positions && Array.isArray(operation.positions)) {
              operation.positions.forEach((pos) => {
                const obj = canvasManager.state.objects.find((o) => o.id === pos.id);
                if (!obj) return;
                const target = {};
                ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'rotation', 'radius', 'radiusX', 'radiusY', 'flipX', 'flipY']
                  .forEach((k) => { if (pos[k] !== undefined) target[k] = pos[k]; });
                if (Array.isArray(pos.points)) target.points = pos.points;
                smoothMove(obj, target, canvasManager, 45);
              });
              const ids = operation.positions.map((pos) => pos.id).filter(Boolean);
              canvasManager.applyLastEditedBy?.(ids, remoteUserId);
            }
            break;

          case "transform:update":
            if (operation.states && Array.isArray(operation.states)) {
              operation.states.forEach((state) => {
                const obj = canvasManager.state.objects.find((o) => o.id === state.id);
                if (!obj) return;
                const target = {};
                ['x', 'y', 'width', 'height', 'rotation', 'radiusX', 'radiusY', 'radius', 'flipX', 'flipY']
                  .forEach((k) => { if (state[k] !== undefined) target[k] = state[k]; });
                if (state.points !== undefined) target.points = state.points;
                smoothMove(obj, target, canvasManager, 45);
              });
            }
            break;

          case "transform:final":
            if (operation.states && Array.isArray(operation.states)) {
              operation.states.forEach((state) => {
                const obj = canvasManager.state.objects.find((o) => o.id === state.id);
                if (!obj) return;
                const target = {};
                ['x', 'y', 'width', 'height', 'rotation', 'radiusX', 'radiusY', 'radius', 'flipX', 'flipY']
                  .forEach((k) => { if (state[k] !== undefined) target[k] = state[k]; });
                if (state.points !== undefined) target.points = state.points;
                smoothMove(obj, target, canvasManager, 45);
              });
              const ids = operation.states.map((state) => state.id).filter(Boolean);
              canvasManager.applyLastEditedBy?.(ids, remoteUserId);
            }
            break;

          case "selection:update": {
            const { setRemoteSelection } = useCollaborationStore.getState();
            if (typeof setRemoteSelection === "function") {
              setRemoteSelection(remoteUserId, operation.selectedIds || []);
            }
            // Force canvas re-render so remote selection highlights appear immediately
            canvasManager.requestRender();
            break;
          }

          case "shape:preview": {
            let previewObj;
            if (operation.preview) {
              previewObj = {
                ...operation.preview,
                isPreview: true,
                isRemotePreview: true,
                userId: remoteUserId,
              };
            } else {
              const { startPoint, currentPoint, shapeType, options } = operation;
              previewObj = {
                id: `temp-shape-${remoteUserId}`,
                type: shapeType || "shape",
                start: startPoint,
                end: currentPoint,
                options,
                isPreview: true,
                isRemotePreview: true,
                userId: remoteUserId,
              };
            }
            canvasManager.setPreviewObject(previewObj);
            break;
          }
          case "shape:preview:clear":
            canvasManager.clearPreview();
            break;

          case "eraser:live": {
            // Apply live eraser changes immediately so objects disappear during drag
            const { deletedIds, modifiedObjects, addedObjects } = operation;
            if (deletedIds && deletedIds.length > 0) {
              for (const id of deletedIds) {
                const idx = canvasManager.state.objects.findIndex(o => o.id === id);
                if (idx !== -1) canvasManager.state.objects.splice(idx, 1);
              }
              canvasManager.applyLastEditedBy?.(deletedIds, remoteUserId);
            }
            if (modifiedObjects && modifiedObjects.length > 0) {
              for (const mod of modifiedObjects) {
                const idx = canvasManager.state.objects.findIndex(o => o.id === mod.id);
                if (idx !== -1) {
                  canvasManager.state.objects[idx] = { ...mod };
                } else {
                  canvasManager.state.objects.push({ ...mod });
                }
              }
              canvasManager.applyLastEditedBy?.(modifiedObjects.map((m) => m.id).filter(Boolean), remoteUserId);
            }
            if (addedObjects && addedObjects.length > 0) {
              for (const added of addedObjects) {
                const exists = canvasManager.state.objects.findIndex(o => o.id === added.id);
                if (exists === -1) {
                  canvasManager.state.objects.push({ ...added });
                }
              }
              canvasManager.applyLastEditedBy?.(addedObjects.map((a) => a.id).filter(Boolean), remoteUserId);
            }
            canvasManager.updateObjectIndex?.();
            canvasManager.requestRender();
            break;
          }

          case "title:update":
            if (operation.title !== undefined) {
              useUIStore.setState({ boardTitle: operation.title });
            }
            break;

          case "title:editing:start":
            // Another user started editing the title — set the soft lock
            useCollaborationStore.setState({
              titleEditLock: {
                userId: remoteUserId,
                username: (useCollaborationStore.getState().users.get(remoteUserId) || {}).name || 'User',
                timestamp: Date.now(),
              },
            });
            break;

          case "title:editing:stop":
            // Another user stopped editing the title — release the soft lock
            {
              const currentLock = useCollaborationStore.getState().titleEditLock;
              if (currentLock && currentLock.userId === remoteUserId) {
                useCollaborationStore.setState({ titleEditLock: null });
              }
            }
            break;

          case "text:update": {
            const obj = canvasManager.state.objects.find((o) => o.id === operation.textId);
            if (obj && (obj.type === "text" || obj.type === "sticky")) {
              if (operation.text !== undefined) obj.text = operation.text;
              if (operation.fontFamily !== undefined) obj.fontFamily = operation.fontFamily;
              if (operation.fontSize !== undefined) obj.fontSize = operation.fontSize;
              if (operation.textColor !== undefined) obj.textColor = operation.textColor;
              if (operation.textAlign !== undefined) obj.textAlign = operation.textAlign;
              if (operation.verticalAlign !== undefined) obj.verticalAlign = operation.verticalAlign;
              if (operation.fontWeight !== undefined) obj.fontWeight = operation.fontWeight;
              if (operation.fontStyle !== undefined) obj.fontStyle = operation.fontStyle;
              if (operation.underline !== undefined) obj.underline = operation.underline;
              if (operation.strikethrough !== undefined) obj.strikethrough = operation.strikethrough;
              if (operation.backgroundColor !== undefined) obj.backgroundColor = operation.backgroundColor;
              if (operation.listType !== undefined) obj.listType = operation.listType;
              if (operation.autoWidth !== undefined) obj.autoWidth = operation.autoWidth;
              if (operation.autoHeight !== undefined) obj.autoHeight = operation.autoHeight;
              if (operation.formattedRanges !== undefined) obj.formattedRanges = operation.formattedRanges;

              // Sync dimensions from remote — always recalculate height if not provided
              if (operation.width !== undefined) obj.width = operation.width;
              if (operation.height !== undefined) {
                obj.height = operation.height;
              } else {
                // Auto-recalculate height from text content
                const fontSize = obj.fontSize || 16;
                const lineHeight = fontSize * 1.2;
                const lines = (obj.text || '').split('\n');
                obj.height = Math.max(lines.length * lineHeight, lineHeight);
              }

              obj.updatedAt = Date.now();
              canvasManager.applyLastEditedBy?.([obj.id], remoteUserId);
              canvasManager.updateObjectIndex?.();
              canvasManager.requestRender();
            }
            break;
          }
          case "text:editing": {
            // Update cursor position to text object location so remote user's cursor stays visible
            const textObj = canvasManager.state.objects.find((o) => o.id === operation.textId);
            if (textObj && remoteUserId) {
              const bounds = canvasManager.getObjectBounds(textObj);
              if (bounds) {
                const worldPos = { x: bounds.x + bounds.width / 2, y: bounds.y };
                const screenPos = canvasManager.worldToScreen(worldPos.x, worldPos.y);
                const newCursors = new Map(useCollaborationStore.getState().cursors);
                newCursors.set(remoteUserId, {
                  world: worldPos,
                  screen: screenPos,
                  isTextEditing: true,
                  textId: operation.textId,
                });
                useCollaborationStore.setState({ cursors: newCursors });
              }
            }
            break;
          }
          case "text:finished": {
            // Clear text editing indicator from cursor
            if (remoteUserId) {
              const newCursors = new Map(useCollaborationStore.getState().cursors);
              const existing = newCursors.get(remoteUserId);
              if (existing && existing.isTextEditing) {
                newCursors.set(remoteUserId, {
                  ...existing,
                  isTextEditing: false,
                  textId: null,
                });
                useCollaborationStore.setState({ cursors: newCursors });
              }
            }
            break;
          }
          case "tool:change":
          default:
            break;
        }
      } catch (error) {
        console.error("Error applying remote operation:", error);
      } finally {
        setTimeout(() => {
          isRemoteOperationRef.current = false;
        }, 100);
      }
    };

    useCollaborationStore.setState({ handleRemoteOperation: handleRemoteOp });
    return () => {
      useCollaborationStore.setState({ handleRemoteOperation: null });
    };
  }, [canvasManager, isRemoteOperationRef, userId]);
}
