export function isTransformBlockedByTool(activeTool) {
  // precision-eraser and object-eraser must not be blocked by transform or move
  const drawingTools = ['pencil', 'eraser', 'precision-eraser', 'object-eraser', 'fill'];
  return !!(activeTool && drawingTools.includes(activeTool.name));
}

export function buildObjectSnapshot(obj) {
  const snapshot = { id: obj.id };
  if (obj.x !== undefined) snapshot.x = obj.x;
  if (obj.y !== undefined) snapshot.y = obj.y;
  if (obj.width !== undefined) snapshot.width = obj.width;
  if (obj.height !== undefined) snapshot.height = obj.height;
  if (obj.rotation !== undefined) snapshot.rotation = obj.rotation;
  if (obj.radiusX !== undefined) snapshot.radiusX = obj.radiusX;
  if (obj.radiusY !== undefined) snapshot.radiusY = obj.radiusY;
  if (obj.radius !== undefined) snapshot.radius = obj.radius;
  if (obj.x1 !== undefined) snapshot.x1 = obj.x1;
  if (obj.y1 !== undefined) snapshot.y1 = obj.y1;
  if (obj.x2 !== undefined) snapshot.x2 = obj.x2;
  if (obj.y2 !== undefined) snapshot.y2 = obj.y2;
  if (Array.isArray(obj.points)) {
    snapshot.points = obj.points.map((point) => ({ ...point }));
  }
  return snapshot;
}

export function buildTransformStates(canvas, objectIds) {
  return objectIds
    .map((id) => {
      const obj = canvas.state.objects.find((item) => item.id === id);
      if (!obj) return null;
      return buildObjectSnapshot(obj);
    })
    .filter(Boolean);
}

export function updateLineArrowEndpoint(controller, currentPoint) {
  if (controller.objectIds.length !== 1) return;

  const obj = controller.canvas.getObjectById(controller.objectIds[0]);
  const effectiveType = obj?.type === 'shape' ? obj.shapeType : obj?.type;
  // Bug #24: also allow line/arrow endpoint dragging via transform handles
  if (!obj || (effectiveType !== 'line' && effectiveType !== 'arrow')) return;

  if (controller.lineEndpointDragging === 'start') {
    obj.x1 = currentPoint.x;
    obj.y1 = currentPoint.y;
    // Detach from source object when manually repositioned (lines/arrows have no attachments)
  } else if (controller.lineEndpointDragging === 'end') {
    obj.x2 = currentPoint.x;
    obj.y2 = currentPoint.y;
    // Detach from target object when manually repositioned (lines/arrows have no attachments)
  }

  controller.canvas.requestRender();
  controller.hasMovedSignificantly = true;

  controller.canvas.emit('move:update', {
    objectIds: [obj.id],
    delta: { x: 0, y: 0 },
    positions: [buildObjectSnapshot(obj)],
  });
}

export function updateCircleResize(controller, currentPoint) {
  const circle = controller.canvas.getObjectById(controller.objectIds[0]);
  if (!circle) return;

  const centerX = circle.x;
  const centerY = circle.y;
  const startRadius = circle.radius || 0;
  let newRadius = startRadius;

  const bounds = controller.startBounds;
  const handleX = controller.getHandleWorldX(controller.activeHandle, bounds);
  const handleY = controller.getHandleWorldY(controller.activeHandle, bounds);

  const handleVectorX = handleX - centerX;
  const handleVectorY = handleY - centerY;
  const handleDistance = Math.sqrt(handleVectorX * handleVectorX + handleVectorY * handleVectorY);

  if (handleDistance > 0) {
    const normalizedX = handleVectorX / handleDistance;
    const normalizedY = handleVectorY / handleDistance;
    const mouseVectorX = currentPoint.x - centerX;
    const mouseVectorY = currentPoint.y - centerY;
    const projection = mouseVectorX * normalizedX + mouseVectorY * normalizedY;
    newRadius = Math.abs(projection);
  }

  circle.radius = Math.max(0.1, newRadius);
  controller.canvas.requestRender();
}

function getEllipseAnchor(initial, handle) {
  let anchorX = initial.x;
  let anchorY = initial.y;

  switch (handle) {
    case 'tl':
    case 'nw':
      anchorX = initial.x + initial.radiusX;
      anchorY = initial.y + initial.radiusY;
      break;
    case 'tr':
    case 'ne':
      anchorX = initial.x - initial.radiusX;
      anchorY = initial.y + initial.radiusY;
      break;
    case 'bl':
    case 'sw':
      anchorX = initial.x + initial.radiusX;
      anchorY = initial.y - initial.radiusY;
      break;
    case 'br':
    case 'se':
      anchorX = initial.x - initial.radiusX;
      anchorY = initial.y - initial.radiusY;
      break;
    case 't':
    case 'n':
      anchorX = initial.x;
      anchorY = initial.y + initial.radiusY;
      break;
    case 'b':
    case 's':
      anchorX = initial.x;
      anchorY = initial.y - initial.radiusY;
      break;
    case 'l':
    case 'w':
      anchorX = initial.x + initial.radiusX;
      anchorY = initial.y;
      break;
    case 'r':
    case 'e':
      anchorX = initial.x - initial.radiusX;
      anchorY = initial.y;
      break;
  }

  return { anchorX, anchorY };
}

export function updateEllipseResize(controller, currentPoint) {
  const ellipse = controller.canvas.getObjectById(controller.objectIds[0]);
  if (!ellipse || !controller.initialEllipseState) return;

  const initial = controller.initialEllipseState;
  const handle = controller.activeHandle;
  const { anchorX, anchorY } = getEllipseAnchor(initial, handle);

  const deltaX = currentPoint.x - anchorX;
  const deltaY = currentPoint.y - anchorY;

  let newRadiusX = initial.radiusX;
  let newRadiusY = initial.radiusY;
  let newCenterX = initial.x;
  let newCenterY = initial.y;

  switch (handle) {
    case 'tl':
    case 'nw':
    case 'tr':
    case 'ne':
    case 'bl':
    case 'sw':
    case 'br':
    case 'se':
      newRadiusX = Math.abs(deltaX) / 2;
      newRadiusY = Math.abs(deltaY) / 2;
      newCenterX = anchorX + deltaX / 2;
      newCenterY = anchorY + deltaY / 2;
      if (controller.modifiers.shift) {
        const aspectRatio = initial.radiusY / initial.radiusX;
        const avgRadius = Math.sqrt(newRadiusX * newRadiusX + newRadiusY * newRadiusY) / Math.sqrt(2);
        newRadiusX = avgRadius;
        newRadiusY = avgRadius * aspectRatio;
      }
      break;
    case 't':
    case 'n':
    case 'b':
    case 's':
      newRadiusY = Math.abs(deltaY) / 2;
      newCenterY = anchorY + deltaY / 2;
      break;
    case 'l':
    case 'w':
    case 'r':
    case 'e':
      newRadiusX = Math.abs(deltaX) / 2;
      newCenterX = anchorX + deltaX / 2;
      break;
  }

  ellipse.x = newCenterX;
  ellipse.y = newCenterY;
  ellipse.radiusX = Math.max(0.1, newRadiusX);
  ellipse.radiusY = Math.max(0.1, newRadiusY);
  controller.canvas.requestRender();
}
