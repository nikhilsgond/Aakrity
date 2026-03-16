import { useEffect, useRef, useCallback } from 'react';
import useCollaborationStore from '@features/room/state/collaborationStore';
import { ObjectTextCommand } from '../engine/commands/ObjectTextCommand';

// ─── HTML ↔ formattedRanges helpers ───────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Walk a contenteditable element and extract plain text + formattedRanges. */
function htmlToTextAndRanges(container) {
  const ranges = [];
  let text = '';

  function walk(node, bold, italic) {
    if (node.nodeType === Node.TEXT_NODE) {
      const start = text.length;
      text += node.textContent;
      const end = text.length;
      if ((bold || italic) && start < end) {
        ranges.push({ start, end, bold: !!bold, italic: !!italic });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();
    const isBold = bold || tag === 'b' || tag === 'strong';
    const isItalic = italic || tag === 'i' || tag === 'em';

    if (tag === 'br') { text += '\n'; return; }
    // <div> from contenteditable newlines
    if ((tag === 'div' || tag === 'p') && text.length > 0 && !text.endsWith('\n')) {
      text += '\n';
    }

    for (const child of node.childNodes) {
      walk(child, isBold, isItalic);
    }
  }

  for (const child of container.childNodes) {
    walk(child, false, false);
  }

  // Merge adjacent ranges with same style
  const merged = [];
  for (const r of ranges) {
    const prev = merged[merged.length - 1];
    if (prev && prev.end === r.start && prev.bold === r.bold && prev.italic === r.italic) {
      prev.end = r.end;
    } else {
      merged.push({ ...r });
    }
  }
  return { text, formattedRanges: merged };
}

/** Convert text + formattedRanges back into innerHTML for the contenteditable. */
function textAndRangesToHtml(text, ranges) {
  if (!text) return '';
  if (!ranges || ranges.length === 0) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let html = '';
  let pos = 0;

  for (const r of sorted) {
    if (r.start > pos) {
      html += escapeHtml(text.slice(pos, r.start)).replace(/\n/g, '<br>');
    }
    let slice = escapeHtml(text.slice(r.start, r.end)).replace(/\n/g, '<br>');
    if (r.italic) slice = `<i>${slice}</i>`;
    if (r.bold) slice = `<b>${slice}</b>`;
    html += slice;
    pos = r.end;
  }
  if (pos < text.length) {
    html += escapeHtml(text.slice(pos)).replace(/\n/g, '<br>');
  }
  return html;
}

const areRangesEqual = (a, b) => {
  const listA = Array.isArray(a) ? a : [];
  const listB = Array.isArray(b) ? b : [];
  if (listA.length !== listB.length) return false;
  for (let i = 0; i < listA.length; i += 1) {
    const left = listA[i];
    const right = listB[i];
    if (!right) return false;
    if (left.start !== right.start || left.end !== right.end || !!left.bold !== !!right.bold || !!left.italic !== !!right.italic) {
      return false;
    }
  }
  return true;
};

const cloneRanges = (ranges) => (Array.isArray(ranges) ? ranges.map((r) => ({ ...r })) : []);

// ─── Hook ─────────────────────────────────────────────────────────

/**
 * Hook that handles sticky:edit events from SelectTool.
 * Opens a contenteditable overlay on top of the sticky note for inline editing.
 * Implements Miro-style behaviour: fixed container, text auto-shrinks to fit.
 */
export function useCanvasStickyEvents({ isReady, canvasManagerRef }) {
  const editorRef = useRef(null);
  const editingIdRef = useRef(null);
  const rafRef = useRef(null);
  const historyTimerRef = useRef(null);
  const historyTextRef = useRef('');
  const historyRangesRef = useRef([]);

  const getCanvasRect = useCallback(() => {
    return canvasManagerRef.current?.canvas?.getBoundingClientRect() ?? null;
  }, [canvasManagerRef]);

  /** Compute the best font-size (px) that makes `text` fit inside `w × h`. */
  const computeFittedFontSize = useCallback((text, maxW, maxH, baseFontSize) => {
    if (!text) return baseFontSize;

    const probe = document.createElement('div');
    Object.assign(probe.style, {
      position: 'absolute',
      visibility: 'hidden',
      left: '-9999px',
      top: '-9999px',
      width: `${maxW}px`,
      fontFamily: 'Arial, sans-serif',
      lineHeight: '1.3',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      padding: '0',
      boxSizing: 'border-box',
    });
    document.body.appendChild(probe);

    let fontSize = baseFontSize;
    const MIN_FONT = 8;
    while (fontSize > MIN_FONT) {
      probe.style.fontSize = `${fontSize}px`;
      probe.innerText = text;
      if (probe.scrollHeight <= maxH) break;
      fontSize -= 1;
    }

    document.body.removeChild(probe);
    return Math.max(fontSize, MIN_FONT);
  }, []);

  /** Position the editor overlay exactly on top of the sticky note. */
  const positionEditor = useCallback(() => {
    const cm = canvasManagerRef.current;
    const el = editorRef.current;
    const id = editingIdRef.current;
    if (!cm || !el || !id) return;

    const obj = cm.getObjectById(id);
    if (!obj) return;

    const canvasRect = getCanvasRect();
    if (!canvasRect) return;

    const zoom = cm.state.viewport.zoom;
    const tl = cm.worldToScreen(obj.x, obj.y);
    const padding = 12;
    const scaledPadding = padding * zoom;
    const innerW = obj.width * zoom - scaledPadding * 2;
    const innerH = obj.height * zoom - scaledPadding * 2;
    const rotation = obj.rotation || 0;

    const baseFontSize = (obj.fontSize || 16) * zoom;
    const plainText = el.innerText || '';
    const fitted = computeFittedFontSize(plainText, innerW, innerH, baseFontSize);

    Object.assign(el.style, {
      left: `${canvasRect.left + tl.x + scaledPadding}px`,
      top: `${canvasRect.top + tl.y + scaledPadding}px`,
      width: `${innerW}px`,
      height: `${innerH}px`,
      fontSize: `${fitted}px`,
      lineHeight: '1.3',
      transform: rotation ? `rotate(${rotation}rad)` : '',
      transformOrigin: 'top left',
    });
  }, [canvasManagerRef, getCanvasRect, computeFittedFontSize]);

  /** Commit current text back to the canvas object and close the overlay. */
  const commitAndClose = useCallback(() => {
    const cm = canvasManagerRef.current;
    const el = editorRef.current;
    const id = editingIdRef.current;
    if (!cm || !el || !id) return;

    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }

    const obj = cm.getObjectById(id);
    if (obj) {
      // Parse formatted HTML → plain text + ranges
      const { text: newText, formattedRanges } = htmlToTextAndRanges(el);
      const prevText = obj.text || '';
      const prevRanges = cloneRanges(obj.formattedRanges);
      const cleanedText = newText.replace(/\n+$/, '');
      // Strip trailing newlines that contenteditable leaves (Chrome adds trailing <br>)
      obj.text = cleanedText;
      obj.formattedRanges = formattedRanges.length > 0 ? formattedRanges : undefined;

      const cmd = new ObjectTextCommand({
        objectId: id,
        fieldKey: 'text',
        previousText: prevText,
        nextText: cleanedText,
        previousFormattedRanges: prevRanges,
        nextFormattedRanges: formattedRanges,
      });
      cmd.userId = useCollaborationStore.getState().currentUser?.id || null;
      cm.executeLocalCommand(cmd);
      obj.updatedAt = Date.now();

      // Clear editing flag so canvas draws the text again
      obj._isEditing = false;

      cm.updateObjectIndex?.();
      cm.requestRender();
      cm.emit('object:modified', { target: obj });
    }

    cm.emit('sticky:textedit:end', { objectId: id });
    cm.stickyInlineEditId = null;

    el.remove();
    editorRef.current = null;
    editingIdRef.current = null;
  }, [canvasManagerRef]);

  // ---- main handler ----

  const handleStickyEdit = useCallback(({ objectId, point }) => {
    const cm = canvasManagerRef.current;
    if (!cm) return;
    const obj = cm.getObjectById(objectId);
    if (!obj || obj.type !== 'sticky') return;

    // If already editing this one, bail
    if (editingIdRef.current === objectId && editorRef.current) return;
    // Close any existing editor
    if (editorRef.current) commitAndClose();

    const canvasRect = getCanvasRect();
    if (!canvasRect) return;

    // Mark as editing so the canvas renderer hides the text
    obj._isEditing = true;
    cm.requestRender();

    const zoom = cm.state.viewport.zoom;
    const tl = cm.worldToScreen(obj.x, obj.y);
    const padding = 12;
    const scaledPadding = padding * zoom;
    const innerW = obj.width * zoom - scaledPadding * 2;
    const innerH = obj.height * zoom - scaledPadding * 2;
    const rotation = obj.rotation || 0;

    const baseFontSize = (obj.fontSize || 16) * zoom;
    const fitted = computeFittedFontSize(obj.text || '', innerW, innerH, baseFontSize);

    // Create contenteditable overlay
    const el = document.createElement('div');
    el.contentEditable = 'true';
    el.setAttribute('data-sticky-editor', objectId);

    // Hydrate formatted text → HTML
    const initHtml = textAndRangesToHtml(obj.text || '', obj.formattedRanges);
    if (initHtml) {
      el.innerHTML = initHtml;
    }

    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '920',
      left: `${canvasRect.left + tl.x + scaledPadding}px`,
      top: `${canvasRect.top + tl.y + scaledPadding}px`,
      width: `${innerW}px`,
      height: `${innerH}px`,
      fontSize: `${fitted}px`,
      fontFamily: 'Arial, sans-serif',
      lineHeight: '1.3',
      color: obj.textColor || '#111111',
      caretColor: obj.textColor || '#111111',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      padding: '0',
      margin: '0',
      overflow: 'hidden',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      cursor: 'text',
      boxSizing: 'border-box',
      transform: rotation ? `rotate(${rotation}rad)` : '',
      transformOrigin: 'top left',
    });

    document.body.appendChild(el);
    editorRef.current = el;
    editingIdRef.current = objectId;
    cm.emit('sticky:textedit:started', { objectId });
    cm.stickyInlineEditId = objectId;
    historyTextRef.current = obj.text || '';
    historyRangesRef.current = cloneRanges(obj.formattedRanges);

    // Focus & place caret at end
    el.focus();
    const sel = window.getSelection();
    if (sel && el.childNodes.length > 0) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // --- event listeners ---

    const onInput = () => {
      const obj2 = cm.getObjectById(objectId);
      if (obj2) {
        const { text, formattedRanges } = htmlToTextAndRanges(el);
        const cleanedText = text.replace(/\n+$/, '');
        obj2.text = cleanedText;
        obj2.formattedRanges = formattedRanges.length > 0 ? formattedRanges : undefined;
        obj2.updatedAt = Date.now();
        const currentUserId = useCollaborationStore.getState().currentUser?.id || null;
        if (currentUserId) {
          obj2.lastEditedBy = currentUserId;
          obj2.lastEditedAt = Date.now();
        }

        if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
        historyTimerRef.current = setTimeout(() => {
          const latest = cm.getObjectById(objectId);
          if (!latest) return;
          const nextText = latest.text || '';
          const nextRanges = cloneRanges(latest.formattedRanges);
          if (nextText === historyTextRef.current && areRangesEqual(nextRanges, historyRangesRef.current)) return;
          const cmd = new ObjectTextCommand({
            objectId,
            fieldKey: 'text',
            previousText: historyTextRef.current,
            nextText,
            previousFormattedRanges: historyRangesRef.current,
            nextFormattedRanges: nextRanges,
          });
          cmd.userId = useCollaborationStore.getState().currentUser?.id || null;
          cm.historyManager.registerWithoutExecuting(cmd);
          historyTextRef.current = nextText;
          historyRangesRef.current = cloneRanges(nextRanges);
        }, 350);
      }
      positionEditor();
      cm.requestRender();

      cm.emit('sticky:text:update', {
        objectId,
        text: el.innerText ?? '',
      });
    };

    const onKeyDown = (e) => {
      // Escape → commit & close
      if (e.key === 'Escape') {
        e.preventDefault();
        el.blur();
        return;
      }
      // Ctrl+Enter → commit & close
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        el.blur();
        return;
      }
      // Let Ctrl+B / Ctrl+I pass through for native bold/italic
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) {
        // Don't stop propagation — let browser handle execCommand
        e.stopPropagation();
        return;
      }
      // Prevent canvas keyboard shortcuts from firing
      e.stopPropagation();
    };

    const onBlur = () => {
      const activeEl = document.activeElement;
      const isToolbarFocus = activeEl && activeEl.closest('[data-floating-toolbar]');
      if (isToolbarFocus) {
        requestAnimationFrame(() => el.focus());
        return;
      }
      el.removeEventListener('input', onInput);
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('blur', onBlur);
      commitAndClose();
    };

    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('blur', onBlur);
  }, [canvasManagerRef, getCanvasRect, computeFittedFontSize, positionEditor, commitAndClose]);

  const requestClose = useCallback(({ objectId } = {}) => {
    const id = objectId || editingIdRef.current;
    if (!id || !editorRef.current) return;
    editorRef.current.blur();
  }, []);

  // ---- lifecycle ----

  useEffect(() => {
    if (!isReady || !canvasManagerRef.current) return;
    const cm = canvasManagerRef.current;

    cm.on('sticky:edit', handleStickyEdit);
    cm.on('sticky:textedit:requestclose', requestClose);
    const handleStickyStyleChanged = () => {
      if (editorRef.current && editingIdRef.current) positionEditor();
      const cmNow = canvasManagerRef.current;
      const editingId = editingIdRef.current;
      const el = editorRef.current;
      if (!cmNow || !editingId || !el) return;
      const obj = cmNow.getObjectById(editingId);
      if (!obj) return;
      el.style.color = obj.textColor || '#111111';
      el.style.caretColor = obj.textColor || '#111111';
    };
    cm.on('sticky:textedit:stylechanged', handleStickyStyleChanged);

    const onViewportChange = () => {
      if (editorRef.current && editingIdRef.current) positionEditor();
    };
    cm.on('viewport:changed', onViewportChange);

    // Reposition editor when the sticky note is moved while in edit mode.
    // This handles both local drag-moves and remote smooth-move animations.
    const onMoveUpdate = () => {
      if (editorRef.current && editingIdRef.current) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          positionEditor();
          rafRef.current = null;
        });
      }
    };
    cm.on('move:update', onMoveUpdate);
    cm.on('move:final', onMoveUpdate);
    cm.on('transform:update', onMoveUpdate);
    cm.on('transform:final', onMoveUpdate);

    // Bug 2: During any resize / move gesture, disable pointer-events on the sticky
    // editor overlay so that the transform-drag pointermove is not swallowed by the
    // contenteditable (which sits on top with z-index 1000).
    // "Older" interaction (the editor) yields to the incoming transform gesture.
    let interactionTimer = null;
    const disableEditorEvents = () => {
      if (editorRef.current) {
        editorRef.current.style.pointerEvents = 'none';
        editorRef.current.style.userSelect = 'none';
      }
    };
    const restoreEditorEvents = () => {
      if (interactionTimer) clearTimeout(interactionTimer);
      interactionTimer = setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.style.pointerEvents = 'text';
          editorRef.current.style.userSelect = 'text';
        }
        interactionTimer = null;
      }, 150);
    };

    cm.on('transform:update', disableEditorEvents);
    cm.on('transform:final', restoreEditorEvents);
    cm.on('move:update', disableEditorEvents);
    cm.on('move:final', restoreEditorEvents);

    const onSelectionChange = () => {
      const id = editingIdRef.current;
      if (!id) return;
      const sel = cm.state.selection || [];
      if (!sel.includes(id)) {
        if (editorRef.current) {
          editorRef.current.blur();
        }
      }
    };
    cm.on('selection:changed', onSelectionChange);

    return () => {
      cm.off('sticky:edit', handleStickyEdit);
      cm.off('sticky:textedit:requestclose', requestClose);
      cm.off('sticky:textedit:stylechanged', handleStickyStyleChanged);
      cm.off('viewport:changed', onViewportChange);
      cm.off('move:update', onMoveUpdate);
      cm.off('move:final', onMoveUpdate);
      cm.off('transform:update', onMoveUpdate);
      cm.off('transform:final', onMoveUpdate);
      cm.off('transform:update', disableEditorEvents);
      cm.off('transform:final', restoreEditorEvents);
      cm.off('move:update', disableEditorEvents);
      cm.off('move:final', restoreEditorEvents);
      if (interactionTimer) clearTimeout(interactionTimer);
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }
      cm.off('selection:changed', onSelectionChange);
      cm.stickyInlineEditId = null;
      if (editorRef.current) commitAndClose();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isReady, canvasManagerRef, handleStickyEdit, positionEditor, commitAndClose, requestClose]);
}
