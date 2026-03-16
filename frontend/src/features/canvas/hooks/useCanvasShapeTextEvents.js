import { useEffect, useRef } from 'react';
import useCollaborationStore from '@features/room/state/collaborationStore';
import { ObjectTextCommand } from '../engine/commands/ObjectTextCommand';

export function useCanvasShapeTextEvents({ isReady, canvasManagerRef }) {
  const inputRef = useRef(null);
  const editingObjectIdRef = useRef(null);
  const historyTimerRef = useRef(null);
  const historyTextRef = useRef('');

  const getInscribedTextBounds = (obj, bounds) => {
    if (!bounds) return bounds;
    const shapeType = obj.shapeType || obj.type;
    const { x, y, width, height } = bounds;

    switch (shapeType) {
      case 'circle': {
        const r = Math.min(width, height) / 2;
        const side = r * Math.SQRT2;
        const cx = x + width / 2;
        const cy = y + height / 2;
        return { x: cx - side / 2, y: cy - side / 2, width: side, height: side };
      }
      case 'ellipse': {
        const rX = width / 2;
        const rY = height / 2;
        const iW = rX * Math.SQRT2;
        const iH = rY * Math.SQRT2;
        const cx = x + width / 2;
        const cy = y + height / 2;
        return { x: cx - iW / 2, y: cy - iH / 2, width: iW, height: iH };
      }
      case 'diamond': {
        const iW = width / 2;
        const iH = height / 2;
        const cx = x + width / 2;
        const cy = y + height / 2;
        return { x: cx - iW / 2, y: cy - iH / 2, width: iW, height: iH };
      }
      case 'triangle': {
        const iW = width * 0.55;
        const iH = height * 0.4;
        const cx = x + width / 2;
        const cy = y + height * 0.65;
        return { x: cx - iW / 2, y: cy - iH / 2, width: iW, height: iH };
      }
      case 'hexagon': {
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
        const iW = width * 0.4;
        const iH = height * 0.35;
        const cx = x + width / 2;
        const cy = y + height / 2;
        return { x: cx - iW / 2, y: cy - iH / 2, width: iW, height: iH };
      }
      default:
        return bounds;
    }
  };

  useEffect(() => {
    if (!isReady || !canvasManagerRef.current) return;
    const canvasManager = canvasManagerRef.current;
    let previewTimer = null;
    let interactionTimer = null;

    const removeInput = () => {
      const input = inputRef.current;
      if (input) {
        try { input.remove(); } catch { }
      }
      inputRef.current = null;
      editingObjectIdRef.current = null;
    };

    const buildListPreview = (text, listType) => {
      if (!listType || listType === 'none') return text;
      const lines = String(text ?? '').split('\n');
      return lines.map((line, idx) => {
        if (!line.trim()) return line;
        if (listType === 'unordered') return `• ${line}`;
        return `${idx + 1}. ${line}`;
      }).join('\n');
    };

    const stripListPreview = (text, listType) => {
      if (!listType || listType === 'none') return text;
      const lines = String(text ?? '').split('\n');
      return lines.map((line) => {
        if (listType === 'unordered') return line.replace(/^\s*•\s?/, '');
        return line.replace(/^\s*\d+[.)]\s?/, '');
      }).join('\n');
    };

    const applyVerticalAlignPadding = (input, obj, zoom) => {
      if (!input || !obj) return;
      const verticalAlign = obj.innerTextVerticalAlign || 'middle';
      const fontSize = (obj.innerTextSize || 14) * zoom;
      const lineHeight = fontSize * 1.4;
      const rawText = obj.innerText || '';
      const lines = rawText.split('\n');
      const contentHeight = Math.max(lineHeight, lines.length * lineHeight);
      const boxHeight = input.clientHeight || contentHeight;
      const extra = Math.max(0, boxHeight - contentHeight);
      const padTop = verticalAlign === 'top'
        ? 0
        : verticalAlign === 'bottom'
          ? extra
          : extra / 2;
      const padBottom = Math.max(0, extra - padTop);
      input.style.paddingTop = `${padTop}px`;
      input.style.paddingBottom = `${padBottom}px`;
    };

    const positionInput = () => {
      const input = inputRef.current;
      const objectId = editingObjectIdRef.current;
      if (!input || !objectId) return;

      const obj = canvasManager.getObjectById(objectId);
      const canvasEl = canvasManager.canvas;
      if (!obj || !canvasEl) return;

      const zoom = canvasManager.state.viewport.zoom;
      const canvasRect = canvasEl.getBoundingClientRect();
      const effectiveType = obj.shapeType || obj.type;

      // Line/arrow: position at center, width based on line length
      if (effectiveType === 'line' || effectiveType === 'arrow') {
        const midX = ((obj.x1 || 0) + (obj.x2 || 0)) / 2;
        const midY = ((obj.y1 || 0) + (obj.y2 || 0)) / 2;
        const lineLen = Math.sqrt(((obj.x2 || 0) - (obj.x1 || 0)) ** 2 + ((obj.y2 || 0) - (obj.y1 || 0)) ** 2);
        const widthPx = Math.max(80, lineLen * 0.8 * zoom);
        const heightPx = Math.max(28, 40 * zoom);
        const screenMid = canvasManager.worldToScreen(midX, midY);

        Object.assign(input.style, {
          position: 'fixed',
          left: `${canvasRect.left + screenMid.x - widthPx / 2}px`,
          top: `${canvasRect.top + screenMid.y - heightPx / 2}px`,
          width: `${widthPx}px`,
          minHeight: `${heightPx}px`,
          maxHeight: `${heightPx}px`,
          transform: 'none',
          zIndex: '920',
          border: 'none',
          borderRadius: '0',
          outline: 'none',
          resize: 'none',
          background: 'transparent',
          color: obj.innerTextColor || '#111827',
          textAlign: obj.innerTextAlign || 'center',
          fontFamily: obj.fontFamily || 'Arial, sans-serif',
          fontSize: `${(obj.innerTextSize || 14) * zoom}px`,
          fontWeight: obj.innerTextWeight || 'normal',
          fontStyle: obj.innerTextStyle || 'normal',
          lineHeight: '1.4',
          overflow: 'hidden',
          overflowX: 'hidden',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
          padding: '4px 8px',
          boxSizing: 'border-box',
        });
        return;
      }

      const bounds = canvasManager.getObjectBounds(obj);
      if (!bounds) return;
      const textBounds = getInscribedTextBounds(obj, bounds);
      if (!textBounds) return;

      const screenCenter = canvasManager.worldToScreen(
        textBounds.x + textBounds.width / 2,
        textBounds.y + textBounds.height / 2
      );
      const requestedPadding = Math.max(4, (obj.innerTextPadding ?? 12) * zoom);
      const boundW = Math.max(1, textBounds.width * zoom);
      const boundH = Math.max(1, textBounds.height * zoom);
      const padX = Math.min(requestedPadding, Math.max(0, boundW / 2 - 0.5));
      const padY = Math.min(requestedPadding, Math.max(0, boundH / 2 - 0.5));
      const widthPx = Math.max(6, boundW - padX * 2);
      const heightPx = Math.max(6, boundH - padY * 2);
      const editorPadX = widthPx <= 72 ? 0 : 8;
      const editorPadY = heightPx <= 36 ? 0 : 4;

      Object.assign(input.style, {
        position: 'fixed',
        left: `${canvasRect.left + screenCenter.x - widthPx / 2}px`,
        top: `${canvasRect.top + screenCenter.y - heightPx / 2}px`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        minHeight: `${heightPx}px`,
        maxHeight: `${heightPx}px`,
        zIndex: '920',
        border: 'none',
        borderRadius: '0',
        outline: 'none',
        resize: 'none',
        background: 'transparent',
        color: obj.innerTextColor || '#111827',
        textAlign: obj.innerTextAlign || 'center',
        fontFamily: obj.fontFamily || 'Arial, sans-serif',
        fontSize: `${(obj.innerTextSize || 14) * zoom}px`,
        fontWeight: obj.innerTextWeight || 'normal',
        fontStyle: obj.innerTextStyle || 'normal',
        textDecoration: [
          obj.innerTextUnderline ? 'underline' : '',
          obj.innerTextStrikethrough ? 'line-through' : '',
        ].filter(Boolean).join(' ') || 'none',
        lineHeight: '1.4',
        overflow: 'hidden',
        overflowX: 'hidden',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        padding: `${editorPadY}px ${editorPadX}px`,
        boxSizing: 'border-box',
      });
    };

    const commit = (objectId) => {
      if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
      const input = inputRef.current;
      if (!input) return;
      const target = canvasManager.getObjectById(objectId);
      if (target) {
        const listType = target.innerTextListType || 'none';
        const rawText = listType === 'none'
          ? input.value
          : stripListPreview(input.value, listType);
        const prevText = target.innerText || '';
        target.innerText = rawText;
        const cmd = new ObjectTextCommand({
          objectId,
          fieldKey: 'innerText',
          previousText: prevText,
          nextText: rawText,
        });
        cmd.userId = useCollaborationStore.getState().currentUser?.id || null;
        canvasManager.executeLocalCommand(cmd);
        target._isEditing = false;
        target.updatedAt = Date.now();
        canvasManager.requestRender();
        canvasManager.emit('object:modified', { target });
      }
      canvasManager.shapeInlineEditId = null;
      canvasManager.emit('shape:textedit:end', { objectId });
      removeInput();
    };

    const startEditing = ({ objectId }) => {
      const obj = canvasManager.getObjectById(objectId);
      if (!obj || obj.type !== 'shape') return;

      // Enable inner text on this shape if not already enabled
      if (!obj.innerTextEnabled) {
        obj.innerTextEnabled = true;
        obj.innerText = obj.innerText || '';
        obj.innerTextSize = obj.innerTextSize || 14;
        obj.innerTextWeight = obj.innerTextWeight || 'normal';
        obj.innerTextStyle = obj.innerTextStyle || 'normal';
        obj.innerTextColor = obj.innerTextColor || '#111827';
        obj.innerTextAlign = obj.innerTextAlign || 'center';
        obj.innerTextPadding = obj.innerTextPadding || 12;
        obj.fontFamily = obj.fontFamily || 'Arial, sans-serif';
      }

      removeInput();
      editingObjectIdRef.current = objectId;

      // Mark as editing so the canvas renderer skips drawing its text
      obj._isEditing = true;
      canvasManager.shapeInlineEditId = objectId;
      canvasManager.requestRender();

      const input = document.createElement('textarea');
      const listType = obj.innerTextListType || 'none';
      const rawText = obj.innerText || '';
      input.value = listType === 'none' ? rawText : buildListPreview(rawText, listType);
      input.setAttribute('data-raw-text', rawText);
      input.setAttribute('data-shape-text-editor', 'true');
      input.setAttribute('data-editing-id', objectId);
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('wrap', 'soft');
      inputRef.current = input;
      document.body.appendChild(input);
      positionInput();
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);

      historyTextRef.current = obj.innerText || '';

      canvasManager.emit('shape:textedit:started', { objectId });

      input.addEventListener('input', () => {
        const target = canvasManager.getObjectById(objectId);
        if (!target) return;
        const listType = target.innerTextListType || 'none';
        const rawText = listType === 'none'
          ? input.value
          : stripListPreview(input.value, listType);
        target.innerText = rawText;
        target.updatedAt = Date.now();
        const currentUserId = useCollaborationStore.getState().currentUser?.id || null;
        if (currentUserId) {
          target.lastEditedBy = currentUserId;
          target.lastEditedAt = Date.now();
        }
        input.setAttribute('data-raw-text', rawText);
        if (listType !== 'none') {
          const preview = buildListPreview(rawText, listType);
          if (input.value !== preview) {
            input.value = preview;
            input.setSelectionRange(input.value.length, input.value.length);
          }
        }
        positionInput();
        applyVerticalAlignPadding(input, target, canvasManager.state.viewport.zoom);
        canvasManager.requestRender();

        if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
        historyTimerRef.current = setTimeout(() => {
          const latest = canvasManager.getObjectById(objectId);
          if (!latest) return;
          const nextText = latest.innerText || '';
          if (nextText === historyTextRef.current) return;
          const cmd = new ObjectTextCommand({
            objectId,
            fieldKey: 'innerText',
            previousText: historyTextRef.current,
            nextText,
          });
          cmd.userId = useCollaborationStore.getState().currentUser?.id || null;
          canvasManager.historyManager.registerWithoutExecuting(cmd);
          historyTextRef.current = nextText;
        }, 350);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          commit(objectId);
        } else if (e.key === 'Enter' && e.ctrlKey) {
          e.preventDefault();
          commit(objectId);
        }
      });

      input.addEventListener('blur', () => {
        // Small delay to allow toolbar button clicks to register before blur commits
        setTimeout(() => {
          if (inputRef.current === input) {
            commit(objectId);
          }
        }, 150);
      });
    };

    const requestClose = ({ objectId } = {}) => {
      const id = objectId || editingObjectIdRef.current;
      if (id) commit(id);
    };

    const handleSelectionChange = ({ selectedIds = [] } = {}) => {
      const editingId = editingObjectIdRef.current;
      if (!editingId) return;
      if (!selectedIds.includes(editingId)) {
        commit(editingId);
      }
    };

    const updateInputStyle = () => {
      if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
      positionInput();
      const objectId = editingObjectIdRef.current;
      const input = inputRef.current;
      if (!input || !objectId) return;
      const obj = canvasManager.getObjectById(objectId);
      const zoom = canvasManager.state.viewport.zoom;
      if (!obj) return;
      const listType = obj.innerTextListType || 'none';
      const rawText = obj.innerText || '';
      if (listType === 'none') {
        input.value = rawText;
      } else {
        const preview = buildListPreview(rawText, listType);
        if (input.value !== preview) {
          input.value = preview;
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }
      Object.assign(input.style, {
        color: obj.innerTextColor || '#111827',
        textAlign: obj.innerTextAlign || 'center',
        fontFamily: obj.fontFamily || 'Arial, sans-serif',
        fontSize: `${(obj.innerTextSize || 14) * zoom}px`,
        fontWeight: obj.innerTextWeight || 'normal',
        fontStyle: obj.innerTextStyle || 'normal',
        textDecoration: [
          obj.innerTextUnderline ? 'underline' : '',
          obj.innerTextStrikethrough ? 'line-through' : '',
        ].filter(Boolean).join(' ') || 'none',
      });
      const markerSpace = listType === 'none' ? 0 : (obj.innerTextSize || 14) * zoom * 1.2;
      input.style.paddingLeft = markerSpace > 0 ? `${Math.max(markerSpace, 8)}px` : input.style.paddingLeft;
      applyVerticalAlignPadding(input, obj, zoom);
      // Keep editor visible and stable while styles change live.
      obj._isEditing = true;
      canvasManager.requestRender();
    };

    canvasManager.on('shape:textedit:start', startEditing);
    canvasManager.on('shape:textedit:requestclose', requestClose);
    canvasManager.on('shape:textedit:stylechanged', updateInputStyle);
    canvasManager.on('selection:changed', handleSelectionChange);
    canvasManager.on('viewport:changed', positionInput);
    canvasManager.on('transform:update', positionInput);
    canvasManager.on('move:update', positionInput);

    const disableInputEvents = () => {
      const input = inputRef.current;
      if (!input) return;
      input.style.pointerEvents = 'none';
      input.style.userSelect = 'none';
    };

    const restoreInputEvents = () => {
      if (interactionTimer) clearTimeout(interactionTimer);
      interactionTimer = setTimeout(() => {
        const input = inputRef.current;
        if (input) {
          input.style.pointerEvents = 'text';
          input.style.userSelect = 'text';
        }
        interactionTimer = null;
      }, 150);
    };

    canvasManager.on('transform:update', disableInputEvents);
    canvasManager.on('transform:final', restoreInputEvents);
    canvasManager.on('move:update', disableInputEvents);
    canvasManager.on('move:final', restoreInputEvents);

    return () => {
      canvasManager.off('shape:textedit:start', startEditing);
      canvasManager.off('shape:textedit:requestclose', requestClose);
      canvasManager.off('shape:textedit:stylechanged', updateInputStyle);
      canvasManager.off('selection:changed', handleSelectionChange);
      canvasManager.off('viewport:changed', positionInput);
      canvasManager.off('transform:update', positionInput);
      canvasManager.off('move:update', positionInput);
      canvasManager.off('transform:update', disableInputEvents);
      canvasManager.off('transform:final', restoreInputEvents);
      canvasManager.off('move:update', disableInputEvents);
      canvasManager.off('move:final', restoreInputEvents);
      if (interactionTimer) clearTimeout(interactionTimer);
      if (editingObjectIdRef.current) {
        const obj = canvasManager.getObjectById(editingObjectIdRef.current);
        if (obj) obj._isEditing = false;
        canvasManager.shapeInlineEditId = null;
      }
      removeInput();
    };
  }, [isReady, canvasManagerRef]);
}
