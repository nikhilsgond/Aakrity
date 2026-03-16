const POINT_EPSILON = 0.01;
const SEGMENT_LENGTH_EPSILON = 0.5;

export function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }

  if (value && typeof value === "object") {
    const cloned = {};
    Object.keys(value).forEach((key) => {
      if (key.startsWith("_")) return;
      if (key === "imageElement") return;
      const next = value[key];
      if (typeof next === "function") return;
      cloned[key] = cloneValue(next);
    });
    return cloned;
  }

  return value;
}

export function cloneCanvasObject(obj) {
  return cloneValue(obj);
}

export function distance(a, b) {
  const dx = (a?.x || 0) - (b?.x || 0);
  const dy = (a?.y || 0) - (b?.y || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

export function pointsClose(a, b, epsilon = POINT_EPSILON) {
  return distance(a, b) <= epsilon;
}

function pointInsideCircle(point, center, radiusSq) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return dx * dx + dy * dy <= radiusSq;
}

function lerpNumber(a, b, t) {
  if (typeof a !== "number" && typeof b !== "number") return undefined;
  const start = typeof a === "number" ? a : b;
  const end = typeof b === "number" ? b : a;
  return start + (end - start) * t;
}

function lerpPoint(a, b, t) {
  const point = {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };

  const pressure = lerpNumber(a.pressure, b.pressure, t);
  if (pressure !== undefined) point.pressure = pressure;

  const timestamp = lerpNumber(a.timestamp, b.timestamp, t);
  if (timestamp !== undefined) point.timestamp = timestamp;

  return point;
}

function lineCircleIntersections(a, b, center, radiusSq) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= POINT_EPSILON) return [];

  const fx = a.x - center.x;
  const fy = a.y - center.y;

  const A = lenSq;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - radiusSq;
  const discriminant = B * B - 4 * A * C;

  if (discriminant < 0) return [];

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-B - sqrtDisc) / (2 * A);
  const t2 = (-B + sqrtDisc) / (2 * A);
  const result = [];

  [t1, t2].forEach((t) => {
    if (t > POINT_EPSILON && t < 1 - POINT_EPSILON) {
      if (!result.some((v) => Math.abs(v - t) <= POINT_EPSILON)) {
        result.push(t);
      }
    }
  });

  result.sort((lhs, rhs) => lhs - rhs);
  return result;
}

function getSegmentOutsidePieces(a, b, center, radiusSq) {
  const intersections = lineCircleIntersections(a, b, center, radiusSq);
  const cuts = [0, ...intersections, 1];
  const pieces = [];

  for (let i = 0; i < cuts.length - 1; i += 1) {
    const startT = cuts[i];
    const endT = cuts[i + 1];
    if (endT - startT <= POINT_EPSILON) continue;

    const midPoint = lerpPoint(a, b, (startT + endT) / 2);
    if (pointInsideCircle(midPoint, center, radiusSq)) continue;

    const startPoint = lerpPoint(a, b, startT);
    const endPoint = lerpPoint(a, b, endT);
    if (distance(startPoint, endPoint) <= POINT_EPSILON) continue;

    pieces.push([startPoint, endPoint]);
  }

  return pieces;
}

function finalizeSegments(rawSegments) {
  const finalized = [];

  rawSegments.forEach((segment) => {
    if (!Array.isArray(segment) || segment.length < 2) return;
    const cleaned = [segment[0]];
    for (let i = 1; i < segment.length; i += 1) {
      const point = segment[i];
      if (!point) continue;
      if (!pointsClose(cleaned[cleaned.length - 1], point)) {
        cleaned.push(point);
      }
    }

    if (cleaned.length < 2) return;

    let totalLength = 0;
    for (let i = 0; i < cleaned.length - 1; i += 1) {
      totalLength += distance(cleaned[i], cleaned[i + 1]);
    }
    if (totalLength < SEGMENT_LENGTH_EPSILON) return;

    finalized.push(cleaned);
  });

  return finalized;
}

export function splitPolylineByCircle(points, center, radius) {
  if (!Array.isArray(points) || points.length < 2) return [];

  const radiusSq = radius * radius;
  const rawSegments = [];
  let current = null;

  const appendPiece = ([start, end]) => {
    if (!current) {
      current = [start, end];
      rawSegments.push(current);
      return;
    }

    const last = current[current.length - 1];
    if (pointsClose(last, start)) {
      if (!pointsClose(last, end)) {
        current.push(end);
      }
      return;
    }

    current = [start, end];
    rawSegments.push(current);
  };

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;

    const outsidePieces = getSegmentOutsidePieces(a, b, center, radiusSq);
    if (outsidePieces.length === 0) {
      current = null;
      continue;
    }

    outsidePieces.forEach((piece) => appendPiece(piece));
  }

  return finalizeSegments(rawSegments);
}

export function circleIntersectsBounds(center, radius, bounds) {
  if (!bounds) return false;

  const nearestX = Math.max(bounds.x, Math.min(center.x, bounds.x + bounds.width));
  const nearestY = Math.max(bounds.y, Math.min(center.y, bounds.y + bounds.height));

  const dx = center.x - nearestX;
  const dy = center.y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

export function pointsEquivalent(lhs = [], rhs = []) {
  if (!Array.isArray(lhs) || !Array.isArray(rhs)) return false;
  if (lhs.length !== rhs.length) return false;
  for (let i = 0; i < lhs.length; i += 1) {
    const a = lhs[i];
    const b = rhs[i];
    if (!a || !b) return false;
    if (Math.abs(a.x - b.x) > POINT_EPSILON) return false;
    if (Math.abs(a.y - b.y) > POINT_EPSILON) return false;
  }
  return true;
}
