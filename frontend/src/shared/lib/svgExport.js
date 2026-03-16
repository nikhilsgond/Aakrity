const DEFAULT_FONT = 'Arial, sans-serif';

const escapeXml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const sanitizeNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
};

const toDegrees = (rad) => (sanitizeNumber(rad, 0) * 180) / Math.PI;

const hasValue = (val) => val !== undefined && val !== null;

const normalizeColor = (color, fallback = 'none') => {
  if (!color || color === 'transparent') return fallback;
  return color;
};

const normalizeFill = (value) => {
  if (value === null || value === undefined) return 'none';
  if (value === '' || value === 'transparent') return 'none';
  return value;
};

const normalizeStroke = (value) => {
  if (value === null || value === undefined) return null;
  if (value === '' || value === 'transparent') return null;
  return value;
};

const buildAttributeString = (attrs = {}) => {
  const parts = [];
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return;
      parts.push(`${key}="${value}"`);
      return;
    }
    parts.push(`${key}="${escapeXml(String(value))}"`);
  });
  return parts.join(' ');
};

const buildStyleAttributes = (obj, overrides = {}) => {
  const attrs = {};
  const fillOverride = overrides.fill;
  const fillValue = normalizeFill(overrides.forceFill ? fillOverride : (obj?.fillColor ?? fillOverride));
  if (fillValue !== undefined) attrs.fill = fillValue;

  const strokeValue = normalizeStroke(obj?.strokeColor ?? overrides.stroke);
  const strokeWidthValue = sanitizeNumber(obj?.strokeWidth ?? overrides['stroke-width'], 0);
  if (strokeValue && strokeWidthValue > 0) {
    attrs.stroke = strokeValue;
    attrs['stroke-width'] = strokeWidthValue;

    const dashArray = obj?.dashArray || obj?.lineDash;
    if (Array.isArray(dashArray) && dashArray.length > 0) {
      const dashValue = dashArray
        .map((v) => sanitizeNumber(v, 0))
        .filter((v) => Number.isFinite(v))
        .join(' ');
      if (dashValue) attrs['stroke-dasharray'] = dashValue;
    }
  }

  if (hasValue(obj?.opacity)) {
    const opacityValue = sanitizeNumber(obj.opacity, 1);
    if (Number.isFinite(opacityValue)) attrs.opacity = opacityValue;
  }

  if (overrides.transform) attrs.transform = overrides.transform;
  if (overrides.href) attrs.href = overrides.href;
  return attrs;
};

const buildTransform = (obj, bounds) => {
  const transforms = [];
  const rotation = sanitizeNumber(obj.rotation, 0);
  const flipX = obj.flipX ? -1 : 1;
  const flipY = obj.flipY ? -1 : 1;
  const scaleX = hasValue(obj.scaleX) ? sanitizeNumber(obj.scaleX, 1) : 1;
  const scaleY = hasValue(obj.scaleY) ? sanitizeNumber(obj.scaleY, 1) : 1;

  if (rotation || flipX !== 1 || flipY !== 1 || scaleX !== 1 || scaleY !== 1) {
    const cx = sanitizeNumber(bounds?.cx, 0);
    const cy = sanitizeNumber(bounds?.cy, 0);

    transforms.push(`translate(${cx} ${cy})`);
    if (rotation) transforms.push(`rotate(${toDegrees(rotation)})`);
    if (flipX !== 1 || flipY !== 1 || scaleX !== 1 || scaleY !== 1) {
      transforms.push(`scale(${flipX * scaleX} ${flipY * scaleY})`);
    }
    transforms.push(`translate(${-cx} ${-cy})`);
  }

  return transforms.length > 0 ? transforms.join(' ') : '';
};

const buildPathFromPoints = (points) => {
  if (!Array.isArray(points) || points.length < 2) return '';
  const segments = [];
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    const x = sanitizeNumber(point?.x, null);
    const y = sanitizeNumber(point?.y, null);
    if (x === null || y === null) continue;
    segments.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  return segments.length >= 2 ? segments.join(' ') : '';
};

