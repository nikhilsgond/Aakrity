import { boundsIntersect, pointNearLineSegment } from '../helpers/geometryShared.js';

export const rectangle = {
  getBounds(obj) {
    if (
      typeof obj.x !== 'number' ||
      typeof obj.y !== 'number' ||
      typeof obj.width !== 'number' ||
      typeof obj.height !== 'number'
    ) {
      return null;
    }

    const width = Math.abs(obj.width || 0);
    const height = Math.abs(obj.height || 0);
    const x = obj.width >= 0 ? obj.x : obj.x - width;
    const y = obj.height >= 0 ? obj.y : obj.y - height;

    if (!obj.rotation || Math.abs(obj.rotation) < 0.001) {
      return { x, y, width, height };
    }

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const cos = Math.cos(obj.rotation);
    const sin = Math.sin(obj.rotation);

    const corners = [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];

    const rotated = corners.map((corner) => {
      const dx = corner.x - centerX;
      const dy = corner.y - centerY;
      return {
        x: centerX + dx * cos - dy * sin,
        y: centerY + dx * sin + dy * cos,
      };
    });

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    rotated.forEach((corner) => {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    });

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  },

  hitTest(point, obj, tolerance = 0) {
    if (!obj.rotation || Math.abs(obj.rotation) < 0.001) {
      const bounds = rectangle.getBounds(obj);
      if (!bounds) return false;
      return (
        point.x >= bounds.x - tolerance &&
        point.x <= bounds.x + bounds.width + tolerance &&
        point.y >= bounds.y - tolerance &&
        point.y <= bounds.y + bounds.height + tolerance
      );
    }

    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;
    const cos = Math.cos(-obj.rotation);
    const sin = Math.sin(-obj.rotation);
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const localX = centerX + dx * cos - dy * sin;
    const localY = centerY + dx * sin + dy * cos;

    return (
      localX >= obj.x - tolerance &&
      localX <= obj.x + obj.width + tolerance &&
      localY >= obj.y - tolerance &&
      localY <= obj.y + obj.height + tolerance
    );
  },

  intersectsRect(obj, rect) {
    const bounds = rectangle.getBounds(obj);
    if (!bounds) return false;
    return boundsIntersect(bounds, rect);
  },
};

export const circle = {
  getBounds(obj) {
    if (typeof obj.x !== 'number' || typeof obj.y !== 'number' || typeof obj.radius !== 'number') {
      return null;
    }
    return {
      x: obj.x - obj.radius,
      y: obj.y - obj.radius,
      width: obj.radius * 2,
      height: obj.radius * 2,
    };
  },

  hitTest(point, obj, tolerance = 0) {
    if (typeof obj.x !== 'number' || typeof obj.y !== 'number' || typeof obj.radius !== 'number') {
      return false;
    }
    const dx = point.x - obj.x;
    const dy = point.y - obj.y;
    return Math.sqrt(dx * dx + dy * dy) <= obj.radius + tolerance;
  },

  intersectsRect(obj, rect) {
    const bounds = circle.getBounds(obj);
    if (!bounds) return false;
    return boundsIntersect(bounds, rect);
  },
};

export const line = {
  getBounds(obj) {
    if (
      typeof obj.x1 !== 'number' ||
      typeof obj.y1 !== 'number' ||
      typeof obj.x2 !== 'number' ||
      typeof obj.y2 !== 'number'
    ) {
      return null;
    }
    return {
      x: Math.min(obj.x1, obj.x2),
      y: Math.min(obj.y1, obj.y2),
      width: Math.abs(obj.x2 - obj.x1),
      height: Math.abs(obj.y2 - obj.y1),
    };
  },

  hitTest(point, obj, tolerance = 0) {
    return pointNearLineSegment(point, obj, tolerance);
  },

  intersectsRect(obj, rect) {
    const bounds = line.getBounds(obj);
    if (!bounds) return false;
    return boundsIntersect(bounds, rect);
  },
};

export const roundedRectangle = {
  getBounds(obj) {
    if (
      typeof obj.x !== 'number' ||
      typeof obj.y !== 'number' ||
      typeof obj.width !== 'number' ||
      typeof obj.height !== 'number'
    ) {
      return null;
    }
    return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
  },

  hitTest(point, obj, tolerance = 0) {
    if (!obj.rotation || Math.abs(obj.rotation) < 0.001) {
      const bounds = roundedRectangle.getBounds(obj);
      if (!bounds) return false;
      return (
        point.x >= bounds.x - tolerance &&
        point.x <= bounds.x + bounds.width + tolerance &&
        point.y >= bounds.y - tolerance &&
        point.y <= bounds.y + bounds.height + tolerance
      );
    }

    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;
    const cos = Math.cos(-obj.rotation);
    const sin = Math.sin(-obj.rotation);
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const localX = centerX + dx * cos - dy * sin;
    const localY = centerY + dx * sin + dy * cos;

    return (
      localX >= obj.x - tolerance &&
      localX <= obj.x + obj.width + tolerance &&
      localY >= obj.y - tolerance &&
      localY <= obj.y + obj.height + tolerance
    );
  },

  intersectsRect(obj, rect) {
    const bounds = roundedRectangle.getBounds(obj);
    if (!bounds) return false;
    return boundsIntersect(bounds, rect);
  },
};

