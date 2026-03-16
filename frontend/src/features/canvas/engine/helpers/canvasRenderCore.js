import { drawSmartGuides } from '../smartGuides/SmartGuideRenderer.js';

export function startRenderLoop(manager) {
  const render = () => {
    if (manager.needsRender && manager.ctx) {
      // Clear the flag before rendering so requestRender() calls during draw
      // (e.g. loading animations) correctly schedule the next frame.
      manager.needsRender = false;
      renderCanvas(manager);
    }
    manager.renderRequestId = requestAnimationFrame(render);
  };
  manager.renderRequestId = requestAnimationFrame(render);
}

export function requestRender(manager) {
  manager.needsRender = true;
}

export function renderCanvas(manager) {
  const ctx = manager.ctx;
  const canvas = manager.canvas;
  if (!ctx || !canvas) return;

  const { zoom, panX, panY } = manager.state.viewport;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = manager.state.darkMode ? "#111111" : "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  manager.drawGrid();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  manager.state.objects.forEach((obj) => {
    drawObject(manager, obj);
  });

  if (manager.previewObject) {
    drawObject(manager, manager.previewObject);
  }

  // Draw remote preview objects (concurrent remote drawings)
  if (manager.remotePreviewObjects && manager.remotePreviewObjects.size > 0) {
    manager.remotePreviewObjects.forEach((preview) => {
      drawObject(manager, preview);
    });
  }

  if (manager.selectionOverlayRenderer) {
    manager.selectionOverlayRenderer.render(manager.ctx);
  }
  if (manager.transformOverlay) {
    manager.transformOverlay.render(manager.ctx);
  }

  // Smart Guides overlay — drawn on top of everything
  if (manager.smartGuideState && manager.smartGuideState.hasGuides()) {
    drawSmartGuides(ctx, manager.smartGuideState.getRenderData(), zoom);
  }

  ctx.restore();
}

export function drawObject(manager, obj) {
  if (!obj || !obj.type) return;

  const isPreview = obj.isPreview;
  if (isPreview) {
    manager.ctx.save();
    manager.ctx.globalAlpha = obj.opacity ?? 0.5;
  }

  // Normalize: resolve the concrete shape name for routing
  // Objects with type:'shape' use shapeType; preview objects may use the raw name directly
  const rawType = obj.type;
  const shapeType = obj.shapeType || rawType;
  const routeType = rawType === 'shape' ? shapeType : rawType;

  switch (routeType) {
    case "drawing":
      manager.drawPath(obj);
      break;
    case "rectangle":
      manager.drawRectangle(obj);
      break;
    case "roundedRectangle":
      manager.drawRoundedRectangle(obj);
      break;
    case "circle":
      manager.drawCircle(obj);
      break;
    case "ellipse":
      manager.drawEllipse(obj);
      break;
    case "line":
      manager.drawLine(obj);
      break;
    case "arrow":
      manager.drawArrow(obj);
      break;
    case "triangle":
      manager.drawTriangle(obj);
      break;
    case "diamond":
    case "star":
    case "hexagon":
    case "pentagon":
    case "polygon":
      manager.drawPolygon(obj);
      break;
    case "text":
      manager.drawText(obj);
      break;
    case "image":
      manager.drawImage(obj);
      break;
    case "emoji":
      manager.drawEmoji(obj);
      break;
    case "sticky":
      manager.drawStickyNote(obj);
      break;
    default:
      console.warn("Unknown object type:", obj.type, obj.shapeType);
  }

  if (isPreview) {
    manager.ctx.restore();
  }
}