const buildPathFromLineStyle = (obj) => {
  const x1 = sanitizeNumber(obj.x1, null);
  const y1 = sanitizeNumber(obj.y1, null);
  const x2 = sanitizeNumber(obj.x2, null);
  const y2 = sanitizeNumber(obj.y2, null);
  if (x1 === null || y1 === null || x2 === null || y2 === null) return '';

  const style = obj.lineStyle || 'straight';
  if (style === 'elbow') {
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }
  if (style === 'curved') {
    const cpOff = Math.abs(x2 - x1) * 0.45 || 40;
    return `M ${x1} ${y1} C ${x1 + cpOff} ${y1} ${x2 - cpOff} ${y2} ${x2} ${y2}`;
  }

  return `M ${x1} ${y1} L ${x2} ${y2}`;
};

const buildTextRuns = (lineText, lineStart, formattedRanges, baseStyle) => {
  if (!lineText.length) {
    return [{ text: '', ...baseStyle }];
  }

  const lineEnd = lineStart + lineText.length;
  const splits = new Set([0, lineText.length]);

  for (const range of formattedRanges) {
    if (!range || range.end <= lineStart || range.start >= lineEnd) continue;
    splits.add(Math.max(0, range.start - lineStart));
    splits.add(Math.min(lineText.length, range.end - lineStart));
  }

  const points = [...splits].sort((a, b) => a - b);
  const runs = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const s = points[i];
    const e = points[i + 1];
    const charIndex = lineStart + s;

    let bold = baseStyle.fontWeight === 'bold';
    let italic = baseStyle.fontStyle === 'italic';
    let underline = baseStyle.underline;
    let strikethrough = baseStyle.strikethrough;

    for (const range of formattedRanges) {
      if (range.start <= charIndex && range.end > charIndex) {
        if (range.bold !== undefined) bold = !!range.bold;
        if (range.italic !== undefined) italic = !!range.italic;
        if (range.underline !== undefined) underline = !!range.underline;
        if (range.strikethrough !== undefined) strikethrough = !!range.strikethrough;
      }
    }

    runs.push({
      text: lineText.slice(s, e),
      fontWeight: bold ? 'bold' : 'normal',
      fontStyle: italic ? 'italic' : 'normal',
      underline,
      strikethrough,
      fontFamily: baseStyle.fontFamily,
      fontSize: baseStyle.fontSize,
      textColor: baseStyle.textColor,
    });
  }

  return runs;
};

