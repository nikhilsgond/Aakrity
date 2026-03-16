import { useEffect } from "react";

export function useRoomTextCollaboration({
  isReady,
  canvasManager,
  sendOperation,
  setIsTextEditing,
}) {
  useEffect(() => {
    if (!isReady || !canvasManager) return;

    const handleTextEditing = (data) => {
      setIsTextEditing(true);
      sendOperation({
        type: "text:editing",
        textId: data.textId,
        position: data.position,
        timestamp: Date.now(),
      });
    };

    const handleTextFinished = (data) => {
      setIsTextEditing(false);
      sendOperation({
        type: "text:finished",
        textId: data?.textId,
        timestamp: Date.now(),
      });
    };

    const handleTextUpdate = (data) => {
      sendOperation({
        type: "text:update",
        textId: data.textId,
        text: data.text,
        fontFamily: data.fontFamily,
        fontSize: data.fontSize,
        textColor: data.textColor,
        textAlign: data.textAlign,
        verticalAlign: data.verticalAlign,
        fontWeight: data.fontWeight,
        fontStyle: data.fontStyle,
        underline: data.underline,
        strikethrough: data.strikethrough,
        backgroundColor: data.backgroundColor,
        listType: data.listType,
        autoWidth: data.autoWidth,
        autoHeight: data.autoHeight,
        formattedRanges: data.formattedRanges || [],
        width: data.width,
        height: data.height,
        isCommit: data.isCommit || false,
        timestamp: Date.now(),
      });
    };

    canvasManager.on("text:editing", handleTextEditing);
    canvasManager.on("text:finished", handleTextFinished);
    canvasManager.on("text:update", handleTextUpdate);

    return () => {
      canvasManager.off("text:editing", handleTextEditing);
      canvasManager.off("text:finished", handleTextFinished);
      canvasManager.off("text:update", handleTextUpdate);
    };
  }, [canvasManager, isReady, sendOperation, setIsTextEditing]);
}
