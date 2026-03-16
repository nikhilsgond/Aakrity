// src/features/room/page/RoomPage.jsx
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useCanvas } from '@features/canvas/hooks/useCanvas';
import { useUIStore } from '@app/state/uiStore';
import { useCollaboration } from '@features/canvas/hooks/useCollaboration';
import useCollaborationStore from '@features/room/state/collaborationStore';
import RoomLayout from '@features/room/components/RoomLayout';
import { useRoomIdentity } from '@features/room/hooks/useRoomIdentity';
import { useRoomKeyboardShortcuts } from '@features/room/hooks/useRoomKeyboardShortcuts';
import { useRoomOperationBroadcast } from '@features/room/hooks/useRoomOperationBroadcast';
import { useRoomRemoteOperations } from '@features/room/hooks/useRoomRemoteOperations';
import { useRoomTextCollaboration } from '@features/room/hooks/useRoomTextCollaboration';
import { useRoomSelectionSync } from '@features/room/hooks/useRoomSelectionSync';
import { useRoomObjectLocking } from '@features/room/hooks/useRoomObjectLocking';
import { createRoomSnapshot, loadRoomSnapshot } from '@features/room/lib/roomSnapshot';
import { useAuth } from '@features/auth/context/AuthProvider';
import { apiRequest } from '@shared/lib/apiClient';
import { validateRoomId } from '@shared/lib/inputValidation';
import { exportCanvasSnapshotToSvg } from '@shared/lib/svgExport';
import { TOOL_TYPES } from '@shared/constants';
import socketService from '@features/room/services/socketService';

function buildBootstrapSnapshot(payload) {
  const flatObjects = (payload.objectChunks || []).flat().filter(Boolean);
  const persistedSnapshot = payload.latestSnapshot?.snapshot || null;

  if (persistedSnapshot) {
    return {
      ...persistedSnapshot,
      boardTitle: persistedSnapshot.boardTitle || payload.room?.name || 'Untitled Board',
      state: {
        viewport: { zoom: 1, panX: 0, panY: 0, ...(persistedSnapshot.state?.viewport || {}) },
        gridStyle: persistedSnapshot.state?.gridStyle || 'lines',
        darkMode: !!persistedSnapshot.state?.darkMode,
        ...(persistedSnapshot.state || {}),
        objects: flatObjects,
      },
    };
  }

  return {
    version: 1,
    boardTitle: payload.room?.name || 'Untitled Board',
    state: {
      objects: flatObjects,
      viewport: { zoom: 1, panX: 0, panY: 0 },
      gridStyle: 'lines',
      darkMode: false,
    },
    savedAt: new Date().toISOString(),
  };
}