const buildTextSvg = ({
  text,
  x,
  y,
  width,
  height,
  fontFamily,
  fontSize,
  textColor,
  fontWeight,
  fontStyle,
  underline,
  strikethrough,
  textAlign,
  verticalAlign,
  listType,
  formattedRanges,
  opacity,
  rotation,
  bounds,
}) => {
  const rawText = String(text || '').replace(/\n+$/, '');
  const hasFormatted = Array.isArray(formattedRanges) && formattedRanges.length > 0;
  const lines = rawText.split('\n');
  const baseStyle = {
    fontFamily: fontFamily || DEFAULT_FONT,
    fontSize: sanitizeNumber(fontSize, 16),
    fontWeight: fontWeight || 'normal',
    fontStyle: fontStyle || 'normal',
    underline: !!underline,
    strikethrough: !!strikethrough,
    textColor: textColor || '#000000',
  };

  const lineHeight = baseStyle.fontSize * 1.2;
  const contentHeight = Math.max(lineHeight, lines.length * lineHeight);
  const boxHeight = Math.max(sanitizeNumber(height, 0), contentHeight);

  const startY = verticalAlign === 'middle'
    ? y + (boxHeight - contentHeight) / 2
    : verticalAlign === 'bottom'
      ? y + (boxHeight - contentHeight)
      : y;

  const anchor = textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start';
  const anchorX = textAlign === 'center'
    ? sanitizeNumber(x, 0) + sanitizeNumber(width, 0) / 2
    : textAlign === 'right'
      ? sanitizeNumber(x, 0) + sanitizeNumber(width, 0)
      : sanitizeNumber(x, 0);

  const transformValue = buildTransform({ rotation }, bounds);
  const textAttrs = buildAttributeString({
    x: anchorX,
    y: sanitizeNumber(startY, 0),
    'text-anchor': anchor,
    'font-family': baseStyle.fontFamily,
    'font-size': baseStyle.fontSize,
    'font-weight': baseStyle.fontWeight,
    'font-style': baseStyle.fontStyle,
    fill: baseStyle.textColor,
    style: `line-height:${lineHeight}px;`,
    opacity: hasValue(opacity) ? sanitizeNumber(opacity, 1) : null,
    transform: transformValue || null,
  });

  let charOffset = 0;
  const lineOffsets = lines.map((line) => {
    const off = charOffset;
    charOffset += line.length + 1;
    return off;
  });

  const tspans = lines.map((line, index) => {
    const lineY = startY + lineHeight * index;
    const lineText = listType === 'unordered'
      ? (line ? `• ${line}` : '')
      : listType === 'ordered'
        ? (line ? `${index + 1}. ${line}` : '')
        : line;

    if (!hasFormatted || listType && listType !== 'none') {
      return `  <tspan x="${anchorX}" y="${sanitizeNumber(lineY, 0)}">${escapeXml(lineText)}</tspan>`;
    }

    const runs = buildTextRuns(lineText, lineOffsets[index] || 0, formattedRanges || [], baseStyle);
    const runSpans = runs.map((run) => {
      const runAttrs = {
        'font-family': run.fontFamily,
        'font-size': sanitizeNumber(run.fontSize, baseStyle.fontSize),
        'font-weight': run.fontWeight,
        'font-style': run.fontStyle,
        fill: run.textColor,
      };
      const textDecor = [run.underline ? 'underline' : '', run.strikethrough ? 'line-through' : '']
        .filter(Boolean)
        .join(' ');
      if (textDecor) runAttrs['text-decoration'] = textDecor;

      return `<tspan ${buildAttributeString(runAttrs)}>${escapeXml(run.text)}</tspan>`;
    }).join('');

    return `  <tspan x="${anchorX}" y="${sanitizeNumber(lineY, 0)}">${runSpans}</tspan>`;
  });

  return `<text ${textAttrs}>${tspans.join('')}</text>`;
};

const getShapeBounds = (obj) => {
  if (obj.shapeType === 'circle' || obj.type === 'circle') {
    const radius = sanitizeNumber(obj.radius, 0);
    const cx = sanitizeNumber(obj.x, 0);
    const cy = sanitizeNumber(obj.y, 0);
    return { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2, cx, cy };
  }
  if (obj.shapeType === 'ellipse' || obj.type === 'ellipse') {
    const rx = sanitizeNumber(obj.radiusX, 0);
    const ry = sanitizeNumber(obj.radiusY, 0);
    const cx = sanitizeNumber(obj.x, 0);
    const cy = sanitizeNumber(obj.y, 0);
    return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2, cx, cy };
  }
  const x = sanitizeNumber(obj.x, 0);
  const y = sanitizeNumber(obj.y, 0);
  const width = sanitizeNumber(obj.width, 0);
  const height = sanitizeNumber(obj.height, 0);
  return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
};

const buildImageFallback = (obj, bounds, transformValue) => {
  const fill = '#F3F4F6';
  const stroke = '#9CA3AF';
  const rectAttrs = buildAttributeString({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fill,
    stroke,
    'stroke-width': 1,
  });
  const rect = `<rect ${rectAttrs} />`;
  const textAttrs = buildAttributeString({
    x: bounds.cx,
    y: bounds.cy,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    'font-family': DEFAULT_FONT,
    'font-size': 12,
    fill: '#6B7280',
  });
  const text = `<text ${textAttrs}>image missing</text>`;
  if (transformValue) {
    return `<g ${buildAttributeString({ transform: transformValue })}>${rect}${text}</g>`;
  }
  return `${rect}${text}`;
};

