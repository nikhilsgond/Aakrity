// Connector geometry removed

export function drawPath(manager, obj) {
  const { points, strokeColor, strokeWidth, style, opacity } = obj;
  if (!points || points.length < 2) return;

  if (opacity !== undefined && opacity !== 1.0) {
    manager.ctx.save();
    manager.ctx.globalAlpha = opacity;
  }

  manager.ctx.strokeStyle = strokeColor || "#000000";
  manager.ctx.lineCap = "round";
  manager.ctx.lineJoin = "round";

  const hasPressure = points.some((p) => p.pressure !== undefined && p.pressure !== 0.5);
  if (hasPressure && style !== "highlighter") {
    drawPressureSensitivePath(manager, points, strokeWidth);
  } else {
    manager.ctx.lineWidth = strokeWidth || 2;
    manager.ctx.beginPath();
    manager.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      manager.ctx.lineTo(points[i].x, points[i].y);
    }
    manager.ctx.stroke();
  }

  if (opacity !== undefined && opacity !== 1.0) {
    manager.ctx.restore();
  }
}

export function drawPressureSensitivePath(manager, points, baseWidth) {
  if (points.length < 2) return;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const pressure1 = p1.pressure || 0.5;
    const pressure2 = p2.pressure || 0.5;
    const width1 = baseWidth * (0.7 + pressure1 * 0.6);
    const width2 = baseWidth * (0.7 + pressure2 * 0.6);
    const avgWidth = (width1 + width2) / 2;

    manager.ctx.lineWidth = avgWidth;
    manager.ctx.beginPath();
    manager.ctx.moveTo(p1.x, p1.y);
    manager.ctx.lineTo(p2.x, p2.y);
    manager.ctx.stroke();
  }
}

export function drawRectangle(manager, obj) {
  const { x, y, width, height, cornerRadius, strokeColor, strokeWidth, fillColor, rotation } = obj;
  manager.ctx.save();
  if (rotation) {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    manager.ctx.translate(centerX, centerY);
    manager.ctx.rotate(rotation);
    manager.ctx.translate(-centerX, -centerY);
  }
  manager.ctx.fillStyle = fillColor || "transparent";
  manager.ctx.strokeStyle = strokeColor || "#000000";
  manager.ctx.lineWidth = strokeWidth || 1;
  manager.ctx.beginPath();
  const r = cornerRadius > 0 ? Math.min(cornerRadius, Math.abs(width) / 2, Math.abs(height) / 2) : 0;
  if (r > 0) {
    manager.ctx.moveTo(x + r, y);
    manager.ctx.lineTo(x + width - r, y);
    manager.ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    manager.ctx.lineTo(x + width, y + height - r);
    manager.ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    manager.ctx.lineTo(x + r, y + height);
    manager.ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    manager.ctx.lineTo(x, y + r);
    manager.ctx.quadraticCurveTo(x, y, x + r, y);
    manager.ctx.closePath();
  } else {
    manager.ctx.rect(x, y, width, height);
  }
  if (fillColor && fillColor !== "transparent") manager.ctx.fill();
  manager.ctx.stroke();
  drawShapeInnerText(manager, obj, { x, y, width, height });
  manager.ctx.restore();
}

export function drawCircle(manager, obj) {
  const { x, y, radius, strokeColor, strokeWidth, fillColor, rotation } = obj;
  const absRadius = Math.abs(radius || 0);
  if (absRadius < 0.1) return;
  manager.ctx.save();
  if (rotation) {
    manager.ctx.translate(x, y);
    manager.ctx.rotate(rotation);
    manager.ctx.translate(-x, -y);
  }
  manager.ctx.fillStyle = fillColor || "transparent";
  manager.ctx.strokeStyle = strokeColor || "#000000";
  manager.ctx.lineWidth = strokeWidth || 1;
  manager.ctx.beginPath();
  manager.ctx.arc(x, y, absRadius, 0, Math.PI * 2);
  if (fillColor && fillColor !== "transparent") manager.ctx.fill();
  manager.ctx.stroke();
  drawShapeInnerText(manager, obj, {
    x: x - absRadius,
    y: y - absRadius,
    width: absRadius * 2,
    height: absRadius * 2,
  });
  manager.ctx.restore();
}

