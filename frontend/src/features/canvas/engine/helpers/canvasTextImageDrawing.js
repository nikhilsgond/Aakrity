// ─── Character-level formatting helpers ───

/**
 * Build an array of styled text runs for a single line,
 * applying formattedRanges overrides on top of the base style.
 */
function _buildStyledRuns(lineText, lineStart, formattedRanges, baseStyle) {
  if (!lineText.length) return [{ text: '', ...baseStyle, _width: 0 }];

  const lineEnd = lineStart + lineText.length;

  // Collect all split points within this line
  const splits = new Set([0, lineText.length]);
  for (const r of formattedRanges) {
    if (r.end <= lineStart || r.start >= lineEnd) continue;
    const s = Math.max(0, r.start - lineStart);
    const e = Math.min(lineText.length, r.end - lineStart);
    splits.add(s);
    splits.add(e);
  }
  const points = [...splits].sort((a, b) => a - b);

  const runs = [];
  for (let i = 0; i < points.length - 1; i++) {
    const s = points[i];
    const e = points[i + 1];
    const charIdx = lineStart + s; // absolute character index

    // Determine formatting for this run
    let bold = baseStyle.fontWeight === 'bold';
    let italic = baseStyle.fontStyle === 'italic';
    let ul = baseStyle.underline;
    let st = baseStyle.strikethrough;

    for (const r of formattedRanges) {
      if (r.start <= charIdx && r.end > charIdx) {
        if (r.bold !== undefined) bold = r.bold;
        if (r.italic !== undefined) italic = r.italic;
        if (r.underline !== undefined) ul = r.underline;
        if (r.strikethrough !== undefined) st = r.strikethrough;
      }
    }

    runs.push({
      text: lineText.slice(s, e),
      fontWeight: bold ? 'bold' : 'normal',
      fontStyle: italic ? 'italic' : 'normal',
      underline: ul,
      strikethrough: st,
      fontFamily: baseStyle.fontFamily,
      fontSize: baseStyle.fontSize,
      textColor: baseStyle.textColor,
    });
  }

  return runs;
}

function _buildFontString(run) {
  let s = '';
  if (run.fontWeight && run.fontWeight !== 'normal') s += `${run.fontWeight} `;
  if (run.fontStyle && run.fontStyle !== 'normal') s += `${run.fontStyle} `;
  s += `${run.fontSize}px ${run.fontFamily}`;
  return s;
}

