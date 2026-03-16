import { ResizeCommand } from '../commands/ResizeCommand.js';
import { RotateCommand } from '../commands/RotateCommand.js';
import useCollaborationStore from '@features/room/state/collaborationStore.js';
import {
  findDimensionMatches,
  findLengthMatches,
  snapRotation,
  snapAspectRatio,
  DIM_SNAP_ENTRY,
} from '../smartGuides/SmartGuideEngine.js';
import ObjectGeometry from '../geometry/ObjectGeometry.js';
import {
  getHandleWorldX as getHandleWorldXHelper,
  getHandleWorldY as getHandleWorldYHelper,
  worldDeltaToLocal as worldDeltaToLocalHelper,
  getOBBScale as getOBBScaleHelper,
  getScaleX as getScaleXHelper,
  getScaleY as getScaleYHelper,
  getResizeOrigin as getResizeOriginHelper,
  getOBBResizeOrigin as getOBBResizeOriginHelper,
  getAngleFromCenter as getAngleFromCenterHelper,
  getRotationCenter as getRotationCenterHelper,
  pointInRect as pointInRectHelper,
  pointInCircle as pointInCircleHelper,
} from './transformMath.js';
import {
  isTransformBlockedByTool,
  buildTransformStates,
  updateLineArrowEndpoint as updateLineArrowEndpointHelper,
  updateEllipseResize as updateEllipseResizeHelper,
} from './transformInteractionHelpers.js';

export default class TransformController {
  constructor(selectionManager, canvasManager, transformOverlay) {
    this.selection = selectionManager;
    this.canvas = canvasManager;
    this.overlay = transformOverlay;

    this.dragThreshold = 2;
    this.modifiers = { shift: false, alt: false, ctrl: false, cmd: false };

    this.lineEndpointDragging = null;
    this.initialEllipseState = null;
    this.lastBroadcastAt = 0;
    this.broadcastIntervalMs = 50;
    this.resetState();
  }

  resetState() {
    this.activeHandle = null;
    this.activeType = null;
    this.startPoint = null;
    this.startBounds = null;
    this.startOBB = null;
    this.startAngle = null;
    this.activeCommand = null;
    this.hasMovedSignificantly = false;
    this.objectIds = [];
    this.isOBB = false;
    this.objectRotation = 0;
    this.lineEndpointDragging = null;
    this.initialEllipseState = null;
    this.lastBroadcastAt = 0;

    this.modifiers.shift = false;
    this.modifiers.alt = false;
    this.modifiers.ctrl = false;
    this.modifiers.cmd = false;
  }

  isActive() {
    return this.activeHandle !== null || this.lineEndpointDragging !== null;
  }

  cancel() {
    if (this.activeCommand && this.activeCommand.initialStates) {
      this.activeCommand.undo(this.canvas.state);
      this.canvas.requestRender();
    }
    if (this.canvas.smartGuideState) {
      this.canvas.smartGuideState.reset();
    }
    this.resetState();
  }

  onPointerDown(event) {
    if (!this.selection.hasSelection()) return false;
    if (this.isActive()) return false;

    if (isTransformBlockedByTool(this.canvas.getActiveTool())) {
      return false;
    }

    this.updateModifiers(event);
    const worldPoint = this.canvas.screenToWorld(event.clientX, event.clientY);
    const ids = this.selection.getSelectedIds();
    if (ids.length === 0) return false;

    if (ids.length === 1) {
      const obj = this.canvas.state.objects.find((o) => o.id === ids[0]);
      const effectiveType = obj?.type === 'shape' ? obj.shapeType : obj?.type;
      // Bug #24: line/arrow selection uses endpoint handles
      if (obj && (effectiveType === 'line' || effectiveType === 'arrow')) {
        return this.handleLineArrowPointerDown(worldPoint, obj, ids);
      }
    }

    const selectionBounds = this.overlay.getSelectionBounds();
    if (!selectionBounds) return false;

    if (ids.length === 1) {
      const obj = this.canvas.state.objects.find((o) => o.id === ids[0]);
      this.objectRotation = obj?.rotation || 0;
    } else {
      this.objectRotation = 0;
    }

    if (selectionBounds.type === 'obb') {
      return this.handleOBBPointerDown(worldPoint, selectionBounds, ids);
    }
    return this.handleAABBPointerDown(worldPoint, selectionBounds, ids);
  }

