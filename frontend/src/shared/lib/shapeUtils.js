// src/shared/lib/shapeUtils.js
export const CONNECTABLE_TYPES = new Set([
  'rectangle', 'roundedRectangle', 'circle', 'ellipse',
  'triangle', 'diamond', 'star', 'hexagon', 'pentagon', 'polygon',
  'text', 'image', 'emoji', 'sticky',
]);

export function isConnectable(objOrType) {
  if (!objOrType) return false;
  const type = typeof objOrType === 'string' ? objOrType : objOrType.type;
  return CONNECTABLE_TYPES.has(type);
}

export default isConnectable;