export function drawLine(manager, obj) {
  const { x1, y1, x2, y2, strokeColor, strokeWidth, lineStyle } = obj;
  // Endpoints use stored x1/y1/x2/y2 — fixed at creation, do NOT track object moves.
  const ctx = manager.ctx;
  ctx.beginPath();
  ctx.strokeStyle = strokeColor || "#000000";
  ctx.lineWidth = strokeWidth || 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([]);

  if (lineStyle === 'elbow') {
    const midX = (x1 + x2) / 2;
    ctx.moveTo(x1, y1);
    ctx.lineTo(midX, y1);
    ctx.lineTo(midX, y2);
    ctx.lineTo(x2, y2);
  } else if (lineStyle === 'curved') {
    const cpOff = Math.abs(x2 - x1) * 0.45 || 40;
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + cpOff, y1, x2 - cpOff, y2, x2, y2);
  } else {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
  drawLineArrowText(manager, obj);
}

export function drawRoundedRectangle(manager, obj) {
  const { x, y, width, height, cornerRadius, strokeColor, strokeWidth, fillColor, rotation } = obj;
  const radius = cornerRadius || 10;
  manager.ctx.save();
  if (rotation) {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    manager.ctx.translate(centerX, centerY);
    manager.ctx.rotate(rotation);
    manager.ctx.translate(-centerX, -centerY);
  }
  manager.ctx.fillStyle = fillColor || "transparent";
  manager.ctx.strokeStyle = strokeColor || "#000000";
  manager.ctx.lineWidth = strokeWidth || 1;
  manager.ctx.beginPath();
  manager.ctx.moveTo(x + radius, y);
  manager.ctx.lineTo(x + width - radius, y);
  manager.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  manager.ctx.lineTo(x + width, y + height - radius);
  manager.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  manager.ctx.lineTo(x + radius, y + height);
  manager.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  manager.ctx.lineTo(x, y + radius);
  manager.ctx.quadraticCurveTo(x, y, x + radius, y);
  manager.ctx.closePath();
  if (fillColor && fillColor !== "transparent") manager.ctx.fill();
  manager.ctx.stroke();
  drawShapeInnerText(manager, obj, { x, y, width, height });
  manager.ctx.restore();
}

export function drawEllipse(manager, obj) {
  const { x, y, radiusX, radiusY, strokeColor, strokeWidth, fillColor, rotation } = obj;
  const absRadiusX = Math.abs(radiusX || 0);
  const absRadiusY = Math.abs(radiusY || 0);
  if (absRadiusX < 0.1 || absRadiusY < 0.1) return;
  manager.ctx.save();
  if (rotation) {
    manager.ctx.translate(x, y);
    manager.ctx.rotate(rotation);
    manager.ctx.translate(-x, -y);
  }
  manager.ctx.fillStyle = fillColor || "transparent";
  manager.ctx.strokeStyle = strokeColor || "#000000";
  manager.ctx.lineWidth = strokeWidth || 1;
  manager.ctx.beginPath();
  manager.ctx.ellipse(x, y, absRadiusX, absRadiusY, 0, 0, Math.PI * 2);
  if (fillColor && fillColor !== "transparent") manager.ctx.fill();
  manager.ctx.stroke();
  drawShapeInnerText(manager, obj, {
    x: x - absRadiusX,
    y: y - absRadiusY,
    width: absRadiusX * 2,
    height: absRadiusY * 2,
  });
  manager.ctx.restore();
}

export function drawArrow(manager, obj) {
  const { x1, y1, x2, y2, arrowSize, strokeColor, strokeWidth, lineStyle } = obj;

  // Endpoints are always stored x1/y1/x2/y2 — they do NOT track connected objects.
  const size = arrowSize || 10;
  const ctx = manager.ctx;
  ctx.save();
  ctx.strokeStyle = strokeColor || "#000000";
  ctx.lineWidth = strokeWidth || 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([]);

  let endX = x2, endY = y2;

  ctx.beginPath();
  if (lineStyle === 'elbow') {
    const midX = (x1 + x2) / 2;
    ctx.moveTo(x1, y1);
    ctx.lineTo(midX, y1);
    ctx.lineTo(midX, y2);
    ctx.lineTo(x2, y2);
  } else if (lineStyle === 'curved') {
    const cpOff = Math.abs(x2 - x1) * 0.45 || 40;
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + cpOff, y1, x2 - cpOff, y2, x2, y2);
  } else {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowAngle = Math.PI / 6;

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - size * Math.cos(angle - arrowAngle), endY - size * Math.sin(angle - arrowAngle));
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - size * Math.cos(angle + arrowAngle), endY - size * Math.sin(angle + arrowAngle));
  ctx.stroke();
  drawLineArrowText(manager, obj);
  ctx.restore();
}

