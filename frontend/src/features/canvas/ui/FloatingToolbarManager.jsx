import { useState, useEffect, useCallback, useRef } from 'react';
import ContextToolbar from './ContextToolbar';
import ShapeTextEditToolbar from './ShapeTextEditToolbar';
import StickyTextEditToolbar from './StickyTextEditToolbar';
import useCollaborationStore from '@features/room/state/collaborationStore';
import { DeleteObjectsCommand } from '../engine/commands/ObjectCommands';

export default function FloatingToolbarManager({ canvasManager }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedObjects, setSelectedObjects] = useState([]);
  const [toolbarPosition, setToolbarPosition] = useState(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [editingShapeId, setEditingShapeId] = useState(null);
  const [editingStickyId, setEditingStickyId] = useState(null);

  const rafRef = useRef(null);
  const visibilityTimerRef = useRef(null);
  const previousSelectionKeyRef = useRef('');
  const selectionKey = selectedIds.length > 0 ? selectedIds.join('|') : null;

  // Track selection changes from CanvasManager
  useEffect(() => {
    if (!canvasManager) return;

    const handleSelectionChange = (data) => {
      setSelectedIds(data.selectedIds);
      if (data.selectedIds.length > 0) {
        const objs = data.selectedIds
          .map(id => canvasManager.getObjectById(id))
          .filter(o => o);
        setSelectedObjects(objs);
      } else {
        setSelectedObjects([]);
      }
    };

    canvasManager.on('selection:changed', handleSelectionChange);
    handleSelectionChange({ selectedIds: canvasManager.getSelection() });

    const handleTextEditStarted = ({ objectId }) => setEditingShapeId(objectId);
    const handleTextEditEnd = () => setEditingShapeId(null);
    const handleStickyEditStarted = ({ objectId }) => setEditingStickyId(objectId);
    const handleStickyEditEnd = () => setEditingStickyId(null);
    canvasManager.on('shape:textedit:started', handleTextEditStarted);
    canvasManager.on('shape:textedit:end', handleTextEditEnd);
    canvasManager.on('sticky:textedit:started', handleStickyEditStarted);
    canvasManager.on('sticky:textedit:end', handleStickyEditEnd);

    return () => {
      canvasManager.off('selection:changed', handleSelectionChange);
      canvasManager.off('shape:textedit:started', handleTextEditStarted);
      canvasManager.off('shape:textedit:end', handleTextEditEnd);
      canvasManager.off('sticky:textedit:started', handleStickyEditStarted);
      canvasManager.off('sticky:textedit:end', handleStickyEditEnd);
    };
  }, [canvasManager]);

  // Get selection bounds
  const getSelectionBounds = useCallback(() => {
    if (!canvasManager || selectedIds.length === 0) return null;
    
    if (selectedIds.length === 1) {
      const obj = canvasManager.getObjectById(selectedIds[0]);
      return obj ? canvasManager.getObjectBounds(obj) : null;
    }
    return canvasManager.getMultipleObjectBounds(selectedIds);
  }, [canvasManager, selectedIds]);

  // Calculate toolbar position (screen coordinates)
  const calculateToolbarPosition = useCallback(() => {
    if (!canvasManager) return null;
    const bounds = getSelectionBounds();
    if (!bounds) return null;

    const canvasRect = canvasManager.canvas?.getBoundingClientRect();
    if (!canvasRect) return null;

    const toolbarWidth = 440;
    const toolbarHeight = 80;
    const gap = 16;

    const topCenter = canvasManager.worldToScreen(bounds.x + bounds.width / 2, bounds.y);
    const bottomCenter = canvasManager.worldToScreen(bounds.x + bounds.width / 2, bounds.y + bounds.height);

    let x = topCenter.x;
    let y = topCenter.y - toolbarHeight - gap;

    // If too high, put below
    if (y < 56) {
      y = bottomCenter.y + gap;
    }

    // Keep toolbar on screen
    x = Math.max(toolbarWidth / 2 + 10, Math.min(x, canvasRect.width - toolbarWidth / 2 - 10));
    y = Math.max(10, Math.min(y, canvasRect.height - toolbarHeight - 10));

    return { x, y };
  }, [canvasManager, getSelectionBounds]);

  // Check if selection is visible in viewport
  const isSelectionVisible = useCallback(() => {
    const bounds = getSelectionBounds();
    if (!bounds || !canvasManager?.canvas) return false;

    const canvasRect = canvasManager.canvas.getBoundingClientRect();
    const tl = canvasManager.worldToScreen(bounds.x, bounds.y);
    const br = canvasManager.worldToScreen(bounds.x + bounds.width, bounds.y + bounds.height);

    const left = Math.min(tl.x, br.x);
    const right = Math.max(tl.x, br.x);
    const top = Math.min(tl.y, br.y);
    const bottom = Math.max(tl.y, br.y);

    const margin = 40;
    return !(
      right < -margin ||
      left > canvasRect.width + margin ||
      bottom < -margin ||
      top > canvasRect.height + margin
    );
  }, [canvasManager, getSelectionBounds]);

  // Update position with RAF
  const updatePosition = useCallback(() => {
    if (!canvasManager || selectedIds.length === 0) {
      setToolbarPosition(null);
      return;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      if (!isSelectionVisible()) {
        setToolbarPosition(null);
      } else {
        setToolbarPosition(calculateToolbarPosition());
      }
      rafRef.current = null;
    });
  }, [canvasManager, selectedIds.length, calculateToolbarPosition, isSelectionVisible]);

  // Show/hide toolbar based on selection
  useEffect(() => {
    if (!canvasManager) return;

    if (selectedIds.length > 0) {
      setShowToolbar(true);
      updatePosition();
    } else {
      setShowToolbar(false);
      setToolbarPosition(null);
    }
  }, [canvasManager, selectedIds.length, updatePosition]);

  // Handle selection changes with animation
  useEffect(() => {
    if (selectionKey && previousSelectionKeyRef.current && previousSelectionKeyRef.current !== selectionKey) {
      setShowToolbar(false);
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
      visibilityTimerRef.current = setTimeout(() => setShowToolbar(true), 80);
    }
    previousSelectionKeyRef.current = selectionKey;

    return () => {
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
    };
  }, [selectionKey]);

  // Event listeners for viewport changes
  useEffect(() => {
    if (!canvasManager || selectedIds.length === 0) return;

    updatePosition();

    const handleViewportChange = () => updatePosition();
    const handleContentUpdate = () => updatePosition();
    const handleMoveUpdate = () => setShowToolbar(false);
    const handleMoveFinal = () => {
      updatePosition();
      if (selectedIds.length > 0) setShowToolbar(true);
    };
    const handlePanStart = () => setShowToolbar(false);
    const handlePanEnd = () => {
      updatePosition();
      if (selectedIds.length > 0) setShowToolbar(true);
    };

    canvasManager.on('viewport:changed', handleViewportChange);
    canvasManager.on('text:update', handleContentUpdate);
    canvasManager.on('sticky:text:update', handleContentUpdate);
    canvasManager.on('object:modified', handleContentUpdate);
    canvasManager.on('move:update', handleMoveUpdate);
    canvasManager.on('move:final', handleMoveFinal);
    canvasManager.on('transform:update', handleMoveUpdate);
    canvasManager.on('transform:final', handleMoveFinal);
    canvasManager.on('pan:start', handlePanStart);
    canvasManager.on('pan:end', handlePanEnd);
    window.addEventListener('resize', updatePosition);

    return () => {
      canvasManager.off('viewport:changed', handleViewportChange);
      canvasManager.off('text:update', handleContentUpdate);
      canvasManager.off('sticky:text:update', handleContentUpdate);
      canvasManager.off('object:modified', handleContentUpdate);
      canvasManager.off('move:update', handleMoveUpdate);
      canvasManager.off('move:final', handleMoveFinal);
      canvasManager.off('transform:update', handleMoveUpdate);
      canvasManager.off('transform:final', handleMoveFinal);
      canvasManager.off('pan:start', handlePanStart);
      canvasManager.off('pan:end', handlePanEnd);
      window.removeEventListener('resize', updatePosition);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [canvasManager, selectedIds.length, updatePosition]);

  const singleObj = selectedObjects.length === 1 ? selectedObjects[0] : null;

  const handleDeleteSelected = useCallback(() => {
    if (!canvasManager) return;
    const selectedIds = canvasManager.getSelection?.() || [];
    if (selectedIds.length === 0) return;

    const { isLockedByOther, remoteSelections, currentUser } = useCollaborationStore.getState();
    const isSelectedByOther = (id) => {
      if (!remoteSelections) return false;
      for (const [uid, ids] of remoteSelections.entries()) {
        if (uid !== currentUser?.id && Array.isArray(ids) && ids.includes(id)) return true;
      }
      return false;
    };

    const deletableIds = selectedIds.filter((id) => !isLockedByOther?.(id) && !isSelectedByOther(id));
    if (deletableIds.length === 0) return;

    const objects = deletableIds
      .map((id) => canvasManager.getObjectById(id))
      .filter((obj) => obj);

    const cmd = new DeleteObjectsCommand(objects);
    canvasManager.executeLocalCommand(cmd);
    canvasManager.clearSelection();
  }, [canvasManager]);

  return (
    <>
      {editingShapeId ? (
        <ShapeTextEditToolbar
          canvasManager={canvasManager}
          objectId={editingShapeId}
          position={toolbarPosition}
          onDone={() => canvasManager.emit('shape:textedit:requestclose', { objectId: editingShapeId })}
        />
      ) : editingStickyId ? (
        <StickyTextEditToolbar
          canvasManager={canvasManager}
          objectId={editingStickyId}
          position={toolbarPosition}
          onDone={() => canvasManager.emit('sticky:textedit:requestclose', { objectId: editingStickyId })}
        />
      ) : (
        <ContextToolbar
          canvasManager={canvasManager}
          selectedIds={selectedIds}
          selectedObjects={selectedObjects}
          position={toolbarPosition}
          showToolbar={showToolbar}
          onStartShapeEdit={(id) => canvasManager.emit('shape:textedit:start', { objectId: id })}
          onDeleteSelected={handleDeleteSelected}
        />
      )}
    </>
  );
}