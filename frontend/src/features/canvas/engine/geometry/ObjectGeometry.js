import { computeOBBFromRect } from './helpers/geometryShared.js';
import {
  rectangle,
  circle,
  line,
  roundedRectangle,
  ellipse,
  arrow,
  image,
} from './handlers/primitivesHandlers.js';
import { drawing, text, triangle, polygon } from './handlers/complexHandlers.js';

const SHAPE_HANDLERS = {
  rectangle,
  roundedRectangle,
  emoji: rectangle,
  sticky: rectangle,
  circle,
  ellipse,
  image,
  line,
  arrow,
  triangle,
  diamond: polygon,
  star: polygon,
  hexagon: polygon,
  pentagon: polygon,
  polygon,
  drawing,
  text,
};

function getOBB(obj) {
  if (!obj || !obj.shapeType) return null;

  if (obj.shapeType === 'rectangle' || obj.shapeType === 'text' || obj.shapeType === 'sticky') {
    return computeOBBFromRect(obj);
  }

  const bounds = SHAPE_HANDLERS[obj.shapeType]?.getBounds(obj);
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

export default {
  getBounds(obj) {
    if (!obj || !obj.type) return null;
    // 'shape' objects store the concrete type in shapeType; all others use type directly
    const key = (obj.type === 'shape' && obj.shapeType) ? obj.shapeType : obj.type;
    const handler = SHAPE_HANDLERS[key];
    if (!handler) return null;
    return handler.getBounds(obj);
  },

  hitTest(point, obj, tolerance = 0) {
    if (!obj || !obj.type || !point) return false;
    const key = (obj.type === 'shape' && obj.shapeType) ? obj.shapeType : obj.type;
    const handler = SHAPE_HANDLERS[key];
    if (!handler) return false;
    return handler.hitTest(point, obj, tolerance);
  },

  intersectsRect(obj, rect) {
    if (!obj || !obj.type || !rect) return false;
    const key = (obj.type === 'shape' && obj.shapeType) ? obj.shapeType : obj.type;
    const handler = SHAPE_HANDLERS[key];
    if (!handler) return false;
    return handler.intersectsRect(obj, rect);
  },

  registerShape(type, handler) {
    if (handler && handler.getBounds && handler.hitTest && handler.intersectsRect) {
      SHAPE_HANDLERS[type] = handler;
    } else {
      console.warn(`ObjectGeometry: Invalid handler for shape type "${type}"`);
    }
  },

  getOBB(obj) {
    return getOBB(obj);
  },
};