export function drawTriangle(manager, obj) {
  const { points, strokeColor, strokeWidth, fillColor, rotation } = obj;
  if (!points || points.length !== 3) return;
  manager.ctx.save();
  let centerX = 0;
  let centerY = 0;
  points.forEach((p) => {
    centerX += p.x;
    centerY += p.y;
  });
  centerX /= points.length;
  centerY /= points.length;
  if (rotation) {
    manager.ctx.translate(centerX, centerY);
    manager.ctx.rotate(rotation);
    manager.ctx.translate(-centerX, -centerY);
  }
  manager.ctx.fillStyle = fillColor || "transparent";
  manager.ctx.strokeStyle = strokeColor || "#000000";
  manager.ctx.lineWidth = strokeWidth || 1;
  manager.ctx.lineJoin = "round";
  manager.ctx.beginPath();
  manager.ctx.moveTo(points[0].x, points[0].y);
  manager.ctx.lineTo(points[1].x, points[1].y);
  manager.ctx.lineTo(points[2].x, points[2].y);
  manager.ctx.closePath();
  if (fillColor && fillColor !== "transparent") manager.ctx.fill();
  manager.ctx.stroke();
  drawShapeInnerText(manager, obj, getPointsBounds(points));
  manager.ctx.restore();
}

export function drawPolygon(manager, obj) {
  const { points, strokeColor, strokeWidth, fillColor, rotation } = obj;
  if (!points || points.length < 3) return;
  manager.ctx.save();
  let centerX = 0;
  let centerY = 0;
  points.forEach((p) => {
    centerX += p.x;
    centerY += p.y;
  });
  centerX /= points.length;
  centerY /= points.length;
  if (rotation) {
    manager.ctx.translate(centerX, centerY);
    manager.ctx.rotate(rotation);
    manager.ctx.translate(-centerX, -centerY);
  }
  manager.ctx.fillStyle = fillColor || "transparent";
  manager.ctx.strokeStyle = strokeColor || "#000000";
  manager.ctx.lineWidth = strokeWidth || 1;
  manager.ctx.lineJoin = "round";
  manager.ctx.beginPath();
  manager.ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    manager.ctx.lineTo(points[i].x, points[i].y);
  }
  manager.ctx.closePath();
  if (fillColor && fillColor !== "transparent") manager.ctx.fill();
  manager.ctx.stroke();
  drawShapeInnerText(manager, obj, getPointsBounds(points));
  manager.ctx.restore();
}