  handleLineArrowPointerDown(worldPoint, obj, ids) {
    const handles = this.overlay.getLineArrowHandles(obj);
    if (this.pointInRect(worldPoint, handles.start)) {
      this.lineEndpointDragging = 'start';
      this.startPoint = { x: worldPoint.x, y: worldPoint.y };
      this.objectIds = [...ids];
      this.hasMovedSignificantly = false;
      return true;
    }
    if (this.pointInRect(worldPoint, handles.end)) {
      this.lineEndpointDragging = 'end';
      this.startPoint = { x: worldPoint.x, y: worldPoint.y };
      this.objectIds = [...ids];
      this.hasMovedSignificantly = false;
      return true;
    }
    return false;
  }

  handleOBBPointerDown(worldPoint, selectionBounds, ids) {
    const obb = selectionBounds.obb;
    if (!obb || !obb.corners) return false;

    const handles = this.overlay.getOBBHandleRects(obb, selectionBounds.rotation || 0);
    this.isOBB = true;
    this.startOBB = JSON.parse(JSON.stringify(obb));

    // Check if single selected object is text (skip n/s handles) or emoji (skip all edge handles)
    const singleObj = ids.length === 1 ? this.canvas.getObjectById(ids[0]) : null;
    const singleObjType = singleObj?.type || null;
    const isTextObj = singleObjType === 'text';
    const isEmojiObj = singleObjType === 'emoji';
    const isStickyObj = singleObjType === 'sticky';

    for (const [key, handle] of Object.entries(handles.resize)) {
      if (isTextObj && (key === 'n' || key === 's')) continue;
      if ((isEmojiObj || isStickyObj) && ['n', 'e', 's', 'w'].includes(key)) continue;
      if (this.pointInRect(worldPoint, handle)) {
        this.startResize(key, worldPoint, selectionBounds.aabb, ids, true);
        return true;
      }
    }

    if (handles.rotate && this.pointInCircle(worldPoint, handles.rotate)) {
      this.startRotate(worldPoint, selectionBounds.aabb, ids, true);
      return true;
    }
    return false;
  }

  handleAABBPointerDown(worldPoint, selectionBounds, ids) {
    const bounds = selectionBounds.aabb;
    const handles = this.overlay.getHandleRects(bounds, selectionBounds.rotation || 0);
    this.isOBB = false;

    // Check if single selected object is text (skip t/b handles) or emoji (skip all edge handles)
    const singleObj2 = ids.length === 1 ? this.canvas.getObjectById(ids[0]) : null;
    const singleObjType2 = singleObj2?.type || null;
    const isTextObj = singleObjType2 === 'text';
    const isEmojiObj = singleObjType2 === 'emoji';
    const isStickyObj = singleObjType2 === 'sticky';

    for (const [key, handle] of Object.entries(handles.resize)) {
      if (isTextObj && (key === 't' || key === 'b')) continue;
      if ((isEmojiObj || isStickyObj) && ['t', 'r', 'b', 'l'].includes(key)) continue;
      if (this.pointInRect(worldPoint, handle)) {
        this.startResize(key, worldPoint, bounds, ids, false);
        return true;
      }
    }

    if (handles.rotate && this.pointInCircle(worldPoint, handles.rotate)) {
      this.startRotate(worldPoint, bounds, ids, false);
      return true;
    }
    return false;
  }

