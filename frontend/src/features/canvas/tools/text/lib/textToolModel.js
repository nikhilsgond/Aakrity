import { TOOL_OPTIONS } from '@shared/constants';

export function createTextObjectFromOptions(x, y, options, currentLayer = 'default') {
  return {
    id: `text-${Date.now()}`,
    type: 'text',
    x,
    y,
    text: '',
    placeholder: 'Type something...',
    placeholderColor: '#9CA3AF',
    placeholderOpacity: 0.5,
    fontFamily: options[TOOL_OPTIONS.FONT_FAMILY],
    fontSize: options[TOOL_OPTIONS.FONT_SIZE],
    textColor: options[TOOL_OPTIONS.TEXT_COLOR],
    backgroundColor: options[TOOL_OPTIONS.FILL_COLOR],
    textAlign: options[TOOL_OPTIONS.TEXT_ALIGN],
    verticalAlign: options.verticalAlign || 'top',
    fontWeight: options.fontWeight,
    fontStyle: options.fontStyle,
    underline: options.underline,
    strikethrough: options.strikethrough,
    listType: options.listType,
    autoWidth: options.autoWidth !== false,
    autoHeight: options.autoHeight !== false,
    rotation: 0,
    opacity: 1,
    layer: currentLayer,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function updateTextDimensions(obj) {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  const fontSize = obj.fontSize || 16;
  const fontFamily = obj.fontFamily || 'Arial, sans-serif';
  const fontWeight = obj.fontWeight || 'normal';
  const fontStyle = obj.fontStyle || 'normal';
  const lineHeight = fontSize * 1.2;
  tempCtx.font = `${fontWeight} ${fontStyle} ${fontSize}px ${fontFamily}`;

  const displayText = obj.text || obj.placeholder || '';
  const lines = displayText.split('\n');
  let maxWidth = 0;

  for (const line of lines) {
    const width = tempCtx.measureText(line).width;
    if (width > maxWidth) maxWidth = width;
  }

  // Use 0.4em padding on each side — matches _autoResizeTextBounds for consistency
  // Extra 0.5em buffer so the bounding box is always slightly wider than measured
  // text content (canvas measureText can underestimate at subpixel sizes — Bug 8).
  const widthPadding = fontSize * 0.4;
  const extraBuffer = fontSize * 0.5;
  const measuredWidth = Math.max(maxWidth + widthPadding * 2 + extraBuffer, fontSize * 4);
  const measuredHeight = Math.max(lines.length * lineHeight, lineHeight);

  if (obj.autoWidth !== false || obj.width == null) {
    obj.width = measuredWidth;
  }
  if (obj.autoHeight !== false || obj.height == null) {
    obj.height = measuredHeight;
  }
}

export function syncToolOptionsFromTextObject(options, textObject) {
  options[TOOL_OPTIONS.FONT_FAMILY] = textObject.fontFamily;
  options[TOOL_OPTIONS.FONT_SIZE] = textObject.fontSize;
  options[TOOL_OPTIONS.TEXT_COLOR] = textObject.textColor;
  options[TOOL_OPTIONS.TEXT_ALIGN] = textObject.textAlign;
  options[TOOL_OPTIONS.FILL_COLOR] = textObject.backgroundColor || 'transparent';
  options.verticalAlign = textObject.verticalAlign || 'top';
  options.fontWeight = textObject.fontWeight || 'normal';
  options.fontStyle = textObject.fontStyle || 'normal';
  options.underline = textObject.underline || false;
  options.strikethrough = textObject.strikethrough || false;
  options.listType = textObject.listType || 'none';
  options.autoWidth = textObject.autoWidth !== false;
  options.autoHeight = textObject.autoHeight !== false;
}

export function applyCurrentOptionsToTextObject(currentTextObject, options) {
  currentTextObject.fontFamily = options[TOOL_OPTIONS.FONT_FAMILY];
  currentTextObject.fontSize = options[TOOL_OPTIONS.FONT_SIZE];
  currentTextObject.textColor = options[TOOL_OPTIONS.TEXT_COLOR];
  currentTextObject.backgroundColor = options[TOOL_OPTIONS.FILL_COLOR];
  currentTextObject.textAlign = options[TOOL_OPTIONS.TEXT_ALIGN];
  currentTextObject.verticalAlign = options.verticalAlign || 'top';
  currentTextObject.fontWeight = options.fontWeight;
  currentTextObject.fontStyle = options.fontStyle;
  currentTextObject.underline = options.underline;
  currentTextObject.strikethrough = options.strikethrough;
  currentTextObject.listType = options.listType;
  currentTextObject.autoWidth = options.autoWidth !== false;
  currentTextObject.autoHeight = options.autoHeight !== false;
  currentTextObject.updatedAt = Date.now();
}
