// src/features/canvas/hooks/useConnectorInteraction.js
// Miro-style connector interaction: hover → port dots → click/drag → preview → snap → finalize.
// Port dots are rendered by ConnectorPortOverlay (visual only, pointerEvents:'none').
// ALL click/drag interaction on ports is handled here via canvas pointer events.
import { useCallback, useRef } from 'react';
import { useConnectorStore } from '../state/connectorStore';
import useCollaborationStore from '@features/room/state/collaborationStore';
import {
  getPortPositions,
  hitTestPort,
  findClosestPort,
  getPortPosition,
  getSurfacePoint,
  findBestTargetPort,
  isConnectable,
  PORT_NAMES,
  PORT_HIT_TOLERANCE,
} from '../engine/geometry/connectorGeometry';
import ObjectGeometry from '../engine/geometry/ObjectGeometry';
import { AddShapeCommand } from '../engine/commands/ShapeCommands';
import { UpdateStyleCommand } from '../engine/commands/UpdateStyleCommand';
import { generateId } from '@shared/lib/idGenerator';

/** Distance (world units) to detect a click on a connector endpoint */
const ENDPOINT_HIT_RADIUS = 14;

/** Screen-px distance the cursor must travel before a port click becomes a drag */
const DRAG_THRESHOLD = 4;

/** Snap distances in screen px (zoom-independent) */
const SNAP_ENTRY_PX = 20;
const SNAP_EXIT_PX  = 30;

/** Smaller hit tolerance used only for ghost-preview hover (visual radius) */
const GHOST_HOVER_TOLERANCE = 10;

/** Ghost-preview constants (must match canvasRenderCore drawGhostPreview) */
const _GHOST_PORT_DIR = {
  top:    { x:  0, y: -1 },
  right:  { x:  1, y:  0 },
  bottom: { x:  0, y:  1 },
  left:   { x: -1, y:  0 },
};
const GHOST_TIP_HIT_RADIUS = 32; // world units — click this close to tip to auto-generate

/** Returns true if objectId is currently selected by any remote collaborator */
function _isRemotelySelected(objectId) {
  const { remoteSelections } = useCollaborationStore.getState();
  if (!remoteSelections || remoteSelections.size === 0) return false;
  for (const [, ids] of remoteSelections.entries()) {
    if (Array.isArray(ids) && ids.includes(objectId)) return true;
  }
  return false;
}

/**
 * Hook that manages the full connector-port interaction lifecycle.
 */