  startResize(handleKey, worldPoint, bounds, ids, isOBB) {
    this.activeHandle = handleKey;
    this.activeType = 'resize';
    this.startPoint = worldPoint;
    this.startBounds = { ...bounds };
    this.objectIds = [...ids];
    this.hasMovedSignificantly = false;
    this.isOBB = isOBB;
    this.overlay.snapshotBounds = { ...bounds };

    if (ids.length === 1) {
      const obj = this.canvas.getObjectById(ids[0]);
      if (obj && obj.type === 'ellipse') {
        this.initialEllipseState = {
          x: obj.x,
          y: obj.y,
          radiusX: obj.radiusX,
          radiusY: obj.radiusY,
          handle: handleKey,
        };
      }
    }

    const origin = this.getResizeOrigin(handleKey, bounds, isOBB);
    this.activeCommand = new ResizeCommand(ids, {
      scaleX: 1,
      scaleY: 1,
      origin,
      handle: handleKey,
      isOBB,
    });
    this.activeCommand.userId = useCollaborationStore.getState().currentUser?.id || null;
  }

  startRotate(worldPoint, bounds, ids, isOBB) {
    this.activeHandle = 'rotate';
    this.activeType = 'rotate';
    this.startPoint = worldPoint;
    this.startBounds = { ...bounds };
    this.objectIds = [...ids];
    this.hasMovedSignificantly = false;
    this.isOBB = isOBB;
    this.startAngle = this.getAngleFromCenter(worldPoint, bounds, isOBB);
    this.overlay.snapshotBounds = { ...bounds };

    const center = this.getRotationCenter(bounds, isOBB);
    this.activeCommand = new RotateCommand(ids, 0, center, isOBB);
    this.activeCommand.userId = useCollaborationStore.getState().currentUser?.id || null;
  }

  onPointerMove(event) {
    if (!this.isActive()) return;

    this.updateModifiers(event);
    const currentPoint = this.canvas.screenToWorld(event.clientX, event.clientY);

    if (this.lineEndpointDragging) {
      this.updateLineArrowEndpoint(currentPoint);
      return;
    }

    if (!this.activeCommand) return;

    const dx = currentPoint.x - this.startPoint.x;
    const dy = currentPoint.y - this.startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!this.hasMovedSignificantly && distance > this.dragThreshold) {
      this.hasMovedSignificantly = true;
    }
    if (!this.hasMovedSignificantly) return;

    if (this.activeCommand.initialStates) {
      this.activeCommand.undo(this.canvas.state);
    }

    if (this.activeType === 'resize') {
      this.updateResizePreview(currentPoint);
    } else if (this.activeType === 'rotate') {
      this.updateRotatePreview(currentPoint);
    }

    this.canvas.requestRender();