export const image = {
  getBounds(obj) {
    if (
      typeof obj.x !== 'number' ||
      typeof obj.y !== 'number' ||
      typeof obj.width !== 'number' ||
      typeof obj.height !== 'number'
    ) {
      return null;
    }

    const width = Math.max(1, Math.abs(obj.width));
    const height = Math.max(1, Math.abs(obj.height));
    const x = obj.width >= 0 ? obj.x : obj.x - width;
    const y = obj.height >= 0 ? obj.y : obj.y - height;
    const border = Math.max(0, obj.borderWidth || 0) / 2;

    return {
      x: x - border,
      y: y - border,
      width: width + border * 2,
      height: height + border * 2,
    };
  },

  hitTest(point, obj, tolerance = 0) {
    const bounds = image.getBounds(obj);
    if (!bounds) return false;
    return (
      point.x >= bounds.x - tolerance &&
      point.x <= bounds.x + bounds.width + tolerance &&
      point.y >= bounds.y - tolerance &&
      point.y <= bounds.y + bounds.height + tolerance
    );
  },

  intersectsRect(obj, rect) {
    const bounds = image.getBounds(obj);
    if (!bounds) return false;
    return boundsIntersect(bounds, rect);
  },
};

export const ellipse = {
  getBounds(obj) {
    if (
      typeof obj.x !== 'number' ||
      typeof obj.y !== 'number' ||
      typeof obj.radiusX !== 'number' ||
      typeof obj.radiusY !== 'number'
    ) {
      return null;
    }
    return {
      x: obj.x - obj.radiusX,
      y: obj.y - obj.radiusY,
      width: obj.radiusX * 2,
      height: obj.radiusY * 2,
    };
  },

  hitTest(point, obj, tolerance = 0) {
    if (
      typeof obj.x !== 'number' ||
      typeof obj.y !== 'number' ||
      typeof obj.radiusX !== 'number' ||
      typeof obj.radiusY !== 'number'
    ) {
      return false;
    }

    const dx = point.x - obj.x;
    const dy = point.y - obj.y;
    const normalized =
      (dx * dx) / (obj.radiusX * obj.radiusX) + (dy * dy) / (obj.radiusY * obj.radiusY);
    return normalized <= 1 + tolerance / Math.min(obj.radiusX, obj.radiusY);
  },

  intersectsRect(obj, rect) {
    const bounds = ellipse.getBounds(obj);
    if (!bounds) return false;
    return boundsIntersect(bounds, rect);
  },
};

export const arrow = {
  getBounds(obj) {
    if (
      typeof obj.x1 !== 'number' ||
      typeof obj.y1 !== 'number' ||
      typeof obj.x2 !== 'number' ||
      typeof obj.y2 !== 'number'
    ) {
      return null;
    }
    const arrowSize = obj.arrowSize || 10;
    const padding = arrowSize * 1.5;
    return {
      x: Math.min(obj.x1, obj.x2) - padding,
      y: Math.min(obj.y1, obj.y2) - padding,
      width: Math.abs(obj.x2 - obj.x1) + padding * 2,
      height: Math.abs(obj.y2 - obj.y1) + padding * 2,
    };
  },

  hitTest(point, obj, tolerance = 0) {
    if (pointNearLineSegment(point, obj, tolerance)) return true;

    const arrowSize = obj.arrowSize || 10;
    const dx = obj.x2 - obj.x1;
    const dy = obj.y2 - obj.y1;
    const angle = Math.atan2(dy, dx);
    const arrowAngle = Math.PI / 6;
    const arrowPoints = [
      { x: obj.x2, y: obj.y2 },
      {
        x: obj.x2 - arrowSize * Math.cos(angle - arrowAngle),
        y: obj.y2 - arrowSize * Math.sin(angle - arrowAngle),
      },
      {
        x: obj.x2 - arrowSize * Math.cos(angle + arrowAngle),
        y: obj.y2 - arrowSize * Math.sin(angle + arrowAngle),
      },
    ];

    for (let i = 0; i < arrowPoints.length; i += 1) {
      const p1 = arrowPoints[i];
      const p2 = arrowPoints[(i + 1) % arrowPoints.length];
      if (pointNearLineSegment(point, { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }, tolerance)) {
        return true;
      }
    }
    return false;
  },

  intersectsRect(obj, rect) {
    const bounds = arrow.getBounds(obj);
    if (!bounds) return false;
    return boundsIntersect(bounds, rect);
  },
};