export function useConnectorInteraction({
  canvasManagerRef,
  containerRef,
  executeLocalCommand,
  updateCanvasState,
  undo,
}) {
  const isDraggingRef     = useRef(false);
  const isEndpointDragRef = useRef(false);

  // Pending port: stores info between pointerdown and pointerup to distinguish
  // a single click (→ ghost preview) from a drag (→ live connector).
  const pendingPortRef = useRef(null);
  // { objId, portName, startScreenX, startScreenY, hasDragged }

  // Hysteresis: track whether we are currently snapped so we use exit threshold
  const currentSnapRef = useRef(null); // { objectId, port } | null

  // ─── Hover tracking (called from handlePointerMove when idle) ─────
  const updateHover = useCallback((worldX, worldY) => {
    const cm = canvasManagerRef.current;
    if (!cm) return;

    if (isDraggingRef.current || isEndpointDragRef.current) return;

    const store = useConnectorStore.getState();
    const objects = cm.state.objects;
    let hitId = null;

    // Check if cursor is over any connectable object
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (obj.type === 'connector') continue;
      if (!isConnectable(obj)) continue;
      if (ObjectGeometry.hitTest({ x: worldX, y: worldY }, obj, 8)) {
        hitId = obj.id;
        break;
      }
    }

    // Also detect hover via port proximity on selected objects
    // (ports are positioned outside the bounding box, so normal hit-test misses them)
    if (!hitId) {
      const selectedIds = cm.getSelection();
      for (const sid of selectedIds) {
        const obj = objects.find(o => o.id === sid);
        if (!obj || obj.type === 'connector' || !isConnectable(obj)) continue;
        const portName = hitTestPort({ x: worldX, y: worldY }, obj, PORT_HIT_TOLERANCE);
        if (portName) {
          hitId = sid;
          break;
        }
      }
    }

    // ── Bug #18: hover ghost preview ──────────────────────────────────
    // When the cursor is hovering directly over a port, show the ghost
    // preview arrow extending outward so users can see the connection point
    // before clicking or dragging.
    // Uses a smaller GHOST_HOVER_TOLERANCE (visual radius) vs PORT_HIT_TOLERANCE
    // (interaction radius) to prevent ghost from showing too aggressively.
    const worldPos = { x: worldX, y: worldY };
    let hoveredPort = null;
    if (hitId) {
      // Use selected + hovered candidates for richer hit-testing
      const candidateIds = new Set(cm.getSelection());
      candidateIds.add(hitId);
      for (const cid of candidateIds) {
        const obj = objects.find(o => o.id === cid);
        if (!obj || obj.type === 'connector' || !isConnectable(obj)) continue;
        const portName = hitTestPort(worldPos, obj, GHOST_HOVER_TOLERANCE);
        if (portName) {
          hoveredPort = { objId: cid, portName };
          break;
        }
      }
    }

    if (hoveredPort) {
      // Only update if something changed to avoid thrashing
      const prev = store.ghostPreview;
      if (!prev || prev.fromObjectId !== hoveredPort.objId || prev.fromPort !== hoveredPort.portName) {
        store.showGhostPreview(hoveredPort.objId, hoveredPort.portName);
        cm.requestRender();
      }
    } else {
      // Clear hover ghost when not over any port
      if (store.ghostPreview && !store.suggestionPopup) {
        store.hideGhostPreview();
        cm.requestRender();
      }
    }

    // Bug 2: don't show port hover on objects owned by another user
    if (hitId && _isRemotelySelected(hitId)) hitId = null;

    store.setHoveredObjectId(hitId);
  }, [canvasManagerRef]);

  // Also: when the snap target of a draft is remotely selected,
  // clear it to prevent accidentally connecting to locked objects.
  // This is checked live in _findPortHit above.

  // ─── Find a port hit on selected + hovered objects ──────────────
  const _findPortHit = useCallback((worldPos) => {
    const cm = canvasManagerRef.current;
    if (!cm) return null;

    const store = useConnectorStore.getState();
    const objects = cm.state.objects;

    // Build set of candidate objects: selected + hovered
    const candidateIds = new Set(cm.getSelection());
    if (store.hoveredObjectId) candidateIds.add(store.hoveredObjectId);

    for (const cid of candidateIds) {
      const obj = objects.find(o => o.id === cid);
      if (!obj || obj.type === 'connector' || !isConnectable(obj)) continue;
      // Bug 2: don't allow port interaction on objects held by another user
      if (_isRemotelySelected(cid)) continue;
      const portName = hitTestPort(worldPos, obj, PORT_HIT_TOLERANCE);
      if (portName) {
        return { objId: cid, portName };
      }
    }
    return null;
  }, [canvasManagerRef]);

  // ─── Pointer-down: intercept port clicks + connector endpoint clicks ──
  const onPointerDown = useCallback((screenX, screenY, clientX, clientY) => {
    const cm = canvasManagerRef.current;
    if (!cm) return false;

    const store = useConnectorStore.getState();
    const worldPos = cm.screenToWorld(screenX, screenY);

    // Clear ghost preview on any click
    if (store.ghostPreview) {
      // ── Bug ghost-click: hit-test the ghost preview tip first ──
      // Clicking at or near the ghost arrow tip auto-generates a connected shape.
      const ghostHitResult = _hitTestGhostTip(cm.state.objects, worldPos, store.ghostPreview);
      if (ghostHitResult) {
        store.hideGhostPreview();
        _autoGenerateFromGhost(
          ghostHitResult.sourceObj,
          ghostHitResult.tipX,
          ghostHitResult.tipY,
          store.ghostPreview.fromPort,
          executeLocalCommand,
          cm,
        );
        cm.requestRender();
        updateCanvasState();
        isDraggingRef.current = false;
        return true;
      }
      store.hideGhostPreview();
      cm.requestRender();
    }

    // ── 1) Check for existing connector/line/arrow endpoint drag ──
    const selectedIds = new Set(cm.getSelection());
    const endpointHit = _hitTestConnectorEndpoints(cm.state.objects, worldPos, selectedIds);
    if (endpointHit) {
      const { connector, endpoint } = endpointHit;
      isEndpointDragRef.current = true;
      isDraggingRef.current = true;
      pendingPortRef.current = null;

      let anchorObjId, anchorPort;
      if (endpoint === 'to') {
        anchorObjId = connector.fromObjectId;
        anchorPort = connector.fromPort || 'right';
      } else {
        anchorObjId = connector.toObjectId;
        anchorPort = connector.toPort || 'left';
      }

      // Bug #20/#25: track whether this endpoint is free (unconnected) so that
      // a bare click (no drag) can show the suggestion popup.
      const isEndpointFree = endpoint === 'to'
        ? !connector.toObjectId
        : !connector.fromObjectId;

      store.startEndpointDrag(
        connector.id,
        endpoint,
        anchorObjId,
        anchorPort,
        worldPos.x,
        worldPos.y,
        connector.fromObjectId,
        connector.toObjectId,
      );

      // Store click start position and whether the endpoint is free for click detection
      pendingPortRef.current = {
        isEndpointClick: true,
        isEndpointFree,
        clientX,
        clientY,
        startScreenX: screenX,
        startScreenY: screenY,
        hasDragged: false,
      };

      cm.requestRender();
      return true;
    }

    // ── 2) Check for port hit on selected + hovered objects ──
    const portHit = _findPortHit(worldPos);
    if (portHit) {
      // Immediately create a connector on click (no drag threshold)
      const obj = cm.state.objects.find(o => o.id === portHit.objId);
      if (!obj) return false;
      const portPos = getPortPosition(obj, portHit.portName);
      if (!portPos) return false;

      // Create the connector immediately
      const connectorData = {
        type: 'connector',
        id: generateId(),
        fromObjectId: portHit.objId,
        toObjectId: null,
        fromPort: portHit.portName,
        toPort: null,
        x1: portPos.x,
        y1: portPos.y,
        x2: worldPos.x,
        y2: worldPos.y,
        strokeColor: '#000000',
        strokeWidth: 2,
        opacity: 1.0,
        lineStyle: 'auto',
      };
      const command = new AddShapeCommand(connectorData);
      executeLocalCommand(command);

      // Start dragging the connector's head
      isDraggingRef.current = true;
      isEndpointDragRef.current = false;
      currentSnapRef.current = null;

      // Store the connector ID for dragging
      pendingPortRef.current = {
        isConnectorDrag: true,
        connectorId: connectorData.id,
        startScreenX: screenX,
        startScreenY: screenY,
        hasDragged: true, // Already created, so consider it dragged
      };

      cm.requestRender();
      updateCanvasState();
      return true;
    }

    return false;
  }, [canvasManagerRef, _findPortHit, executeLocalCommand, updateCanvasState]);

  // ─── Pointer-move: update connector head position + snap ──
  const onPointerMove = useCallback((screenX, screenY) => {
    if (!isDraggingRef.current) return false;

    const cm = canvasManagerRef.current;
    if (!cm) return false;

    const store = useConnectorStore.getState();
    const worldPos = cm.screenToWorld(screenX, screenY);
    const zoom = cm.state.viewport.zoom;

    // Handle connector head dragging
    if (pendingPortRef.current?.isConnectorDrag) {
      const connectorId = pendingPortRef.current.connectorId;
      const connector = cm.state.objects.find(o => o.id === connectorId);
      if (!connector) {
        isDraggingRef.current = false;
        pendingPortRef.current = null;
        return false;
      }

      // ── Magnetic snap (screen-space thresholds with hysteresis) ──
      let snapTarget = null;
      const objects = cm.state.objects;

      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (obj.type === 'connector' || obj.id === connector.fromObjectId) continue;
        if (!isConnectable(obj)) continue;

        const closest = findClosestPort(worldPos, obj);
        if (!closest) continue;

        // Convert world-unit distance to screen-px distance
        const screenDist = closest.distance * zoom;

        // Hysteresis: if currently snapped to this port, use exit threshold
        const isCurrentSnap = currentSnapRef.current &&
          currentSnapRef.current.objectId === obj.id &&
          currentSnapRef.current.port === closest.port;

        const threshold = isCurrentSnap ? SNAP_EXIT_PX : SNAP_ENTRY_PX;

        if (screenDist <= threshold) {
          snapTarget = { objectId: obj.id, port: closest.port };
          break;
        }
      }

      // Update hysteresis state
      currentSnapRef.current = snapTarget;

      // Update connector position
      const updates = {};
      if (snapTarget) {
        const targetObj = objects.find(o => o.id === snapTarget.objectId);
        const toPos = getPortPosition(targetObj, snapTarget.port);
        if (toPos) {
          updates.toObjectId = snapTarget.objectId;
          updates.toPort = snapTarget.port;
          updates.x2 = toPos.x;
          updates.y2 = toPos.y;
        }
      } else {
        updates.toObjectId = null;
        updates.toPort = null;
        updates.x2 = worldPos.x;
        updates.y2 = worldPos.y;
      }

      const command = new UpdateStyleCommand(connectorId, updates);
      executeLocalCommand(command);

      cm.requestRender();
      updateCanvasState();
      return true;
    }

    // Legacy draft logic (shouldn't be reached with new behavior)
    return false;
  }, [canvasManagerRef, executeLocalCommand, updateCanvasState]);

  // ─── Pointer-up: finalize connector or show suggestion ──────
  const onPointerUp = useCallback((screenX, screenY, clientX, clientY) => {
    if (!isDraggingRef.current) return false;

    const cm = canvasManagerRef.current;
    if (!cm) return false;

    const store = useConnectorStore.getState();
    const worldPos = cm.screenToWorld(screenX, screenY);

    // ── Handle connector drag finalization ──
    if (pendingPortRef.current?.isConnectorDrag) {
      isDraggingRef.current = false;
      const connectorId = pendingPortRef.current.connectorId;
      pendingPortRef.current = null;
      currentSnapRef.current = null;

      const connector = cm.state.objects.find(o => o.id === connectorId);
      if (!connector) return false;

      // If not snapped to anything, show suggestion popup
      if (!connector.toObjectId) {
        store.showSuggestionPopup(
          clientX, clientY,
          worldPos.x, worldPos.y,
          connector.fromObjectId,
          connector.fromPort,
        );
      }
      // If snapped, the connector is already finalized

      cm.requestRender();
      updateCanvasState();
      return true;
    }

    // Legacy logic (shouldn't be reached)
    return false;
  }, [canvasManagerRef, updateCanvasState]);

  // ─── Cancel draft (e.g. on Escape) ───────────────────────────────
  const cancelDraft = useCallback(() => {
    isDraggingRef.current = false;
    isEndpointDragRef.current = false;
    const store = useConnectorStore.getState();

    // If we have a pending connector drag, undo the creation
    if (pendingPortRef.current?.isConnectorDrag) {
      undo();
      updateCanvasState();
    }

    pendingPortRef.current = null;
    currentSnapRef.current = null;
    store.cancelDraft();
    store.hideGhostPreview();
    canvasManagerRef.current?.requestRender();
  }, [canvasManagerRef, undo, updateCanvasState]);

  return {
    updateHover,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    cancelDraft,
    isDragging: () => isDraggingRef.current,
  };
}

