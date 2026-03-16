// src/canvas/tools/text/TextTool.js
import { TOOL_OPTIONS } from '@shared/constants';
import { TextCommandFactory } from '../../engine/commands/TextCommands';
import useCollaborationStore from '@features/room/state/collaborationStore';
import { ObjectTextCommand } from '../../engine/commands/ObjectTextCommand';
import {
  createTextObjectFromOptions,
  updateTextDimensions as updateTextDimensionsModel,
  syncToolOptionsFromTextObject,
  applyCurrentOptionsToTextObject,
} from './lib/textToolModel';

export class TextTool {
  constructor(options = {}) {
    this.name = 'text';
    this.description = 'Add and edit text';
    this.icon = 'type';
    this.cursor = 'text';
    this.toolType = 'text';

    this.options = {
      [TOOL_OPTIONS.FONT_FAMILY]: options.fontFamily || 'Arial, sans-serif',
      [TOOL_OPTIONS.FONT_SIZE]: options.fontSize || 24,
      [TOOL_OPTIONS.TEXT_COLOR]: options.textColor || '#000000',
      [TOOL_OPTIONS.TEXT_ALIGN]: options.textAlign || 'left',
      [TOOL_OPTIONS.FILL_COLOR]: options.backgroundColor || 'transparent',
      verticalAlign: options.verticalAlign || 'top',
      fontStyle: options.fontStyle || 'normal',
      fontWeight: options.fontWeight || 'normal',
      underline: options.underline || false,
      strikethrough: options.strikethrough || false,
      listType: options.listType || 'none',
      autoWidth: options.autoWidth !== false,
      autoHeight: options.autoHeight !== false,
    };

    this.isCreating = false;
    this.isSelected = false;
    this.isEditing = false;
    this.selectedTextId = null;
    this.currentTextObject = null;
    this.editingTextId = null;
    this.startPoint = null;
    this.canvasManager = null;
    this.selectionManager = null;

    this.textInput = null;
    this.floatingToolbarVisible = false;
    this.viewportChangeHandler = null;

    // Issue 1 fix: track blur timer to cancel it on explicit finish
    this._blurTimer = null;
    this._isFinishing = false;
    this._historyTimer = null;
    this._lastHistoryText = '';
    this._lastHistoryRanges = [];
  }

  getCursor() {
    return this.cursor;
  }

  setOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    if (this.isEditing && this.editingTextId) {
      this.updateCurrentText();
    }
  }

  setSelectionManager(selectionManager) {
    this.selectionManager = selectionManager;
  }

  activate(canvasManager, toolOptions) {
    this.canvasManager = canvasManager;

    if (toolOptions && !this.isEditing) {
      this.setOptions(toolOptions);
    }

    this.viewportChangeHandler = () => {
      if (this.isEditing && this.textInput) {
        this.positionTextarea();
      }
    };

    if (canvasManager) {
      canvasManager.on('viewport:changed', this.viewportChangeHandler);
      // Reposition textarea when the text object is moved while editing
      // (local drag or remote smoothMove both emit move:update / move:final)
      canvasManager.on('move:update', this.viewportChangeHandler);
      canvasManager.on('move:final', this.viewportChangeHandler);
      canvasManager.on('transform:update', this.viewportChangeHandler);
      canvasManager.on('transform:final', this.viewportChangeHandler);
    }
  }

  deactivate() {
    if (this.isEditing && this.editingTextId && this.canvasManager) {
      this.finishEditing();
    }

    if (this.canvasManager && this.viewportChangeHandler) {
      this.canvasManager.off('viewport:changed', this.viewportChangeHandler);
      this.canvasManager.off('move:update', this.viewportChangeHandler);
      this.canvasManager.off('move:final', this.viewportChangeHandler);
      this.canvasManager.off('transform:update', this.viewportChangeHandler);
      this.canvasManager.off('transform:final', this.viewportChangeHandler);
      this.viewportChangeHandler = null;
    }

    this.removeTextInput();
    this.isCreating = false;
    this.isEditing = false;
    this.currentTextObject = null;
    this.editingTextId = null;
    this.startPoint = null;
    this.floatingToolbarVisible = false;
    this._isFinishing = false;
  }

  onPointerDown(event) {
    if (!this.canvasManager) return null;

    const { x, y, screenX, screenY } = event;
    this.startPoint = { x, y };

    const hitObjects = this.canvasManager.getObjectsAtPoint(screenX, screenY, 5);
    const textObject = hitObjects.find(obj => obj.type === 'text');

    if (textObject) {
      if (this.isEditing && this.editingTextId && this.editingTextId !== textObject.id) {
        this.finishEditing({ keepSelected: false });
      }
      this.canvasManager.setSelection([textObject.id]);
      this.selectedTextId = textObject.id;
      this.isSelected = true;
      this.startEditingExisting(textObject, { x, y });
      return null;
    }

    // Clicking empty canvas while editing should commit and fully exit edit mode.
    if (this.isEditing && this.editingTextId) {
      this.finishEditing({ keepSelected: false });
      return null; // ← stop here, don't fall through to createNewText
    }

    this.canvasManager.clearSelection();

    const bounds = this.canvasManager.state.canvasBounds;
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, x));
    const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, y));

    this.createNewText(clampedX, clampedY);
    return null;
  }

  onPointerMove(event) { return; }

  onPointerUp(event) {
    this.startPoint = null;
    return null;
  }

  createNewText(x, y) {
    const bounds = this.canvasManager.state.canvasBounds;
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, x));
    const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, y));


    const textObject = createTextObjectFromOptions(
      clampedX,
      clampedY,
      this.options,
      this.canvasManager.state.currentLayer || 'default'
    );

    this.updateTextDimensions(textObject);
    // Left-center anchor: click point is the left-center of text box
    textObject.y -= textObject.height / 2;

    textObject.y = Math.max(bounds.minY, Math.min(bounds.maxY - textObject.height, textObject.y));

    const command = TextCommandFactory.createText(
      textObject.text, textObject.x, textObject.y,
      {
        fontFamily: textObject.fontFamily,
        fontSize: textObject.fontSize,
        color: textObject.textColor,
        backgroundColor: textObject.backgroundColor,
        textAlign: textObject.textAlign,
        verticalAlign: textObject.verticalAlign,
        fontWeight: textObject.fontWeight,
        fontStyle: textObject.fontStyle,
        underline: textObject.underline,
        strikethrough: textObject.strikethrough,
        listType: textObject.listType,
        autoWidth: textObject.autoWidth,
        autoHeight: textObject.autoHeight,
        width: textObject.width,
        height: textObject.height,
        layer: textObject.layer,
        placeholder: textObject.placeholder,
        placeholderColor: textObject.placeholderColor,
        placeholderOpacity: textObject.placeholderOpacity,
        isTempPlaceholder: true,
      }
    );

    this.canvasManager.executeLocalCommand(command);
    const createdObject = this.canvasManager.getObjectById(command.textObject.id) || command.textObject;
    this.selectedTextId = createdObject.id;
    if (this.selectionManager) {
      this.selectionManager.set([this.selectedTextId]);
    }
    this.canvasManager.setSelection([this.selectedTextId]);
    this.isSelected = true;
    this.startEditingExisting(createdObject);

    return command;
  }

  updateTextDimensions(obj) {
    return updateTextDimensionsModel(obj);
  }

  startEditingExisting(textObject, clickPoint = null) {
    // Check if object is locked by another user
    const collabStore = useCollaborationStore.getState();
    if (collabStore.isLockedByOther && collabStore.isLockedByOther(textObject.id)) {
      return; // Object is locked by another user, can't edit
    }

    if (this.selectionManager) {
      this.selectionManager.set([textObject.id]);
    }
    this.canvasManager.setSelection([textObject.id]);

    // Request lock for this object
    if (collabStore.lockObjects) {
      collabStore.lockObjects([textObject.id]);
    }

    this.isEditing = true;
    this.editingTextId = textObject.id;
    this.currentTextObject = { ...textObject };

    this._lastHistoryText = textObject.text || '';
    this._lastHistoryRanges = Array.isArray(textObject.formattedRanges)
      ? textObject.formattedRanges.map(r => ({ ...r }))
      : [];
    this.floatingToolbarVisible = true;

    // Mark object as locked on the local state
    const stateObj = this.canvasManager.getObjectById(textObject.id);
    if (stateObj) {
      stateObj.lockedBy = collabStore.currentUser?.id || null;
    }

    syncToolOptionsFromTextObject(this.options, textObject);

    this.canvasManager.emit('text:editing', {
      textId: this.editingTextId,
      textObject: this.currentTextObject,
      position: { x: textObject.x, y: textObject.y }
    });

    this.createTextInput(clickPoint);
  }

  // ─── Rich-text / contenteditable helpers ─────────────────────────

  /** Escape characters that would break innerHTML assignment */
  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Build innerHTML for the contenteditable editor from a plain text string
   * and a formattedRanges array.  Each paragraph (separated by \n) becomes a
   * <div>; inline formatting is rendered with <span style="…"> so the user
   * can see bold / italic / underline live while typing.
   */
  _buildEditableHTML(text, formattedRanges = []) {
    if (!text && (!formattedRanges || !formattedRanges.length)) return '';
    const lines = (text || '').split('\n');
    let pos = 0;
    return lines.map((line) => {
      const lineStart = pos;
      pos += line.length + 1; // +1 for the \n separator
      if (!line.length) return '<div><br></div>';
      if (!formattedRanges || !formattedRanges.length) return `<div>${this._escapeHtml(line)}</div>`;

      // Collect split points within this line
      const splits = new Set([0, line.length]);
      for (const r of formattedRanges) {
        const rS = Math.max(0, r.start - lineStart);
        const rE = Math.min(line.length, r.end - lineStart);
        if (rE > rS) { splits.add(rS); splits.add(rE); }
      }
      const pts = [...splits].sort((a, b) => a - b);

      let html = '';
      for (let i = 0; i < pts.length - 1; i++) {
        const s = pts[i], e = pts[i + 1];
        const chars = this._escapeHtml(line.slice(s, e));
        const absIdx = lineStart + s;
        let bold = false, italic = false, underline = false;
        for (const r of formattedRanges) {
          if (r.start <= absIdx && r.end > absIdx) {
            if (r.bold) bold = true;
            if (r.italic) italic = true;
            if (r.underline) underline = true;
          }
        }
        if (bold || italic || underline) {
          const styles = [];
          if (bold) styles.push('font-weight:bold');
          if (italic) styles.push('font-style:italic');
          if (underline) styles.push('text-decoration:underline');
          html += `<span style="${styles.join(';')}">${chars}</span>`;
        } else {
          html += chars;
        }
      }
      return `<div>${html}</div>`;
    }).join('');
  }

  /**
   * Walk the contenteditable DOM and extract {text, formattedRanges}.
   * Supports <b>, <strong>, <i>, <em>, <u>, and inline-styled <span>s.
   * Block elements (<div>, <p>) become newlines; <br> inside a block also
   * becomes a newline (Chrome inserts these for empty lines).
   */
  _serializeEditable(el) {
    const textParts = [];
    const rawRanges = [];
    let pos = 0;
    let isFirstBlock = true;

    const walkNode = (node, bold, italic, underline) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent || '';
        if (t.length > 0) {
          if (bold || italic || underline) {
            rawRanges.push({ start: pos, end: pos + t.length, bold, italic, underline });
          }
          textParts.push(t);
          pos += t.length;
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();

      // Block-level elements emit a newline before their content (except the first)
      if (tag === 'div' || tag === 'p') {
        if (!isFirstBlock) {
          textParts.push('\n');
          pos++;
        }
        isFirstBlock = false;
      } else if (tag === 'br') {
        // <br> at end of a block is Chrome's artifact — emit newline only when
        // the <br> is the ONLY child of its div (i.e. an empty line).
        if (node.parentNode && node.parentNode.childNodes.length === 1) {
          // empty block — parent's newline prefix already handled, nothing extra
        } else {
          textParts.push('\n');
          pos++;
        }
        return;
      }

      // Detect formatting from element tag or inline style
      let newBold = bold, newItalic = italic, newUl = underline;
      if (tag === 'b' || tag === 'strong') newBold = true;
      if (tag === 'i' || tag === 'em') newItalic = true;
      if (tag === 'u') newUl = true;
      const st = node.style;
      if (st) {
        const fw = st.fontWeight;
        if (fw === 'bold' || parseInt(fw) >= 700) newBold = true;
        if (st.fontStyle === 'italic') newItalic = true;
        if ((st.textDecoration || '').includes('underline')) newUl = true;
      }

      node.childNodes.forEach(child => walkNode(child, newBold, newItalic, newUl));
    };

    el.childNodes.forEach(child => walkNode(child, false, false, false));

    const text = textParts.join('');
    const formattedRanges = rawRanges.filter(r => r.end > r.start);
    return { text, formattedRanges };
  }

  createTextInput(clickPoint = null) {
    this.removeTextInput();
    if (!this.currentTextObject || !this.canvasManager) return;

    // Inject placeholder CSS once (safe to repeat — the id guard prevents doubles)
    if (!document.getElementById('text-tool-placeholder-style')) {
      const style = document.createElement('style');
      style.id = 'text-tool-placeholder-style';
      style.textContent = [
        '[data-text-tool-input][data-placeholder]:empty::before {',
        '  content: attr(data-placeholder);',
        '  display: block;',
        '  color: #9CA3AF;',
        '  opacity: 0.7;',
        '  pointer-events: none;',
        '}',
      ].join('\n');
      document.head.appendChild(style);
    }

    const obj = this.currentTextObject;
    const fontSize = obj.fontSize || 16;

    // ── Create a contenteditable div so formatting is visible during editing ──
    // This replaces the old <textarea> approach (Bug 6).
    this.textInput = document.createElement('div');
    this.textInput.contentEditable = 'true';
    this.textInput.setAttribute('data-text-tool-input', 'true');
    this.textInput.setAttribute('data-rich-text-editor', 'true');
    this.textInput.setAttribute('spellcheck', 'false');

    // Populate initial HTML with any existing text + formatted ranges
    const existingHtml = this._buildEditableHTML(
      obj.text || '',
      obj.formattedRanges || []
    );
    this.textInput.innerHTML = existingHtml;

    // Show placeholder via CSS data-attribute when empty
    if (!obj.text) {
      this.textInput.setAttribute('data-placeholder', obj.placeholder || 'Type something...');
    }

    Object.assign(this.textInput.style, {
      position: 'fixed',
      zIndex: '920',
      border: 'none',
      outline: 'none',
      overflow: 'hidden',
      background: 'transparent',
      caretColor: obj.textColor || '#000000',
      color: obj.textColor || '#000000',
      fontFamily: obj.fontFamily || 'Arial, sans-serif',
      fontSize: `${fontSize}px`,
      fontWeight: obj.fontWeight || 'normal',
      fontStyle: obj.fontStyle || 'normal',
      lineHeight: '1.2',
      textAlign: obj.textAlign || 'left',
      padding: '0 1px',
      margin: '0',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      minWidth: '4px',
      minHeight: `${fontSize * 1.2}px`,
      boxSizing: 'border-box',
      transformOrigin: 'top left',
      // Removes the default blue focus ring that contenteditable shows
      WebkitUserModify: 'read-write',
      userSelect: 'text',
      cursor: 'text',
    });

    document.body.appendChild(this.textInput);
    this.positionTextarea();

    this.textInput.focus();

    // Place cursor at end of content (or at click position if available)
    const range = document.createRange();
    range.selectNodeContents(this.textInput);
    range.collapse(false); // collapse to end
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }

    this.handleTextInputBound = this.handleTextInput.bind(this);
    this.handleKeyDownBound = this.handleKeyDown.bind(this);
    this.handleBlurBound = this.handleBlur.bind(this);

    this.textInput.addEventListener('input', this.handleTextInputBound);
    this.textInput.addEventListener('keydown', this.handleKeyDownBound);
    this.textInput.addEventListener('blur', this.handleBlurBound);
  }

  positionTextarea() {
    if (!this.textInput || !this.currentTextObject || !this.canvasManager) return;

    const obj = this.currentTextObject;
    const canvasEl = this.canvasManager.canvas;
    if (!canvasEl) return;

    // Always read live state position so remote moves are reflected immediately
    // (prevents ghost: textarea at old pos while canvas shows object at new pos)
    const liveState = this.canvasManager.getObjectById(obj.id);
    const posSource = liveState || obj;
    const effectiveBoundsObj = { ...posSource, width: obj.width || posSource.width, height: obj.height || posSource.height };

    const canvasRect = canvasEl.getBoundingClientRect();
    const bounds = this.canvasManager.getObjectBounds(effectiveBoundsObj);
    if (!bounds) return;
    const screenPos = this.canvasManager.worldToScreen(bounds.x, bounds.y);
    const left = canvasRect.left + screenPos.x;
    const top = canvasRect.top + screenPos.y;

    const zoom = this.canvasManager.state.viewport.zoom;
    const scaledFontSize = (obj.fontSize || 16) * zoom;
    const scaledWidth = Math.max((bounds.width || obj.width || 200) * zoom, scaledFontSize * 4);
    const scaledHeight = Math.max((bounds.height || obj.height || 24) * zoom, scaledFontSize * 1.2);
    const rotation = obj.rotation || 0;
    const verticalAlign = obj.verticalAlign || 'top';
    const autoHeight = obj.autoHeight !== false;

    // When a list type is active the canvas draws markers at x; we indent the
    // contenteditable text by the same markerSpace so text lines align correctly
    // behind the canvas-rendered bullets/numbers (Bug 7 – list formatting visibility).
    const hasListType = obj.listType && obj.listType !== 'none';
    const scaledMarkerSpace = hasListType ? scaledFontSize * 1.2 : 0;

    Object.assign(this.textInput.style, {
      left: `${left}px`,
      top: `${top}px`,
      fontSize: `${scaledFontSize}px`,
      minHeight: `${scaledFontSize * 1.2}px`,
      width: `${scaledWidth}px`,
      height: `${scaledHeight}px`,
      fontFamily: obj.fontFamily || 'Arial, sans-serif',
      fontWeight: obj.fontWeight || 'normal',
      fontStyle: obj.fontStyle || 'normal',
      textAlign: obj.textAlign || 'left',
      textDecoration: [
        obj.underline ? 'underline' : '',
        obj.strikethrough ? 'line-through' : '',
      ].filter(Boolean).join(' ') || 'none',
      lineHeight: '1.2',
      color: obj.textColor || '#000000',
      caretColor: obj.textColor || '#000000',
      transform: `rotate(${rotation}rad)`,
      transformOrigin: 'top left',
      paddingTop: '0px',
      paddingBottom: '0px',
      paddingLeft: hasListType ? `${scaledMarkerSpace}px` : '1px',
      paddingRight: '1px',
    });

    // Update height: auto first so the div can shrink, then expand to scrollHeight
    this.textInput.style.height = 'auto';
    const contentHeight = this.textInput.scrollHeight;
    const finalHeight = autoHeight ? Math.max(scaledHeight, contentHeight) : scaledHeight;
    const extraVerticalSpace = Math.max(0, finalHeight - contentHeight);
    const topPadding = verticalAlign === 'middle'
      ? extraVerticalSpace / 2
      : verticalAlign === 'bottom'
        ? extraVerticalSpace
        : 0;
    const bottomPadding = Math.max(0, extraVerticalSpace - topPadding);
    this.textInput.style.paddingTop = `${topPadding}px`;
    this.textInput.style.paddingBottom = `${bottomPadding}px`;
    this.textInput.style.height = `${finalHeight}px`;
  }

  handleTextInput(e) {
    if (!this.currentTextObject || !this.editingTextId) return;

    // Serialize the contenteditable DOM to get plain text + formatting ranges.
    // This replaces the old `textarea.value` approach and gives us live rich-text
    // sync over WebSocket (Bug 6).
    const { text: newText, formattedRanges } = this._serializeEditable(this.textInput);

    this.currentTextObject.text = newText;
    this.currentTextObject.formattedRanges = formattedRanges;
    this.currentTextObject.isTempPlaceholder = !newText || newText.trim() === '';

    // Keep the placeholder attribute in sync (shown via CSS when div is empty)
    if (newText) {
      this.textInput.removeAttribute('data-placeholder');
    } else {
      this.textInput.setAttribute('data-placeholder', this.currentTextObject.placeholder || 'Type something...');
    }

    // Sync formatted ranges to live state object so the canvas renderer
    // shows formatting immediately (the creator sees it without exiting edit mode)
    const stateObj = this.canvasManager.getObjectById(this.editingTextId);
    if (stateObj) {
      stateObj.formattedRanges = [...formattedRanges];
      stateObj.text = newText;
      stateObj.isTempPlaceholder = !newText || newText.trim() === '';
      const currentUserId = useCollaborationStore.getState().currentUser?.id || null;
      if (currentUserId) {
        stateObj.lastEditedBy = currentUserId;
        stateObj.lastEditedAt = Date.now();
      }
    }

    // Auto-resize text bounds to fit content
    this._autoResizeTextBounds();
    this.positionTextarea();

    this._queueTextHistoryUpdate();

    // Broadcast live text content + formatting to remote users (throttled)
    this._emitLiveTextUpdate();
  }

  _autoResizeTextBounds() {
    if (!this.currentTextObject || !this.canvasManager) return;

    const obj = this.currentTextObject;
    const fontSize = obj.fontSize || 16;
    const lineHeight = fontSize * 1.2;
    const text = obj.text || '';
    const autoWidth = obj.autoWidth !== false;
    const autoHeight = obj.autoHeight !== false;

    const bounds = this.canvasManager.state.canvasBounds;

    // Measure text width using a temp canvas
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    let fontStr = '';
    if (obj.fontWeight && obj.fontWeight !== 'normal') fontStr += `${obj.fontWeight} `;
    if (obj.fontStyle && obj.fontStyle !== 'normal') fontStr += `${obj.fontStyle} `;
    fontStr += `${fontSize}px ${obj.fontFamily || 'Arial'}`;
    tempCtx.font = fontStr;

    // Add list marker width if applicable
    let markerSpace = 0;
    if (obj.listType && obj.listType !== 'none') {
      markerSpace = fontSize * 1.2;
    }

    // Use 0.4em side padding — consistent with updateTextDimensions
    const padding = fontSize * 0.4;
    const extraBuffer = fontSize * 0.5;
    const rawLines = text.split('\n');

    // Minimum width: 4em or the current object width
    const minWidth = fontSize * 4;
    const currentWidth = Math.max(obj.width || minWidth, minWidth);
    const maxAllowedWidth = Math.max(minWidth, bounds.maxX - obj.x);
    const widestRawLine = rawLines.reduce((max, rawLine) => {
      if (!rawLine.length) return max;
      return Math.max(max, tempCtx.measureText(rawLine).width + markerSpace);
    }, 0);
    const widthTarget = autoWidth
      ? Math.min(maxAllowedWidth, Math.max(widestRawLine + padding * 2 + extraBuffer, minWidth))
      : currentWidth;

    // Available space for text inside the bounding box
    const availableTextWidth = Math.max(fontSize, widthTarget - padding * 2 - extraBuffer - markerSpace);

    // Word-wrap lines to fit within the available width and count total visual lines
    let totalVisualLines = 0;
    let maxLineWidth = 0;

    for (const rawLine of rawLines) {
      if (rawLine.length === 0) {
        totalVisualLines++;
        continue;
      }

      const lineW = tempCtx.measureText(rawLine).width;
      if (lineW <= availableTextWidth) {
        totalVisualLines++;
        if (lineW + markerSpace > maxLineWidth) maxLineWidth = lineW + markerSpace;
      } else {
        // Wrap this line — count how many visual lines it takes
        const words = rawLine.split(/(\s+)/);
        let currentLineW = 0;
        let visualLinesForThisLine = 1;

        for (const word of words) {
          const wordW = tempCtx.measureText(word).width;
          if (currentLineW + wordW > availableTextWidth && currentLineW > 0) {
            visualLinesForThisLine++;
            currentLineW = wordW;
          } else if (wordW > availableTextWidth) {
            // Hard-wrap very long tokens (no spaces) at character level.
            let chunkW = currentLineW;
            for (const ch of word) {
              const chW = tempCtx.measureText(ch).width;
              if (chunkW + chW > availableTextWidth && chunkW > 0) {
                visualLinesForThisLine++;
                chunkW = chW;
              } else {
                chunkW += chW;
              }
            }
            currentLineW = chunkW;
          } else {
            currentLineW += wordW;
          }
        }

        totalVisualLines += visualLinesForThisLine;
        // This line needs full width
        maxLineWidth = Math.max(maxLineWidth, availableTextWidth + markerSpace);
      }
    }

    // Content-driven minimum: never clip text
    const contentWidth = Math.max(maxLineWidth + padding * 2 + extraBuffer, minWidth);
    const contentHeight = Math.max(totalVisualLines * lineHeight, lineHeight);

    obj.width = autoWidth ? Math.min(maxAllowedWidth, contentWidth) : currentWidth;
    if (autoHeight) {
      obj.height = contentHeight;
    }

    if (obj.x + obj.width > bounds.maxX) {
      obj.x = Math.max(bounds.minX, bounds.maxX - obj.width);
    }
    if (obj.y + obj.height > bounds.maxY) {
      obj.y = Math.max(bounds.minY, bounds.maxY - obj.height);
    }


    // Update object index
    this.canvasManager.updateObjectIndex?.();
    this.canvasManager.requestRender();
  }

  _emitLiveTextUpdate() {
    if (!this.currentTextObject || !this.editingTextId) return;

    if (this._liveTextTimer) clearTimeout(this._liveTextTimer);
    this._liveTextTimer = setTimeout(() => {
      if (!this.currentTextObject || !this.editingTextId) return;
      const obj = this.currentTextObject;
      this.canvasManager.emit('text:update', {
        textId: this.editingTextId,
        text: obj.text,
        fontFamily: obj.fontFamily,
        fontSize: obj.fontSize,
        textColor: obj.textColor,
        textAlign: obj.textAlign,
        verticalAlign: obj.verticalAlign,
        fontWeight: obj.fontWeight,
        fontStyle: obj.fontStyle,
        underline: obj.underline,
        strikethrough: obj.strikethrough,
        backgroundColor: obj.backgroundColor,
        listType: obj.listType,
        autoWidth: obj.autoWidth,
        autoHeight: obj.autoHeight,
        formattedRanges: obj.formattedRanges || [],
        width: obj.width,
        height: obj.height,
      });
      this._liveTextTimer = null;
    }, 100); // Throttle to 100ms
  }

  _queueTextHistoryUpdate() {
    if (!this.canvasManager || !this.editingTextId) return;
    if (this._historyTimer) clearTimeout(this._historyTimer);

    this._historyTimer = setTimeout(() => {
      this._historyTimer = null;
      const obj = this.canvasManager.getObjectById(this.editingTextId);
      if (!obj) return;

      const nextText = obj.text || '';
      const nextRanges = Array.isArray(obj.formattedRanges) ? obj.formattedRanges : [];

      const sameText = nextText === this._lastHistoryText;
      const sameRanges = JSON.stringify(nextRanges) === JSON.stringify(this._lastHistoryRanges);
      if (sameText && sameRanges) return;

      const cmd = new ObjectTextCommand({
        objectId: obj.id,
        fieldKey: 'text',
        previousText: this._lastHistoryText,
        nextText,
        previousFormattedRanges: this._lastHistoryRanges,
        nextFormattedRanges: nextRanges,
      });
      cmd.userId = useCollaborationStore.getState().currentUser?.id || null;
      this.canvasManager.historyManager.registerWithoutExecuting(cmd);

      this._lastHistoryText = nextText;
      this._lastHistoryRanges = nextRanges.map(r => ({ ...r }));
    }, 350);
  }

  _flushTextHistory() {
    if (this._historyTimer) {
      clearTimeout(this._historyTimer);
      this._historyTimer = null;
    }
    if (!this.canvasManager || !this.editingTextId) return;
    const obj = this.canvasManager.getObjectById(this.editingTextId);
    if (!obj) return;

    const nextText = obj.text || '';
    const nextRanges = Array.isArray(obj.formattedRanges) ? obj.formattedRanges : [];
    const sameText = nextText === this._lastHistoryText;
    const sameRanges = JSON.stringify(nextRanges) === JSON.stringify(this._lastHistoryRanges);
    if (sameText && sameRanges) return;

    const cmd = new ObjectTextCommand({
      objectId: obj.id,
      fieldKey: 'text',
      previousText: this._lastHistoryText,
      nextText,
      previousFormattedRanges: this._lastHistoryRanges,
      nextFormattedRanges: nextRanges,
    });
    cmd.userId = useCollaborationStore.getState().currentUser?.id || null;
    this.canvasManager.historyManager.registerWithoutExecuting(cmd);

    this._lastHistoryText = nextText;
    this._lastHistoryRanges = nextRanges.map(r => ({ ...r }));
  }

  handleKeyDown(e) {
    e.stopPropagation();

    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.finishEditing({ keepSelected: true });
      return;
    }

    // Formatting shortcuts: Ctrl+B (bold), Ctrl+I (italic), Ctrl+U (underline)
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'b' || key === 'i' || key === 'u') {
        e.preventDefault();
        // Use the browser's built-in execCommand for contenteditable formatting.
        // This correctly handles partial selections, nested spans, and undo/redo.
        // The 'input' event will fire after execCommand and _serializeEditable will
        // extract the resulting formattedRanges automatically.
        const cmd = key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline';
        document.execCommand(cmd, false, null);
        // Manually trigger serialization so the model is updated immediately
        this.handleTextInput(null);
        return;
      }
      // Let other Ctrl shortcuts (copy, paste, cut, undo) pass through
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.finishEditing({ keepSelected: true });
      return;
    }
  }

  handleBlur(e) {
    if (this._blurTimer) {
      clearTimeout(this._blurTimer);
      this._blurTimer = null;
    }

    this._blurTimer = setTimeout(() => {
      this._blurTimer = null;

      const focusedEl = document.activeElement;
      const isToolbarFocus = focusedEl && (
        focusedEl.closest('[data-floating-toolbar]') ||
        focusedEl.closest('.floating-text-toolbar') ||
        focusedEl.getAttribute('data-text-tool-input')
      );

      if (!isToolbarFocus && this.isEditing && !this._isFinishing) {
        this.finishEditing({ keepSelected: false });
      }
    }, 150);
  }

  removeTextInput() {
    // Cancel pending blur timer when removing input explicitly
    if (this._blurTimer) {
      clearTimeout(this._blurTimer);
      this._blurTimer = null;
    }

    if (this.textInput) {
      try {
        if (this.handleTextInputBound) this.textInput.removeEventListener('input', this.handleTextInputBound);
        if (this.handleKeyDownBound) this.textInput.removeEventListener('keydown', this.handleKeyDownBound);
        if (this.handleBlurBound) this.textInput.removeEventListener('blur', this.handleBlurBound);
        if (this.textInput.parentNode) this.textInput.parentNode.removeChild(this.textInput);
      } catch (error) { }
    }

    this.textInput = null;
    this.handleTextInputBound = null;
    this.handleKeyDownBound = null;
    this.handleBlurBound = null;
  }

  updateCurrentText() {
    if (!this.currentTextObject || !this.editingTextId) return;

    applyCurrentOptionsToTextObject(this.currentTextObject, this.options);

    if (this.textInput) {
      // Re-apply base styling to the contenteditable container so the caret
      // and newly typed characters inherit the updated font settings.
      const obj = this.currentTextObject;
      Object.assign(this.textInput.style, {
        fontFamily: obj.fontFamily || 'Arial, sans-serif',
        fontWeight: obj.fontWeight || 'normal',
        fontStyle: obj.fontStyle || 'normal',
        color: obj.textColor || '#000000',
        caretColor: obj.textColor || '#000000',
        textAlign: obj.textAlign || 'left',
        textDecoration: [
          obj.underline ? 'underline' : '',
          obj.strikethrough ? 'line-through' : '',
        ].filter(Boolean).join(' ') || 'none',
      });
      this.positionTextarea();
    }
  }

  finishEditing({ keepSelected = false } = {}) {
    if (this._isFinishing) return null;
    if (!this.editingTextId || !this.canvasManager) return null;

    this._isFinishing = true;

    if (this._blurTimer) {
      clearTimeout(this._blurTimer);
      this._blurTimer = null;
    }

    // Cancel any pending live update timer
    if (this._liveTextTimer) {
      clearTimeout(this._liveTextTimer);
      this._liveTextTimer = null;
    }

    this._flushTextHistory();

    // Final serialization BEFORE removeTextInput() destroys the DOM node.
    // This ensures the model reflects the absolute latest typed content even
    // if the last keypress hadn't triggered an 'input' event yet.
    if (this.textInput && this.currentTextObject) {
      const { text: latestText, formattedRanges: latestRanges } = this._serializeEditable(this.textInput);
      this.currentTextObject.text = latestText;
      this.currentTextObject.formattedRanges = latestRanges;
    }

    this.removeTextInput();

    const currentObj = this.canvasManager.getObjectById(this.editingTextId);
    const textIdBeingFinished = this.editingTextId;

    const finalTextObject = {
      ...(currentObj || {}),
      ...(this.currentTextObject || {}),
      text: this.currentTextObject?.text ?? currentObj?.text ?? '',
    };
    // Always preserve live position — another user may have moved the object
    // while we were editing. Without this, committing the stale copy would
    // snap the object back to its pre-move coordinates.
    if (currentObj) {
      finalTextObject.x = currentObj.x;
      finalTextObject.y = currentObj.y;
      finalTextObject.rotation = currentObj.rotation ?? finalTextObject.rotation ?? 0;
    }

    // Release lock
    const collabStore = useCollaborationStore.getState();
    if (collabStore.unlockObjects) {
      collabStore.unlockObjects([textIdBeingFinished]);
    }
    // Clear lockedBy on local state
    if (currentObj) {
      currentObj.lockedBy = null;
    }

    if (!currentObj || !finalTextObject.text || finalTextObject.text.trim() === '') {
      if (currentObj) {
        const deleteCommand = TextCommandFactory.deleteText(currentObj);
        this.canvasManager.executeLocalCommand(deleteCommand);
      }

      this.isEditing = false;
      this.editingTextId = null;
      this.currentTextObject = null;
      this.floatingToolbarVisible = false;
      this._isFinishing = false;

      this.canvasManager.emit('text:finished', { textId: textIdBeingFinished });

      if (this.canvasManager.toolManager) {
        const selectTool = this.canvasManager.toolManager.getToolInstance('select');
        if (selectTool) this.canvasManager.setActiveTool(selectTool);
      }

      if (!keepSelected) {
        this.canvasManager.clearSelection();
      }

      return null;
    }

    // Commit final textarea content and style once when editing exits.
    this.updateTextDimensions(finalTextObject);
    const modifyCommand = TextCommandFactory.modifyText(currentObj, {
      text: finalTextObject.text,
      fontFamily: finalTextObject.fontFamily,
      fontSize: finalTextObject.fontSize,
      textColor: finalTextObject.textColor,
      backgroundColor: finalTextObject.backgroundColor,
      textAlign: finalTextObject.textAlign,
      verticalAlign: finalTextObject.verticalAlign,
      fontWeight: finalTextObject.fontWeight,
      fontStyle: finalTextObject.fontStyle,
      underline: finalTextObject.underline,
      strikethrough: finalTextObject.strikethrough,
      listType: finalTextObject.listType,
      autoWidth: finalTextObject.autoWidth,
      autoHeight: finalTextObject.autoHeight,
      width: finalTextObject.width,
      height: finalTextObject.height,
      formattedRanges: finalTextObject.formattedRanges || [],
      lockedBy: null,
      isTempPlaceholder: !finalTextObject.text || finalTextObject.text.trim() === '',
      updatedAt: Date.now(),
    });

    this.canvasManager.executeLocalCommand(modifyCommand);

    this.isEditing = false;
    this.editingTextId = null;
    this.currentTextObject = null;
    this.floatingToolbarVisible = false;

    // Sync selection for transform handles only when the caller wants selection retained.
    if (this.canvasManager.toolManager) {
      const selectTool = this.canvasManager.toolManager.getToolInstance('select');
      if (selectTool) {
        this.canvasManager.setActiveTool(selectTool);
        if (keepSelected && selectTool.selectionManager) {
          selectTool.selectionManager.set([textIdBeingFinished]);
        }
        if (keepSelected) {
          this.canvasManager.setSelection([textIdBeingFinished]);
        } else {
          this.canvasManager.clearSelection();
        }
      }
    }

    // Emit text:finished (signals lock release + final state to remote)
    this.canvasManager.emit('text:finished', {
      textId: textIdBeingFinished,
    });

    // Send final committed text as text:commit with dimensions for remote height sync
    this.canvasManager.emit('text:update', {
      textId: textIdBeingFinished,
      text: finalTextObject.text,
      fontFamily: finalTextObject.fontFamily,
      fontSize: finalTextObject.fontSize,
      textColor: finalTextObject.textColor,
      textAlign: finalTextObject.textAlign,
      verticalAlign: finalTextObject.verticalAlign,
      fontWeight: finalTextObject.fontWeight,
      fontStyle: finalTextObject.fontStyle,
      underline: finalTextObject.underline,
      strikethrough: finalTextObject.strikethrough,
      backgroundColor: finalTextObject.backgroundColor,
      listType: finalTextObject.listType,
      autoWidth: finalTextObject.autoWidth,
      autoHeight: finalTextObject.autoHeight,
      formattedRanges: finalTextObject.formattedRanges || [],
      width: finalTextObject.width,
      height: finalTextObject.height,
      isCommit: true,
    });

    this._isFinishing = false;
    return null;
  }

  getCaretIndexFromPoint(obj, clickPoint) {
    try {
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      const fontSize = obj.fontSize || 16;
      const fontFamily = obj.fontFamily || 'Arial, sans-serif';
      const fontWeight = obj.fontWeight || 'normal';
      const fontStyle = obj.fontStyle || 'normal';
      const textAlign = obj.textAlign || 'left';
      ctx.font = `${fontWeight} ${fontStyle} ${fontSize}px ${fontFamily}`;
      const bounds = this.canvasManager.getObjectBounds(obj);
      if (!bounds) return (obj.text || '').length;
      const lineHeight = fontSize * 1.2;
      const textValue = obj.text || '';
      const lines = textValue.split('\n');
      const lineIndex = Math.max(0, Math.min(lines.length - 1, Math.floor((clickPoint.y - bounds.y) / lineHeight)));
      const line = lines[lineIndex] || '';

      let baseX = bounds.x;
      if (textAlign === 'center') baseX = bounds.x + bounds.width / 2 - ctx.measureText(line).width / 2;
      if (textAlign === 'right') baseX = bounds.x + bounds.width - ctx.measureText(line).width;

      const relX = Math.max(0, clickPoint.x - baseX);
      let charIndexInLine = line.length;
      for (let i = 0; i <= line.length; i++) {
        const w = ctx.measureText(line.slice(0, i)).width;
        if (w >= relX) {
          charIndexInLine = i;
          break;
        }
      }

      let offset = 0;
      for (let i = 0; i < lineIndex; i++) offset += (lines[i]?.length || 0) + 1;
      return Math.max(0, Math.min(textValue.length, offset + charIndexInLine));
    } catch {
      return (obj.text || '').length;
    }
  }

  updateTextProperty(property, value) {
    if (!this.isEditing || !this.editingTextId) return;

    const toolOptionMap = {
      fontFamily: TOOL_OPTIONS.FONT_FAMILY,
      fontSize: TOOL_OPTIONS.FONT_SIZE,
      textColor: TOOL_OPTIONS.TEXT_COLOR,
      textAlign: TOOL_OPTIONS.TEXT_ALIGN,
      backgroundColor: TOOL_OPTIONS.FILL_COLOR,
    };

    if (toolOptionMap[property]) {
      this.options[toolOptionMap[property]] = value;
    } else {
      this.options[property] = value;
    }

    this.updateCurrentText();

    // Sync the state object so the canvas renders the change immediately
    const stateObj = this.canvasManager.getObjectById(this.editingTextId);
    if (stateObj) {
      stateObj[property] = value;
    }

    this._autoResizeTextBounds();
    this.canvasManager.requestRender();
    this._emitLiveTextUpdate();
  }

  // ─── Character-level formatting (spans) ───

  /**
   * Toggle a formatting property on the current selection inside the
   * contenteditable editor using the browser-native execCommand API.
   * formattedRanges are then re-derived by _serializeEditable on the next
   * input event. (Bug 6: replaces manual range-splicing approach.)
   */
  _toggleSpanFormatting(prop) {
    if (!this.textInput) return;

    const cmd =
      prop === 'fontWeight' ? 'bold'
        : prop === 'fontStyle' ? 'italic'
          : prop === 'underline' ? 'underline'
            : prop === 'strikethrough' ? 'strikeThrough'
              : null;

    if (!cmd) return;

    this.textInput.focus();
    document.execCommand(cmd, false, null);
    // Re-serialize so the model stays in sync immediately
    this.handleTextInput(null);
  }

  _isRangeFullyFormatted(ranges, start, end, propKey) {
    // Check every character in [start, end) has propKey = true
    for (let i = start; i < end; i++) {
      const r = ranges.find(r => r.start <= i && r.end > i && r[propKey]);
      if (!r) return false;
    }
    return true;
  }

  _addFormattingToRange(ranges, start, end, propKey) {
    // Split existing ranges that partially overlap, then add new range
    const newRanges = [];
    for (const r of ranges) {
      if (r.end <= start || r.start >= end) {
        // No overlap
        newRanges.push({ ...r });
      } else {
        // Overlapping — split into parts
        if (r.start < start) {
          newRanges.push({ ...r, end: start });
        }
        // The overlapping middle part gets the new property added
        const overlapStart = Math.max(r.start, start);
        const overlapEnd = Math.min(r.end, end);
        newRanges.push({ ...r, start: overlapStart, end: overlapEnd, [propKey]: true });
        if (r.end > end) {
          newRanges.push({ ...r, start: end });
        }
      }
    }

    // Add the new formatting range for parts not covered by existing ranges
    const covered = new Set();
    for (const r of newRanges) {
      if (r[propKey]) {
        for (let i = r.start; i < r.end; i++) covered.add(i);
      }
    }
    let gapStart = null;
    for (let i = start; i <= end; i++) {
      if (i < end && !covered.has(i)) {
        if (gapStart === null) gapStart = i;
      } else {
        if (gapStart !== null) {
          newRanges.push({ start: gapStart, end: i, [propKey]: true });
          gapStart = null;
        }
      }
    }

    // Replace the original array
    ranges.length = 0;
    ranges.push(...newRanges);
  }

  _removeFormattingFromRange(ranges, start, end, propKey) {
    const newRanges = [];
    for (const r of ranges) {
      if (!r[propKey] || r.end <= start || r.start >= end) {
        newRanges.push({ ...r });
        continue;
      }
      // This range has the property and overlaps with the removal range
      if (r.start < start) {
        newRanges.push({ ...r, end: start });
      }
      // Middle part: remove the property
      const overlapStart = Math.max(r.start, start);
      const overlapEnd = Math.min(r.end, end);
      const cleaned = { ...r, start: overlapStart, end: overlapEnd };
      delete cleaned[propKey];
      // Only keep if it still has other formatting
      if (cleaned.bold || cleaned.italic || cleaned.underline || cleaned.strikethrough) {
        newRanges.push(cleaned);
      }
      if (r.end > end) {
        newRanges.push({ ...r, start: end });
      }
    }
    ranges.length = 0;
    ranges.push(...newRanges);
  }

  _normalizeRanges(ranges) {
    // Remove zero-length ranges, sort by start, merge adjacent identical ranges
    const filtered = ranges.filter(r => r.end > r.start);
    filtered.sort((a, b) => a.start - b.start || a.end - b.end);

    const merged = [];
    for (const r of filtered) {
      const last = merged[merged.length - 1];
      if (last && last.end === r.start &&
        !!last.bold === !!r.bold &&
        !!last.italic === !!r.italic &&
        !!last.underline === !!r.underline &&
        !!last.strikethrough === !!r.strikethrough) {
        last.end = r.end;
      } else {
        merged.push({ ...r });
      }
    }
    return merged;
  }

  /**
   * Adjust formattedRanges when text content changes (insert/delete).
   * Call before updating the text content in the object.
   */
  _adjustRangesForTextEdit(oldText, newText, cursorPos) {
    if (!this.currentTextObject?.formattedRanges?.length) return;

    const oldLen = oldText.length;
    const newLen = newText.length;
    const delta = newLen - oldLen;
    if (delta === 0) return;

    const ranges = this.currentTextObject.formattedRanges;

    if (delta > 0) {
      // Characters inserted at cursorPos - delta (the position before insertion)
      const insertPos = cursorPos - delta;
      for (const r of ranges) {
        if (r.start >= insertPos) {
          r.start += delta;
          r.end += delta;
        } else if (r.end > insertPos) {
          r.end += delta;
        }
      }
    } else {
      // Characters deleted ending at cursorPos
      const deleteCount = -delta;
      const deleteStart = cursorPos;
      const deleteEnd = cursorPos + deleteCount;
      const newRanges = [];
      for (const r of ranges) {
        if (r.end <= deleteStart) {
          newRanges.push(r);
        } else if (r.start >= deleteEnd) {
          r.start += delta;
          r.end += delta;
          newRanges.push(r);
        } else {
          // Overlapping with deletion
          if (r.start < deleteStart) {
            const before = { ...r, end: deleteStart };
            if (r.end > deleteEnd) {
              before.end = deleteStart + (r.end - deleteEnd);
            }
            if (before.end > before.start) newRanges.push(before);
          } else if (r.end > deleteEnd) {
            r.start = deleteStart;
            r.end = deleteStart + (r.end - deleteEnd);
            if (r.end > r.start) newRanges.push(r);
          }
          // If fully inside deletion, it's dropped
        }
      }
      this.currentTextObject.formattedRanges = newRanges;
    }

    this.currentTextObject.formattedRanges = this._normalizeRanges(
      this.currentTextObject.formattedRanges
    );
  }

  getUIConfig() {
    return {
      name: this.name,
      description: this.description,
      icon: this.icon,
      cursor: this.cursor,
      hasOptions: false,
      toolType: this.toolType,
    };
  }
}

export default TextTool;