const buildInnerTextForShape = (obj, bounds) => {
  if (!obj.innerTextEnabled || !obj.innerText) return '';
  return buildTextSvg({
    text: obj.innerText,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fontFamily: obj.fontFamily || DEFAULT_FONT,
    fontSize: obj.innerTextSize || 14,
    textColor: obj.innerTextColor || '#111827',
    fontWeight: obj.innerTextWeight || 'normal',
    fontStyle: obj.innerTextStyle || 'normal',
    underline: obj.innerTextUnderline,
    strikethrough: obj.innerTextStrikethrough,
    textAlign: obj.innerTextAlign || 'center',
    verticalAlign: obj.innerTextVerticalAlign || 'middle',
    listType: obj.innerTextListType || 'none',
    opacity: obj.opacity,
    rotation: obj.rotation,
    bounds,
  });
};

const wrapShapeWithText = (shapeMarkup, textMarkup) => {
  if (!textMarkup) return shapeMarkup;
  return `<g>${shapeMarkup}${textMarkup}</g>`;
};

const mergeBounds = (current, next) => {
  if (!next) return current;
  if (!current) return { ...next };
  return {
    minX: Math.min(current.minX, next.minX),
    minY: Math.min(current.minY, next.minY),
    maxX: Math.max(current.maxX, next.maxX),
    maxY: Math.max(current.maxY, next.maxY),
  };
};