/**
 * Hit-test connector/line/arrow endpoints (arrowhead / tail) for endpoint dragging.
 * Connector endpoints are always hit-tested.
 * Line/arrow endpoints are ONLY hit-tested when the object is already selected
 * (this allows first-click to select, second-click on handle to show popup/resize).
 * Returns { connector, endpoint: 'from'|'to' } or null.
 */
function _hitTestConnectorEndpoints(objects, worldPoint, selectedIds = new Set()) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (obj.type === 'connector') {
      // Connector endpoints always checked
    } else if (obj.type === 'line' || obj.type === 'arrow') {
      // Line/arrow: only when already selected
      if (!selectedIds.has(obj.id)) continue;
    } else {
      continue;
    }
    if (typeof obj.x1 !== 'number') continue;

    const dx2 = worldPoint.x - obj.x2;
    const dy2 = worldPoint.y - obj.y2;
    if (Math.sqrt(dx2 * dx2 + dy2 * dy2) <= ENDPOINT_HIT_RADIUS) {
      return { connector: obj, endpoint: 'to' };
    }

    const dx1 = worldPoint.x - obj.x1;
    const dy1 = worldPoint.y - obj.y1;
    if (Math.sqrt(dx1 * dx1 + dy1 * dy1) <= ENDPOINT_HIT_RADIUS) {
      return { connector: obj, endpoint: 'from' };
    }
  }
  return null;
}
/**
 * Compute the ghost-preview arrow tip position (world coords) for a given object + port.
 * Uses the same math as drawGhostPreview in canvasRenderCore.js.
 */
