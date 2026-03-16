function distanceToObject(canvasManager, obj, point) {
  const bounds = canvasManager.getObjectBounds(obj);
  if (!bounds) return Infinity;

  const dx = Math.max(bounds.x - point.x, 0, point.x - (bounds.x + bounds.width));
  const dy = Math.max(bounds.y - point.y, 0, point.y - (bounds.y + bounds.height));

  return Math.sqrt(dx * dx + dy * dy);
}

export function selectBestObject(canvasManager, candidates, clickPoint) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const layers = canvasManager.state.layers || {};

  const scored = candidates.map((obj) => {
    const bounds = canvasManager.getObjectBounds(obj);
    const area = bounds ? bounds.width * bounds.height : Infinity;
    const distance = distanceToObject(canvasManager, obj, clickPoint);
    const layerId = obj.layer || 'default';
    const layer = layers[layerId];
    const layerPriority = layer?.zIndex || 0;

    return {
      obj,
      score: distance * 0.5 + area * 0.3 - layerPriority * 1000,
    };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored[0].obj;
}
