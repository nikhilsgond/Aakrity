import useCollaborationStore from '@features/room/state/collaborationStore';

const STYLES = {
  marquee: {
    stroke: '#0077ff',
    fill: 'rgba(74, 144, 226, 0.1)',
    lineWidth: 1
  },
  selection: {
    stroke: '#0077ff75',
    padding: 0,
    lineWidth: 3
  },
  // NEW: Line/Arrow selection styles
  lineSelection: {
    stroke: '#0077ff75',
    lineWidth: 3,
    dashPattern: []
  }
};

export class SelectionOverlayRenderer {
  constructor(selectionManager, canvasManager) {
    this.selectionManager = selectionManager;
    this.canvasManager = canvasManager;
  }

  render(ctx) {
    const activeTool = this.canvasManager.getActiveTool();
    const toolName = activeTool?.name;

    if (this.selectionManager.isMarqueeActive()) {
      this.renderMarquee(ctx);
    }

    if ((toolName === 'select' || toolName === 'text' || toolName === 'sticky') && this.selectionManager.hasSelection()) {
      this.renderSelectionBounds(ctx);
    }

    // draw remote users' selections after local selection
    this.renderRemoteSelections(ctx);
  }

  renderMarquee(ctx) {
    const marqueeRect = this.selectionManager.getMarqueeRect();
    if (!marqueeRect) return;

    const zoom = this.canvasManager.state.viewport?.zoom || 1;
    const { x, y, width, height } = marqueeRect;
    ctx.strokeStyle = STYLES.marquee.stroke;
    ctx.fillStyle = STYLES.marquee.fill;
    ctx.lineWidth = STYLES.marquee.lineWidth / zoom;

    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);
  }

  renderSelectionBounds(ctx) {
    const selectedIds = this.selectionManager.getSelectedIds();
    if (selectedIds.length === 0) return;

    const zoom = this.canvasManager.state.viewport?.zoom || 1;
    ctx.strokeStyle = STYLES.selection.stroke;
    ctx.lineWidth = STYLES.selection.lineWidth / zoom;

    if (selectedIds.length === 1) {
      this.renderSingleSelection(ctx, selectedIds[0]);
    } else {
      this.renderMultiSelection(ctx, selectedIds);
    }

    ctx.setLineDash([]);
  }

  renderSingleSelection(ctx, objectId) {
    const obj = this.canvasManager.getObjectById(objectId);
    if (!obj) return;

    // Special rendering for lines and arrows
    const effectiveType = obj.type === 'shape' ? obj.shapeType : obj.type;
    if (effectiveType === 'line' || effectiveType === 'arrow') {
      this.renderLineArrowSelection(ctx, obj);
      return;
    }

    // Account for stroke width in visual bounds
    const strokeExpand = (obj.strokeWidth || 0) / 2;

    // Try to get OBB first, fall back to AABB
    const obb = this.canvasManager.getObjectOBB?.(obj);

    if (obb && obb.corners && obb.corners.length >= 4) {
      // Expand OBB corners outward by strokeWidth/2
      if (strokeExpand > 0) {
        const cx = obb.center.x;
        const cy = obb.center.y;
        const expandedCorners = obb.corners.map(corner => {
          const dx = corner.x - cx;
          const dy = corner.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const scale = (dist + strokeExpand) / dist;
            return { x: cx + dx * scale, y: cy + dy * scale };
          }
          return { ...corner };
        });
        this.drawOBB(ctx, expandedCorners);
      } else {
        this.drawOBB(ctx, obb.corners);
      }
    } else {
      // Fallback to AABB
      const bounds = this.canvasManager.getObjectBounds(obj);
      if (!bounds) return;

      const padding = STYLES.selection.padding;
      ctx.strokeRect(
        bounds.x - padding - strokeExpand,
        bounds.y - padding - strokeExpand,
        bounds.width + (padding + strokeExpand) * 2,
        bounds.height + (padding + strokeExpand) * 2
      );
    }
  }

  // Render selection directly on the line/arrow path
  renderLineArrowSelection(ctx, obj) {
    if (obj.x1 == null || obj.y1 == null || obj.x2 == null || obj.y2 == null) return;

    const zoom = this.canvasManager.state.viewport?.zoom || 1;
    ctx.save();

    // Draw selection highlight along the line path
    ctx.strokeStyle = STYLES.lineSelection.stroke;
    ctx.lineWidth = STYLES.lineSelection.lineWidth / zoom;
    ctx.setLineDash(STYLES.lineSelection.dashPattern);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(obj.x1, obj.y1);
    ctx.lineTo(obj.x2, obj.y2);
    ctx.stroke();

    // If it's an arrow, also highlight the arrow head
    const effectiveType = obj.type === 'shape' ? obj.shapeType : obj.type;
    if (effectiveType === 'arrow') {
      const arrowSize = obj.arrowSize || 10;
      const angle = Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1);
      const arrowAngle = Math.PI / 6; // 30 degrees

      ctx.setLineDash([]); // Solid line for arrow head
      ctx.beginPath();
      ctx.moveTo(obj.x2, obj.y2);
      ctx.lineTo(
        obj.x2 - arrowSize * Math.cos(angle - arrowAngle),
        obj.y2 - arrowSize * Math.sin(angle - arrowAngle)
      );
      ctx.moveTo(obj.x2, obj.y2);
      ctx.lineTo(
        obj.x2 - arrowSize * Math.cos(angle + arrowAngle),
        obj.y2 - arrowSize * Math.sin(angle + arrowAngle)
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  renderMultiSelection(ctx, objectIds) {
    if (objectIds.length === 1) {
      this.renderSingleSelection(ctx, objectIds[0]);
      return;
    }

    // For multiple selections, check if all have rotation
    const allHaveOBB = objectIds.every(id => {
      const obj = this.canvasManager.getObjectById(id);
      if (!obj) return false;

      // Check if object is rotatable (rectangle, text)
      if (obj.type !== 'rectangle' && obj.type !== 'text') return false;

      // Check if actually rotated
      return obj.rotation && Math.abs(obj.rotation) > 0.001;
    });

    if (allHaveOBB) {
      // If all are rotated rectangles/text, draw combined OBB
      const combinedOBB = this.canvasManager.getMultipleObjectOBB?.(objectIds);
      if (combinedOBB && combinedOBB.corners) {
        // Draw bounding box around all OBB corners
        this.drawOBB(ctx, combinedOBB.corners);
        return;
      }
    }

    // Default: draw AABB for mixed or non-rotated selections
    const combinedBounds = this.canvasManager.getMultipleObjectBounds(objectIds);
    if (!combinedBounds) return;

    const padding = STYLES.selection.padding;
    ctx.strokeRect(
      combinedBounds.x - padding,
      combinedBounds.y - padding,
      combinedBounds.width + padding * 2,
      combinedBounds.height + padding * 2
    );
  }

  // Helper method to draw OBB from corners
  drawOBB(ctx, corners) {
    if (!corners || corners.length < 4) return;

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);

    for (let i = 1; i <= 4; i++) {
      const corner = corners[i % 4];
      ctx.lineTo(corner.x, corner.y);
    }

    ctx.closePath();
    ctx.stroke();
  }

  renderRemoteSelections(ctx) {
    const { remoteSelections, users, objectLocks, currentUser } = useCollaborationStore.getState();

    // Render remote user selections
    if (remoteSelections && remoteSelections.size > 0) {
      ctx.save();
      remoteSelections.forEach((ids, userId) => {
        if (!ids || ids.length === 0) return;
        const user = users.get(userId);
        const color = (user && user.color) || '#FF0000';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        ids.forEach(id => {
          const obj = this.canvasManager.getObjectById(id);
          if (!obj) return;
          const bounds = this.canvasManager.getObjectBounds(obj);
          if (bounds) {
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
          }
        });
      });
      ctx.restore();
    }

    // Render lock indicators for objects locked by OTHER users
    if (objectLocks && objectLocks.size > 0 && currentUser) {
      ctx.save();
      const zoom = this.canvasManager.state.viewport.zoom;
      objectLocks.forEach((lockInfo, objectId) => {
        if (lockInfo.userId === currentUser.id) return; // Skip own locks
        const obj = this.canvasManager.getObjectById(objectId);
        if (!obj) return;
        const bounds = this.canvasManager.getObjectBounds(obj);
        if (!bounds) return;

        const user = users.get(lockInfo.userId);
        const color = (user && user.color) || '#FF4444';

        // Draw a subtle lock border
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / zoom;
        ctx.globalAlpha = 0.4;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

        // Draw lock icon badge at top-right corner
        const iconSize = 14 / zoom;
        const iconX = bounds.x + bounds.width - iconSize / 2;
        const iconY = bounds.y - iconSize / 2;

        ctx.globalAlpha = 0.85;
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw lock symbol (simplified)
        ctx.fillStyle = '#ffffff';
        const lw = iconSize * 0.3;
        const lh = iconSize * 0.25;
        ctx.fillRect(iconX - lw / 2, iconY - lh / 4, lw, lh);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath();
        ctx.arc(iconX, iconY - lh / 4, lw * 0.35, Math.PI, 0);
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  updateStyles(newStyles) {
    if (newStyles.marquee) {
      Object.assign(STYLES.marquee, newStyles.marquee);
    }
    if (newStyles.selection) {
      Object.assign(STYLES.selection, newStyles.selection);
    }
    if (newStyles.lineSelection) {
      Object.assign(STYLES.lineSelection, newStyles.lineSelection);
    }
  }

  getStyles() {
    return {
      marquee: { ...STYLES.marquee },
      selection: { ...STYLES.selection },
      lineSelection: { ...STYLES.lineSelection }
    };
  }
}

export default SelectionOverlayRenderer;