function _getGhostTipPos(obj, fromPort) {
  const portPos = getPortPosition(obj, fromPort);
  if (!portPos) return null;
  const surfPt = getSurfacePoint(obj, fromPort, portPos) || portPos;
  const dir = _GHOST_PORT_DIR[fromPort] || _GHOST_PORT_DIR.right;
  const bounds = ObjectGeometry.getBounds(obj);
  const arrowLen = bounds
    ? Math.max(60, Math.min(Math.max(bounds.width, bounds.height) * 0.5, 150))
    : 60;
  return { tipX: surfPt.x + dir.x * arrowLen, tipY: surfPt.y + dir.y * arrowLen, dir, arrowLen };
}

/**
 * Hit-test the ghost-preview tip area.
 * Returns { sourceObj, tipX, tipY } if the cursor is near the tip, else null.
 */
function _hitTestGhostTip(objects, worldPoint, ghostState) {
  const sourceObj = objects.find(o => o.id === ghostState.fromObjectId);
  if (!sourceObj) return null;
  const tip = _getGhostTipPos(sourceObj, ghostState.fromPort);
  if (!tip) return null;
  const dx = worldPoint.x - tip.tipX;
  const dy = worldPoint.y - tip.tipY;
  if (Math.sqrt(dx * dx + dy * dy) <= GHOST_TIP_HIT_RADIUS) {
    return { sourceObj, tipX: tip.tipX, tipY: tip.tipY };
  }
  return null;
}

