// src/canvas/transform/TransformOverlay.js
// Note: connector ports sit PORT_OUTWARD_OFFSET (14 world-units) OUTSIDE the bounding box,
// so they never overlap with edge resize handles which are AT the boundary midpoints.

export default class TransformOverlay {
    constructor(selectionManager, canvasManager) {
        this.selection = selectionManager;
        this.canvas = canvasManager;

        this.boxColor = '#0066ff';
        this.boxDash = [4, 4];
        this.boxWidth = 1;
        this.handleSize = 8;
        this.handleColor = '#ffffff';
        this.handleBorder = '#0066ff';
        this.handleBorderWidth = 1;
        this.rotateHandleRadius = 10;
        this.rotateHandleColor = '#ffffff';
        this.rotateHandleBorder = '#0066ff';
        this.rotateHandleDistance = 25;

        this.endpointHandleSize = 10;
        this.endpointHandleColor = '#ffffff';
        this.endpointHandleBorder = '#0066ff';

        this.snapshotRotation = null;
        this.flipX = false;
        this.flipY = false;
        this.isTextObject = false;
        this.isEmojiObject = false;
    }

    render(ctx) {
        if (!this.selection.hasSelection()) {
            this.snapshotRotation = null;
            this.flipX = false;
            this.flipY = false;
            this.isTextObject = false;
            this.isEmojiObject = false;
            return;
        }

        const ids = this.selection.getSelectedIds();
        if (ids.length === 0) {
            this.snapshotRotation = null;
            this.flipX = false;
            this.flipY = false;
            this.isTextObject = false;
            this.isEmojiObject = false;
            return;
        }

        // Track if single selected object is text or emoji
        this.isTextObject = false;
        this.isEmojiObject = false;
        this.isStickyObject = false;
        if (ids.length === 1) {
            const singleObj = this.canvas.getObjectById(ids[0]);
            if (singleObj && singleObj.type === 'text') {
                this.isTextObject = true;
            }
            if (singleObj && singleObj.type === 'emoji') {
                this.isEmojiObject = true;
            }
            if (singleObj && singleObj.type === 'sticky') {
                this.isStickyObject = true;
            }
        }

        // Special rendering for single line/arrow (#24)
        if (ids.length === 1) {
            const obj = this.canvas.getObjectById(ids[0]);
            const effectiveType = obj?.type === 'shape' ? obj.shapeType : obj?.type;
            if (obj && (effectiveType === 'line' || effectiveType === 'arrow')) {
                this.renderLineArrowHandles(ctx, obj);
                return;
            }
        }

        const transformController = this.canvas.transformController;
        const isRotating = transformController?.isActive() && transformController?.activeType === 'rotate';

        if (isRotating && this.snapshotRotation === null) {
            const bounds = this.getSelectionBounds();
            this.snapshotRotation = bounds?.rotation || 0;
        } else if (!isRotating) {
            this.snapshotRotation = null;
        }

        const bounds = this.getSelectionBounds();
        if (!bounds) return;

        if (bounds.type === 'obb') {
            this.renderOBBHandles(ctx, bounds);
        } else {
            this.renderAABBHandles(ctx, bounds);
        }
    }

    renderLineArrowHandles(ctx, obj) {
        const zoom = this.canvas.state.viewport.zoom;
        const size = this.endpointHandleSize / zoom;
        const halfSize = size / 2;

        ctx.save();
        ctx.strokeStyle = this.boxColor;
        ctx.lineWidth = (obj.strokeWidth || 2) + 2 / zoom;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(obj.x1, obj.y1);
        ctx.lineTo(obj.x2, obj.y2);
        ctx.stroke();
        ctx.restore();

        this.renderEndpointHandle(ctx, {
            x: obj.x1 - halfSize,
            y: obj.y1 - halfSize,
            width: size,
            height: size,
            type: 'start',
            cursor: 'move'
        }, 'start');

        this.renderEndpointHandle(ctx, {
            x: obj.x2 - halfSize,
            y: obj.y2 - halfSize,
            width: size,
            height: size,
            type: 'end',
            cursor: 'move'
        }, 'end');
    }

