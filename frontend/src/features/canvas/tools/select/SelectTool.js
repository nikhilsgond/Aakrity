import { captureInitialPosition, applyMoveFromInitial } from './lib/selectObjectMove.js';
import { selectBestObject as pickBestObject } from './lib/selectScoring.js';
import useCollaborationStore from '@features/room/state/collaborationStore';

export class SelectTool {
  constructor(selectionManager, options = {}) {
    this.name = 'select';
    this.description = 'Select and manipulate objects';
    this.cursor = 'default';
    this.options = options;

    this.selectionManager = selectionManager;
    this.canvasManager = null;

    this.pointerDownPoint = null;
    this.isDragging = false;
    this.isMovingObjects = false;
    this.startedOnEmptyCanvas = false;
    this.dragThreshold = 3;
    this.initialObjectPositions = new Map(); // Store initial positions for move
    this.moveDistance = 0;
    this.moveTargetId = null;
    this.moveTargetType = null;
  }

  getCursor() {
    return this.cursor;
  }

  attachCanvas(canvasManager) {
    this.canvasManager = canvasManager;
  }

  activate(canvasManager, toolOptions) {
    this.canvasManager = canvasManager;
    this.options = { ...this.options, ...toolOptions };
  }

  deactivate() {
    if (this.selectionManager.isMarqueeActive()) {
      this.selectionManager.endMarquee();
    }

    this.pointerDownPoint = null;
    this.isDragging = false;
    this.isMovingObjects = false;
    this.startedOnEmptyCanvas = false;
    this.initialObjectPositions.clear();
    this.moveDistance = 0;
    this.moveTargetId = null;
    this.moveTargetType = null;
    this.canvasManager = null;
  }

