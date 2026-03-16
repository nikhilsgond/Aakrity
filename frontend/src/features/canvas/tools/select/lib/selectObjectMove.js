const XY_TYPES = new Set([
  'rectangle',
  'roundedRectangle',
  'circle',
  'ellipse',
  'text',
  'image',
  'emoji',
  'sticky',
]);

const LINE_TYPES = new Set(['line', 'arrow']);

const POINT_COLLECTION_TYPES = new Set([
  'triangle',
  'polygon',
  'diamond',
  'star',
  'hexagon',
  'pentagon',
  'drawing',
]);

// Resolve the effective type for routing: shape objects use shapeType
function effectiveType(obj) {
  return (obj.type === 'shape' && obj.shapeType) ? obj.shapeType : obj.type;
}

export function captureInitialPosition(obj) {
  if (!obj || !obj.type) return null;

  const t = effectiveType(obj);

  if (XY_TYPES.has(t)) {
    return { x: obj.x, y: obj.y, width: obj.width, height: obj.height, radius: obj.radius, radiusX: obj.radiusX, radiusY: obj.radiusY };
  }

  if (LINE_TYPES.has(t)) {
    return { x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2 };
  }

  if (POINT_COLLECTION_TYPES.has(t)) {
    return { points: obj.points ? obj.points.map(p => ({ ...p })) : [] };
  }

  return null;
}

export function applyMoveFromInitial(obj, initialPosition, deltaX, deltaY) {
  if (!obj || !initialPosition || !obj.type) return;

  const t = effectiveType(obj);

  if (XY_TYPES.has(t)) {
    obj.x = initialPosition.x + deltaX;
    obj.y = initialPosition.y + deltaY;
    return;
  }

  if (LINE_TYPES.has(t)) {
    obj.x1 = initialPosition.x1 + deltaX;
    obj.y1 = initialPosition.y1 + deltaY;
    obj.x2 = initialPosition.x2 + deltaX;
    obj.y2 = initialPosition.y2 + deltaY;
    return;
  }

  if (POINT_COLLECTION_TYPES.has(t) && obj.points && initialPosition.points) {
    obj.points = initialPosition.points.map((point) => {
      if (t === 'drawing') {
        return { ...point, x: point.x + deltaX, y: point.y + deltaY };
      }
      return { x: point.x + deltaX, y: point.y + deltaY };
    });
  }
}
