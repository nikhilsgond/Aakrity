import {
  boundsIntersect,
  getBoundsFromPoints,
  pointNearLineSegment,
} from '../helpers/geometryShared.js';

function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function ccw(a, b, c) {
  return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a, b, c, d) {
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

function triangleIntersectsRect(points, rect) {
  const rectPts = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];

  // Any triangle vertex inside rectangle
  if (points.some((p) => pointInRect(p, rect))) return true;

  // Any rectangle corner inside triangle
  if (rectPts.some((p) => triangle.hitTest(p, { points }, 0))) return true;

  // Any edge crossing
  const triEdges = [
    [points[0], points[1]],
    [points[1], points[2]],
    [points[2], points[0]],
  ];
  const rectEdges = [
    [rectPts[0], rectPts[1]],
    [rectPts[1], rectPts[2]],
    [rectPts[2], rectPts[3]],
    [rectPts[3], rectPts[0]],
  ];

  for (const [a, b] of triEdges) {
    for (const [c, d] of rectEdges) {
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }

  return false;
}

export const drawing = {
  getBounds(obj) {
    if (!obj.points || !Array.isArray(obj.points) || obj.points.length === 0) {
      return null;
    }

    if (obj._cachedBounds && obj._boundsVersion === obj._pointsVersion) {
      return obj._cachedBounds;
    }

    const rawBounds = getBoundsFromPoints(obj.points);
    if (!rawBounds) return null;

    const strokeWidth = obj.strokeWidth || 2;
    const bounds = {
      x: rawBounds.x - strokeWidth / 2,
      y: rawBounds.y - strokeWidth / 2,
      width: rawBounds.width + strokeWidth,
      height: rawBounds.height + strokeWidth,
    };

    obj._cachedBounds = bounds;
    obj._boundsVersion = obj._pointsVersion || 0;
    return bounds;
  },

  hitTest(point, obj, tolerance = 0) {
    if (!obj.points || !Array.isArray(obj.points) || obj.points.length < 2) {
      return false;
    }

    for (let i = 0; i < obj.points.length - 1; i += 1) {
      const p1 = obj.points[i];
      const p2 = obj.points[i + 1];
      if (
        typeof p1.x !== 'number' ||
        typeof p1.y !== 'number' ||
        typeof p2.x !== 'number' ||
        typeof p2.y !== 'number'
      ) {
        continue;
      }

      if (pointNearLineSegment(point, { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }, tolerance)) {
        return true;
      }
    }

    return false;
  },

  intersectsRect(obj, rect) {
    const bounds = drawing.getBounds(obj);
    if (!bounds) return false;
    return boundsIntersect(bounds, rect);
  },
};

export const text = {
  getBounds(obj) {
    if (typeof obj.x !== 'number' || typeof obj.y !== 'number') return null;

    const fontSize = obj.fontSize || 16;
    const fontFamily = obj.fontFamily || 'Arial, sans-serif';
    const fontWeight = obj.fontWeight || 'normal';
    const fontStyle = obj.fontStyle || 'normal';
    const textAlign = obj.textAlign || 'left';
    const listType = obj.listType || 'none';

    // If the object already has stored width/height (set by updateTextDimensions
    // or resize), use those directly so bounds match the transform handles.
    if (obj.width > 0 && obj.height > 0) {
      // Use the stored position and dimensions directly — alignment offsets
      // are handled by the renderer, not by bounds calculation.
      return {
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
      };
    }

    const displayText =
      obj.text && obj.text.length > 0 ? obj.text : obj.placeholder || 'Type something...';

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = `${fontWeight} ${fontStyle} ${fontSize}px ${fontFamily}`;

    const lines = displayText.split('\n');
    const lineHeight = fontSize * 1.2;
    const markerSpace = listType !== 'none' ? fontSize * 1.2 : 0;

    let maxWidth = 0;
    lines.forEach((lineText, index) => {
      let lineWidth = tempCtx.measureText(lineText).width;
      if (listType === 'ordered') {
        lineWidth += tempCtx.measureText(`${index + 1}. `).width;
      } else if (listType === 'unordered') {
        lineWidth += markerSpace;
      }
      if (lineWidth > maxWidth) maxWidth = lineWidth;
    });

    const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
    const widthPadding = Math.max(4, fontSize * 0.25);
    const minWidth = Math.max(fontSize * 4, 40);
    const width = Math.max(minWidth, maxWidth + widthPadding * 2);

    let adjustedX = obj.x - widthPadding;
    if (textAlign === 'center') {
      adjustedX = obj.x - maxWidth / 2 - widthPadding;
    } else if (textAlign === 'right') {
      adjustedX = obj.x - maxWidth - widthPadding;
    }

    return {
      x: adjustedX,
      y: obj.y,
      width,
      height: totalHeight + widthPadding * 0.5,
      actualTextWidth: maxWidth,
      actualTextHeight: totalHeight,
    };
  },

  hitTest(point, obj, tolerance = 0) {
    const bounds = text.getBounds(obj);
    if (!bounds) return false;
    return (
      point.x >= bounds.x - tolerance &&
      point.x <= bounds.x + bounds.width + tolerance &&
      point.y >= bounds.y - tolerance &&
      point.y <= bounds.y + bounds.height + tolerance
    );
  },

  intersectsRect(obj, rect) {
    const bounds = text.getBounds(obj);
    if (!bounds) return false;
    return boundsIntersect(bounds, rect);
  },
};

export const triangle = {
  getBounds(obj) {
    if (!obj.points || !Array.isArray(obj.points) || obj.points.length !== 3) {
      return null;
    }
    return getBoundsFromPoints(obj.points);
  },

  hitTest(point, obj, tolerance = 0) {
    if (!obj.points || !Array.isArray(obj.points) || obj.points.length !== 3) {
      return false;
    }

    const p0 = obj.points[0];
    const p1 = obj.points[1];
    const p2 = obj.points[2];

    const area =
      0.5 *
      (-p1.y * p2.x +
        p0.y * (-p1.x + p2.x) +
        p0.x * (p1.y - p2.y) +
        p1.x * p2.y -
        p2.x * p1.y);

    if (Math.abs(area) < 1e-8) return false;

    const s =
      (1 / (2 * area)) *
      (p0.y * p2.x - p0.x * p2.y + (p2.y - p0.y) * point.x + (p0.x - p2.x) * point.y);
    const t =
      (1 / (2 * area)) *
      (p0.x * p1.y - p0.y * p1.x + (p0.y - p1.y) * point.x + (p1.x - p0.x) * point.y);

    const isInside = s >= 0 && t >= 0 && s + t <= 1;
    if (isInside) return true;
    if (tolerance <= 0) return false;

    return (
      pointNearLineSegment(point, { x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y }, tolerance) ||
      pointNearLineSegment(point, { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }, tolerance) ||
      pointNearLineSegment(point, { x1: p2.x, y1: p2.y, x2: p0.x, y2: p0.y }, tolerance)
    );
  },

  intersectsRect(obj, rect) {
    if (!obj.points || !Array.isArray(obj.points) || obj.points.length !== 3) {
      return false;
    }
    return triangleIntersectsRect(obj.points, rect);
  },
};

export const polygon = {
  getBounds(obj) {
    if (!obj.points || !Array.isArray(obj.points) || obj.points.length < 3) {
      return null;
    }
    return getBoundsFromPoints(obj.points);
  },

  hitTest(point, obj, tolerance = 0) {
    if (!obj.points || !Array.isArray(obj.points) || obj.points.length < 3) {
      return false;
    }

    for (let i = 0; i < obj.points.length; i += 1) {
      const p1 = obj.points[i];
      const p2 = obj.points[(i + 1) % obj.points.length];
      if (pointNearLineSegment(point, { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }, tolerance)) {
        return true;
      }
    }

    let inside = false;
    for (let i = 0, j = obj.points.length - 1; i < obj.points.length; j = i, i += 1) {
      const xi = obj.points[i].x;
      const yi = obj.points[i].y;
      const xj = obj.points[j].x;
      const yj = obj.points[j].y;

      const intersects =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }

    return inside;
  },

  intersectsRect(obj, rect) {
    const bounds = polygon.getBounds(obj);
    if (!bounds) return false;
    return boundsIntersect(bounds, rect);
  },
};
