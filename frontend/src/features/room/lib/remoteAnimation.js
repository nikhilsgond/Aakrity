const remoteAnimations = new Map();

/**
 * Cancel any running remote animation for the given object id.
 */
export function cancelRemoteAnimation(objectId) {
  if (remoteAnimations.has(objectId)) {
    cancelAnimationFrame(remoteAnimations.get(objectId));
    remoteAnimations.delete(objectId);
  }
}

export function smoothMove(obj, targetProps, canvasManager, duration = 100) {
  if (!obj || !targetProps || Object.keys(targetProps).length === 0) return;
  const key = obj.id;
  const startTime = performance.now();
  const initial = {};
  let hasAnyDiff = false;

  Object.keys(targetProps).forEach((k) => {
    if (Array.isArray(obj[k])) {
      initial[k] = obj[k].map((p) => ({ ...p }));
      if (!hasAnyDiff) {
        const end = targetProps[k];
        hasAnyDiff = JSON.stringify(initial[k]) !== JSON.stringify(end);
      }
    } else {
      initial[k] = obj[k] !== undefined ? obj[k] : 0;
      if (!hasAnyDiff) {
        hasAnyDiff = initial[k] !== targetProps[k];
      }
    }
  });

  if (!hasAnyDiff) return;

  // Linear interpolation for short bridge durations (≤50ms).
  // EaseOut causes overshoot when cancelled mid-animation; linear is safe.
  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);

    Object.keys(targetProps).forEach((k) => {
      const start = initial[k];
      const end = targetProps[k];
      if (Array.isArray(end) && Array.isArray(start)) {
        const pts = [];
        for (let i = 0; i < end.length; i++) {
          const s = start[i] || { x: 0, y: 0 };
          const e = end[i] || { x: 0, y: 0 };
          pts.push({
            x: s.x + (e.x - s.x) * t,
            y: s.y + (e.y - s.y) * t,
          });
        }
        obj[k] = pts;
      } else {
        obj[k] = start + (end - start) * t;
      }
    });

    canvasManager.requestRender();
    if (t < 1) {
      remoteAnimations.set(key, requestAnimationFrame(step));
    } else {
      remoteAnimations.delete(key);
    }
  }

  if (remoteAnimations.has(key)) {
    cancelAnimationFrame(remoteAnimations.get(key));
  }
  requestAnimationFrame(step);
}

/**
 * Animate a newly-created remote object scaling up from center.
 * Reuses smoothMove internally so the same easing / cancellation logic applies.
 */
export function smoothAppear(obj, canvasManager, duration = 150) {
  if (!obj) return;

  const SCALE = 0.3;
  const type = obj.type;

  // ── Circle ─────────────────────────────────────────────
  if (type === 'circle' && obj.radius != null) {
    const targetR = obj.radius;
    obj.radius = targetR * SCALE;
    canvasManager.requestRender();
    smoothMove(obj, { radius: targetR }, canvasManager, duration);
    return;
  }

  // ── Ellipse ────────────────────────────────────────────
  if (type === 'ellipse' && obj.radiusX != null && obj.radiusY != null) {
    const targetRX = obj.radiusX;
    const targetRY = obj.radiusY;
    obj.radiusX = targetRX * SCALE;
    obj.radiusY = targetRY * SCALE;
    canvasManager.requestRender();
    smoothMove(obj, { radiusX: targetRX, radiusY: targetRY }, canvasManager, duration);
    return;
  }

  // ── Line / Arrow ───────────────────────────────────────
  if ((type === 'line' || type === 'arrow') && obj.x1 != null) {
    const mx = (obj.x1 + obj.x2) / 2;
    const my = (obj.y1 + obj.y2) / 2;
    const target = { x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2 };
    obj.x1 = mx + (obj.x1 - mx) * SCALE;
    obj.y1 = my + (obj.y1 - my) * SCALE;
    obj.x2 = mx + (obj.x2 - mx) * SCALE;
    obj.y2 = my + (obj.y2 - my) * SCALE;
    canvasManager.requestRender();
    smoothMove(obj, target, canvasManager, duration);
    return;
  }

  // ── Polygon-based (triangle, diamond, hexagon, pentagon, star, polygon) ─
  if (Array.isArray(obj.points) && obj.points.length > 0 && obj.points[0].x != null) {
    const cx = obj.points.reduce((s, p) => s + p.x, 0) / obj.points.length;
    const cy = obj.points.reduce((s, p) => s + p.y, 0) / obj.points.length;
    const targetPoints = obj.points.map(p => ({ ...p }));
    obj.points = obj.points.map(p => ({
      x: cx + (p.x - cx) * SCALE,
      y: cy + (p.y - cy) * SCALE,
    }));
    canvasManager.requestRender();
    smoothMove(obj, { points: targetPoints }, canvasManager, duration);
    return;
  }

  // ── Rect-like (rectangle, text, image, emoji, sticky, rounded rect) ────
  const targetW = obj.width;
  const targetH = obj.height;
  const targetX = obj.x;
  const targetY = obj.y;

  if (targetW == null || targetH == null || targetX == null || targetY == null) return;

  obj.width  = targetW * SCALE;
  obj.height = targetH * SCALE;
  obj.x = targetX + (targetW - obj.width) / 2;
  obj.y = targetY + (targetH - obj.height) / 2;

  canvasManager.requestRender();
  smoothMove(obj, { x: targetX, y: targetY, width: targetW, height: targetH }, canvasManager, duration);
}
