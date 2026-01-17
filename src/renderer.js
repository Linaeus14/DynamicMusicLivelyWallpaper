/**
 * Canvas Rendering
 * Handles main canvas drawing for background, image, and decorative lines
 */

import { SCALE } from "./config.js";
import { colorWithAlpha, getSolidColor } from "./colors.js";

/**
 * Renders the main canvas with background, image, and decorative lines
 * @param {Object} state - Application state object
 * @param {Object} lines - Line coordinate objects
 * @param {HTMLImageElement} img - Album art image element
 */
export function render(state, lines, img) {
  const canvas = document.getElementById("canvas");
  const TopCanvas = document.getElementById("TopCanvas");
  const ctx = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  TopCanvas.width = window.innerWidth;
  TopCanvas.height = window.innerHeight;
  document.getElementById("track-container").style.fontSize = `${
    SCALE.fontSizeRatio * canvas.height
  }%`;

  // Calculate line positions based on scaled canvas dimensions
  lines.line1A = { x: SCALE.line1AX * canvas.width, y: 0 };
  lines.line1B = {
    x: SCALE.line1BX * canvas.width + SCALE.line1BXOffset,
    y: canvas.height + SCALE.line1BXOffset,
  };
  lines.line2A = { x: SCALE.line2AX * canvas.width, y: 0 };
  lines.line2B = { x: canvas.width, y: SCALE.imgCenterYRatio * canvas.height };
  lines.line3A = { x: SCALE.line3AX * canvas.width, y: 0 };
  lines.line3B = { x: SCALE.line3BX * canvas.width, y: canvas.height };
  lines.line4A = { x: canvas.width, y: SCALE.imgCenterYRatio * canvas.height };
  lines.line4B = {
    x: SCALE.line4BX * canvas.width - SCALE.line4BXOffset,
    y: canvas.height + SCALE.line4BXOffset,
  };

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the main background first
  if (state.quantColors && state.useDynamicBackground) {
    let bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, state.primarySampledColor);
    bgGrad.addColorStop(1, state.secondarySampledColor);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = state.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  img.width = SCALE.imgWidth * canvas.width;
  img.height = SCALE.imgHeight * canvas.height;

  if (img.src != null && !img.src.startsWith("localfolder")) {
    const centerX = SCALE.imgCenterX * canvas.width;
    const centerY = SCALE.imgCenterY * canvas.height;
    const diamondWidth = SCALE.imgWidth * canvas.width;
    const diamondHeight = SCALE.imgHeight * canvas.height;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const diamondRatio = diamondWidth / diamondHeight;
    let drawW, drawH, drawX, drawY;

    if (imgRatio > diamondRatio) {
      drawW = diamondWidth;
      drawH = diamondWidth / imgRatio;
    } else {
      drawH = diamondHeight;
      drawW = diamondHeight * imgRatio;
    }

    drawX = centerX - drawW / 2;
    drawY = centerY - drawH / 2;

    // Create a single clipping path for the diamond
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - diamondHeight / 2);
    ctx.lineTo(centerX + diamondWidth / 2, centerY);
    ctx.lineTo(centerX, centerY + diamondHeight / 2);
    ctx.lineTo(centerX - diamondWidth / 2, centerY);
    ctx.closePath();
    ctx.clip();

    // Draw the image and fills within the clipping path
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    const isRectangularVisual = Math.abs(drawH - diamondHeight) > 1;

    if (isRectangularVisual) {
      const off = document.createElement("canvas");
      off.width = drawW;
      off.height = drawH;
      const offCtx = off.getContext("2d");
      offCtx.drawImage(img, 0, 0, drawW, drawH);
      const scaledImageData = offCtx.getImageData(0, 0, off.width, off.height);

      // Draw the top fills
      const topColor = getSolidColor(scaledImageData, true);
      const topGradient = ctx.createLinearGradient(
        0,
        centerY - diamondHeight / 2,
        0,
        drawY
      );
      topGradient.addColorStop(0, topColor);
      topGradient.addColorStop(1, colorWithAlpha(topColor, 0.8));
      ctx.fillStyle = topGradient;
      ctx.fillRect(
        drawX,
        centerY - diamondHeight / 2,
        drawW,
        drawY - (centerY - diamondHeight / 2)
      );

      // Draw the bottom fills
      const bottomColor = getSolidColor(scaledImageData, false);
      const bottomGradient = ctx.createLinearGradient(
        0,
        drawY + drawH,
        0,
        centerY + diamondHeight / 2
      );
      bottomGradient.addColorStop(0, colorWithAlpha(bottomColor, 0.8));
      bottomGradient.addColorStop(1, bottomColor);
      ctx.fillStyle = bottomGradient;
      ctx.fillRect(
        drawX,
        drawY + drawH,
        drawW,
        centerY + diamondHeight / 2 - (drawY + drawH)
      );
    }

    // Optionally draw the overlay gradient if enabled
    if (state.useFilter) {
      const gradientHalfSide =
        (Math.min(diamondWidth, diamondHeight) / 2) * SCALE.gradientScale;
      const gradient = ctx.createLinearGradient(
        centerX - gradientHalfSide,
        centerY - gradientHalfSide,
        centerX + gradientHalfSide,
        centerY + gradientHalfSide
      );

      gradient.addColorStop(
        0,
        colorWithAlpha(state.backgroundColor, 0.2 * state.filterPower)
      );
      gradient.addColorStop(
        0.7,
        colorWithAlpha(state.backgroundColor, 0.8 * state.filterPower)
      );
      gradient.addColorStop(1, state.backgroundColor);

      ctx.fillStyle = gradient;
      ctx.fillRect(
        centerX - gradientHalfSide,
        centerY - gradientHalfSide,
        gradientHalfSide * 2,
        gradientHalfSide * 2
      );
    }

    ctx.restore();
  }

  // Draw the lines on top of everything
  ctx.strokeStyle = state.lineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lines.line1A.x, lines.line1A.y);
  ctx.lineTo(lines.line1B.x, lines.line1B.y);
  ctx.stroke();

  ctx.moveTo(lines.line2A.x, lines.line2A.y);
  ctx.lineTo(lines.line2B.x, lines.line2B.y);
  ctx.stroke();

  ctx.moveTo(lines.line3A.x, lines.line3A.y);
  ctx.lineTo(lines.line3B.x, lines.line3B.y);
  ctx.stroke();

  ctx.moveTo(lines.line4A.x, lines.line4A.y);
  ctx.lineTo(lines.line4B.x, lines.line4B.y);
  ctx.stroke();

  ctx.restore();
}