  onPointerDown(event) {
    if (!this.canvasManager) return null;

    const { x, y, shiftKey, ctrlKey, metaKey, screenX, screenY, originalEvent } = event;

    // Treat Ctrl/Cmd as same as Shift for multi-selection
    const isMultiSelect = shiftKey || ctrlKey || metaKey;

    this.pointerDownPoint = { x, y };
    this.isDragging = false;
    this.isMovingObjects = false;
    this.initialObjectPositions.clear();
    this.moveDistance = 0;
    this.moveTargetId = null;
    this.moveTargetType = null;

    const hitObjects = this.canvasManager.getObjectsAtPoint(screenX, screenY, 5);
    const selectedIds = this.selectionManager.getSelectedIds();
    this.cleanupTempPlaceholder(selectedIds, hitObjects);

    console.log('SelectTool: Clicked at', { x, y }, 'Hit objects:', hitObjects.length);

    if (hitObjects.length > 0) {
      
      const clickedObject = pickBestObject(this.canvasManager, hitObjects, { x, y });
      const objectId = clickedObject.id;

      // Check if object is locked by another user
      const isLocked = useCollaborationStore.getState().isLockedByOther(objectId);
      if (isLocked) {
        // Object is locked by another user, don't allow selection
        console.log('SelectTool: Object locked by another user:', objectId);
        return null;
      }

      console.log('SelectTool: Selected object:', objectId);

      this.startedOnEmptyCanvas = false;

      if (isMultiSelect) {
        // Multi-select mode: toggle the clicked object
        this.selectionManager.toggle(objectId);
        // keep CanvasManager in sync
        if (this.canvasManager && typeof this.canvasManager.setSelection === 'function') {
          this.canvasManager.setSelection(this.selectionManager.getSelectedIds());
        }
        // CRITICAL: Request render immediately after selection change
        this.canvasManager.requestRender();
      } else {
        if (originalEvent?.detail >= 2 && clickedObject.type === 'text') {
          this.selectionManager.set([objectId]);
          this.canvasManager.setSelection([objectId]);
          this.canvasManager.emit('text:edit', { objectId, point: { x, y } });
          return null;
        }
        if (originalEvent?.detail >= 2 && clickedObject.type === 'emoji') {
          this.selectionManager.set([objectId]);
          this.canvasManager.setSelection([objectId]);
          this.canvasManager.emit('emoji:swap', { objectId, point: { x, y } });
          return null;
        }
        if (originalEvent?.detail >= 2 && clickedObject.type === 'sticky') {
          this.selectionManager.set([objectId]);
          this.canvasManager.setSelection([objectId]);
          this.canvasManager.emit('sticky:edit', { objectId, point: { x, y } });
          return null;
        }
        // Check if we clicked on an already selected object
        if (selectedIds.includes(objectId)) {
          if (
            originalEvent?.detail >= 2 &&
            this.supportsShapeInternalText(clickedObject)
          ) {
            this.canvasManager.emit('shape:textedit:start', { objectId });
            return null;
          }
          // Don't start moving if this shape is being text-edited
          if (this.canvasManager.shapeInlineEditId === objectId) return null;
          // Don't start moving if this sticky note is being edited inline
          if (this.canvasManager.stickyInlineEditId === objectId) return null;
          // Start moving objects (don't change selection)
          this.isMovingObjects = true;
          this.saveInitialObjectPositions();
          this.moveTargetId = objectId;
          this.moveTargetType = clickedObject.type;
        } else {
          // Single select: replace selection with this object
          this.selectionManager.set([objectId]);
          // sync with CanvasManager
          if (this.canvasManager && typeof this.canvasManager.setSelection === 'function') {
            this.canvasManager.setSelection([objectId]);
          }
          // CRITICAL: Request render immediately after selection change
          this.canvasManager.requestRender();

          // For sticky and emoji: immediately start move mode (grab-drag)
          if (clickedObject.type === 'sticky' || clickedObject.type === 'emoji') {
            this.isMovingObjects = true;
            this.saveInitialObjectPositions();
            this.moveTargetId = objectId;
            this.moveTargetType = clickedObject.type;
          }
        }
      }
    } else {
      console.log('SelectTool: Clicked on empty canvas');
      this.startedOnEmptyCanvas = true;

      if (!isMultiSelect) {
        // Clear selection when clicking empty canvas (without multi-select key)
        this.selectionManager.clear();
        // sync with CanvasManager
        if (this.canvasManager) {
          if (typeof this.canvasManager.clearSelection === 'function') {
            this.canvasManager.clearSelection();
          } else if (typeof this.canvasManager.setSelection === 'function') {
            this.canvasManager.setSelection([]);
          }
        }
        // CRITICAL: Request render immediately after selection cleared
        this.canvasManager.requestRender();
      }
    }

    return null;
  }

  saveInitialObjectPositions() {
    const selectedIds = this.selectionManager.getSelectedIds();
    selectedIds.forEach(id => {
      const obj = this.canvasManager.getObjectById(id);
      if (!obj) return;

      const position = captureInitialPosition(obj);
      if (position) {
        this.initialObjectPositions.set(id, position);
      }
    });
  }

  moveSelectedObjects(deltaX, deltaY) {
    const selectedIds = this.selectionManager.getSelectedIds();

    selectedIds.forEach(id => {
      const obj = this.canvasManager.getObjectById(id);
      if (!obj) return;

      const initialPosition = this.initialObjectPositions.get(id);
      if (!initialPosition) return;

      applyMoveFromInitial(obj, initialPosition, deltaX, deltaY);
    });

    this.canvasManager.requestRender();
  }

  onPointerMove(event) {
    if (!this.canvasManager || !this.pointerDownPoint) return;

    const { x, y } = event;

    if (this.isMovingObjects) {
      // Move selected objects
      const deltaX = x - this.pointerDownPoint.x;
      const deltaY = y - this.pointerDownPoint.y;
      this.moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      this.moveSelectedObjects(deltaX, deltaY);
      return;
    }

    if (!this.isDragging) {
      const dx = x - this.pointerDownPoint.x;
      const dy = y - this.pointerDownPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > this.dragThreshold && this.startedOnEmptyCanvas) {
        this.isDragging = true;
        this.selectionManager.startMarquee(this.pointerDownPoint);
        console.log('SelectTool: Started marquee selection');
      }
    }

