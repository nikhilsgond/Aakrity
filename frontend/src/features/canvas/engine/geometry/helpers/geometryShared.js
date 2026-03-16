export function pointNearLineSegment(point, line, tolerance) {
  const { x1, y1, x2, y2 } = line;
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;

  if (l2 === 0) {
    const dx = point.x - x1;
    const dy = point.y - y1;
    return Math.sqrt(dx * dx + dy * dy) <= tolerance;
  }

  let t = ((point.x - x1) * (x2 - x1) + (point.y - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);

  const dx = point.x - projX;
  const dy = point.y - projY;
  return Math.sqrt(dx * dx + dy * dy) <= tolerance;
}

export function boundsIntersect(a, b) {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
}

export function getBoundsFromPoints(points) {
  if (!Array.isArray(points) || points.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    if (typeof point.x !== 'number' || typeof point.y !== 'number') continue;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  if (minX === Infinity) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function computeOBBFromRect(obj) {
  if (!obj.rotation || Math.abs(obj.rotation) < 0.001) {
    return {
      corners: [
        { x: obj.x, y: obj.y },
        { x: obj.x + obj.width, y: obj.y },
        { x: obj.x + obj.width, y: obj.y + obj.height },
        { x: obj.x, y: obj.y + obj.height },
      ],
      center: {
        x: obj.x + obj.width / 2,
        y: obj.y + obj.height / 2,
      },
    };
  }

  const centerX = obj.x + obj.width / 2;
  const centerY = obj.y + obj.height / 2;
  const cos = Math.cos(obj.rotation);
  const sin = Math.sin(obj.rotation);
  const halfW = obj.width / 2;
  const halfH = obj.height / 2;

  const localCorners = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ];

  const corners = localCorners.map((corner) => ({
    x: centerX + corner.x * cos - corner.y * sin,
    y: centerY + corner.x * sin + corner.y * cos,
  }));

  return {
    corners,
    center: { x: centerX, y: centerY },
  };
}