const computeObjectBounds = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.visible === false || obj.hidden === true) return null;

  const type = obj.type === 'shape' ? obj.shapeType : obj.type;
  const strokePad = Math.max(0, sanitizeNumber(obj.strokeWidth, 0)) / 2;

  if (type === 'line' || type === 'arrow' || type === 'connector') {
    const x1 = sanitizeNumber(obj.x1, null);
    const y1 = sanitizeNumber(obj.y1, null);
    const x2 = sanitizeNumber(obj.x2, null);
    const y2 = sanitizeNumber(obj.y2, null);
    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
    return {
      minX: Math.min(x1, x2) - strokePad,
      minY: Math.min(y1, y2) - strokePad,
      maxX: Math.max(x1, x2) + strokePad,
      maxY: Math.max(y1, y2) + strokePad,
    };
  }

  if (type === 'drawing') {
    if (!Array.isArray(obj.points) || obj.points.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    obj.points.forEach((pt) => {
      const x = sanitizeNumber(pt?.x, null);
      const y = sanitizeNumber(pt?.y, null);
      if (x === null || y === null) return;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
    return {
      minX: minX - strokePad,
      minY: minY - strokePad,
      maxX: maxX + strokePad,
      maxY: maxY + strokePad,
    };
  }

  if (type === 'polygon' || type === 'triangle' || type === 'diamond' || type === 'star' || type === 'hexagon' || type === 'pentagon') {
    if (!Array.isArray(obj.points) || obj.points.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    obj.points.forEach((pt) => {
      const x = sanitizeNumber(pt?.x, null);
      const y = sanitizeNumber(pt?.y, null);
      if (x === null || y === null) return;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
    return {
      minX: minX - strokePad,
      minY: minY - strokePad,
      maxX: maxX + strokePad,
      maxY: maxY + strokePad,
    };
  }

  if (type === 'circle') {
    const r = sanitizeNumber(obj.radius, 0);
    if (r <= 0) return null;
    const cx = sanitizeNumber(obj.x, 0);
    const cy = sanitizeNumber(obj.y, 0);
    return {
      minX: cx - r - strokePad,
      minY: cy - r - strokePad,
      maxX: cx + r + strokePad,
      maxY: cy + r + strokePad,
    };
  }

  if (type === 'ellipse') {
    const rx = sanitizeNumber(obj.radiusX, 0);
    const ry = sanitizeNumber(obj.radiusY, 0);
    if (rx <= 0 || ry <= 0) return null;
    const cx = sanitizeNumber(obj.x, 0);
    const cy = sanitizeNumber(obj.y, 0);
    return {
      minX: cx - rx - strokePad,
      minY: cy - ry - strokePad,
      maxX: cx + rx + strokePad,
      maxY: cy + ry + strokePad,
    };
  }

  const x = sanitizeNumber(obj.x, null);
  const y = sanitizeNumber(obj.y, null);
  const width = sanitizeNumber(obj.width, 0);
  const height = sanitizeNumber(obj.height, 0);
  if (x === null || y === null || width <= 0 || height <= 0) return null;

  return {
    minX: x - strokePad,
    minY: y - strokePad,
    maxX: x + width + strokePad,
    maxY: y + height + strokePad,
  };
};

const computeContentBounds = (objects) => {
  if (!Array.isArray(objects) || objects.length === 0) return null;
  let bounds = null;
  objects.forEach((obj) => {
    const next = computeObjectBounds(obj);
    bounds = mergeBounds(bounds, next);
  });
  return bounds;
};

const buildSvgForObject = (obj, options) => {
  if (!obj || typeof obj !== 'object') return '';
  if (obj.visible === false || obj.hidden === true) return '';

  const type = obj.type === 'shape' ? obj.shapeType : obj.type;
  const bounds = getShapeBounds({ ...obj, type });
  const transformValue = buildTransform(obj, bounds);

  switch (type) {
    case 'rectangle':
    case 'roundedRectangle': {
      if (bounds.width <= 0 || bounds.height <= 0) return '';
      const corner = sanitizeNumber(obj.cornerRadius, 0);
      const styleAttrs = buildStyleAttributes(obj, { fill: normalizeFill(obj.fillColor) });
      const attrs = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        rx: corner > 0 ? corner : null,
        ry: corner > 0 ? corner : null,
        transform: transformValue || null,
        ...styleAttrs,
      };
      const shape = `<rect ${buildAttributeString(attrs)} />`;
      const innerText = buildInnerTextForShape(obj, bounds);
      return wrapShapeWithText(shape, innerText);
    }
    case 'circle': {
      const radius = sanitizeNumber(obj.radius, 0);
      if (radius <= 0) return '';
      const styleAttrs = buildStyleAttributes(obj, { fill: normalizeFill(obj.fillColor) });
      const attrs = {
        cx: sanitizeNumber(obj.x, 0),
        cy: sanitizeNumber(obj.y, 0),
        r: radius,
        transform: transformValue || null,
        ...styleAttrs,
      };
      const shape = `<circle ${buildAttributeString(attrs)} />`;
      const innerText = buildInnerTextForShape(obj, bounds);
      return wrapShapeWithText(shape, innerText);
    }
    case 'ellipse': {
      const rx = sanitizeNumber(obj.radiusX, 0);
      const ry = sanitizeNumber(obj.radiusY, 0);
      if (rx <= 0 || ry <= 0) return '';
      const styleAttrs = buildStyleAttributes(obj, { fill: normalizeFill(obj.fillColor) });
      const attrs = {
        cx: sanitizeNumber(obj.x, 0),
        cy: sanitizeNumber(obj.y, 0),
        rx,
        ry,
        transform: transformValue || null,
        ...styleAttrs,
      };
      const shape = `<ellipse ${buildAttributeString(attrs)} />`;
      const innerText = buildInnerTextForShape(obj, bounds);
      return wrapShapeWithText(shape, innerText);
    }
    case 'line': {
      const x1 = sanitizeNumber(obj.x1, null);
      const y1 = sanitizeNumber(obj.y1, null);
      const x2 = sanitizeNumber(obj.x2, null);
      const y2 = sanitizeNumber(obj.y2, null);
      if (x1 === null || y1 === null || x2 === null || y2 === null) return '';

      if (obj.lineStyle && obj.lineStyle !== 'straight') {
        const d = buildPathFromLineStyle(obj);
        if (!d) return '';
           const styleAttrs = buildStyleAttributes(obj, { fill: 'none', forceFill: true });
        const attrs = {
          d,
          transform: transformValue || null,
          ...styleAttrs,
        };
        return `<path ${buildAttributeString(attrs)} />`;
      }

      const styleAttrs = buildStyleAttributes(obj, { fill: 'none', forceFill: true });
      const attrs = {
        x1,
        y1,
        x2,
        y2,
        transform: transformValue || null,
        ...styleAttrs,
      };
      return `<line ${buildAttributeString(attrs)} />`;
    }
    case 'arrow': {
      const d = buildPathFromLineStyle(obj);
      if (!d) return '';
         const styleAttrs = buildStyleAttributes(obj, { fill: 'none', forceFill: true });
      const attrs = {
        d,
        'marker-end': 'url(#arrowhead)',
        transform: transformValue || null,
        ...styleAttrs,
      };
      return `<path ${buildAttributeString(attrs)} />`;
    }
    case 'polygon':
    case 'triangle':
    case 'diamond':
    case 'star':
    case 'hexagon':
    case 'pentagon': {
      if (!Array.isArray(obj.points) || obj.points.length < 3) return '';
      const points = obj.points
        .map((pt) => `${sanitizeNumber(pt.x, 0)},${sanitizeNumber(pt.y, 0)}`)
        .join(' ');
      const styleAttrs = buildStyleAttributes(obj, { fill: normalizeFill(obj.fillColor) });
      const attrs = {
        points,
        transform: transformValue || null,
        ...styleAttrs,
      };
      const shape = `<polygon ${buildAttributeString(attrs)} />`;
      const innerText = buildInnerTextForShape(obj, bounds);
      return wrapShapeWithText(shape, innerText);
    }
    case 'drawing': {
      const d = buildPathFromPoints(obj.points);
      if (!d) return '';
      const styleAttrs = buildStyleAttributes(obj, { fill: 'none', forceFill: true });
      const attrs = {
        d,
        transform: transformValue || null,
        ...styleAttrs,
      };
      return `<path ${buildAttributeString(attrs)} />`;
    }
    case 'text': {
      if (!obj.text && obj.placeholder && !obj.isTempPlaceholder) {
        obj = { ...obj, text: obj.placeholder, textColor: obj.placeholderColor || '#9CA3AF', opacity: obj.placeholderOpacity ?? obj.opacity };
      }
      if (!obj.text) return '';

      const backgroundColor = normalizeColor(obj.backgroundColor, 'none');
      const background = backgroundColor !== 'none' && bounds.width > 0 && bounds.height > 0
        ? `<rect ${buildAttributeString({
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            fill: backgroundColor,
            transform: transformValue || null,
          })} />`
        : '';

      const textSvg = buildTextSvg({
        text: obj.text,
        x: sanitizeNumber(obj.x, 0),
        y: sanitizeNumber(obj.y, 0),
        width: sanitizeNumber(obj.width, 0),
        height: sanitizeNumber(obj.height, 0),
        fontFamily: obj.fontFamily,
        fontSize: obj.fontSize,
        textColor: obj.textColor,
        fontWeight: obj.fontWeight,
        fontStyle: obj.fontStyle,
        underline: obj.underline,
        strikethrough: obj.strikethrough,
        textAlign: obj.textAlign || 'left',
        verticalAlign: obj.verticalAlign || 'top',
        listType: obj.listType || 'none',
        formattedRanges: obj.formattedRanges,
        opacity: obj.opacity,
        rotation: obj.rotation,
        bounds,
      });
      return `${background}${textSvg}`;
    }
    case 'emoji': {
      if (bounds.width <= 0 || bounds.height <= 0) return '';
      if (!obj.emoji) return '';
      const fontSize = Math.min(bounds.width, bounds.height) * 0.85 || 16;
      const textObj = {
        text: obj.emoji,
        x: bounds.cx,
        y: bounds.cy - fontSize / 2,
        width: bounds.width,
        height: bounds.height,
        fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
        fontSize,
        textColor: '#000000',
        textAlign: 'center',
        verticalAlign: 'middle',
        opacity: obj.opacity,
        rotation: obj.rotation,
      };
      return buildTextSvg({
        ...textObj,
        bounds,
      });
    }
    case 'sticky': {
      if (bounds.width <= 0 || bounds.height <= 0) return '';
      const fill = obj.noteColor || '#FFF176';
      const rectAttrs = buildAttributeString({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        rx: 6,
        ry: 6,
        fill,
        stroke: 'rgba(0,0,0,0.22)',
        'stroke-width': 1,
        opacity: hasValue(obj.opacity) ? sanitizeNumber(obj.opacity, 1) : null,
        transform: transformValue || null,
      });
      const rect = `<rect ${rectAttrs} />`;
      const text = obj.text
        ? buildTextSvg({
            text: obj.text,
            x: bounds.x + 12,
            y: bounds.y + 12,
            width: Math.max(bounds.width - 24, 0),
            height: Math.max(bounds.height - 24, 0),
            fontFamily: obj.fontFamily || DEFAULT_FONT,
            fontSize: obj.fontSize || 14,
            textColor: obj.textColor || '#111111',
            fontWeight: obj.fontWeight || 'normal',
            fontStyle: obj.fontStyle || 'normal',
            textAlign: obj.textAlign || 'left',
            verticalAlign: obj.verticalAlign || 'top',
            listType: obj.listType || 'none',
            opacity: obj.opacity,
            rotation: obj.rotation,
            formattedRanges: obj.formattedRanges,
            bounds,
          })
        : '';
      return wrapShapeWithText(rect, text);
    }
    case 'image': {
      if (bounds.width <= 0 || bounds.height <= 0) return '';
      const href = obj.imageData || obj.src || obj.url;
      const attrs = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        transform: transformValue || null,
        opacity: hasValue(obj.opacity) ? sanitizeNumber(obj.opacity, 1) : null,
      };
      if (href && obj.imageStatus !== 'error') {
        attrs.href = href;
        return `<image ${buildAttributeString(attrs)} />`;
      }
      return buildImageFallback(obj, bounds, transformValue);
    }
    case 'connector': {
      const d = buildPathFromLineStyle(obj);
      if (!d) return '';
         const styleAttrs = buildStyleAttributes(obj, { fill: 'none', forceFill: true });
      const attrs = {
        d,
        transform: transformValue || null,
        ...styleAttrs,
      };
      return `<path ${buildAttributeString(attrs)} />`;
    }
    default:
      console.warn('SVG export: unsupported object type', type, obj?.id);
      return '';
  }
};

export async function exportCanvasSnapshotToSvg({
  snapshot,
  onProgress,
  shouldCancel,
  batchSize = 50,
}) {
  if (!snapshot || !Array.isArray(snapshot.objects)) return null;

  const rawBounds = computeContentBounds(snapshot.objects);
  const margin = 16;
  const bounds = rawBounds
    ? {
        minX: rawBounds.minX - margin,
        minY: rawBounds.minY - margin,
        maxX: rawBounds.maxX + margin,
        maxY: rawBounds.maxY + margin,
      }
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const width = sanitizeNumber(bounds.maxX, 0) - sanitizeNumber(bounds.minX, 0);
  const height = sanitizeNumber(bounds.maxY, 0) - sanitizeNumber(bounds.minY, 0);
  const safeWidth = Math.max(0, width);
  const safeHeight = Math.max(0, height);

  const offsetX = -sanitizeNumber(bounds.minX, 0);
  const offsetY = -sanitizeNumber(bounds.minY, 0);

  const total = snapshot.objects.length;
  const parts = [];
  const hasArrow = snapshot.objects.some((obj) => (obj.type === 'shape' ? obj.shapeType : obj.type) === 'arrow');

  const outputWidth = safeWidth || 1;
  const outputHeight = safeHeight || 1;

  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}">`);

  if (hasArrow) {
    parts.push('<defs>');
    parts.push('<marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">');
    parts.push('<path d="M0,0 L8,4 L0,8 Z" fill="context-stroke" />');
    parts.push('</marker>');
    parts.push('</defs>');
  }

  parts.push(`<g transform="translate(${offsetX} ${offsetY})">`);

  for (let i = 0; i < total; i += 1) {
    if (shouldCancel && shouldCancel()) return null;

    const obj = snapshot.objects[i];
    const svg = buildSvgForObject(obj);
    if (svg) parts.push(svg);

    if ((i + 1) % batchSize === 0) {
      if (onProgress) onProgress(i + 1, total);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  if (onProgress) onProgress(total, total);

  parts.push('</g>');
  parts.push('</svg>');

  return parts.join('');
}
