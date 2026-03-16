// src/components/canvas/tool-options/EmojiOptions.jsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AddShapeCommand, ShapeCommandFactory } from '../../engine/commands/ShapeCommands';

const DEFAULT_EMOJI_SIZE = 64;

const EMOJI_CATEGORIES = [
  {
    name: '😀',
    emojis: ['😀', '😂', '🥹', '😍', '🤩', '😎', '🤔', '😢', '😡', '🥳', '😱', '🤯'],
  },
  {
    name: '👍',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪', '🫡', '👋', '🫶', '☝️'],
  },
  {
    name: '⭐',
    emojis: ['⭐', '🔥', '💡', '❤️', '💯', '🎯', '🚀', '💎', '🏆', '🎉', '📌', '✅'],
  },
  {
    name: '✨',
    emojis: ['✨', '⚡', '💥', '🔔', '⚠️', '❌', '⬆️', '➡️', '🔄', '🔗', '💬', '📍'],
  },
];

/**
 * Ghost element that follows the cursor during emoji drag
 */
function DragGhost({ emoji, x, y }) {
  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999]"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      <span className="text-5xl drop-shadow-lg select-none" style={{ lineHeight: 1 }}>
        {emoji}
      </span>
    </div>,
    document.body
  );
}

export default function EmojiOptions({ toolManager }) {
  const [selectedEmoji, setSelectedEmoji] = useState(() => {
    if (!toolManager) return '😀';
    const opts = toolManager.getOptions();
    return opts?.emoji || '😀';
  });

  const [activeCategory, setActiveCategory] = useState(0);

  // Drag state
  const [dragging, setDragging] = useState(null); // { emoji, x, y }
  const dragRef = useRef(null); // { emoji, startX, startY }

  const handleEmojiClick = (emoji) => {
    setSelectedEmoji(emoji);
    if (!toolManager) return;

    toolManager.setOption('emoji', emoji);
    try {
      const emojiTool = toolManager.getToolInstance('emoji');
      if (emojiTool?.setOptions) {
        emojiTool.setOptions({ emoji });
      }
    } catch (e) {
      // noop
    }
  };

  // --- Drag & Drop ---
  const handleDragStart = useCallback((emoji, e) => {
    e.preventDefault();
    dragRef.current = { emoji, startX: e.clientX, startY: e.clientY };
    setDragging({ emoji, x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e) => {
      setDragging((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    };

    const onUp = (e) => {
      const emoji = dragRef.current?.emoji;
      dragRef.current = null;
      setDragging(null);
      if (!emoji || !toolManager) return;

      // Get the canvasManager from toolManager's cached instances
      const canvasManager = getCanvasManager(toolManager);
      if (!canvasManager || !canvasManager.canvas) return;

      const canvasRect = canvasManager.canvas.getBoundingClientRect();
      const cx = e.clientX;
      const cy = e.clientY;

      // Check if dropped on canvas
      if (
        cx >= canvasRect.left &&
        cx <= canvasRect.right &&
        cy >= canvasRect.top &&
        cy <= canvasRect.bottom
      ) {
        const relX = cx - canvasRect.left;
        const relY = cy - canvasRect.top;
        const worldPos = canvasManager.screenToWorld(relX, relY);

        const size = DEFAULT_EMOJI_SIZE;
        const shapeData = {
          id: ShapeCommandFactory.generateShapeId(),
          type: 'emoji',
          x: worldPos.x - size / 2,
          y: worldPos.y - size / 2,
          width: size,
          height: size,
          emoji,
          rotation: 0,
          opacity: 1.0,
          visible: true,
          lockedBy: null,
          createdAt: Date.now(),
        };

        const command = new AddShapeCommand(shapeData);
        canvasManager.executeCommand(command);

        // Select the placed emoji and switch to select tool
        requestAnimationFrame(() => {
          if (command.objectId) {
            canvasManager.setSelection([command.objectId]);
          }
          const selectTool = toolManager.getToolInstance('select');
          if (selectTool) {
            canvasManager.setActiveTool(selectTool);
            toolManager.setActiveTool('select');
          }
        });

        // Also set this as the selected emoji for click-to-place
        handleEmojiClick(emoji);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, toolManager, handleEmojiClick]);

  return (
    <div className="w-full">
      {/* Category tabs */}
      <div className="flex gap-1 mb-2">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(i)}
            className={`text-base px-1.5 py-0.5 rounded transition-colors ${
              activeCategory === i
                ? 'bg-primary/10 scale-110'
                : 'opacity-60 hover:opacity-100 hover:bg-muted/50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Emoji grid — draggable */}
      <div className="grid grid-cols-6 gap-1">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleEmojiClick(emoji)}
            onMouseDown={(e) => handleDragStart(emoji, e)}
            className={`w-8 h-8 flex items-center justify-center rounded-md text-lg transition-all cursor-grab active:cursor-grabbing
              ${selectedEmoji === emoji
                ? 'bg-primary/10 shadow-[inset_0_0_0_2px] shadow-primary scale-110'
                : 'hover:bg-muted/50 hover:scale-105'
              }`}
            title={`${emoji} — click to select, drag to place`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Hint */}
      <div className="mt-1 pt-1 border-t border-border">
        <span className="text-[10px] text-muted-foreground">Drag to canvas or click to select</span>
      </div>

      {/* Drag ghost portal */}
      {dragging && <DragGhost emoji={dragging.emoji} x={dragging.x} y={dragging.y} />}
    </div>
  );
}

/**
 * Extract canvasManager from toolManager by inspecting cached tool instances.
 */
function getCanvasManager(toolManager) {
  // The toolManager stores cached tool instances; each has a canvasManager ref set on activate
  for (const [, instance] of toolManager.toolInstances) {
    if (instance?.canvasManager) return instance.canvasManager;
  }
  // Fallback: look for it on the selectTool instance
  try {
    const selectTool = toolManager.getToolInstance('select');
    if (selectTool?.canvasManager) return selectTool.canvasManager;
  } catch (e) {
    // noop
  }
  return null;
}
