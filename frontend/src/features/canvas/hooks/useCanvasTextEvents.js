import { useEffect } from "react";

export function useCanvasTextEvents({ isReady, canvasManagerRef }) {
  useEffect(() => {
    if (!isReady || !canvasManagerRef.current) return;
    const canvasManager = canvasManagerRef.current;

    const handleTextEditing = (data) => {
      console.log("Text editing started", data);
    };

    const handleTextFinished = () => {
      console.log("Text editing finished");
    };

    const handleTextEditRequest = ({ objectId, point }) => {
      const obj = canvasManager.getObjectById(objectId);
      if (!obj || obj.type !== 'text') return;

      const toolManager = canvasManager.toolManager;
      if (!toolManager) return;
      const textTool = toolManager.getToolInstance('text');
      if (!textTool) return;

      canvasManager.setActiveTool(textTool);
      try {
        textTool.startEditingExisting(obj, point || null);
      } catch (err) {
        console.warn('Failed to start text edit', err);
      }
    };

    canvasManager.on("text:editing", handleTextEditing);
    canvasManager.on("text:finished", handleTextFinished);
    canvasManager.on("text:edit", handleTextEditRequest);

    return () => {
      canvasManager.off("text:editing", handleTextEditing);
      canvasManager.off("text:finished", handleTextFinished);
      canvasManager.off("text:edit", handleTextEditRequest);
    };
  }, [isReady, canvasManagerRef]);
}
