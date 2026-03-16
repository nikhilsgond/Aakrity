export function getHandleWorldX(handleKey, bounds) {
  switch (handleKey) {
    case "tl":
    case "nw":
    case "bl":
    case "sw":
    case "l":
    case "w":
      return bounds.x;
    case "tr":
    case "ne":
    case "br":
    case "se":
    case "r":
    case "e":
      return bounds.x + bounds.width;
    case "t":
    case "n":
    case "b":
    case "s":
      return bounds.x + bounds.width / 2;
    default:
      return bounds.x;
  }
}

export function getHandleWorldY(handleKey, bounds) {
  switch (handleKey) {
    case "tl":
    case "nw":
    case "tr":
    case "ne":
    case "t":
    case "n":
      return bounds.y;
    case "bl":
    case "sw":
    case "br":
    case "se":
    case "b":
    case "s":
      return bounds.y + bounds.height;
    case "l":
    case "w":
    case "r":
    case "e":
      return bounds.y + bounds.height / 2;
    default:
      return bounds.y;
  }
}

export function worldDeltaToLocal(dx, dy, rotation) {
  if (!rotation || Math.abs(rotation) < 0.001) {
    return { dx, dy };
  }

  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);

  return {
    dx: dx * cos - dy * sin,
    dy: dx * sin + dy * cos,
  };
}

export function getOBBScale(startOBB, dx, dy, handleKey) {
  if (!startOBB || !startOBB.corners || startOBB.corners.length < 4) {
    return { scaleX: 1, scaleY: 1 };
  }

  const corners = startOBB.corners;
  const localX = {
    x: corners[1].x - corners[0].x,
    y: corners[1].y - corners[0].y,
  };
  const localY = {
    x: corners[3].x - corners[0].x,
    y: corners[3].y - corners[0].y,
  };

  const lengthX = Math.sqrt(localX.x * localX.x + localX.y * localX.y);
  const lengthY = Math.sqrt(localY.x * localY.x + localY.y * localY.y);

  if (lengthX === 0 || lengthY === 0 || !isFinite(lengthX) || !isFinite(lengthY)) {
    return { scaleX: 1, scaleY: 1 };
  }

  const axisX = { x: localX.x / lengthX, y: localX.y / lengthX };
  const axisY = { x: localY.x / lengthY, y: localY.y / lengthY };
  const projX = dx * axisX.x + dy * axisX.y;
  const projY = dx * axisY.x + dy * axisY.y;

  let scaleX = 1;
  let scaleY = 1;

  switch (handleKey) {
    case "nw":
      scaleX = (lengthX - projX) / lengthX;
      scaleY = (lengthY - projY) / lengthY;
      break;
    case "ne":
      scaleX = (lengthX + projX) / lengthX;
      scaleY = (lengthY - projY) / lengthY;
      break;
    case "sw":
      scaleX = (lengthX - projX) / lengthX;
      scaleY = (lengthY + projY) / lengthY;
      break;
    case "se":
      scaleX = (lengthX + projX) / lengthX;
      scaleY = (lengthY + projY) / lengthY;
      break;
    case "n":
      scaleY = (lengthY - projY) / lengthY;
      break;
    case "s":
      scaleY = (lengthY + projY) / lengthY;
      break;
    case "e":
      scaleX = (lengthX + projX) / lengthX;
      break;
    case "w":
      scaleX = (lengthX - projX) / lengthX;
      break;
    default:
      break;
  }

  if (!isFinite(scaleX) || !isFinite(scaleY)) {
    return { scaleX: 1, scaleY: 1 };
  }

  return { scaleX, scaleY };
}

export function getScaleX(dx, bounds, handleKey) {
  const width = bounds.width;
  if (width === 0) return 1;

  switch (handleKey) {
    case "tl":
    case "nw":
    case "bl":
    case "sw":
    case "l":
    case "w":
      return (width - dx) / width;
    case "tr":
    case "ne":
    case "br":
    case "se":
    case "r":
    case "e":
      return (width + dx) / width;
    default:
      return 1;
  }
}

export function getScaleY(dy, bounds, handleKey) {
  const height = bounds.height;
  if (height === 0) return 1;

  switch (handleKey) {
    case "tl":
    case "nw":
    case "tr":
    case "ne":
    case "t":
    case "n":
      return (height - dy) / height;
    case "bl":
    case "sw":
    case "br":
    case "se":
    case "b":
    case "s":
      return (height + dy) / height;
    default:
      return 1;
  }
}

export function getResizeOrigin(handleKey, bounds, isOBB = false, startOBB = null, modifiers = {}) {
  if (isOBB && startOBB) {
    return getOBBResizeOrigin(handleKey, startOBB, modifiers);
  }

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  const isShift = !!modifiers.shift;
  const isAlt = !!(modifiers.alt || modifiers.ctrl || modifiers.cmd);

  if (isShift && isAlt) {
    return { x: centerX, y: centerY };
  }

  if (isAlt) {
    return { x: centerX, y: centerY };
  }

  switch (handleKey) {
    case "tl":
    case "nw":
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height };
    case "tr":
    case "ne":
      return { x: bounds.x, y: bounds.y + bounds.height };
    case "bl":
    case "sw":
      return { x: bounds.x + bounds.width, y: bounds.y };
    case "br":
    case "se":
      return { x: bounds.x, y: bounds.y };
    case "t":
    case "n":
      return { x: centerX, y: bounds.y + bounds.height };
    case "b":
    case "s":
      return { x: centerX, y: bounds.y };
    case "l":
    case "w":
      return { x: bounds.x + bounds.width, y: centerY };
    case "r":
    case "e":
      return { x: bounds.x, y: centerY };
    default:
      return { x: bounds.x, y: bounds.y };
  }
}

export function getOBBResizeOrigin(handleKey, startOBB, modifiers = {}) {
  if (!startOBB || !startOBB.corners) {
    return { x: 0, y: 0 };
  }

  const corners = startOBB.corners;
  const center = startOBB.center;
  const isAlt = !!(modifiers.alt || modifiers.ctrl || modifiers.cmd);

  if (isAlt) {
    return center;
  }

  switch (handleKey) {
    case "nw":
      return corners[2];
    case "ne":
      return corners[3];
    case "sw":
      return corners[1];
    case "se":
      return corners[0];
    case "n":
      return { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 };
    case "s":
      return { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 };
    case "w":
      return { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 };
    case "e":
      return { x: (corners[0].x + corners[3].x) / 2, y: (corners[0].y + corners[3].y) / 2 };
    default:
      return center;
  }
}

export function getAngleFromCenter(point, bounds, isOBB = false, startOBB = null) {
  let centerX;
  let centerY;

  if (isOBB && startOBB) {
    centerX = startOBB.center.x;
    centerY = startOBB.center.y;
  } else {
    centerX = bounds.x + bounds.width / 2;
    centerY = bounds.y + bounds.height / 2;
  }

  return Math.atan2(point.y - centerY, point.x - centerX);
}

export function getRotationCenter(bounds, isOBB = false, startOBB = null) {
  if (isOBB && startOBB) {
    return { ...startOBB.center };
  }
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

export function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function pointInCircle(point, circle) {
  const dx = point.x - circle.x;
  const dy = point.y - circle.y;
  return Math.sqrt(dx * dx + dy * dy) <= circle.radius;
}
