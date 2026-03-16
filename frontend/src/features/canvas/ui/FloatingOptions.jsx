import { useState, useEffect, useCallback, useRef } from 'react';
import FloatingTextToolbar from './FloatingTextToolbar';
import ImageOptions from './tool-options/ImageOptions';
import ObjectOptionsToolbar from './ObjectOptionsToolbar';
import MultiObjectOptionsToolbar from './MultiObjectOptionsToolbar';
import EmojiObjectToolbar from './EmojiObjectToolbar';
import StickyObjectToolbar from './StickyObjectToolbar';
// Connector UI removed: ConnectorStyleToolbar and connector geometry constants

function getToolbarWidthForSelection(selectedObject, selectedCount) {
  if (selectedCount > 1) return 420;
  if (!selectedObject) return 360;
  if (selectedObject.type === 'text') return 600;
  if (selectedObject.type === 'image') return 460;
  return 380;
}

function getToolbarHeightForSelection(selectedObject, selectedCount) {
  if (selectedCount > 1) return 54;
  if (!selectedObject) return 48;
  if (selectedObject.type === 'text') return 56;
  if (selectedObject.type === 'image') return 54;
  return 52;
}

export default function FloatingOptions({
  canvasManager,
  selectedIds = [],
  selectedObjects = [],
  isVisible = true,
}) {
  const [toolbarPosition, setToolbarPosition] = useState(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const rafRef = useRef(null);
  const visibilityTimerRef = useRef(null);
  const previousSelectionKeyRef = useRef('');

  const selectedObject = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const selectionKey = selectedIds.join('|');

  const getSelectionBounds = useCallback(() => {
    if (!canvasManager || selectedIds.length === 0) return null;
    if (selectedIds.length === 1) {
      const obj = canvasManager.getObjectById(selectedIds[0]);
      if (!obj) return null;
      return canvasManager.getObjectBounds(obj);
    }
    return canvasManager.getMultipleObjectBounds(selectedIds);
  }, [canvasManager, selectedIds]);

  const calculateToolbarPosition = useCallback(() => {
    if (!canvasManager) return null;
    const bounds = getSelectionBounds();
    if (!bounds) return null;

    const canvasRect = canvasManager.canvas?.getBoundingClientRect();
    if (!canvasRect) return null;

    const toolbarWidth = getToolbarWidthForSelection(selectedObject, selectedIds.length);
    const toolbarHeight = getToolbarHeightForSelection(selectedObject, selectedIds.length);
    const baseGap = selectedObject?.type === 'text' ? 44 : 16;
    // Port handles removed — no extra outward gap
    const gap = baseGap;

    const topCenter = canvasManager.worldToScreen(bounds.x + bounds.width / 2, bounds.y);
    const bottomCenter = canvasManager.worldToScreen(bounds.x + bounds.width / 2, bounds.y + bounds.height);
    const rightCenter = canvasManager.worldToScreen(bounds.x + bounds.width, bounds.y + bounds.height / 2);

    let x = topCenter.x;
    let y = topCenter.y - toolbarHeight - gap;

    // Prefer above; if too tight, move below.
    if (y < 56 || Math.abs(y - topCenter.y) < toolbarHeight + 14) {
      y = bottomCenter.y + gap;
    }

    // If still too crowded, move to right side.
    if (y + toolbarHeight > canvasRect.height - 10) {
      x = rightCenter.x + toolbarWidth / 2 + gap;
      y = topCenter.y - toolbarHeight / 2;
    }

    // Clamp to viewport area.
    x = Math.max(toolbarWidth / 2 + 10, Math.min(x, canvasRect.width - toolbarWidth / 2 - 10));
    y = Math.max(10, Math.min(y, canvasRect.height - toolbarHeight - 10));

    return { x, y };
  }, [canvasManager, getSelectionBounds, selectedObject, selectedIds.length]);

  const isSelectionVisibleInViewport = useCallback(() => {
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
  
  const updatePosition = useCallback(() => {
    if (!canvasManager || selectedIds.length === 0) {
      setToolbarPosition(null);
      return;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!isSelectionVisibleInViewport()) {
        setToolbarPosition(null);
      } else {
        setToolbarPosition(calculateToolbarPosition());
      }
      rafRef.current = null;
    });
  }, [canvasManager, selectedIds.length, calculateToolbarPosition, isSelectionVisibleInViewport]);



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

  useEffect(() => {
    if (!canvasManager || selectedIds.length === 0) return;
    updatePosition();

    const handleViewportChange = () => updatePosition();
    const handleMoveUpdate = () => setShowToolbar(false);
    const handleMoveFinal = () => { updatePosition(); if (selectedIds.length > 0) setShowToolbar(true); };
    const handleTextUpdate = () => updatePosition();
    const handlePanStart = () => setShowToolbar(false);
    const handlePanEnd = () => { updatePosition(); if (selectedIds.length > 0) setShowToolbar(true); };

    canvasManager.on('viewport:changed', handleViewportChange);
    canvasManager.on('move:update', handleMoveUpdate);
    canvasManager.on('move:final', handleMoveFinal);
    canvasManager.on('transform:update', handleMoveUpdate);
    canvasManager.on('transform:final', handleMoveFinal);
    canvasManager.on('text:update', handleTextUpdate);
    canvasManager.on('pan:start', handlePanStart);
    canvasManager.on('pan:end', handlePanEnd);
    window.addEventListener('resize', updatePosition);

    return () => {
      canvasManager.off('viewport:changed', handleViewportChange);
      canvasManager.off('move:update', handleMoveUpdate);
      canvasManager.off('move:final', handleMoveFinal);
      canvasManager.off('transform:update', handleMoveUpdate);
      canvasManager.off('transform:final', handleMoveFinal);
      canvasManager.off('text:update', handleTextUpdate);
      canvasManager.off('pan:start', handlePanStart);
      canvasManager.off('pan:end', handlePanEnd);
      window.removeEventListener('resize', updatePosition);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

    };
  }, [canvasManager, selectedIds.length, updatePosition]);

  if (!showToolbar || !toolbarPosition || !isVisible || selectedIds.length === 0) {
    return null;
  }

  if (selectedIds.length > 1) {
    return (
      <MultiObjectOptionsToolbar
        canvasManager={canvasManager}
        objects={selectedObjects}
        position={toolbarPosition}
        onClose={() => {}}
      />
    );
  }

  if (!selectedObject) return null;

  if (selectedObject.type === 'text') {
    return (
      <FloatingTextToolbar
        canvasManager={canvasManager}
        textObject={selectedObject}
        position={toolbarPosition}
        onFinish={() => {}}
      />
    );
  }

  if (selectedObject.type === 'image') {
    return (
      <ImageOptions
        canvasManager={canvasManager}
        imageObject={selectedObject}
        position={toolbarPosition}
        onClose={() => {}}
      />
    );
  }

  if (selectedObject.type === 'emoji') {
    return (
      <EmojiObjectToolbar
        canvasManager={canvasManager}
        object={selectedObject}
        position={toolbarPosition}
        onClose={() => {}}
      />
    );
  }

  if (selectedObject.type === 'sticky') {
    return (
      <StickyObjectToolbar
        canvasManager={canvasManager}
        object={selectedObject}
        position={toolbarPosition}
        onClose={() => {}}
      />
    );
  }

  // Lines/arrows use the default object options toolbar now

  return (
    <ObjectOptionsToolbar
      canvasManager={canvasManager}
      object={selectedObject}
      position={toolbarPosition}
      onClose={() => {}}
    />
  );
}