function getPointsBounds(points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  points.forEach((p) => {
    if (typeof p.x !== "number" || typeof p.y !== "number") return;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  if (minX === Infinity) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Draw text centered on a line/arrow, always at 0° angle.
 * Width adapts to the object length.
 */
function drawLineArrowText(manager, obj) {
  if (!obj.innerText || !obj.innerText.trim()) return;
  if (obj._isEditing) return;

  const { x1, y1, x2, y2 } = obj;
  if (x1 == null || y1 == null || x2 == null || y2 == null) return;

  const ctx = manager.ctx;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const lineLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  if (lineLen < 10) return;

  const fontSize = obj.innerTextSize || 14;
  const fontWeight = obj.innerTextWeight || 'normal';
  const fontStyle = obj.innerTextStyle || 'normal';
  const fontFamily = obj.fontFamily || 'Arial, sans-serif';
  const textColor = obj.innerTextColor || '#111827';
  const maxWidth = Math.max(20, lineLen * 0.8);
  const lineHeight = fontSize * 1.2;
  const padding = 4;

  ctx.save();
  ctx.font = `${fontWeight} ${fontStyle} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = textColor;

  const wrappedLines = wrapText(ctx, obj.innerText.trim(), maxWidth);
  const blockHeight = wrappedLines.length * lineHeight;

  // Draw background behind text for readability
  const bgPad = 3;
  let bgWidth = 0;
  wrappedLines.forEach(line => {
    bgWidth = Math.max(bgWidth, ctx.measureText(line).width);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(
    midX - bgWidth / 2 - bgPad,
    midY - blockHeight / 2 - padding - bgPad,
    bgWidth + bgPad * 2,
    blockHeight + bgPad * 2
  );

  // Draw text
  ctx.fillStyle = textColor;
  wrappedLines.forEach((line, i) => {
    ctx.fillText(line, midX, midY - blockHeight / 2 - padding + i * lineHeight);
  });

  ctx.restore();
}

/**
 * Compute the maximum inscribed rectangle for text inside a shape.
 * For rectangles, the full bounds are used. For other shapes, the text area
 * is reduced to fit within the shape boundary.
 */
function getInscribedTextBounds(obj, bounds) {
  if (!bounds) return bounds;
  const shapeType = obj.shapeType || obj.type;
  const { x, y, width, height } = bounds;

  switch (shapeType) {
    case 'circle': {
      // Largest inscribed square inside a circle: side = r * √2
      const r = Math.min(width, height) / 2;
      const side = r * Math.SQRT2;
      const cx = x + width / 2;
      const cy = y + height / 2;
      return { x: cx - side / 2, y: cy - side / 2, width: side, height: side };
    }
    case 'ellipse': {
      // Largest inscribed rectangle inside an ellipse: w = rX*√2, h = rY*√2
      const rX = width / 2;
      const rY = height / 2;
      const iW = rX * Math.SQRT2;
      const iH = rY * Math.SQRT2;
      const cx = x + width / 2;
      const cy = y + height / 2;
      return { x: cx - iW / 2, y: cy - iH / 2, width: iW, height: iH };
    }
    case 'diamond': {
      // Diamond inscribed rectangle: half width and half height
      const iW = width / 2;
      const iH = height / 2;
      const cx = x + width / 2;
      const cy = y + height / 2;
      return { x: cx - iW / 2, y: cy - iH / 2, width: iW, height: iH };
    }
    case 'triangle': {
      // Approximate inscribed rect in bottom portion of triangle
      const iW = width * 0.55;
      const iH = height * 0.4;
      const cx = x + width / 2;
      const cy = y + height * 0.65;
      return { x: cx - iW / 2, y: cy - iH / 2, width: iW, height: iH };
    }
    case 'hexagon': {
      // Regular hexagon inscribed rectangle: ~86% width, ~100% of inner height
      const iW = width * 0.75;
      const iH = height * 0.85;
      const cx = x + width / 2;
      const cy = y + height / 2;
      return { x: cx - iW / 2, y: cy - iH / 2, width: iW, height: iH };
    }
    case 'pentagon': {
      const iW = width * 0.6;
      const iH = height * 0.55;
      const cx = x + width / 2;
      const cy = y + height * 0.55;
      return { x: cx - iW / 2, y: cy - iH / 2, width: iW, height: iH };
    }
    case 'star': {
      // Star has very limited interior; use ~40% of bounds
      const iW = width * 0.4;
      const iH = height * 0.35;
      const cx = x + width / 2;
      const cy = y + height / 2;
      return { x: cx - iW / 2, y: cy - iH / 2, width: iW, height: iH };
    }
    default:
      // Rectangle, roundedRectangle, polygon — use full bounds
      return bounds;
  }
}

function drawShapeInnerText(manager, obj, bounds) {
  if (!bounds || !obj || !obj.innerTextEnabled) return;
  // Hide canvas text while the inline editor overlay is active
  if (obj._isEditing) return;
  if (!(obj.innerText || "").trim()) return;

  // Use inscribed text area for non-rectangular shapes
  const textBounds = getInscribedTextBounds(obj, bounds);
  if (!textBounds) return;

  const requestedPadding = Math.max(0, obj.innerTextPadding ?? 12);
  const padX = Math.min(requestedPadding, Math.max(0, textBounds.width / 2 - 0.5));
  const padY = Math.min(requestedPadding, Math.max(0, textBounds.height / 2 - 0.5));
  const availableWidth = textBounds.width - padX * 2;
  const availableHeight = textBounds.height - padY * 2;
  const maxWidth = Math.max(1, availableWidth);
  const maxHeight = Math.max(1, availableHeight);
  if (textBounds.width <= 1 || textBounds.height <= 1) return;

  const fontSize = obj.innerTextSize || 14;
  const fontWeight = obj.innerTextWeight || "normal";
  const fontStyle = obj.innerTextStyle || "normal";
  const fontFamily = obj.fontFamily || "Arial, sans-serif";
  const lineHeight = fontSize * 1.2;

  manager.ctx.save();
  manager.ctx.beginPath();
  const clipX = textBounds.x + Math.max(0, availableWidth > 1 ? padX : 0);
  const clipY = textBounds.y + Math.max(0, availableHeight > 1 ? padY : 0);
  manager.ctx.rect(clipX, clipY, maxWidth, maxHeight);
  manager.ctx.clip();

  const textAlign = obj.innerTextAlign || "center";
  const listType = obj.innerTextListType || 'none';
  manager.ctx.fillStyle = obj.innerTextColor || "#111827";
  manager.ctx.font = `${fontWeight} ${fontStyle} ${fontSize}px ${fontFamily}`;
  manager.ctx.textAlign = textAlign;
  manager.ctx.textBaseline = "top";

  // Apply list prefix to each raw line
  const rawText = (obj.innerText || "").trim();
  const listedText = listType === 'none' ? rawText : rawText.split('\n').map((line, i) => {
    if (!line.trim()) return line;
    return listType === 'unordered' ? `\u2022 ${line}` : `${i + 1}. ${line}`;
  }).join('\n');

  const wrappedLines = wrapText(manager.ctx, listedText, maxWidth);
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  const lines = wrappedLines.slice(0, maxLines);
  const blockHeight = lines.length * lineHeight;
  const verticalAlign = obj.innerTextVerticalAlign || 'middle';
  const startY =
    verticalAlign === 'top'
      ? textBounds.y + padY
      : verticalAlign === 'bottom'
      ? textBounds.y + textBounds.height - padY - blockHeight
      : textBounds.y + (textBounds.height - blockHeight) / 2;

  // Anchor X for each alignment
  const anchorX =
    textAlign === 'left'
      ? textBounds.x + padX
      : textAlign === 'right'
      ? textBounds.x + textBounds.width - padX
      : textBounds.x + textBounds.width / 2; // center

  const underline = !!obj.innerTextUnderline;
  const strikethrough = !!obj.innerTextStrikethrough;
  const textColor = obj.innerTextColor || '#111827';

  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight;
    manager.ctx.fillText(line, anchorX, lineY);
    if (line && (underline || strikethrough)) {
      const measured = manager.ctx.measureText(line);
      const lineW = measured.width;
      const lineXStart =
        textAlign === 'center'
          ? anchorX - lineW / 2
          : textAlign === 'right'
          ? anchorX - lineW
          : anchorX;
      manager.ctx.strokeStyle = textColor;
      manager.ctx.lineWidth = Math.max(1, fontSize * 0.07);
      if (underline) {
        manager.ctx.beginPath();
        manager.ctx.moveTo(lineXStart, lineY + fontSize + 1);
        manager.ctx.lineTo(lineXStart + lineW, lineY + fontSize + 1);
        manager.ctx.stroke();
      }
      if (strikethrough) {
        manager.ctx.beginPath();
        manager.ctx.moveTo(lineXStart, lineY + fontSize * 0.55);
        manager.ctx.lineTo(lineXStart + lineW, lineY + fontSize * 0.55);
        manager.ctx.stroke();
      }
    }
  });
  manager.ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const rawLines = String(text).split("\n");
  const result = [];
  const breakLongWord = (word) => {
    const pieces = [];
    let current = '';
    for (const ch of String(word)) {
      const next = current + ch;
      if (ctx.measureText(next).width > maxWidth && current) {
        pieces.push(current);
        current = ch;
      } else {
        current = next;
      }
    }
    if (current) pieces.push(current);
    return pieces;
  };

  rawLines.forEach((rawLine) => {
    const words = rawLine.split(" ");
    let current = "";
    words.forEach((word) => {
      if (ctx.measureText(word).width > maxWidth) {
        if (current) {
          result.push(current);
          current = '';
        }
        const chunks = breakLongWord(word);
        chunks.forEach((chunk, idx) => {
          if (idx < chunks.length - 1) result.push(chunk);
          else current = chunk;
        });
        return;
      }
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) result.push(current);
        current = word;
      }
    });
    result.push(current || "");
  });
  return result;
}

export function drawEmoji(manager, obj) {
  const { x, y, width, height, emoji, rotation, opacity } = obj;
  if (!emoji) return;

  manager.ctx.save();

  if (opacity !== undefined && opacity !== 1.0) {
    manager.ctx.globalAlpha = opacity;
  }

  if (rotation) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    manager.ctx.translate(cx, cy);
    manager.ctx.rotate(rotation);
    manager.ctx.translate(-cx, -cy);
  }

  // Draw emoji as text, centered in the bounding box
  const fontSize = Math.min(width, height) * 0.85;
  manager.ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  manager.ctx.textAlign = 'center';
  manager.ctx.textBaseline = 'middle';
  manager.ctx.fillText(emoji, x + width / 2, y + height / 2);

  manager.ctx.restore();
}

/**
 * Draw a sticky note: colored rounded-rect background + wrapped text.
 */
export function drawStickyNote(manager, obj) {
  const {
    x, y, width, height,
    noteColor = '#FFF176',
    textColor = '#111111',
    text = '',
    fontSize = 14,
    rotation,
    opacity,
  } = obj;

  const ctx = manager.ctx;
  ctx.save();

  if (opacity !== undefined && opacity !== 1.0) {
    ctx.globalAlpha = opacity;
  }

  if (rotation) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.translate(-cx, -cy);
  }

  // --- Background ---
  const r = 6; // corner radius
  ctx.fillStyle = noteColor;
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // --- Shadow hint ---
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // --- Text (hidden while contenteditable overlay is open) ---
  // Strip trailing newlines that contenteditable may leave
  const cleanText = text ? text.replace(/\n+$/, '') : '';
  if (cleanText && !obj._isEditing) {
    const padding = 12;
    const maxW = width - padding * 2;
    const maxH = height - padding * 2;
    const formattedRanges = obj.formattedRanges || [];

    // Helper: break a single word into chunks that each fit within maxW
    const breakWord = (word, maxWidth) => {
      const chunks = [];
      let chunk = '';
      for (let i = 0; i < word.length; i++) {
        const testChunk = chunk + word[i];
        if (ctx.measureText(testChunk).width > maxWidth && chunk) {
          chunks.push(chunk);
          chunk = word[i];
        } else {
          chunk = testChunk;
        }
      }
      if (chunk) chunks.push(chunk);
      return chunks;
    };

    // Auto-shrink font size to fit the fixed container (Miro-style)
    let fitSize = fontSize;
    const MIN_FONT = 8;

    const wrapText = (size) => {
      ctx.font = `${size}px Arial, sans-serif`;
      const lh = size * 1.3;
      const paragraphs = cleanText.split('\n');
      const resultLines = []; // { text, charStart }
      let totalH = 0;
      let charIdx = 0;

      for (const para of paragraphs) {
        if (para === '') {
          resultLines.push({ text: '', charStart: charIdx });
          totalH += lh;
          charIdx += 1; // the \n
          continue;
        }
        const words = para.split(' ');
        let line = '';
        let lineStart = charIdx;

        for (let wi = 0; wi < words.length; wi++) {
          const word = words[wi];

          // If a single word is wider than maxW, break it into characters
          if (ctx.measureText(word).width > maxW && !line) {
            const chunks = breakWord(word, maxW);
            for (let ci = 0; ci < chunks.length; ci++) {
              resultLines.push({ text: chunks[ci], charStart: lineStart });
              totalH += lh;
              lineStart += chunks[ci].length;
            }
            line = '';
            // If there are more words, we continue; otherwise the last chunk started a new line
            continue;
          }

          const testLine = line ? `${line} ${word}` : word;
          if (ctx.measureText(testLine).width > maxW && line) {
            resultLines.push({ text: line, charStart: lineStart });
            totalH += lh;
            line = word;
            lineStart = charIdx + (testLine.length - word.length);
          } else {
            line = testLine;
          }
        }
        if (line) {
          resultLines.push({ text: line, charStart: lineStart });
          totalH += lh;
        }
        charIdx += para.length + 1; // +1 for \n
      }
      return { totalH, resultLines };
    };

    while (fitSize > MIN_FONT && wrapText(fitSize).totalH > maxH) {
      fitSize -= 1;
    }

    const { resultLines: lines } = wrapText(fitSize);
    const lineHeight = fitSize * 1.3;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Clip text to the sticky note bounds so nothing overflows
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + padding, y + padding, maxW, maxH);
    ctx.clip();

    // Render each line, splitting by formatted ranges
    let curY = y + padding;
    const maxY = y + height - padding;

    for (const lineInfo of lines) {
      if (curY > maxY) break;
      if (lineInfo.text === '') {
        curY += lineHeight;
        continue;
      }
      if (curY + lineHeight > maxY + lineHeight) break;

      if (formattedRanges.length === 0) {
        // Fast path: no formatting
        ctx.font = `${fitSize}px Arial, sans-serif`;
        ctx.fillText(lineInfo.text, x + padding, curY);
      } else {
        // Split line into segments by formatted ranges
        const lineEnd = lineInfo.charStart + lineInfo.text.length;
        const segments = [];
        let segPos = lineInfo.charStart;

        for (const range of formattedRanges) {
          if (range.end <= lineInfo.charStart || range.start >= lineEnd) continue;
          const segStart = Math.max(range.start, lineInfo.charStart);
          const segEnd = Math.min(range.end, lineEnd);

          if (segStart > segPos) {
            segments.push({
              text: lineInfo.text.slice(segPos - lineInfo.charStart, segStart - lineInfo.charStart),
              bold: false, italic: false,
            });
          }
          segments.push({
            text: lineInfo.text.slice(segStart - lineInfo.charStart, segEnd - lineInfo.charStart),
            bold: !!range.bold,
            italic: !!range.italic,
          });
          segPos = segEnd;
        }
        if (segPos < lineEnd) {
          segments.push({
            text: lineInfo.text.slice(segPos - lineInfo.charStart),
            bold: false, italic: false,
          });
        }
        if (segments.length === 0) {
          segments.push({ text: lineInfo.text, bold: false, italic: false });
        }

        // Draw each segment
        let curX = x + padding;
        for (const seg of segments) {
          let fontStr = '';
          if (seg.italic) fontStr += 'italic ';
          if (seg.bold) fontStr += 'bold ';
          fontStr += `${fitSize}px Arial, sans-serif`;
          ctx.font = fontStr;
          ctx.fillText(seg.text, curX, curY);
          curX += ctx.measureText(seg.text).width;
        }
      }
      curY += lineHeight;
    }

    ctx.restore(); // restore clipping
  }

  ctx.restore();
}

// Connector drawing removed

/**
 * Draw a polyline path (from → waypoints → to) with rounded corners.
 * Corners are arcs of the given radius.
 */
function _drawRoundedElbow(ctx, from, waypoints, to, cornerRadius) {
  const pts = [from, ...waypoints, to];
  if (pts.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);

  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
    return;
  }

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    // Skip zero-length segments
    const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
    const seg1 = Math.hypot(dx1, dy1);
    const seg2 = Math.hypot(dx2, dy2);

    if (seg1 < 0.5 || seg2 < 0.5) {
      ctx.lineTo(curr.x, curr.y);
      continue;
    }

    // Clamp radius to half the shorter segment
    const r = Math.min(cornerRadius, seg1 / 2, seg2 / 2);

    // Point where the arc starts (r distance before corner)
    const arcStartX = curr.x - (dx1 / seg1) * r;
    const arcStartY = curr.y - (dy1 / seg1) * r;
    // Point where the arc ends (r distance after corner)
    const arcEndX = curr.x + (dx2 / seg2) * r;
    const arcEndY = curr.y + (dy2 / seg2) * r;

    ctx.lineTo(arcStartX, arcStartY);
    ctx.quadraticCurveTo(curr.x, curr.y, arcEndX, arcEndY);
  }

  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
}

// Arrowhead helper removed (drawArrow has its own arrow rendering)
