// src/components/canvas/tool-options/ImageOptions.jsx
import { useState, useEffect, useRef } from 'react';
import {
  Square,
  Copy,
  BringToFront,
  SendToBack,
} from 'lucide-react';
import { generateId } from '@shared/lib/idGenerator';
import ColorPickerPanel from '../ColorPickerPanel';

export default function ImageOptions({
  canvasManager,
  imageObject,
  position,
  onClose
}) {
  const [options, setOptions] = useState({
    borderWidth: 0,
    borderColor: '#000000',
    borderRadius: 0,
    opacity: 1,
  });

  const [showBorderColorPicker, setShowBorderColorPicker] = useState(false);
  const [showOpacityMenu, setShowOpacityMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  const toolbarRef = useRef(null);

  // Initialize options from image object
  useEffect(() => {
    if (imageObject) {
      setOptions({
        borderWidth: imageObject.borderWidth || 0,
        borderColor: imageObject.borderColor || '#000000',
        borderRadius: imageObject.borderRadius || 0,
        opacity: imageObject.opacity ?? 1,
      });
    }
  }, [imageObject]);

  // mount animation
  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 12);
    return () => clearTimeout(t);
  }, [imageObject?.id]);

  // Update image when options change
  const updateOption = (property, value) => {
    setOptions(prev => ({ ...prev, [property]: value }));

    if (canvasManager && imageObject) {
      const obj = canvasManager.getObjectById(imageObject.id);
      if (obj) {
        obj[property] = value;
        canvasManager.requestRender();
        canvasManager.emit('object:modified', { target: obj });
      }
    }
  };

  // Handle click outside to close dropdown menus
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setShowBorderColorPicker(false);
        setShowOpacityMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const bringToFront = () => {
    const idx = canvasManager.state.objects.findIndex((o) => o.id === imageObject.id);
    if (idx < 0) return;
    const [item] = canvasManager.state.objects.splice(idx, 1);
    canvasManager.state.objects.push(item);
    canvasManager.requestRender();
    canvasManager.emit('object:modified', { target: item });
  };

  const sendToBack = () => {
    const idx = canvasManager.state.objects.findIndex((o) => o.id === imageObject.id);
    if (idx < 0) return;
    const [item] = canvasManager.state.objects.splice(idx, 1);
    canvasManager.state.objects.unshift(item);
    canvasManager.requestRender();
    canvasManager.emit('object:modified', { target: item });
  };

  const duplicateObject = () => {
    const src = canvasManager.getObjectById(imageObject.id) || imageObject;
    if (!src) return;
    const cloned = JSON.parse(JSON.stringify(src));
    cloned.id = generateId();
    cloned.createdAt = Date.now();
    cloned.updatedAt = Date.now();
    if (cloned.x !== undefined) cloned.x += 20;
    if (cloned.y !== undefined) cloned.y += 20;
    canvasManager.state.objects.push(cloned);
    canvasManager.updateObjectIndex?.();
    canvasManager.setSelection([cloned.id]);
    canvasManager.requestRender();
    canvasManager.emit('object:added', { object: cloned });
  };

  // Calculate toolbar position
  const getToolbarStyle = () => {
    if (!position || !canvasManager) return { display: 'none' };

    const toolbarWidth = 500;

    if (position.worldX !== undefined && position.worldY !== undefined) {
      const screenX = position.worldX * position.viewport.zoom + position.viewport.panX;
      const screenY = position.worldY * position.viewport.zoom + position.viewport.panY;

      const toolbarHeight = 60;
      const canvasRect = canvasManager.canvas?.getBoundingClientRect();

      let left = screenX - toolbarWidth / 2;
      let top = screenY - toolbarHeight - 80;

      if (canvasRect) {
        left = Math.max(10, Math.min(left, canvasRect.width - toolbarWidth - 10));
        top = Math.max(10, top);
      }

      return {
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        zIndex: 1000,
        pointerEvents: 'auto',
      };
    }

    return {
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
      transform: 'translateX(-50%)',
      zIndex: 1000,
      pointerEvents: 'auto',
    };
  };

  if (!imageObject || !position || !canvasManager) return null;

  return (
    <div
      ref={toolbarRef}
      style={getToolbarStyle()}
      className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-300/50 dark:border-gray-600/50 rounded-md shadow-lg px-3 py-2 flex items-center gap-2 transition-all duration-150 ease-out transform ${mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
    >
      {/* Border Width Slider */}
      <div className="flex items-center gap-1.5">
        <Square className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={options.borderWidth}
          onChange={(e) => updateOption('borderWidth', parseInt(e.target.value, 10))}
          className="w-16 h-1 accent-primary cursor-pointer"
          title="Border Width"
        />
        <span className="text-[10px] tabular-nums text-muted-foreground w-4 text-center">{options.borderWidth}</span>
      </div>

      {/* Border Color */}
      <div className="relative">
        <button
          onClick={() => { setShowBorderColorPicker(!showBorderColorPicker); setShowOpacityMenu(false); }}
          className="w-7 h-7 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
          style={{ backgroundColor: options.borderColor }}
          title="Border Color"
        />
        {showBorderColorPicker && (
          <ColorPickerPanel
            value={options.borderColor}
            onChange={(c) => updateOption('borderColor', c)}
            type="stroke"
            onClose={() => setShowBorderColorPicker(false)}
          />
        )}
      </div>

      {/* Border Radius +/- */}
      <div className="flex items-center gap-1">
        <button onClick={() => updateOption('borderRadius', Math.max(0, (options.borderRadius || 0) - 2))} className="w-6 h-6 rounded flex items-center justify-center border border-border text-xs">-</button>
        <span className="text-[10px] tabular-nums px-0.5 w-5 text-center" title="Border Radius">{options.borderRadius}</span>
        <button onClick={() => updateOption('borderRadius', Math.min(100, (options.borderRadius || 0) + 2))} className="w-6 h-6 rounded flex items-center justify-center border border-border text-xs">+</button>
      </div>

      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

      {/* Opacity Slider */}
      <div className="relative">
        <button
          onClick={() => { setShowOpacityMenu(!showOpacityMenu); setShowBorderColorPicker(false); }}
          className={`px-2 py-1 rounded flex items-center gap-1 text-xs ${options.opacity < 1
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          title="Opacity"
        >
          {Math.round(options.opacity * 100)}%
        </button>

        {showOpacityMenu && (
          <div className="absolute top-full left-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20 p-3">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={options.opacity}
              onChange={(e) => updateOption('opacity', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-gray-600 dark:text-gray-400 mt-1">
              <span>0%</span>
              <span>{Math.round(options.opacity * 100)}%</span>
              <span>100%</span>
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

      {/* Duplicate */}
      <button onClick={duplicateObject} title="Duplicate" className="p-1.5 rounded-md hover:bg-gray-200/60 dark:hover:bg-gray-700/50 transition-colors">
        <Copy className="w-3.5 h-3.5" />
      </button>

      {/* Bring to Front */}
      <button onClick={bringToFront} title="Bring to Front" className="p-1.5 rounded-md hover:bg-gray-200/60 dark:hover:bg-gray-700/50 transition-colors">
        <BringToFront className="w-3.5 h-3.5" />
      </button>

      {/* Send to Back */}
      <button onClick={sendToBack} title="Send to Back" className="p-1.5 rounded-md hover:bg-gray-200/60 dark:hover:bg-gray-700/50 transition-colors">
        <SendToBack className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}