    renderEndpointHandle(ctx, handle, type) {
        if (!handle) return;
        ctx.save();
        const zoom = this.canvas.state.viewport.zoom;
        const borderWidth = this.handleBorderWidth / zoom;

        ctx.fillStyle = this.endpointHandleBorder;
        ctx.beginPath();
        ctx.arc(handle.x + handle.width / 2, handle.y + handle.height / 2, handle.width / 2, 0, Math.PI * 2);
        ctx.fill();

        const innerRadius = (handle.width / 2) - borderWidth;
        ctx.fillStyle = this.endpointHandleColor;
        ctx.beginPath();
        ctx.arc(handle.x + handle.width / 2, handle.y + handle.height / 2, innerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.endpointHandleBorder;
        ctx.beginPath();
        ctx.arc(handle.x + handle.width / 2, handle.y + handle.height / 2, innerRadius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    getSelectionBounds() {
        const ids = this.selection.getSelectedIds();
        if (ids.length === 0) return null;

        this.flipX = false;
        this.flipY = false;

        if (ids.length > 1) {
            const aabb = this.canvas.getMultipleObjectBounds(ids);
            if (!aabb) return null;
            return { type: 'aabb', aabb, rotation: 0 };
        }

        const obj = this.canvas.getObjectById(ids[0]);
        if (!obj) return null;

        if (obj.flipX === true || (obj.scaleX !== undefined && obj.scaleX < 0)) this.flipX = true;
        if (obj.flipY === true || (obj.scaleY !== undefined && obj.scaleY < 0)) this.flipY = true;

        // Calculate stroke expansion for visual bounds
        const strokeExpand = (obj.strokeWidth || 0) / 2;

        const isRotatable = obj.type === 'rectangle' || obj.type === 'text' || obj.type === 'image';
        const isRotated = obj.rotation && Math.abs(obj.rotation) > 0.001;

        if (isRotatable && isRotated) {
            const obb = this.canvas.getObjectOBB?.(obj);
            if (obb && obb.corners && obb.corners.length >= 4) {
                // Expand OBB corners outward by strokeWidth/2
                if (strokeExpand > 0) {
                    const cx = obb.center.x;
                    const cy = obb.center.y;
                    for (let i = 0; i < obb.corners.length; i++) {
                        const dx = obb.corners[i].x - cx;
                        const dy = obb.corners[i].y - cy;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 0) {
                            const scale = (dist + strokeExpand) / dist;
                            obb.corners[i].x = cx + dx * scale;
                            obb.corners[i].y = cy + dy * scale;
                        }
                    }
                }
                return {
                    type: 'obb',
                    obb,
                    aabb: this.canvas.getObjectBounds(obj),
                    rotation: obj.rotation || 0,
                };
            }
        }

        const aabb = this.canvas.getObjectBounds(obj);
        if (!aabb) return null;
        // Expand AABB by stroke width
        if (strokeExpand > 0) {
            aabb.x -= strokeExpand;
            aabb.y -= strokeExpand;
            aabb.width += strokeExpand * 2;
            aabb.height += strokeExpand * 2;
        }
        return { type: 'aabb', aabb, rotation: 0 };
    }

    getLineArrowHandles(obj) {
        const zoom = this.canvas.state.viewport.zoom;
        const size = this.endpointHandleSize / zoom;
        const halfSize = size / 2;
        return {
            start: {
                x: obj.x1 - halfSize,
                y: obj.y1 - halfSize,
                width: size,
                height: size,
                worldX: obj.x1,
                worldY: obj.y1,
                type: 'endpoint',
                endpoint: 'start',
                cursor: 'move'
            },
            end: {
                x: obj.x2 - halfSize,
                y: obj.y2 - halfSize,
                width: size,
                height: size,
                worldX: obj.x2,
                worldY: obj.y2,
                type: 'endpoint',
                endpoint: 'end',
                cursor: 'move'
            }
        };
    }

    renderOBBHandles(ctx, bounds) {
        const obb = bounds.obb;
        if (!obb || !obb.corners) return;
        const handles = this.getOBBHandleRects(obb, bounds.rotation || 0);
        this.renderResizeHandle(ctx, handles.resize.nw);
        this.renderResizeHandle(ctx, handles.resize.ne);
        this.renderResizeHandle(ctx, handles.resize.sw);
        this.renderResizeHandle(ctx, handles.resize.se);
        // Edge handles: hidden only for text (n/s), emoji, and sticky objects
        if (!this.isTextObject && !this.isEmojiObject && !this.isStickyObject) this.renderResizeHandle(ctx, handles.resize.n);
        if (!this.isEmojiObject && !this.isStickyObject) this.renderResizeHandle(ctx, handles.resize.e);
        if (!this.isTextObject && !this.isEmojiObject && !this.isStickyObject) this.renderResizeHandle(ctx, handles.resize.s);
        if (!this.isEmojiObject && !this.isStickyObject) this.renderResizeHandle(ctx, handles.resize.w);
        if (handles.rotate) this.renderRotateHandle(ctx, handles.rotate);
    }

    renderAABBHandles(ctx, bounds) {
        const aabb = bounds.aabb;
        if (!aabb) return;
        const handles = this.getHandleRects(aabb, bounds.rotation || 0);
        this.renderResizeHandle(ctx, handles.resize.tl);
        this.renderResizeHandle(ctx, handles.resize.tr);
        this.renderResizeHandle(ctx, handles.resize.bl);
        this.renderResizeHandle(ctx, handles.resize.br);
        // Edge handles: hidden only for text (t/b), emoji, and sticky objects
        if (!this.isTextObject && !this.isEmojiObject && !this.isStickyObject) this.renderResizeHandle(ctx, handles.resize.t);
        if (!this.isEmojiObject && !this.isStickyObject) this.renderResizeHandle(ctx, handles.resize.r);
        if (!this.isTextObject && !this.isEmojiObject && !this.isStickyObject) this.renderResizeHandle(ctx, handles.resize.b);
        if (!this.isEmojiObject && !this.isStickyObject) this.renderResizeHandle(ctx, handles.resize.l);
        if (handles.rotate) this.renderRotateHandle(ctx, handles.rotate);
    }

    getOBBHandleRects(obb, rotation) {
        const handles = { resize: {}, rotate: null };
        const zoom = this.canvas.state.viewport.zoom;
        const size = this.handleSize / zoom;
        const halfSize = size / 2;
        const corners = obb.corners;
        if (!corners || corners.length < 4) return handles;

        let nwIdx = 0;
        let neIdx = 1;
        let seIdx = 2;
        let swIdx = 3;
        if (this.flipX && !this.flipY) {
            nwIdx = 1; neIdx = 0; swIdx = 2; seIdx = 3;
        } else if (!this.flipX && this.flipY) {
            nwIdx = 3; neIdx = 2; swIdx = 0; seIdx = 1;
        } else if (this.flipX && this.flipY) {
            nwIdx = 2; neIdx = 3; swIdx = 1; seIdx = 0;
        }

        handles.resize.nw = { x: corners[nwIdx].x - halfSize, y: corners[nwIdx].y - halfSize, width: size, height: size, type: 'corner', cursor: this.getFlipAwareCursor('nwse-resize', 'nesw-resize', 'nw') };
        handles.resize.ne = { x: corners[neIdx].x - halfSize, y: corners[neIdx].y - halfSize, width: size, height: size, type: 'corner', cursor: this.getFlipAwareCursor('nesw-resize', 'nwse-resize', 'ne') };
        handles.resize.sw = { x: corners[swIdx].x - halfSize, y: corners[swIdx].y - halfSize, width: size, height: size, type: 'corner', cursor: this.getFlipAwareCursor('nesw-resize', 'nwse-resize', 'sw') };
        handles.resize.se = { x: corners[seIdx].x - halfSize, y: corners[seIdx].y - halfSize, width: size, height: size, type: 'corner', cursor: this.getFlipAwareCursor('nwse-resize', 'nesw-resize', 'se') };

        const nEdge = { x: (corners[nwIdx].x + corners[neIdx].x) / 2, y: (corners[nwIdx].y + corners[neIdx].y) / 2 };
        const eEdge = { x: (corners[neIdx].x + corners[seIdx].x) / 2, y: (corners[neIdx].y + corners[seIdx].y) / 2 };
        const sEdge = { x: (corners[seIdx].x + corners[swIdx].x) / 2, y: (corners[seIdx].y + corners[swIdx].y) / 2 };
        const wEdge = { x: (corners[swIdx].x + corners[nwIdx].x) / 2, y: (corners[swIdx].y + corners[nwIdx].y) / 2 };

        handles.resize.n = { x: nEdge.x - halfSize, y: nEdge.y - halfSize, width: size, height: size, type: 'edge', cursor: 'ns-resize' };
        handles.resize.e = { x: eEdge.x - halfSize, y: eEdge.y - halfSize, width: size, height: size, type: 'edge', cursor: 'ew-resize' };
        handles.resize.s = { x: sEdge.x - halfSize, y: sEdge.y - halfSize, width: size, height: size, type: 'edge', cursor: 'ns-resize' };
        handles.resize.w = { x: wEdge.x - halfSize, y: wEdge.y - halfSize, width: size, height: size, type: 'edge', cursor: 'ew-resize' };

        const rotateDistance = this.rotateHandleDistance / zoom;
        const rotateRadius = this.rotateHandleRadius / zoom;
        const rotateCorner = corners[neIdx];
        const vecX = rotateCorner.x - obb.center.x;
        const vecY = rotateCorner.y - obb.center.y;
        const length = Math.sqrt(vecX * vecX + vecY * vecY);
        if (length > 0) {
            const scale = (length + rotateDistance) / length;
            handles.rotate = {
                x: obb.center.x + vecX * scale,
                y: obb.center.y + vecY * scale,
                radius: rotateRadius,
                type: 'rotate',
                cursor: 'grab'
            };
        }
        return handles;
    }

    getFlipAwareCursor(normalCursor, altCursor, corner) {
        if (!this.flipX && !this.flipY) return normalCursor;
        return altCursor;
    }

    getHandleRects(bounds, rotation = 0) {
        const handles = { resize: {}, rotate: null };
        const zoom = this.canvas.state.viewport.zoom;
        const size = this.handleSize / zoom;
        const halfSize = size / 2;

        handles.resize.tl = { x: bounds.x - halfSize, y: bounds.y - halfSize, width: size, height: size, type: 'corner', cursor: 'nwse-resize' };
        handles.resize.tr = { x: bounds.x + bounds.width - halfSize, y: bounds.y - halfSize, width: size, height: size, type: 'corner', cursor: 'nesw-resize' };
        handles.resize.bl = { x: bounds.x - halfSize, y: bounds.y + bounds.height - halfSize, width: size, height: size, type: 'corner', cursor: 'nesw-resize' };
        handles.resize.br = { x: bounds.x + bounds.width - halfSize, y: bounds.y + bounds.height - halfSize, width: size, height: size, type: 'corner', cursor: 'nwse-resize' };

        handles.resize.t = { x: bounds.x + bounds.width / 2 - halfSize, y: bounds.y - halfSize, width: size, height: size, type: 'edge', cursor: 'ns-resize' };
        handles.resize.r = { x: bounds.x + bounds.width - halfSize, y: bounds.y + bounds.height / 2 - halfSize, width: size, height: size, type: 'edge', cursor: 'ew-resize' };
        handles.resize.b = { x: bounds.x + bounds.width / 2 - halfSize, y: bounds.y + bounds.height - halfSize, width: size, height: size, type: 'edge', cursor: 'ns-resize' };
        handles.resize.l = { x: bounds.x - halfSize, y: bounds.y + bounds.height / 2 - halfSize, width: size, height: size, type: 'edge', cursor: 'ew-resize' };

        const rotateDistance = this.rotateHandleDistance / zoom;
        const rotateRadius = this.rotateHandleRadius / zoom;

        if (rotation && Math.abs(rotation) > 0.001) {
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            const topRightLocal = { x: bounds.width / 2, y: -bounds.height / 2 };
            const topRightWorld = {
                x: centerX + topRightLocal.x * cos - topRightLocal.y * sin,
                y: centerY + topRightLocal.x * sin + topRightLocal.y * cos
            };
            const vecX = topRightWorld.x - centerX;
            const vecY = topRightWorld.y - centerY;
            const length = Math.sqrt(vecX * vecX + vecY * vecY);
            if (length > 0) {
                const scale = (length + rotateDistance) / length;
                handles.rotate = { x: centerX + vecX * scale, y: centerY + vecY * scale, radius: rotateRadius, type: 'rotate', cursor: 'grab' };
            }
        } else {
            const offsetAngle = Math.PI / 4;
            const offsetDistance = rotateDistance * 1.5;
            handles.rotate = {
                x: bounds.x + bounds.width + Math.cos(offsetAngle) * offsetDistance,
                y: bounds.y + Math.sin(offsetAngle) * offsetDistance,
                radius: rotateRadius,
                type: 'rotate',
                cursor: 'grab'
            };
        }

        return handles;
    }

    renderResizeHandle(ctx, handle) {
        if (!handle) return;
        ctx.save();
        const zoom = this.canvas.state.viewport.zoom;
        const borderWidth = this.handleBorderWidth / zoom;

        ctx.fillStyle = this.handleBorder;
        ctx.beginPath();
        ctx.arc(handle.x + handle.width / 2, handle.y + handle.height / 2, handle.width / 2, 0, Math.PI * 2);
        ctx.fill();

        const innerRadius = (handle.width / 2) - borderWidth;
        ctx.fillStyle = this.handleColor;
        ctx.beginPath();
        ctx.arc(handle.x + handle.width / 2, handle.y + handle.height / 2, innerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    renderRotateHandle(ctx, handle) {
        if (!handle) return;
        ctx.save();
        const zoom = this.canvas.state.viewport.zoom;
        const borderWidth = this.handleBorderWidth / zoom;

        ctx.fillStyle = this.rotateHandleBorder;
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, handle.radius, 0, Math.PI * 2);
        ctx.fill();

        const innerRadius = handle.radius - borderWidth;
        ctx.fillStyle = this.rotateHandleColor;
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, innerRadius, 0, Math.PI * 2);
        ctx.fill();

        this.renderRotateIcon(ctx, handle.x, handle.y, innerRadius);
        ctx.restore();
    }

    renderRotateIcon(ctx, x, y, radius) {
        const zoom = this.canvas.state.viewport.zoom;
        const iconSize = radius * 1.2;
        ctx.save();
        ctx.strokeStyle = this.rotateHandleBorder;
        ctx.lineWidth = 1.5 / zoom;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x, y, iconSize * 0.4, 0.2, Math.PI * 2 - 0.5);
        ctx.stroke();
        const arrowX = x + Math.cos(Math.PI * 2 - 0.5) * iconSize * 0.4;
        const arrowY = y + Math.sin(Math.PI * 2 - 0.5) * iconSize * 0.4;
        const arrowSize = iconSize * 0.25;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - arrowSize * 0.5, arrowY - arrowSize * 0.7);
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX + arrowSize * 0.5, arrowY - arrowSize * 0.3);
        ctx.stroke();
        ctx.restore();
    }
}
