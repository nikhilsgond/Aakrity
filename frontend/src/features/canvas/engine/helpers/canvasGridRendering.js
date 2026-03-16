export function drawCanvasBoundary(manager) {
  const { minX, maxX, minY, maxY } = manager.canvasBounds;
  manager.ctx.save();

  const isDarkMode = manager.state.darkMode || false;
  const boundaryColor = isDarkMode ? "#666666" : "#999999";
  const boundaryWidth = 2 / manager.state.viewport.zoom;

  manager.ctx.strokeStyle = boundaryColor;
  manager.ctx.lineWidth = boundaryWidth;
  manager.ctx.setLineDash([10 / manager.state.viewport.zoom, 5 / manager.state.viewport.zoom]);
  manager.ctx.beginPath();
  manager.ctx.rect(minX, minY, maxX - minX, maxY - minY);
  manager.ctx.stroke();
  manager.ctx.restore();
}

export function drawGrid(manager) {
  const gridStyle = manager.state.gridStyle || "lines";
  if (gridStyle === "none") return;

  manager.ctx.save();
  const isDarkMode = manager.state.darkMode || false;
  const zoom = manager.state.viewport.zoom;
  const width = manager.canvas.width;
  const height = manager.canvas.height;
  const panX = manager.state.viewport.panX;
  const panY = manager.state.viewport.panY;

  const baseGridSize = 40;
  const targetScreenSize = 40;

  const currentScreenSize = baseGridSize * zoom;
  const level = Math.floor(Math.log(currentScreenSize / targetScreenSize) / Math.log(5));
  const gridSize = baseGridSize * Math.pow(5, -level);
  const subdivisionFactor = currentScreenSize / targetScreenSize / Math.pow(5, level);
  const subLevel = Math.floor(subdivisionFactor);
  const subProgress = subdivisionFactor - subLevel;

  const worldLeft = -panX / zoom;
  const worldTop = -panY / zoom;
  const worldRight = worldLeft + width / zoom;
  const worldBottom = worldTop + height / zoom;

  drawMultiLevelLineGrid(
    manager,
    worldLeft,
    worldTop,
    worldRight,
    worldBottom,
    gridSize,
    subLevel,
    subProgress,
    zoom,
    panX,
    panY,
    width,
    height,
    isDarkMode
  );

  manager.ctx.restore();
}

export function drawMultiLevelLineGrid(
  manager,
  worldLeft,
  worldTop,
  worldRight,
  worldBottom,
  gridSize,
  subLevel,
  subProgress,
  zoom,
  panX,
  panY,
  width,
  height,
  isDarkMode
) {
  if (isDarkMode) {
    manager.ctx.strokeStyle = "rgba(75, 85, 99, 0.25)";
  } else {
    manager.ctx.strokeStyle = "rgba(209, 213, 219, 0.45)";
  }
  manager.ctx.lineWidth = 1;

  const firstX = Math.floor(worldLeft / gridSize) * gridSize;
  const firstY = Math.floor(worldTop / gridSize) * gridSize;

  manager.ctx.beginPath();
  for (let x = firstX; x <= worldRight; x += gridSize) {
    const screenX = x * zoom + panX;
    manager.ctx.moveTo(screenX, 0);
    manager.ctx.lineTo(screenX, height);
  }
  for (let y = firstY; y <= worldBottom; y += gridSize) {
    const screenY = y * zoom + panY;
    manager.ctx.moveTo(0, screenY);
    manager.ctx.lineTo(width, screenY);
  }
  manager.ctx.stroke();

  if (subLevel >= 1 && subProgress > 0.3) {
    const subGridSize = gridSize / 3;
    const opacity = Math.min(0.5, (subProgress - 0.3) / 0.5);

    if (isDarkMode) {
      manager.ctx.strokeStyle = `rgba(107, 114, 128, ${0.1 * opacity})`;
    } else {
      manager.ctx.strokeStyle = `rgba(156, 163, 175, ${0.2 * opacity})`;
    }

    manager.ctx.lineWidth = 1;
    const subFirstX = Math.floor(worldLeft / subGridSize) * subGridSize;
    const subFirstY = Math.floor(worldTop / subGridSize) * subGridSize;

    manager.ctx.beginPath();
    for (let x = subFirstX; x <= worldRight; x += subGridSize) {
      if (Math.abs(x / gridSize - Math.round(x / gridSize)) < 0.001) continue;
      const screenX = x * zoom + panX;
      manager.ctx.moveTo(screenX, 0);
      manager.ctx.lineTo(screenX, height);
    }
    for (let y = subFirstY; y <= worldBottom; y += subGridSize) {
      if (Math.abs(y / gridSize - Math.round(y / gridSize)) < 0.001) continue;
      const screenY = y * zoom + panY;
      manager.ctx.moveTo(0, screenY);
      manager.ctx.lineTo(width, screenY);
    }
    manager.ctx.stroke();
  }
}
