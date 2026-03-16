import { useEffect } from "react";

export function useCanvasImageToolbar({
  isReady,
  canvasManagerRef,
  imageToolbarVisible,
  setImageToolbar,
  updateCanvasState,
}) {
  useEffect(() => {
    if (!isReady || !canvasManagerRef.current) return;

    const handleImageCreated = (data) => {
      const obj = canvasManagerRef.current.getObjectById(data.imageId);
      if (!obj) return;
      setImageToolbar({
        visible: true,
        imageId: data.imageId,
        imageObject: obj,
        position: { x: obj.x + obj.width / 2, y: obj.y - 20 },
      });
    };

    const handleSelectionChanged = (data) => {
      if (imageToolbarVisible && data.selectedIds.length === 0) {
        setImageToolbar((prev) => ({ ...prev, visible: false }));
      }

      if (data.selectedIds.length === 1) {
        const obj = canvasManagerRef.current.getObjectById(data.selectedIds[0]);
        if (obj && obj.type === "image") {
          setImageToolbar({
            visible: true,
            imageId: data.selectedIds[0],
            imageObject: obj,
            position: { x: obj.x + obj.width / 2, y: obj.y - 20 },
          });
        } else if (imageToolbarVisible) {
          setImageToolbar((prev) => ({ ...prev, visible: false }));
        }
      } else if (imageToolbarVisible) {
        setImageToolbar((prev) => ({ ...prev, visible: false }));
      }

      updateCanvasState();
    };

    canvasManagerRef.current.on("image:created", handleImageCreated);
    canvasManagerRef.current.on("selection:changed", handleSelectionChanged);

    return () => {
      if (canvasManagerRef.current) {
        canvasManagerRef.current.off("image:created", handleImageCreated);
        canvasManagerRef.current.off("selection:changed", handleSelectionChanged);
      }
    };
  }, [isReady, canvasManagerRef, imageToolbarVisible, setImageToolbar, updateCanvasState]);
}