    if (this.isDragging && this.selectionManager.isMarqueeActive()) {
      this.selectionManager.updateMarquee({ x, y });
      this.canvasManager.requestRender();
    }
  }

  onPointerUp(event) {
    if (!this.canvasManager) return null;

    const { shiftKey, ctrlKey, metaKey } = event;
    const isMultiSelect = shiftKey || ctrlKey || metaKey;

    if (this.isMovingObjects) {
      if (this.moveTargetType === 'text' && this.moveDistance <= this.dragThreshold) {
        // Treat click-without-drag on selected text as edit intent.
        this.moveSelectedObjects(0, 0);
        this.canvasManager.emit('text:edit', {
          objectId: this.moveTargetId,
          point: { x: event.x, y: event.y },
        });
      }
      // TODO: Create a MoveCommand for undo/redo
      console.log('SelectTool: Finished moving objects');
      this.isMovingObjects = false;
      this.initialObjectPositions.clear();
      this.moveDistance = 0;
      this.moveTargetId = null;
      this.moveTargetType = null;
    }

    if (this.isDragging && this.selectionManager.isMarqueeActive()) {
      console.log('SelectTool: Completing marquee selection');

      const marqueeRect = this.selectionManager.getMarqueeRect();

      if (marqueeRect) {
        const objectsInRect = this.canvasManager.getObjectsInRect(marqueeRect);
        // Filter out objects locked by other users — prevents lock bypass via marquee
        const selectedIds = objectsInRect
          .filter(obj => !useCollaborationStore.getState().isLockedByOther(obj.id))
          .map(obj => obj.id);

        console.log(`SelectTool: Marquee found ${selectedIds.length} objects`);

        if (isMultiSelect) {
          selectedIds.forEach(id => {
            this.selectionManager.select(id, true);
          });
          // Sync CanvasManager selection with SelectionManager after additive marquee
          if (this.canvasManager && typeof this.canvasManager.setSelection === 'function') {
            try {
              this.canvasManager.setSelection(this.selectionManager.getSelectedIds());
            } catch { }
          }
        } else {
          this.selectionManager.set(selectedIds);
          // Sync CanvasManager selection for marquee single/multi results
          if (this.canvasManager && typeof this.canvasManager.setSelection === 'function') {
            try {
              this.canvasManager.setSelection(selectedIds);
            } catch { }
          }
        }

        // CRITICAL: Request render after marquee selection
        this.canvasManager.requestRender();
      }

      this.selectionManager.endMarquee();
      this.canvasManager.requestRender();
    }

    this.pointerDownPoint = null;
    this.isDragging = false;
    this.isMovingObjects = false;
    this.startedOnEmptyCanvas = false;
    this.moveDistance = 0;
    this.moveTargetId = null;
    this.moveTargetType = null;

    return null;
  }

  getUIConfig() {
    return {
      name: this.name,
      description: this.description,
      cursor: 'move',
      hasOptions: false,
    };
  }

  supportsShapeInternalText(obj) {
    if (!obj || obj.type !== 'shape') return false;
    return [
      'rectangle',
      'roundedRectangle',
      'circle',
      'ellipse',
      'triangle',
      'diamond',
      'star',
      'hexagon',
      'pentagon',
      'polygon',
    ].includes(obj.shapeType);
  }

  cleanupTempPlaceholder(selectedIds, hitObjects) {
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) return;
    selectedIds.forEach((id) => {
      const obj = this.canvasManager.getObjectById(id);
      if (!obj || obj.type !== 'text') return;
      if (!obj.isTempPlaceholder) return;
      const stillHit = (hitObjects || []).some((h) => h.id === id);
      if (stillHit) return;
      if (obj.text && obj.text.trim() !== '') return;
      const idx = this.canvasManager.state.objects.findIndex((o) => o.id === id);
      if (idx >= 0) {
        this.canvasManager.state.objects.splice(idx, 1);
        this.canvasManager.updateObjectIndex?.();
      }
    });
  }
}

export default SelectTool;
