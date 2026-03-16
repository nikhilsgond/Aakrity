import ObjectGeometry from "../geometry/ObjectGeometry.js";

export function getObjectOBB(manager, obj) {
  if (ObjectGeometry.getOBB) {
    return ObjectGeometry.getOBB(obj);
  }

  const bounds = getObjectBounds(manager, obj);
  if (!bounds) return null;

  return {
    corners: [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height },
    ],
    center: {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    },
  };
}

export function getMultipleObjectOBB(manager, ids) {
  if (!ids || ids.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  ids.forEach((id) => {
    const obj = manager.objectsById.get(id);
    if (!obj) return;

    const obb = getObjectOBB(manager, obj);
    if (!obb || !obb.corners) return;

    obb.corners.forEach((corner) => {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    });
  });

  if (minX === Infinity) return null;

  return {
    corners: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    },
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}

export function getObjectsAtPoint(manager, x, y, tolerance = 5) {
  const worldPos = manager.screenToWorld(x, y);
  const results = [];
  
  for (let i = manager.state.objects.length - 1; i >= 0; i--) {
    const obj = manager.state.objects[i];
    const isTriangle =
      (obj?.type === 'shape' && obj?.shapeType === 'triangle') ||
      obj?.type === 'triangle';
    const hitTolerance = isTriangle ? 0 : tolerance;

    if (ObjectGeometry.hitTest(worldPos, obj, hitTolerance)) {
      results.push(obj);
    }
  }

  return results; 
}

export function getObjectBounds(_manager, obj) {
  if (!obj) return null;
  // Shape objects store type='shape' with shapeType='rectangle' etc.
  // ObjectGeometry.getBounds routes by obj.type, so pass a proxy with the right type.
  if (obj.type === 'shape' && obj.shapeType) {
    return ObjectGeometry.getBounds({ ...obj, type: obj.shapeType });
  }
  return ObjectGeometry.getBounds(obj);
}

export function getMultipleObjectBounds(manager, ids) {
  if (!ids || ids.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  console.log("ids:", ids);

  ids.forEach((id) => {
    const obj = manager.objectsById.get(id);
    if (!obj) return;

    const bounds = getObjectBounds(manager, obj);
    if (!bounds) return;

    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });

  if (minX === Infinity) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function isPointInBounds(_manager, point, bounds, tolerance = 0) {
  return (
    point.x >= bounds.x - tolerance &&
    point.x <= bounds.x + bounds.width + tolerance &&
    point.y >= bounds.y - tolerance &&
    point.y <= bounds.y + bounds.height + tolerance
  );
}

export function getObjectsInRect(manager, rect) {
  const results = [];

  manager.state.objects.forEach((obj) => {
    if (ObjectGeometry.intersectsRect(obj, rect)) {
      results.push(obj);
    }
  });

  return results;
}
