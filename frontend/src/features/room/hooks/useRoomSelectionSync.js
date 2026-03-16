import { useEffect } from "react";
import useCollaborationStore from "@features/room/state/collaborationStore";
import { TOOL_TYPES } from "@shared/constants";

export function useRoomSelectionSync({
  isReady,
  onCanvasEvent,
  isRemoteOperationRef,
  userId,
  canvasManager,
  sendOperation,
  setActiveToolType,
}) {
  useEffect(() => {
    if (!isReady) return;

    const unsubSelection = onCanvasEvent("selection:changed", ({ selectedIds }) => {
      if (isRemoteOperationRef.current) return;

      const remoteSelections = useCollaborationStore.getState().remoteSelections;
      const selectionMap = remoteSelections instanceof Map ? remoteSelections : new Map();

      const filtered = (selectedIds || []).filter((id) => {
        for (const [uid, ids] of selectionMap) {
          if (uid !== userId && Array.isArray(ids) && ids.includes(id)) {
            return false;
          }
        }
        return true;
      });

      if (filtered.length !== (selectedIds || []).length && canvasManager) {
        canvasManager.setSelection(filtered);
      }

      sendOperation({
        type: "selection:update",
        selectedIds: filtered,
        timestamp: Date.now(),
      });
    });

    return () => {
      if (typeof unsubSelection === "function") unsubSelection();
    };
  }, [isReady, onCanvasEvent, isRemoteOperationRef, userId, canvasManager, sendOperation]);

  useEffect(() => {
    const unSub = useCollaborationStore.subscribe(
      (state) => state.isConnected,
      () => {
        setActiveToolType(TOOL_TYPES.SELECT);
      }
    );
    return () => unSub();
  }, [setActiveToolType]);
}
