// src/features/canvas/engine/smartGuides/SmartGuideRenderer.js
//
// Draws smart guide lines, spacing indicators, and dimension labels
// directly onto the canvas context.  Called once per render frame
// when guides are active.
//
// All coordinates are in world space — the caller must have already
// applied ctx.translate / ctx.scale for the viewport.

const GUIDE_COLOR     = '#F23D6B';  // vivid pink-red — visible on any bg
const GUIDE_ALPHA     = 0.85;
const GUIDE_LINE_W    = 0.8;        // thin crisp line (world units)
const GUIDE_DASH      = [4, 3];     // dashed pattern

const SPACING_COLOR   = '#F23D6B';
const SPACING_ALPHA   = 0.80;
const SPACING_LINE_W  = 0.7;

const DIM_BG          = '#F23D6B';
const DIM_FG          = '#FFFFFF';
const DIM_FONT_SIZE   = 10;         // screen px — will be inverse-scaled

const ROTATION_COLOR  = '#F23D6B';
const ROTATION_ALPHA  = 0.7;

// ─── Public API ─────────────────────────────────────────────

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} guides — output of SmartGuideEngine queries
 *   { alignGuides, spacingGuides, dimensionMatches, rotationSnap }
 * @param {number} zoom — current viewport zoom
 */
export function drawSmartGuides(ctx, guides, zoom) {
  if (!guides) return;
  ctx.save();

  if (guides.alignGuides && guides.alignGuides.length > 0) {
    _drawAlignmentGuides(ctx, guides.alignGuides, zoom);
  }

  if (guides.spacingGuides && guides.spacingGuides.length > 0) {
    _drawSpacingGuides(ctx, guides.spacingGuides, zoom);
  }

  if (guides.dimensionMatches && guides.dimensionMatches.length > 0) {
    _drawDimensionLabels(ctx, guides.dimensionMatches, zoom);
  }

  if (guides.rotationSnap && guides.rotationSnap.isSnapped) {
    _drawRotationGuide(ctx, guides.rotationSnap, zoom);
  }

  ctx.restore();
}

// ─── Alignment guides ───────────────────────────────────────