/**
 * Auto-generate a connected shape from a ghost preview click.
 * Creates: (1) a new shape at the ghost tip, (2) a connector from source port to that shape.
 */
function _autoGenerateFromGhost(sourceObj, tipX, tipY, fromPort, executeLocalCommand, cm) {
  const srcBounds = ObjectGeometry.getBounds(sourceObj);
  const srcW = Math.max(srcBounds?.width || 120, 40);
  const srcH = Math.max(srcBounds?.height || 90, 40);
  const newId = generateId();

  // Determine the shape type to create (same as source, but use rectangle for non-native types)
  const boxTypes = ['image', 'text', 'sticky', 'emoji', 'drawing', 'connector', 'line', 'arrow'];
  const newType = boxTypes.includes(sourceObj.type) ? 'rectangle' : sourceObj.type;

  let shapeData;
  if (newType === 'circle') {
    const r = Math.min(srcW, srcH) / 2;
    shapeData = { type: 'circle', id: newId, x: tipX, y: tipY, radius: r,
      strokeColor: '#000000', strokeWidth: 2, fillColor: 'transparent' };
  } else if (newType === 'ellipse') {
    shapeData = { type: 'ellipse', id: newId, x: tipX, y: tipY,
      radiusX: srcW / 2, radiusY: srcH / 2,
      strokeColor: '#000000', strokeWidth: 2, fillColor: 'transparent' };
  } else {
    shapeData = { type: newType, id: newId,
      x: tipX - srcW / 2, y: tipY - srcH / 2, width: srcW, height: srcH,
      strokeColor: '#000000', strokeWidth: 2, fillColor: 'transparent' };
  }

  executeLocalCommand(new AddShapeCommand(shapeData));

  // Connector from source port to new shape
  const fromPos = getPortPosition(sourceObj, fromPort);
  if (fromPos) {
    const connectorData = {
      type: 'connector', id: generateId(),
      fromObjectId: sourceObj.id, toObjectId: newId,
      fromPort, toPort: 'left',
      x1: fromPos.x, y1: fromPos.y,
      x2: tipX, y2: tipY,
      strokeColor: '#000000', strokeWidth: 2, opacity: 1.0, lineStyle: 'auto',
    };
    executeLocalCommand(new AddShapeCommand(connectorData));
  }

  // Auto-select the new shape
  cm.setSelection([newId]);
}