    if (this.hasMovedSignificantly && this.canvas) {
      const now = performance.now();
      if (now - this.lastBroadcastAt >= this.broadcastIntervalMs) {
        this.lastBroadcastAt = now;
        const states = buildTransformStates(this.canvas, this.objectIds);
        this.canvas.emit('transform:update', {
          objectIds: this.objectIds,
          transformType: this.activeType,
          states,
          transformData: {
            scaleX: this.activeCommand.scaleX,
            scaleY: this.activeCommand.scaleY,
            angle: this.activeCommand.angle,
          },
        });
      }
    }
  }

  updateLineArrowEndpoint(currentPoint) {
    return updateLineArrowEndpointHelper(this, currentPoint);
  }

  updateModifiers(event) {
    this.modifiers.shift = !!event.shiftKey;
    this.modifiers.alt = !!event.altKey;
    this.modifiers.ctrl = !!event.ctrlKey;
    this.modifiers.cmd = !!event.metaKey;
  }

  updateResizePreview(currentPoint) {
    const dx = currentPoint.x - this.startPoint.x;
    const dy = currentPoint.y - this.startPoint.y;

    const isEllipse = this.objectIds.length === 1 && this.canvas.getObjectById(this.objectIds[0])?.type === 'ellipse';
    if (isEllipse) {
      this.updateEllipseResize(currentPoint);
      return;
    }

    // Text objects: corner/top/bottom handles scale fontSize,
    //               left/right handles expand bounding width for alignment.
    const isText = this.objectIds.length === 1 && this.canvas.getObjectById(this.objectIds[0])?.type === 'text';
    if (isText) {
      this.updateTextResize(currentPoint);
      return;
    }

    let scaleX;
    let scaleY;
    if (this.isOBB) {
      const obbScale = this.getOBBScale(dx, dy, this.activeHandle);
      scaleX = obbScale.scaleX;
      scaleY = obbScale.scaleY;
    } else {
      const localDelta = this.worldDeltaToLocal(dx, dy, this.objectRotation);
      scaleX = this.getScaleX(localDelta.dx, this.startBounds, this.activeHandle);
      scaleY = this.getScaleY(localDelta.dy, this.startBounds, this.activeHandle);
    }

    if (this.shouldUseUniformResize() && this.isCornerHandle(this.activeHandle)) {
      const uniform = Math.max(Math.abs(scaleX), Math.abs(scaleY));
      scaleX = Math.sign(scaleX || 1) * uniform;
      scaleY = Math.sign(scaleY || 1) * uniform;
    }

    if (this.modifiers.shift) {
      const avgScale = (scaleX + scaleY) / 2;
      scaleX = avgScale;
      scaleY = avgScale;
    }

    // ── Smart Guide dimension snapping ──────────────────────
    const sgs = this.canvas.smartGuideState;
    const suppressSnap = !!(this.modifiers.ctrl || this.modifiers.cmd);
    sgs.suppressed = suppressSnap;

    if (!suppressSnap && this.startBounds) {
      sgs.mode = 'resize';
      const others = this.canvas.state.objects.filter(o => !this.objectIds.includes(o.id));
      const dimMatches = [];

      // Width matching
      const currentW = this.startBounds.width * Math.abs(scaleX);
      const wResult = findDimensionMatches('width', currentW, others);
      if (wResult.snapValue !== null) {
        const targetScale = wResult.snapValue / this.startBounds.width;
        scaleX = Math.sign(scaleX || 1) * targetScale;
        for (const m of wResult.matches) {
          dimMatches.push({
            ...m,
            labelPos: {
              x: this.startBounds.x + this.startBounds.width / 2,
              y: this.startBounds.y - 20,
            },
          });
        }
      }

      // Height matching
      const currentH = this.startBounds.height * Math.abs(scaleY);
      const hResult = findDimensionMatches('height', currentH, others);
      if (hResult.snapValue !== null) {
        const targetScale = hResult.snapValue / this.startBounds.height;
        scaleY = Math.sign(scaleY || 1) * targetScale;
        for (const m of hResult.matches) {
          dimMatches.push({
            ...m,
            labelPos: {
              x: this.startBounds.x + this.startBounds.width + 20,
              y: this.startBounds.y + this.startBounds.height / 2,
            },
          });
        }
      }

      sgs.dimensionMatches = dimMatches;
    }

    const origin = this.getResizeOrigin(this.activeHandle, this.startBounds, this.isOBB);
    this.activeCommand.scaleX = scaleX;
    this.activeCommand.scaleY = scaleY;
    this.activeCommand.resizeData = {
      scaleX,
      scaleY,
      origin,
      handle: this.activeHandle,
      isOBB: this.isOBB,
    };
    this.activeCommand.execute(this.canvas.state);
  }

  updateTextResize(currentPoint) {
    const obj = this.canvas.getObjectById(this.objectIds[0]);
    if (!obj) return;

    const dx = currentPoint.x - this.startPoint.x;
    const dy = currentPoint.y - this.startPoint.y;
    const handle = this.activeHandle;
    const isCorner = this.isCornerHandle(handle);
    const isTopBottom = ['t', 'b', 'n', 's'].includes(handle);
    const isLeftRight = ['l', 'r', 'e', 'w'].includes(handle);

    if (isCorner || isTopBottom) {
      // Corner and top/bottom handles scale fontSize proportionally.
      // Compute a uniform scale from the drag distance.
      let scaleX, scaleY;
      if (this.isOBB) {
        const obbScale = this.getOBBScale(dx, dy, handle);
        scaleX = obbScale.scaleX;
        scaleY = obbScale.scaleY;
      } else {
        const localDelta = this.worldDeltaToLocal(dx, dy, this.objectRotation);
        scaleX = this.getScaleX(localDelta.dx, this.startBounds, handle);
        scaleY = this.getScaleY(localDelta.dy, this.startBounds, handle);
      }

      // Use the dominant axis for uniform scaling
      const uniform = isTopBottom
        ? Math.abs(scaleY)
        : Math.max(Math.abs(scaleX), Math.abs(scaleY));

      // Apply uniform scale to both axes
      scaleX = Math.sign(scaleX || 1) * uniform;
      scaleY = Math.sign(scaleY || 1) * uniform;

      const origin = this.getResizeOrigin(handle, this.startBounds, this.isOBB);
      this.activeCommand.scaleX = scaleX;
      this.activeCommand.scaleY = scaleY;
      this.activeCommand.resizeData = {
        scaleX,
        scaleY,
        origin,
        handle,
        isOBB: this.isOBB,
        isTextFontResize: true,
      };
      this.activeCommand.execute(this.canvas.state);
    } else if (isLeftRight) {
      // Left/right handles expand the bounding width only (for text alignment).
      let scaleX;
      if (this.isOBB) {
        const obbScale = this.getOBBScale(dx, dy, handle);
        scaleX = obbScale.scaleX;
      } else {
        const localDelta = this.worldDeltaToLocal(dx, dy, this.objectRotation);
        scaleX = this.getScaleX(localDelta.dx, this.startBounds, handle);
      }
      const scaleY = 1; // Don't change height

      const origin = this.getResizeOrigin(handle, this.startBounds, this.isOBB);
      this.activeCommand.scaleX = scaleX;
      this.activeCommand.scaleY = scaleY;
      this.activeCommand.resizeData = {
        scaleX,
        scaleY,
        origin,
        handle,
        isOBB: this.isOBB,
      };
      this.activeCommand.execute(this.canvas.state);
    }
  }

  shouldUseUniformResize() {
    if (this.objectIds.length !== 1) return false;
    const obj = this.canvas.getObjectById(this.objectIds[0]);
    if (!obj) return false;
    return obj.type === 'image' || obj.type === 'drawing' || obj.type === 'text' || obj.type === 'emoji' || obj.type === 'sticky';
  }

  isCornerHandle(handle) {
    return ['tl', 'tr', 'bl', 'br', 'nw', 'ne', 'sw', 'se'].includes(handle);
  }

  updateEllipseResize(currentPoint) {
    return updateEllipseResizeHelper(this, currentPoint);
  }

  updateRotatePreview(currentPoint) {
    const currentAngle = this.getAngleFromCenter(currentPoint, this.startBounds, this.isOBB);
    let angle = currentAngle - this.startAngle;

    // ── Smart Guide rotation snapping ──────────────────────
    const sgs = this.canvas.smartGuideState;
    const suppressSnap = !!(this.modifiers.ctrl || this.modifiers.cmd);
    sgs.suppressed = suppressSnap;

    if (!suppressSnap) {
      sgs.mode = 'rotate';
      // Account for existing rotation of the object
      const existingRotation = this.objectRotation || 0;
      const totalAngle = existingRotation + angle;

      const result = snapRotation(totalAngle, sgs.currentRotationSnap);
      if (result.isSnapped) {
        angle = result.snappedAngle - existingRotation;
        sgs.currentRotationSnap = result.snappedAngle;

        // Provide center for the guide renderer
        const center = this.getRotationCenter(this.startBounds, this.isOBB);
        sgs.rotationSnap = {
          isSnapped: true,
          snapDegrees: result.snapDegrees,
          center,
        };
      } else {
        sgs.currentRotationSnap = null;
        sgs.rotationSnap = null;
      }
    } else {
      sgs.rotationSnap = null;
    }

    this.activeCommand.angle = angle;
    this.activeCommand.execute(this.canvas.state);
  }

  onPointerUp(event = {}) {
    if (!this.isActive()) return;

    let result = null;

    // ── No-drag click on a line/arrow/connector endpoint → show suggestion popup ──
    if (this.lineEndpointDragging && !this.hasMovedSignificantly) {
      const obj = this.canvas.getObjectById(this.objectIds[0]);
      if (obj) {
        const isEnd = this.lineEndpointDragging === 'end';
        const worldX = isEnd ? obj.x2 : obj.x1;
        const worldY = isEnd ? obj.y2 : obj.y1;
        // Use the clientX/clientY passed from the pointer event for popup positioning
        const clientX = event.clientX ?? event.x ?? 0;
        const clientY = event.clientY ?? event.y ?? 0;
        this.canvas.emit('endpoint:click', {
          objId: obj.id,
          objType: obj.type,
          endpoint: this.lineEndpointDragging,
          worldX,
          worldY,
          clientX,
          clientY,
        });
      }
      this.resetState();
      return result;
    }

    if (this.lineEndpointDragging && this.hasMovedSignificantly) {
      this.resetState();
      return result;
    }

    if (this.hasMovedSignificantly && this.activeCommand) {
      if (this.activeType === 'resize') {
        const { scaleX, scaleY } = this.activeCommand.resizeData;
        if (Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001) {
          this.canvas.historyManager.applyOwnership(this.canvas.state, this.activeCommand);
          this.canvas.historyManager.registerWithoutExecuting(this.activeCommand);
          this.canvas.emit('state:changed', { type: 'local', command: this.activeCommand });
          result = { command: this.activeCommand.serialize(), type: 'local' };
        } else if (this.activeCommand.initialStates) {
          this.activeCommand.undo(this.canvas.state);
          this.canvas.requestRender();
        }
      } else if (this.activeType === 'rotate') {
        if (Math.abs(this.activeCommand.angle) > 0.001) {
          this.canvas.historyManager.applyOwnership(this.canvas.state, this.activeCommand);
          this.canvas.historyManager.registerWithoutExecuting(this.activeCommand);
          this.canvas.emit('state:changed', { type: 'local', command: this.activeCommand });
          result = { command: this.activeCommand.serialize(), type: 'local' };
        } else if (this.activeCommand.initialStates) {
          this.activeCommand.undo(this.canvas.state);
          this.canvas.requestRender();
        }
      }
    } else if (this.activeCommand && this.activeCommand.initialStates) {
      this.activeCommand.undo(this.canvas.state);
      this.canvas.requestRender();
    }

    const finalIds = [...this.objectIds];
    const finalType = this.activeType;
    this.resetState();
    this.overlay.snapshotBounds = null;

    // Clear smart guide state after interaction ends
    if (this.canvas.smartGuideState) {
      this.canvas.smartGuideState.reset();
      this.canvas.requestRender();
    }

    if (finalIds.length > 0 && this.canvas) {
      const states = buildTransformStates(this.canvas, finalIds);
      this.canvas.emit('transform:final', {
        objectIds: finalIds,
        transformType: finalType,
        states,
      });
    }

    return result;
  }

  getHandleWorldX(handleKey, bounds) {
    return getHandleWorldXHelper(handleKey, bounds);
  }

  getHandleWorldY(handleKey, bounds) {
    return getHandleWorldYHelper(handleKey, bounds);
  }

  worldDeltaToLocal(dx, dy, rotation) {
    return worldDeltaToLocalHelper(dx, dy, rotation);
  }

  getOBBScale(dx, dy, handleKey) {
    return getOBBScaleHelper(this.startOBB, dx, dy, handleKey);
  }

  getScaleX(dx, bounds, handleKey) {
    return getScaleXHelper(dx, bounds, handleKey);
  }

  getScaleY(dy, bounds, handleKey) {
    return getScaleYHelper(dy, bounds, handleKey);
  }

  getResizeOrigin(handleKey, bounds, isOBB = false) {
    return getResizeOriginHelper(handleKey, bounds, isOBB, this.startOBB, this.modifiers);
  }

  getOBBResizeOrigin(handleKey) {
    return getOBBResizeOriginHelper(handleKey, this.startOBB, this.modifiers);
  }

  getAngleFromCenter(point, bounds, isOBB = false) {
    return getAngleFromCenterHelper(point, bounds, isOBB, this.startOBB);
  }

  getRotationCenter(bounds, isOBB = false) {
    return getRotationCenterHelper(bounds, isOBB, this.startOBB);
  }

  pointInRect(point, rect) {
    return pointInRectHelper(point, rect);
  }

  pointInCircle(point, circle) {
    return pointInCircleHelper(point, circle);
  }
}
