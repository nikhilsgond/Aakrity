import Toolbar from "@features/canvas/ui/Toolbar";
import ToolOptionsPanel from "@features/canvas/ui/ToolOptionsPanel";
import FloatingToolbarManager from "@features/canvas/ui/FloatingToolbarManager";
import CursorOverlay from "@features/canvas/ui/CursorOverlay";
import TopBar from "@features/room/components/TopBar";
import PropertiesPanel from "@features/room/components/PropertiesPanel";
import ChatWidget from "@features/room/components/ChatWidget";
import ShortcutsModal from "@shared/ui/ShortcutsModal";
import NotificationCenter from "@shared/ui/NotificationCenter";
import CanvasDropOverlay from "@features/canvas/ui/CanvasDropOverlay";
import EraserCursorOverlay from "@features/canvas/ui/EraserCursorOverlay";
import EmojiSwapOverlay from "@features/canvas/ui/EmojiSwapOverlay";
import CanvasScrollbars from "@features/canvas/ui/CanvasScrollbars";
import Minimap from "@features/canvas/ui/Minimap";
import ExportProgressOverlay from "@shared/ui/ExportProgressOverlay";
import { useState, useCallback } from 'react';

export default function RoomLayout({
  canvasManager,
  performUndo,
  performRedo,
  clearCanvas,
  resetViewport,
  handleExport,
  zoomIn,
  zoomOut,
  setZoomPercent,
  canvasState,
  activeToolType,
  handleToolChange,
  isConnected,
  users,
  toolManager,
  userId,
  roomId,
  username,
  containerRef,
  isReady,
  cursors,
  isTextEditing,
  dragDropState,
  executeLocalCommand,
  sendOperation,
  isExporting,
  exportProcessed,
  exportTotal,
  onCancelExport,
}) {
  // Increment each time a toolbar tool button is clicked (even the same one)
  // so ToolOptionsPanel re-mounts and resets its panelVisible = true
  const [panelRevealKey, setPanelRevealKey] = useState(0);
  const handleExportSvg = useCallback(() => {
    handleExport?.('svg');
  }, [handleExport]);
  const handleToolChangeWithReveal = useCallback((toolType) => {
    setPanelRevealKey(k => k + 1);
    handleToolChange(toolType);
  }, [handleToolChange]);
  return (
    <div className="relative w-full h-screen overflow-hidden bg-background select-none">
      <NotificationCenter />

      <TopBar
        onUndo={performUndo}
        onRedo={performRedo}
        onClear={clearCanvas}
        onResetViewport={resetViewport}
        onExport={handleExportSvg}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onSetZoomPercent={setZoomPercent}
        canUndo={canvasState.canUndo}
        canRedo={canvasState.canRedo}
        zoomLevel={canvasState.viewport.zoom}
        activeTool={activeToolType}
        onToolChange={handleToolChange}
        sendOperation={sendOperation}
        collaborationStatus={{
          isConnected,
          userCount: users.size,
        }}
      />

      <Toolbar
        activeTool={activeToolType}
        setActiveTool={handleToolChangeWithReveal}
        toolManager={toolManager}
        canvasManager={canvasManager}
      />

      {isReady && canvasManager && (
        <Minimap canvasManager={canvasManager} canvasState={canvasState} />
      )}

      <PropertiesPanel canvasManager={canvasManager} selectionCount={canvasState.selectionCount} />

      {/* Canvas layer */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }} />
        {isReady && canvasManager && (
          <CanvasScrollbars canvasManager={canvasManager} canvasState={canvasState} />
        )}
        <CanvasDropOverlay dragDropState={dragDropState} />
        {isReady && canvasManager && canvasManager.canvas && (
          <>
            <CursorOverlay canvas={canvasManager.canvas} canvasManager={canvasManager} activeTool={activeToolType} />
            <EraserCursorOverlay
              canvasManager={canvasManager}
              activeTool={activeToolType}
              toolManager={toolManager}
            />
          </>
        )}
      </div>

      {isReady && canvasManager && <FloatingToolbarManager canvasManager={canvasManager} />}

      {isReady && canvasManager && <EmojiSwapOverlay canvasManager={canvasManager} />}

      {/* Connector UI removed */}

      <ShortcutsModal />
      <ExportProgressOverlay
        isExporting={isExporting}
        processed={exportProcessed}
        total={exportTotal}
        onCancel={onCancelExport}
      />

      {/* ToolOptionsPanel below chat so chat always sits on top */}
      {isReady && toolManager && (
        <ToolOptionsPanel
          key={panelRevealKey}
          toolManager={toolManager}
          activeTool={activeToolType}
          onToolChange={handleToolChangeWithReveal}
          canvasManager={canvasManager}
        />
      )}

      {/* Chat rendered last so it is always above the options panel */}
      <ChatWidget roomId={roomId} userId={userId} username={username} />
    </div>
  );
}