function _drawAlignmentGuides(ctx, guides, zoom) {
  ctx.strokeStyle = GUIDE_COLOR;
  ctx.lineWidth = GUIDE_LINE_W / zoom; // constant screen width
  ctx.setLineDash(GUIDE_DASH.map(v => v / zoom));
  ctx.globalAlpha = GUIDE_ALPHA;
  ctx.lineCap = 'butt';

  // Deduplicate: merge guides on the same axis+value
  const merged = new Map();
  for (const g of guides) {
    const key = `${g.axis}:${g.value.toFixed(1)}`;
    if (!merged.has(key)) {
      merged.set(key, { ...g, spans: [] });
    }
    const m = merged.get(key);
    if (g.axis === 'x') {
      m.spans.push(...g.activeSpan, ...g.matchSpan);
    } else {
      m.spans.push(...g.activeSpan, ...g.matchSpan);
    }
  }

  for (const [, g] of merged) {
    const min = Math.min(...g.spans);
    const max = Math.max(...g.spans);
    const extend = 20 / zoom; // small extension beyond objects

    ctx.beginPath();
    if (g.axis === 'x') {
      // Vertical line at x = value
      ctx.moveTo(g.value, min - extend);
      ctx.lineTo(g.value, max + extend);
    } else {
      // Horizontal line at y = value
      ctx.moveTo(min - extend, g.value);
      ctx.lineTo(max + extend, g.value);
    }
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

// ─── Spacing guides ────────────────────────────────────────

function _drawSpacingGuides(ctx, spacingGuides, zoom) {
  ctx.globalAlpha = SPACING_ALPHA;
  const lw = SPACING_LINE_W / zoom;
  ctx.lineWidth = lw;
  ctx.strokeStyle = SPACING_COLOR;
  ctx.fillStyle = SPACING_COLOR;
  ctx.setLineDash([]);

  for (const sg of spacingGuides) {
    const isX = sg.axis === 'x';

    // Draw bracket-style indicators in both gaps
    for (const gap of [sg.activeGap, sg.matchGap]) {
      if (isX) {
        const midY = (gap.perpStart + gap.perpEnd) / 2;
        const bracketH = Math.min(8 / zoom, (gap.perpEnd - gap.perpStart) * 0.3);
        // Horizontal line across the gap
        ctx.beginPath();
        ctx.moveTo(gap.start, midY);
        ctx.lineTo(gap.end, midY);
        ctx.stroke();
        // Left bracket
        ctx.beginPath();
        ctx.moveTo(gap.start, midY - bracketH);
        ctx.lineTo(gap.start, midY + bracketH);
        ctx.stroke();
        // Right bracket
        ctx.beginPath();
        ctx.moveTo(gap.end, midY - bracketH);
        ctx.lineTo(gap.end, midY + bracketH);
        ctx.stroke();
      } else {
        const midX = (gap.perpStart + gap.perpEnd) / 2;
        const bracketW = Math.min(8 / zoom, (gap.perpEnd - gap.perpStart) * 0.3);
        ctx.beginPath();
        ctx.moveTo(midX, gap.start);
        ctx.lineTo(midX, gap.end);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(midX - bracketW, gap.start);
        ctx.lineTo(midX + bracketW, gap.start);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(midX - bracketW, gap.end);
        ctx.lineTo(midX + bracketW, gap.end);
        ctx.stroke();
      }
    }

    // Label showing the gap value
    const fontSize = DIM_FONT_SIZE / zoom;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = `${Math.round(sg.equalGap)}`;
    const metrics = ctx.measureText(label);
    const padX = 3 / zoom;
    const padY = 2 / zoom;
    const labelW = metrics.width + padX * 2;
    const labelH = fontSize + padY * 2;

    for (const gap of [sg.activeGap, sg.matchGap]) {
      let lx, ly;
      if (isX) {
        lx = (gap.start + gap.end) / 2;
        ly = (gap.perpStart + gap.perpEnd) / 2 - labelH - 2 / zoom;
      } else {
        lx = (gap.perpStart + gap.perpEnd) / 2 + labelW / 2 + 2 / zoom;
        ly = (gap.start + gap.end) / 2;
      }

      ctx.fillStyle = DIM_BG;
      const r = 2 / zoom;
      _roundRect(ctx, lx - labelW / 2, ly - labelH / 2, labelW, labelH, r);
      ctx.fill();

      ctx.fillStyle = DIM_FG;
      ctx.fillText(label, lx, ly);
    }
  }
}

// ─── Dimension match labels ─────────────────────────────────

function _drawDimensionLabels(ctx, matches, zoom) {
  if (!matches || matches.length === 0) return;

  const fontSize = DIM_FONT_SIZE / zoom;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Show a single label with the matched value near the active object
  // (the caller provides position info)
  for (const m of matches) {
    if (!m.labelPos) continue;
    const label = `${Math.round(m.value)}`;
    const metrics = ctx.measureText(label);
    const padX = 4 / zoom;
    const padY = 2 / zoom;
    const w = metrics.width + padX * 2;
    const h = fontSize + padY * 2;
    const r = 2 / zoom;

    ctx.fillStyle = DIM_BG;
    _roundRect(ctx, m.labelPos.x - w / 2, m.labelPos.y - h / 2, w, h, r);
    ctx.fill();

    ctx.fillStyle = DIM_FG;
    ctx.fillText(label, m.labelPos.x, m.labelPos.y);
  }
}

// ─── Rotation guide ────────────────────────────────────────

function _drawRotationGuide(ctx, snap, zoom) {
  if (!snap || !snap.center) return;

  ctx.globalAlpha = ROTATION_ALPHA;
  ctx.strokeStyle = ROTATION_COLOR;
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([4 / zoom, 3 / zoom]);

  // Radial line from center at the snapped angle
  const len = 60 / zoom;
  const angleRad = (snap.snapDegrees * Math.PI) / 180;
  ctx.beginPath();
  ctx.moveTo(snap.center.x, snap.center.y);
  ctx.lineTo(
    snap.center.x + Math.cos(angleRad) * len,
    snap.center.y + Math.sin(angleRad) * len,
  );
  ctx.stroke();
  ctx.setLineDash([]);

  // Degree label
  const fontSize = DIM_FONT_SIZE / zoom;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const label = `${snap.snapDegrees}°`;
  const lx = snap.center.x + Math.cos(angleRad) * (len + 8 / zoom);
  const ly = snap.center.y + Math.sin(angleRad) * (len + 8 / zoom);

  const metrics = ctx.measureText(label);
  const padX = 3 / zoom;
  const padY = 2 / zoom;
  const w = metrics.width + padX * 2;
  const h = fontSize + padY * 2;

  ctx.fillStyle = DIM_BG;
  _roundRect(ctx, lx - padX, ly - h / 2, w, h, 2 / zoom);
  ctx.fill();

  ctx.fillStyle = DIM_FG;
  ctx.fillText(label, lx, ly);
}

// ─── Helpers ────────────────────────────────────────────────

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