export default function Room() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { session, isLoading: authLoading } = useAuth();
  const isValidRoomId = !validateRoomId(roomId);
  const activeRoomId = isValidRoomId ? roomId : null;

  const containerRef = useRef(null);
  const isRemoteOperationRef = useRef(false);
  const modifyDebounceRef = useRef(new Map());
  const modifyPendingRef = useRef({});
  const saveTimeoutRef = useRef(null);
  const hasBootstrappedRef = useRef(false);
  const bootstrapRequestIdRef = useRef(0);
  const disconnectToastIdRef = useRef(null);

  const { userId, username, userColor } = useRoomIdentity();
  const [activeToolType, setActiveToolType] = useState(TOOL_TYPES.SELECT);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const {
    users,
    cursors,
    initialize: initCollaboration,
    hydrateRoom,
    disconnect: disconnectCollaboration,
    isConnected,
  } = useCollaborationStore();

  const {
    isReady,
    canvasState,
    undo,
    redo,
    clearCanvas,
    resetViewport,
    getCanvasManager,
    getToolManagerRef,
    zoomIn,
    zoomOut,
    setZoomPercent,
    exportCanvas,
    onCanvasEvent,
    dragDropState,
    selectionManager,
    executeLocalCommand: canvasExecuteLocalCommand,
    updateCanvasState,
  } = useCanvas(containerRef, activeToolType);

  const toolManager = useMemo(() => {
    if (!isReady) return null;
    return getToolManagerRef?.() || null;
  }, [isReady, getToolManagerRef]);

  const canvasManager = useMemo(() => {
    if (!isReady) return null;
    return getCanvasManager?.() || null;
  }, [isReady, getCanvasManager]);

  // FIXED: Correct variable name - no typo!
  const { trackOperation: sendOperation } = useCollaboration(
    canvasManager,
    activeRoomId,
    userId,
    {
      username,
      userColor,
      enableCursorTracking: true,
      enableSelectionTracking: true,
      enableDrawingBatching: true,
      enableDeltaCompression: true,
    }
  );

  // Connect pencil tool to collaboration
  useEffect(() => {
    if (!toolManager || typeof toolManager.getToolInstance !== 'function' || !sendOperation) return;

    const pencilTool = toolManager.getToolInstance('pencil');
    if (pencilTool && typeof pencilTool.setCollaborationHook === 'function') {
      pencilTool.setCollaborationHook({ trackOperation: sendOperation });
    }

    const shapeTool = toolManager.getToolInstance('shape');
    if (shapeTool && typeof shapeTool.setCollaborationHook === 'function') {
      shapeTool.setCollaborationHook({ trackOperation: sendOperation });
    }
  }, [toolManager, sendOperation]);

  useEffect(() => {
    if (authLoading || isValidRoomId || !roomId) {
      return;
    }

    navigate('/404', { replace: true });
  }, [authLoading, isValidRoomId, navigate, roomId]);

  const performUndo = useCallback(() => {
    undo();
    if (sendOperation) {
      sendOperation({ type: 'undo', timestamp: Date.now() });
    }
  }, [undo, sendOperation]);

  // FIXED: Added guard checks before sending operations
  const performRedo = useCallback(() => {
    redo();
    if (sendOperation) {
      sendOperation({ type: 'redo', timestamp: Date.now() });
    }
  }, [redo, sendOperation]);

  useEffect(() => {
    if (!canvasManager) return;
    if (activeToolType !== TOOL_TYPES.SELECT && activeToolType !== TOOL_TYPES.TEXT) {
      if (selectionManager?.clear) {
        selectionManager.clear();
      }
      if (typeof canvasManager.clearSelection === 'function') canvasManager.clearSelection();
      try {
        if (typeof canvasManager.setSelection === 'function') canvasManager.setSelection([]);
      } catch (_error) {
        // noop
      }
    }
  }, [activeToolType, canvasManager, selectionManager]);

  const { initTheme, theme, gridMode, toggleGridMode } = useUIStore();
  const pushNotification = useUIStore((state) => state.pushNotification);

  const [exportState, setExportState] = useState({
    isExporting: false,
    processed: 0,
    total: 0,
  });
  const cancelExportRef = useRef(false);

  useEffect(() => {
    if (!exportState.isExporting) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = 'Export in progress. Leaving will cancel download.';
      return event.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [exportState.isExporting]);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    const handleRoomError = (payload) => {
      const message = payload?.message || 'Unable to join this room.';
      if (/rejoin|not currently inside|password verification required/i.test(message)) {
        toast.error(message);
        navigate('/403', {
          replace: true,
          state: { message },
        });
        return;
      }

      toast.error(message);
    };

    const handleRoomDeleted = (payload) => {
      if (payload?.roomId && payload.roomId !== activeRoomId) {
        return;
      }

      toast.error('This room was deleted by the owner.');
      navigate('/dashboard', { replace: true });
    };

    const handleChatError = (payload) => {
      toast.error(payload?.message || 'Failed to send chat message.');
    };

    const handleDisconnected = () => {
      if (!disconnectToastIdRef.current) {
        disconnectToastIdRef.current = toast.info('Connection lost. Trying to reconnect...', {
          autoClose: false,
        });
      }
    };

    const handleReconnected = () => {
      if (disconnectToastIdRef.current) {
        toast.dismiss(disconnectToastIdRef.current);
        disconnectToastIdRef.current = null;
      }
      toast.success('Connection restored.');
    };

    const handleConnected = () => {
      if (disconnectToastIdRef.current) {
        toast.dismiss(disconnectToastIdRef.current);
        disconnectToastIdRef.current = null;
      }
    };

    socketService.on('room-error', handleRoomError);
    socketService.on('room-deleted', handleRoomDeleted);
    socketService.on('chat-error', handleChatError);
    socketService.on('disconnected', handleDisconnected);
    socketService.on('reconnected', handleReconnected);
    socketService.on('connected', handleConnected);

    return () => {
      socketService.off('room-error', handleRoomError);
      socketService.off('room-deleted', handleRoomDeleted);
      socketService.off('chat-error', handleChatError);
      socketService.off('disconnected', handleDisconnected);
      socketService.off('reconnected', handleReconnected);
      socketService.off('connected', handleConnected);
      if (disconnectToastIdRef.current) {
        toast.dismiss(disconnectToastIdRef.current);
        disconnectToastIdRef.current = null;
      }
    };
  }, [activeRoomId, navigate]);

  useEffect(() => {
    if (authLoading || !isReady || !canvasManager || !activeRoomId || !session?.access_token || !userId) {
      return;
    }

    let cancelled = false;
    const requestId = bootstrapRequestIdRef.current + 1;
    bootstrapRequestIdRef.current = requestId;

    const bootstrapRoom = async () => {
      setIsBootstrapping(true);

      try {
        const payload = await apiRequest(`/api/rooms/${activeRoomId}/bootstrap`, {
          token: session.access_token,
        });

        if (cancelled || bootstrapRequestIdRef.current !== requestId) {
          return;
        }

        const snapshot = buildBootstrapSnapshot(payload);
        loadRoomSnapshot(canvasManager, snapshot);

        hydrateRoom({
          roomId: activeRoomId,
          title: snapshot.boardTitle || payload.room?.name,
          chatMessages: payload.chatMessages,
          users: payload.users,
        });

        updateCanvasState();
        
        // FIXED: Added guard for collaboration initialization
        if (activeRoomId && userId && session?.access_token) {
          initCollaboration(activeRoomId, userId, username, userColor, session.access_token);
        }
        
        hasBootstrappedRef.current = true;
      } catch (error) {
        console.error('Failed to bootstrap room:', error);

        if (error.status === 401) {
          toast.error('Session expired. Sign in again.');
          navigate('/login', {
            replace: true,
            state: { from: { pathname: `/room/${activeRoomId}` } },
          });
          return;
        }

        if (error.status === 403) {
          navigate('/403', {
            replace: true,
            state: { message: error.message || 'You are not currently allowed in this room.' },
          });
          return;
        }

        toast.error(error.message || 'Failed to load the room.');
        navigate('/dashboard', { replace: true });
      } finally {
        if (!cancelled && bootstrapRequestIdRef.current === requestId) {
          setIsBootstrapping(false);
        }
      }
    };

    bootstrapRoom();

    return () => {
      cancelled = true;
      hasBootstrappedRef.current = false;
      disconnectCollaboration();
    };
  }, [
    authLoading,
    canvasManager,
    disconnectCollaboration,
    hydrateRoom,
    initCollaboration,
    isReady,
    navigate,
    activeRoomId,
    session?.access_token,
    updateCanvasState,
    userColor,
    userId,
    username,
  ]);

  useEffect(() => {
    if (!canvasManager || !activeRoomId || !session?.access_token) {
      return;
    }

    const scheduleSnapshotSave = () => {
      // FIXED: Added extra guard for canvasManager
      if (!hasBootstrappedRef.current || isRemoteOperationRef.current || !canvasManager) {
        return;
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        const snapshot = createRoomSnapshot(canvasManager);
        if (!snapshot) {
          return;
        }

        try {
          await apiRequest(`/api/rooms/${activeRoomId}/snapshot`, {
            method: 'PUT',
            token: session.access_token,
            body: { snapshot },
          });
        } catch (error) {
          console.error('Failed to save room snapshot:', error);
          if (error.status === 403) {
            toast.error(error.message || 'Your room membership expired. Rejoin with the password.');
            navigate('/403', {
              replace: true,
              state: { message: error.message || 'Your room membership expired. Rejoin with the password.' },
            });
          }
        }
      }, 1500);
    };

    const unsubscribers = [
      onCanvasEvent('state:changed', ({ type }) => {
        if (type === 'local') {
          scheduleSnapshotSave();
        }
      }),
      onCanvasEvent('text:update', scheduleSnapshotSave),
      onCanvasEvent('text:finished', scheduleSnapshotSave),
      onCanvasEvent('object:reordered', scheduleSnapshotSave),
    ];

    let previousTitle = useUIStore.getState().boardTitle;
    const unsubscribeTitle = useUIStore.subscribe((state) => {
      if (state.boardTitle === previousTitle) {
        return;
      }
      previousTitle = state.boardTitle;
      if (!isRemoteOperationRef.current) {
        scheduleSnapshotSave();
      }
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      unsubscribeTitle();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [activeRoomId, canvasManager, navigate, onCanvasEvent, session?.access_token]);

  useRoomOperationBroadcast({
    isReady,
    canvasManager,
    sendOperation,
    isRemoteOperationRef,
    modifyDebounceRef,
    modifyPendingRef,
    setActiveToolType,
  });

  useRoomRemoteOperations({
    canvasManager,
    userId,
    isRemoteOperationRef,
  });

  useRoomTextCollaboration({
    isReady,
    canvasManager,
    sendOperation,
    setIsTextEditing,
  });

  useRoomSelectionSync({
    isReady,
    onCanvasEvent,
    isRemoteOperationRef,
    userId,
    canvasManager,
    sendOperation,
    setActiveToolType,
  });

  useRoomObjectLocking({
    canvasManager,
    isReady,
  });

  // FIXED: Added guard for title updates
  useEffect(() => {
    let previousTitle = useUIStore.getState().boardTitle;
    const unsubscribe = useUIStore.subscribe((state) => {
      const title = state.boardTitle;
      if (isRemoteOperationRef.current || title === previousTitle) return;
      previousTitle = title;
      if (sendOperation) {
        sendOperation({ type: 'title:update', title, timestamp: Date.now() });
      }
    });
    return () => unsubscribe();
  }, [sendOperation]);

  useEffect(() => {
    if (!isReady || !canvasManager) return;
    canvasManager.setDarkMode(theme === 'dark');
  }, [theme, isReady, canvasManager]);

  useEffect(() => {
    if (!isReady || !canvasManager) return;
    if (typeof canvasManager.setGridMode === 'function') {
      canvasManager.setGridMode(gridMode);
    }
  }, [isReady, gridMode, canvasManager]);

  const handleFinishTextEditing = useCallback(() => {
    if (!canvasManager) return;
    const activeTool = canvasManager.getActiveTool();
    if (activeTool?.name === 'text') {
      activeTool.finishEditing();
    }
  }, [canvasManager]);

  useRoomKeyboardShortcuts({
    isTextEditing,
    performUndo,
    performRedo,
    setActiveToolType,
    canvasManager,
    toggleGridMode,
    zoomIn,
    zoomOut,
    resetViewport,
    handleFinishTextEditing,
  });

  const handleExport = useCallback(async (format) => {
    if (!isReady) {
      return;
    }

    if (format === 'svg') {
      if (!canvasManager) {
        return;
      }

      const rawObjects = canvasManager.getObjects();
      const total = rawObjects.length;

      if (total > 2000) {
        const proceed = window.confirm(`This export has ${total} objects and may take a while. Continue?`);
        if (!proceed) return;
      }

      cancelExportRef.current = false;
      setExportState({ isExporting: true, processed: 0, total });

      const snapshot = {
        objects: rawObjects.map((obj) => JSON.parse(JSON.stringify(obj))),
      };

      try {
        const svg = await exportCanvasSnapshotToSvg({
          snapshot,
          batchSize: 75,
          shouldCancel: () => cancelExportRef.current,
          onProgress: (processed, totalCount) => {
            setExportState({ isExporting: true, processed, total: totalCount });
          },
        });

        if (!svg) {
          pushNotification({
            type: 'info',
            title: 'Export cancelled',
            message: 'SVG export was cancelled.',
          });
          return;
        }

        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'canvas.svg';
        link.click();
        URL.revokeObjectURL(url);
      } finally {
        setExportState({ isExporting: false, processed: 0, total: 0 });
      }
      return;
    }

    const data = exportCanvas(format);
    if (!data) {
      return;
    }

    switch (format) {
      case 'png':
      case 'jpeg': {
        const link = document.createElement('a');
        link.href = data;
        link.download = `canvas-export.${format}`;
        link.click();
        break;
      }

      case 'json': {
        const blob = new Blob([data], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'canvas-export.json';
        link.click();
        break;
      }

      default:
        break;
    }
  }, [canvasManager, exportCanvas, isReady, pushNotification]);

  const handleCancelExport = useCallback(() => {
    cancelExportRef.current = true;
  }, []);

  // FIXED: Added guard for tool change
  const handleToolChange = useCallback((toolType) => {
    setActiveToolType(toolType);
    if (sendOperation) {
      sendOperation({
        type: 'tool:change',
        tool: toolType,
        userId,
      });
    }
  }, [sendOperation, userId]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Loading room...</div>
      </div>
    );
  }

  if (!isValidRoomId) {
    return null;
  }

  return (
    <>
      <RoomLayout
        canvasManager={canvasManager}
        performUndo={performUndo}
        performRedo={performRedo}
        clearCanvas={clearCanvas}
        resetViewport={resetViewport}
        handleExport={handleExport}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        setZoomPercent={setZoomPercent}
        canvasState={canvasState}
        activeToolType={activeToolType}
        handleToolChange={handleToolChange}
        isConnected={isConnected}
        users={users}
        toolManager={toolManager}
        userId={userId}
        roomId={activeRoomId}
        username={username}
        containerRef={containerRef}
        isReady={isReady}
        cursors={cursors}
        isTextEditing={isTextEditing}
        dragDropState={dragDropState}
        executeLocalCommand={canvasExecuteLocalCommand}
        sendOperation={sendOperation}
        isExporting={exportState.isExporting}
        exportProcessed={exportState.processed}
        exportTotal={exportState.total}
        onCancelExport={handleCancelExport}
      />
      {isBootstrapping && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/85 text-foreground backdrop-blur-sm">
          <div className="text-sm text-muted-foreground">Loading room...</div>
        </div>
      )}
    </>
  );
}