export function drawText(manager, obj) {
  const {
    x, y, text, fontFamily, fontSize, textColor, rotation,
    fontWeight, fontStyle, underline, strikethrough, listType,
    backgroundColor, textAlign = "left", verticalAlign = "top",
    opacity = 1,
    placeholder, placeholderColor, placeholderOpacity,
    id,
  } = obj || {};

  manager.ctx.save();
  manager.ctx.globalAlpha = opacity;

  if (rotation) {
    // Use the bounding box center as the rotation pivot, not text-measured width
    const objWidth = obj.width || 200;
    const objHeight = obj.height || ((fontSize || 16) * 1.2);
    let pivotX = x + objWidth / 2;
    const pivotY = y + objHeight / 2;

    manager.ctx.translate(pivotX, pivotY);
    manager.ctx.rotate(rotation);
    manager.ctx.translate(-pivotX, -pivotY);
  }

  let fontStyleStr = "";
  if (fontWeight && fontWeight !== "normal") fontStyleStr += `${fontWeight} `;
  if (fontStyle && fontStyle !== "normal") fontStyleStr += `${fontStyle} `;
  fontStyleStr += `${fontSize || 16}px ${fontFamily || "Arial"}`;

  manager.ctx.font = fontStyleStr;
  manager.ctx.textAlign = "left";
  manager.ctx.textBaseline = "top";

  const activeTool = manager.getActiveTool();
  const isEditing = activeTool && activeTool.name === "text" && activeTool.editingTextId === id;
  const lineHeight = (fontSize || 16) * 1.2;
  const lines = (text || "").split("\n");
  const contentHeight = Math.max(lineHeight, lines.length * lineHeight);
  const boxHeight = Math.max(obj.height || 0, contentHeight);
  const drawY = verticalAlign === "middle"
    ? y + (boxHeight - contentHeight) / 2
    : verticalAlign === "bottom"
      ? y + (boxHeight - contentHeight)
      : y;

  // During edit mode, canvas text is hidden and an HTML textarea is used
  // as the editable layer on top of the canvas.
  // But still render list markers during editing so they stay visible.
  if (isEditing) {
    if (listType && listType !== "none" && text) {
      manager.ctx.fillStyle = textColor || "#000000";
      const markerSpace = (fontSize || 16) * 1.2;
      lines.forEach((line, index) => {
        const lineY = drawY + lineHeight * index;
        const lineWidth = manager.ctx.measureText(line).width;
        const markerWidth = manager.ctx.measureText(
          listType === "ordered" ? `${index + 1}. ` : "• "
        ).width;
        const totalWidth = markerWidth + lineWidth;

        let itemX = x;
        if (textAlign === "center") itemX = x - totalWidth / 2;
        else if (textAlign === "right") itemX = x - totalWidth;

        if (listType === "unordered") {
          const bulletRadius = (fontSize || 16) * 0.15;
          const bulletX = itemX + bulletRadius + 2;
          const bulletY = lineY + lineHeight / 2;
          manager.ctx.beginPath();
          manager.ctx.arc(bulletX, bulletY, bulletRadius, 0, Math.PI * 2);
          manager.ctx.fill();
        } else if (listType === "ordered") {
          manager.ctx.fillText(`${index + 1}.`, itemX, lineY);
        }
      });
    }
    manager.ctx.restore();
    return;
  }

  if (backgroundColor && backgroundColor !== "transparent") {
    let maxWidth = 0;
    lines.forEach((line) => {
      const w = manager.ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    });

    const padding = (fontSize || 16) * 0.2;
    let bgX = x - padding;
    if (textAlign === "center") bgX = x - maxWidth / 2 - padding;
    else if (textAlign === "right") bgX = x - maxWidth - padding;

    manager.ctx.fillStyle = backgroundColor;
    manager.ctx.fillRect(bgX, drawY - padding, maxWidth + padding * 2, contentHeight + padding * 2);
  }

  if (!text || text === "") {
    // Temporary placeholders should not paint default text on canvas.
    if (obj?.isTempPlaceholder) {
      manager.ctx.restore();
      return;
    }
    manager.ctx.fillStyle = placeholderColor || "#9CA3AF";
    manager.ctx.globalAlpha = opacity * (placeholderOpacity ?? 0.5);
    manager.ctx.fillText(placeholder || "Type something...", x, drawY);
    manager.ctx.globalAlpha = opacity;
    manager.ctx.restore();
    return;
  }

  if (listType && listType !== "none" && text) {
    manager.ctx.fillStyle = textColor || "#000000";
    const markerSpace = (fontSize || 16) * 1.2;

    lines.forEach((line, index) => {
      const lineY = drawY + lineHeight * index;
      const lineWidth = manager.ctx.measureText(line).width;
      const markerWidth = manager.ctx.measureText(
        listType === "ordered" ? `${index + 1}. ` : "• "
      ).width;
      const totalWidth = markerWidth + lineWidth;

      let itemX = x;
      if (textAlign === "center") itemX = x - totalWidth / 2;
      else if (textAlign === "right") itemX = x - totalWidth;

      if (listType === "unordered") {
        const bulletRadius = (fontSize || 16) * 0.15;
        const bulletX = itemX + bulletRadius + 2;
        const bulletY = lineY + lineHeight / 2;
        manager.ctx.beginPath();
        manager.ctx.arc(bulletX, bulletY, bulletRadius, 0, Math.PI * 2);
        manager.ctx.fill();
        manager.ctx.fillText(line, itemX + markerSpace, lineY);
      } else if (listType === "ordered") {
        manager.ctx.fillText(`${index + 1}.`, itemX, lineY);
        manager.ctx.fillText(line, itemX + markerSpace, lineY);
      }
    });

    manager.ctx.restore();
    return;
  }

  manager.ctx.fillStyle = textColor || "#000000";

  const formattedRanges = obj.formattedRanges;
  const hasSpans = formattedRanges && formattedRanges.length > 0;

  // Build a global character offset map for line starts
  let charOffset = 0;
  const lineOffsets = lines.map((line) => {
    const off = charOffset;
    charOffset += line.length + 1; // +1 for newline
    return off;
  });

  lines.forEach((line, index) => {
    const lineY = drawY + lineHeight * index;
    const lineStart = lineOffsets[index];
    const lineEnd = lineStart + line.length;

    if (!hasSpans) {
      // Original simple rendering path (no character-level formatting)
      const lineWidth = manager.ctx.measureText(line).width;
      let drawX = x;
      if (textAlign === "center") drawX = x - lineWidth / 2;
      else if (textAlign === "right") drawX = x - lineWidth;

      manager.ctx.fillText(line, drawX, lineY);

      if (underline || strikethrough) {
        manager.ctx.strokeStyle = textColor || "#000000";
        manager.ctx.lineWidth = Math.max(1, Math.floor((fontSize || 16) / 20));

        if (underline) {
          manager.ctx.beginPath();
          manager.ctx.moveTo(drawX, lineY + (fontSize || 16) * 0.9);
          manager.ctx.lineTo(drawX + lineWidth, lineY + (fontSize || 16) * 0.9);
          manager.ctx.stroke();
        }

        if (strikethrough) {
          manager.ctx.beginPath();
          manager.ctx.moveTo(drawX, lineY + (fontSize || 16) * 0.5);
          manager.ctx.lineTo(drawX + lineWidth, lineY + (fontSize || 16) * 0.5);
          manager.ctx.stroke();
        }
      }
    } else {
      // Character-level formatting: split line into styled runs
      const runs = _buildStyledRuns(line, lineStart, formattedRanges, {
        fontWeight: fontWeight || "normal",
        fontStyle: fontStyle || "normal",
        underline: !!underline,
        strikethrough: !!strikethrough,
        fontFamily: fontFamily || "Arial",
        fontSize: fontSize || 16,
        textColor: textColor || "#000000",
      });

      // Measure total line width for alignment
      let totalWidth = 0;
      for (const run of runs) {
        const font = _buildFontString(run);
        manager.ctx.font = font;
        run._width = manager.ctx.measureText(run.text).width;
        totalWidth += run._width;
      }

      let drawX = x;
      if (textAlign === "center") drawX = x - totalWidth / 2;
      else if (textAlign === "right") drawX = x - totalWidth;

      // Render each run
      for (const run of runs) {
        const font = _buildFontString(run);
        manager.ctx.font = font;
        manager.ctx.fillStyle = run.textColor;
        manager.ctx.fillText(run.text, drawX, lineY);

        const decoWidth = Math.max(1, Math.floor(run.fontSize / 20));
        if (run.underline) {
          manager.ctx.strokeStyle = run.textColor;
          manager.ctx.lineWidth = decoWidth;
          manager.ctx.beginPath();
          manager.ctx.moveTo(drawX, lineY + run.fontSize * 0.9);
          manager.ctx.lineTo(drawX + run._width, lineY + run.fontSize * 0.9);
          manager.ctx.stroke();
        }
        if (run.strikethrough) {
          manager.ctx.strokeStyle = run.textColor;
          manager.ctx.lineWidth = decoWidth;
          manager.ctx.beginPath();
          manager.ctx.moveTo(drawX, lineY + run.fontSize * 0.5);
          manager.ctx.lineTo(drawX + run._width, lineY + run.fontSize * 0.5);
          manager.ctx.stroke();
        }

        drawX += run._width;
      }

      // Restore base font for next line measurement
      manager.ctx.font = fontStyleStr;
      manager.ctx.fillStyle = textColor || "#000000";
    }
  });

  manager.ctx.restore();
}

