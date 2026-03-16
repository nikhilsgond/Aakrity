import { useEffect, useState, useCallback } from 'react';

export function useCanvasContextToolbar({
    isReady,
    canvasManagerRef,
}) {
    const [context, setContext] = useState({
        visible: false,
        type: 'none',
        count: 0,
        objects: [],
        commonProps: {},
        position: null
    });

    useEffect(() => {
        if (!isReady || !canvasManagerRef.current) return;
        const canvasManager = canvasManagerRef.current;

        const handleSelectionChanged = () => {

            // Get context from CanvasManager
            const selectionContext = canvasManager.getSelectionContext();

            if (selectionContext.count > 0) {
                setContext({
                    visible: true,
                    ...selectionContext
                });
            } else {
                setContext({
                    visible: false,
                    type: 'none',
                    count: 0,
                    objects: [],
                    commonProps: {},
                    position: null
                });
            }
        };

        // Also update when objects are modified (properties might change)
        const handleObjectUpdated = () => {
            handleSelectionChanged();
        };

        canvasManager.on('selection:changed', handleSelectionChanged);
        canvasManager.on('object:updated', handleObjectUpdated);

        return () => {
            canvasManager.off('selection:changed', handleSelectionChanged);
            canvasManager.off('object:updated', handleObjectUpdated);
        };
    }, [isReady, canvasManagerRef]);

    return context;
}