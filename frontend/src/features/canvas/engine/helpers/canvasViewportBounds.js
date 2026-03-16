export function applyPanBoundaries(manager, targetPanX, targetPanY) {
  const { minX, maxX, minY, maxY } = manager.canvasBounds;
  const zoom = manager.state.viewport.zoom;

  const canvasCSSWidth = manager.container?.clientWidth || 800;
  const canvasCSSHeight = manager.container?.clientHeight || 600;
  const worldWidth = Math.max(0, maxX - minX);
  const worldHeight = Math.max(0, maxY - minY);

  // Compute the pixel sizes of the canvas world at current zoom.
  const scaledWorldW = worldWidth * zoom;
  const scaledWorldH = worldHeight * zoom;

  // The maximum allowed pan (canvas left-edge at viewport left-edge):
  //   panX = -minX * zoom   →  world x=minX maps to screen x=0
  // The minimum allowed pan (canvas right-edge at viewport right-edge):
  //   panX = canvasCSSWidth - maxX * zoom
  //
  // When the scaled world is smaller than the viewport we clamp to the range
  // [minPan, maxPan] which naturally allows the full world to be scrolled past
  // both edges — instead of force-centering, which breaks scrolling at low zoom.

  const maxPanX = -minX * zoom;
  const minPanX = canvasCSSWidth - maxX * zoom;
  const maxPanY = -minY * zoom;
  const minPanY = canvasCSSHeight - maxY * zoom;

  if (scaledWorldW <= canvasCSSWidth) {
    // World fits in viewport: allow panning between portrait-fit limits.
    // Clamp so the world stays within the viewport (with the full world visible).
    targetPanX = Math.max(minPanX, Math.min(maxPanX, targetPanX));
  } else {
    targetPanX = Math.max(minPanX, Math.min(maxPanX, targetPanX));
  }

  if (scaledWorldH <= canvasCSSHeight) {
    targetPanY = Math.max(minPanY, Math.min(maxPanY, targetPanY));
  } else {
    targetPanY = Math.max(minPanY, Math.min(maxPanY, targetPanY));
  }

  return { panX: targetPanX, panY: targetPanY };
}

export function isWithinBoundaries(manager, x, y) {
  const { minX, maxX, minY, maxY } = manager.canvasBounds;
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

export function clampPointToBounds(manager, x, y) {
  const { minX, maxX, minY, maxY } = manager.canvasBounds;
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

export function clampObjectToBounds(manager, obj) {
  const { minX, maxX, minY, maxY } = manager.canvasBounds;

  let x = obj.x;
  let y = obj.y;
  let width = obj.width || 0;
  let height = obj.height || 0;
  const radius = obj.radius || 0;

  if (obj.type === "circle" && radius > 0) {
    width = radius * 2;
    height = radius * 2;
    x = obj.x - radius;
    y = obj.y - radius;
  }

  x = Math.max(minX, Math.min(maxX - width, x));
  y = Math.max(minY, Math.min(maxY - height, y));

  if (obj.type === "circle" && radius > 0) {
    return { x: x + radius, y: y + radius };
  }

  return { x, y };
}

export function isObjectWithinBounds(manager, obj) {
  const { minX, maxX, minY, maxY } = manager.canvasBounds;

  if (!obj.width && !obj.radius) {
    return isWithinBoundaries(manager, obj.x, obj.y);
  }

  if (obj.width && obj.height) {
    return (
      obj.x >= minX &&
      obj.x + obj.width <= maxX &&
      obj.y >= minY &&
      obj.y + obj.height <= maxY
    );
  }

  if (obj.type === "circle" && obj.radius) {
    const r = obj.radius;
    return obj.x - r >= minX && obj.x + r <= maxX && obj.y - r >= minY && obj.y + r <= maxY;
  }

  return true;
}

export function enforceCanvasBounds(manager) {
  const { minX, maxX, minY, maxY } = manager.canvasBounds;

  manager.state.objects.forEach((obj) => {
    if ((obj.type === "line" || obj.type === "arrow") && obj.x1 !== undefined && obj.y1 !== undefined) {
      obj.x1 = Math.max(minX, Math.min(maxX, obj.x1));
      obj.y1 = Math.max(minY, Math.min(maxY, obj.y1));
      obj.x2 = Math.max(minX, Math.min(maxX, obj.x2));
      obj.y2 = Math.max(minY, Math.min(maxY, obj.y2));
      return;
    }

    if (obj.x !== undefined && obj.y !== undefined) {
      if (obj.type === "circle" && obj.radius) {
        const r = obj.radius;
        obj.x = Math.max(minX + r, Math.min(maxX - r, obj.x));
        obj.y = Math.max(minY + r, Math.min(maxY - r, obj.y));
        return;
      }

      if (obj.width && obj.height) {
        obj.x = Math.max(minX, Math.min(maxX - obj.width, obj.x));
        obj.y = Math.max(minY, Math.min(maxY - obj.height, obj.y));
        return;
      }

      obj.x = Math.max(minX, Math.min(maxX, obj.x));
      obj.y = Math.max(minY, Math.min(maxY, obj.y));
    }
  });
}

export function getVisibleBoundaries(manager) {
  const { zoom, panX, panY } = manager.state.viewport;
  const canvasWidth = manager.canvas?.width || 0;
  const canvasHeight = manager.canvas?.height || 0;

  const worldLeft = -panX / zoom;
  const worldTop = -panY / zoom;
  const worldRight = worldLeft + canvasWidth / zoom;
  const worldBottom = worldTop + canvasHeight / zoom;

  return { worldLeft, worldTop, worldRight, worldBottom };
}