export function drawImage(manager, obj) {
  const {
    x, y, width, height, imageData, rotation, opacity,
    borderWidth, borderColor, borderRadius, scaleX, scaleY, flipX, flipY,
  } = obj;

  manager.ctx.save();
  const drawWidth = Math.max(1, Math.abs(width || 0));
  const drawHeight = Math.max(1, Math.abs(height || 0));
  const isFlipX = !!flipX || (scaleX !== undefined && scaleX < 0);
  const isFlipY = !!flipY || (scaleY !== undefined && scaleY < 0);

  if (rotation) {
    const centerX = x + drawWidth / 2;
    const centerY = y + drawHeight / 2;
    manager.ctx.translate(centerX, centerY);
    manager.ctx.rotate(rotation);
    manager.ctx.translate(-centerX, -centerY);
  }

  if (!imageData) {
    drawImageLoadingPlaceholder(
      manager,
      x,
      y,
      drawWidth,
      drawHeight,
      borderRadius || 0,
      opacity
    );
    manager.requestRender();
    manager.ctx.restore();
    return;
  }

  ensureImageElement(obj, manager);
  const shouldForceLoader = (obj.loaderVisibleUntil || 0) > Date.now();

  if (!obj.imageElementLoaded || shouldForceLoader) {
    drawImageLoadingPlaceholder(
      manager,
      x,
      y,
      drawWidth,
      drawHeight,
      borderRadius || 0,
      opacity
    );
    manager.requestRender();
    manager.ctx.restore();
    return;
  }
  obj.loaderVisibleUntil = 0;

  const fadeDuration = 160;
  if (!obj.imageFadeStartAt) {
    obj.imageFadeStartAt = performance.now();
  }
  const fadeProgress = Math.min(1, (performance.now() - obj.imageFadeStartAt) / fadeDuration);
  manager.ctx.globalAlpha = (opacity !== undefined ? opacity : 1) * fadeProgress;

  if (isFlipX || isFlipY) {
    manager.ctx.save();
    manager.ctx.translate(x + drawWidth / 2, y + drawHeight / 2);
    manager.ctx.scale(isFlipX ? -1 : 1, isFlipY ? -1 : 1);
    if (borderRadius && borderRadius > 0) {
      manager.ctx.save();
      roundRect(manager, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight, borderRadius);
      manager.ctx.clip();
      manager.ctx.drawImage(obj.imageElement, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      manager.ctx.restore();
    } else {
      manager.ctx.drawImage(obj.imageElement, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    }
    manager.ctx.restore();
  } else {
    if (borderRadius && borderRadius > 0) {
      manager.ctx.save();
      roundRect(manager, x, y, drawWidth, drawHeight, borderRadius);
      manager.ctx.clip();
      manager.ctx.drawImage(obj.imageElement, x, y, drawWidth, drawHeight);
      manager.ctx.restore();
    } else {
      manager.ctx.drawImage(obj.imageElement, x, y, drawWidth, drawHeight);
    }
  }

  if (borderWidth && borderWidth > 0) {
    manager.ctx.strokeStyle = borderColor || "#000000";
    manager.ctx.lineWidth = borderWidth;
    if (borderRadius && borderRadius > 0) {
      roundRect(manager, x, y, drawWidth, drawHeight, borderRadius);
      manager.ctx.stroke();
    } else {
      manager.ctx.strokeRect(x, y, drawWidth, drawHeight);
    }
  }

  if (fadeProgress < 1) {
    manager.requestRender();
  }
  manager.ctx.restore();
}

function drawImageLoadingPlaceholder(manager, x, y, width, height, borderRadius, opacity) {
  manager.ctx.globalAlpha = (opacity !== undefined ? opacity : 1) * 0.78;
  manager.ctx.fillStyle = "#dde4ee";
  if (borderRadius && borderRadius > 0) {
    roundRect(manager, x, y, width, height, borderRadius);
    manager.ctx.fill();
  } else {
    manager.ctx.fillRect(x, y, width, height);
  }
  manager.ctx.globalAlpha = 1;

  manager.ctx.save();
  manager.ctx.strokeStyle = "rgba(59,130,246,0.65)";
  manager.ctx.lineWidth = 1.5;
  manager.ctx.setLineDash([6, 4]);
  if (borderRadius && borderRadius > 0) {
    roundRect(manager, x + 1, y + 1, width - 2, height - 2, borderRadius);
    manager.ctx.stroke();
  } else {
    manager.ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  }
  manager.ctx.setLineDash([]);
  manager.ctx.restore();

  drawImageLoadingIndicator(manager, x, y, width, height, borderRadius);
}

function drawImageLoadingIndicator(manager, x, y, width, height, borderRadius) {
  const now = performance.now();
  const shimmerW = Math.max(40, width * 0.2);
  const speed = 0.22;
  const offset = ((now * speed) % (width + shimmerW)) - shimmerW;

  manager.ctx.save();
  if (borderRadius > 0) {
    roundRect(manager, x, y, width, height, borderRadius);
    manager.ctx.clip();
  }

  const gradient = manager.ctx.createLinearGradient(x + offset, y, x + offset + shimmerW, y);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  manager.ctx.fillStyle = gradient;
  manager.ctx.fillRect(x, y, width, height);

  const r = Math.max(8, Math.min(width, height) * 0.05);
  const angle = (now / 180) % (Math.PI * 2);
  manager.ctx.strokeStyle = "rgba(55,65,81,0.55)";
  manager.ctx.lineWidth = 2;
  manager.ctx.lineCap = "round";
  manager.ctx.beginPath();
  manager.ctx.arc(x + width / 2, y + height / 2, r, angle, angle + Math.PI * 1.35);
  manager.ctx.stroke();

  manager.ctx.fillStyle = "rgba(17,24,39,0.72)";
  manager.ctx.font = "12px Arial, sans-serif";
  manager.ctx.textAlign = "center";
  manager.ctx.textBaseline = "middle";
  manager.ctx.fillText("Loading image...", x + width / 2, y + height / 2 + r + 12);
  manager.requestRender();
  manager.ctx.restore();
}

function ensureImageElement(obj, manager) {
  if (obj.imageElement && obj.imageElementSrc === obj.imageData) return;

  obj.imageElement = new Image();
  obj.imageElementSrc = obj.imageData;
  obj.imageElementLoaded = false;
  obj.imageFadeStartAt = null;

  obj.imageElement.onload = () => {
    obj.imageElementLoaded = true;
    obj.imageFadeStartAt = performance.now();
    manager.requestRender();
  };

  obj.imageElement.onerror = () => {
    obj.imageElementLoaded = false;
    obj.imageStatus = "error";
    manager.requestRender();
  };

  // Non-blocking decode path.
  obj.imageElement.decoding = "async";
  obj.imageElement.src = obj.imageData;
}

export function roundRect(manager, x, y, w, h, r) {
  let radius = r;
  if (w < 2 * radius) radius = w / 2;
  if (h < 2 * radius) radius = h / 2;

  manager.ctx.beginPath();
  manager.ctx.moveTo(x + radius, y);
  manager.ctx.lineTo(x + w - radius, y);
  manager.ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  manager.ctx.lineTo(x + w, y + h - radius);
  manager.ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  manager.ctx.lineTo(x + radius, y + h);
  manager.ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  manager.ctx.lineTo(x, y + radius);
  manager.ctx.quadraticCurveTo(x, y, x + radius, y);
  manager.ctx.closePath();
}
