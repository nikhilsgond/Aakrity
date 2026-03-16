// src/components/canvas/EmojiSwapOverlay.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { UpdateStyleCommand } from '../engine/commands/UpdateStyleCommand';

const ALL_EMOJIS = [
  '😀', '😂', '🥹', '😍', '🤩', '😎', '🤔', '😢', '😡', '🥳', '😱', '🤯',
  '👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪', '🫡', '👋', '🫶', '☝️',
  '⭐', '🔥', '💡', '❤️', '💯', '🎯', '🚀', '💎', '🏆', '🎉', '📌', '✅',
  '✨', '⚡', '💥', '🔔', '⚠️', '❌', '⬆️', '➡️', '🔄', '🔗', '💬', '📍',
];

export default function EmojiSwapOverlay({ canvasManager }) {
  const [swapState, setSwapState] = useState(null); // { objectId, screenX, screenY }
  const overlayRef = useRef(null);

  // Listen for emoji:swap events from SelectTool
  useEffect(() => {
    if (!canvasManager) return;

    const handleSwap = ({ objectId, point }) => {
      let screenPos;
      if (point) {
        screenPos = canvasManager.worldToScreen(point.x, point.y);
      } else {
        // Called from context toolbar button — use object center
        const obj = canvasManager.getObjectById(objectId);
        if (obj) {
          const bounds = canvasManager.getObjectBounds(obj);
          if (bounds) {
            screenPos = canvasManager.worldToScreen(
              bounds.x + bounds.width / 2,
              bounds.y + bounds.height / 2
            );
          }
        }
      }
      if (!screenPos) return;
      setSwapState({ objectId, screenX: screenPos.x, screenY: screenPos.y });
    };

    canvasManager.on('emoji:swap', handleSwap);
    return () => canvasManager.off('emoji:swap', handleSwap);
  }, [canvasManager]);

  // Close when selection changes (object deselected)
  useEffect(() => {
    if (!canvasManager) return;
    const close = () => setSwapState(null);
    canvasManager.on('selection:changed', close);
    return () => canvasManager.off('selection:changed', close);
  }, [canvasManager]);

  // Close on outside click
  useEffect(() => {
    if (!swapState) return;
    const onDown = (e) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target)) {
        setSwapState(null);
      }
    };
    // Delay to avoid immediate close from the double-click event
    const t = setTimeout(() => document.addEventListener('pointerdown', onDown), 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [swapState]);

  const handlePick = useCallback((emoji) => {
    if (!canvasManager || !swapState) return;
    const cmd = new UpdateStyleCommand([swapState.objectId], { emoji });
    canvasManager.executeCommand(cmd);
    canvasManager.requestRender();
    setSwapState(null);
  }, [canvasManager, swapState]);

  if (!swapState) return null;

  // Position the picker so it doesn't overflow the viewport
  const pickerW = 230;
  const pickerH = 220;
  let left = swapState.screenX - pickerW / 2;
  let top = swapState.screenY - pickerH - 16;
  if (top < 8) top = swapState.screenY + 16;
  if (left < 8) left = 8;
  if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;

  return (
    <div
      ref={overlayRef}
      className="fixed z-[1100] bg-card border border-border rounded-xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150"
      style={{ left, top, width: pickerW }}
    >
      <div className="text-xs font-medium text-muted-foreground mb-2">Swap emoji</div>
      <div className="grid grid-cols-8 gap-1">
        {ALL_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handlePick(emoji)}
            className="w-6 h-6 flex items-center justify-center rounded text-sm hover:bg-muted/60 hover:scale-110 transition-all"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
