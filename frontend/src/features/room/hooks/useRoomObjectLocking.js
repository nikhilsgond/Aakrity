import { useEffect, useRef } from 'react';
import useCollaborationStore from '@features/room/state/collaborationStore';

// Connector attachments removed — connectors no longer exist in state

/**
 * Manages Miro-style object locking.
 * - Locks objects when selected, being moved, transformed, or text-edited
 * - Also locks connectors attached to selected/locked objects
 * - Unlocks on deselection or edit finish
 * - Prevents interaction with objects locked by other users
 */
export function useRoomObjectLocking({ canvasManager, isReady }) {
  const lockedIdsRef = useRef(new Set());

  useEffect(() => {
    if (!isReady || !canvasManager) return;

    const lockObjects = (objectIds) => {
      if (!objectIds || objectIds.length === 0) return;
      const newIds = objectIds.filter(id => !lockedIdsRef.current.has(id));
      if (newIds.length === 0) return;
      newIds.forEach(id => lockedIdsRef.current.add(id));
      useCollaborationStore.getState().lockObjects(newIds);
    };

    const unlockObjects = (objectIds) => {
      if (!objectIds || objectIds.length === 0) return;
      const toUnlock = objectIds.filter(id => lockedIdsRef.current.has(id));
      if (toUnlock.length === 0) return;
      toUnlock.forEach(id => lockedIdsRef.current.delete(id));
      useCollaborationStore.getState().unlockObjects(toUnlock);
    };

    const unlockAll = () => {
      const ids = [...lockedIdsRef.current];
      if (ids.length === 0) return;
      lockedIdsRef.current.clear();
      useCollaborationStore.getState().unlockObjects(ids);
    };

    // Lock on selection
    const handleSelectionChanged = (e) => {
      const selectedIds = e.selectedIds || [];
      const allIdsToLock = [...selectedIds];

      // Unlock any previously locked objects that are no longer selected
      const lockSet = new Set(allIdsToLock);
      const toUnlock = [...lockedIdsRef.current].filter(id => !lockSet.has(id));
      if (toUnlock.length > 0) unlockObjects(toUnlock);

      // Lock newly selected objects
      if (allIdsToLock.length > 0) lockObjects(allIdsToLock);
    };

    // Lock on text editing
    const handleTextEdit = (e) => {
      if (e.textId) {
        lockObjects([e.textId]);
      }
    };

    // Unlock on text finish
    const handleTextFinished = (e) => {
      if (e.textId) {
        unlockObjects([e.textId]);
      }
    };

    canvasManager.on('selection:changed', handleSelectionChanged);
    canvasManager.on('text:editing', handleTextEdit);
    canvasManager.on('text:finished', handleTextFinished);

    return () => {
      canvasManager.off('selection:changed', handleSelectionChanged);
      canvasManager.off('text:editing', handleTextEdit);
      canvasManager.off('text:finished', handleTextFinished);
      // Unlock everything when unmounting
      unlockAll();
    };
  }, [canvasManager, isReady]);
}
