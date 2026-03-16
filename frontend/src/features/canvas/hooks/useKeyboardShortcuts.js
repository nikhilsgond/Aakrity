// src/canvas/hooks/useKeyboardShortcuts.js - FIXED WITH EXISTING COMMANDS
import { useEffect, useRef } from 'react';
import { ClearSelectionCommand } from '../engine/commands/SelectionCommands';
import useCollaborationStore from '@features/room/state/collaborationStore';

export const useKeyboardShortcuts = (canvasManager) => {
  const canvasManagerRef = useRef(canvasManager);
  const previousToolRef = useRef(null);
  
  canvasManagerRef.current = canvasManager;

  useEffect(() => {
    if (!canvasManager) {
      console.warn('useKeyboardShortcuts: No canvasManager provided');
      return;
    }

    const handleKeyDown = (event) => {
      // Ignore key events when user is typing
      const tagName = event.target.tagName;
      const isContentEditable = event.target.isContentEditable;
      const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA' || isContentEditable;
      
      if (isInput) return;

      const isModifierKey = event.ctrlKey || event.metaKey;
      const currentManager = canvasManagerRef.current;

      if (!currentManager) return;

      const key = event.key.toLowerCase();
      const code = event.code;

      // UNDO: Ctrl+Z
      if (isModifierKey && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        currentManager.undo();
        return;
      }
      
      // REDO: Ctrl+Y or Ctrl+Shift+Z
      if ((isModifierKey && key === 'y') || 
          (isModifierKey && event.shiftKey && key === 'z')) {
        event.preventDefault();
        currentManager.redo();
        return;
      }
      
      // DELETE: Delete or Backspace
      if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        
        const selectedIds = currentManager.getSelection();
        if (selectedIds && selectedIds.length > 0) {
          // Remove all selected objects
          selectedIds.forEach(id => {
            const idx = currentManager.state.objects.findIndex(o => o.id === id);
            if (idx >= 0) {
              currentManager.state.objects.splice(idx, 1);
            }
          });
          currentManager.updateObjectIndex?.();
          currentManager.clearSelection?.();
          currentManager.requestRender();
          // Emit removal events so remote users see the delete
          selectedIds.forEach(id => {
            currentManager.emit('object:removed', { target: { id } });
          });
        }
        return;
      }
      
      // ESCAPE: Clear selection (using existing command)
      if (key === 'escape') {
        event.preventDefault();
        
        const clearCommand = new ClearSelectionCommand();
        currentManager.executeLocalCommand(clearCommand);
        return;
      }
      
      // SELECT ALL: Ctrl+A
      if (isModifierKey && key === 'a') {
        event.preventDefault();
        
        const { isLockedByOther } = useCollaborationStore.getState();
        const allIds = (currentManager.state?.objects || [])
          .filter(o => !isLockedByOther(o.id))
          .map(o => o.id);
        if (allIds.length > 0) {
          currentManager.setSelection(allIds);
          currentManager.requestRender();
        }
        return;
      }
      

      // COPY/PASTE/CUT: Placeholders
      if (isModifierKey && (key === 'c' || key === 'v' || key === 'x')) {
        event.preventDefault();
        console.log(`${key.toUpperCase()} - to be implemented`);
        return;
      }
    };

    const handleKeyUp = (event) => {
      // no longer handling spacebar
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [canvasManager]);
};

export default useKeyboardShortcuts;