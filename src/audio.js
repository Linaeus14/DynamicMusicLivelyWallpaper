/**
 * Audio Visualization
 * Handles audio frequency analysis and waveform rendering
 */

import { SCALE } from "./config.js";
import { colorWithAlpha } from "./colors.js";

/**
 * Extracts frequency bands from the audio array for varied visualization
 * @param {Array<number>} audioArray - Array of audio frequency levels (0-1)
 * @returns {Object} Object with bass, mids, highs, and overall properties
 */
export function extractAudioBands(audioArray) {
  const len = audioArray.length;
  const bassEnd = Math.floor(len * 0.25); // First 25%: bass (0-250 Hz range)
  const midsEnd = Math.floor(len * 0.75); // Next 50%: mids (250-1500 Hz range)

  let bassSum = 0,
    midsSum = 0,
    highsSum = 0,
    overallSum = 0;

  for (let i = 0; i < len; i++) {
    overallSum += audioArray[i];

    if (i < bassEnd) {
      bassSum += audioArray[i];
    } else if (i < midsEnd) {
      midsSum += audioArray[i];
    } else {
      highsSum += audioArray[i];
    }
  }

  return {
    bass: bassSum / bassEnd,
    mids: midsSum / (midsEnd - bassEnd),
    highs: highsSum / (len - midsEnd),
    overall: overallSum / len,
  };
}

/**
 * Renders audio visualization waveforms for 4 lines
 * @param {Array<number>} audioArray - Array of audio frequency levels (0-1)
 * @param {Object} state - Application state object
 * @param {Object} lines - Line coordinate objects
 */
export function renderAudioVisualization(audioArray, state, lines) {
  const TopCanvas = document.getElementById("TopCanvas");
  const canvas = document.getElementById("canvas");
  const tctx = TopCanvas.getContext("2d");

  const centerX = SCALE.imgCenterX * canvas.width;
  const centerY = SCALE.imgCenterY * canvas.height;
  const centerRadius = {
    w: SCALE.imgRadius * canvas.width,
    h: SCALE.imgRadiusY * canvas.height,
  };
  const isLineInner = { l1: false, l2: false, l3: false, l4: false };

  let isCurrentAudioActive = audioArray.some((level) => level > 0);
  if (isCurrentAudioActive) {
    state.isAudioActive = true;
    tctx.clearRect(0, 0, canvas.width, canvas.height);
  } else {
    state.isAudioActive = false;
  }

  if (!state.isAudioActive) {
    return;
  }

  const len = audioArray.length;
  const bassEnd = Math.floor(len * 0.25);
  const midsEnd = Math.floor(len * 0.75);

  tctx.beginPath();
  var nextLevel;
  var grt;

  for (var i = 0; i < audioArray.length; i++) {
    var level =
      i == 0
        ? Math.min(
            audioArray[i] == 0 ? audioArray[i] : audioArray[i] + state.minLevel,
            1 + state.minLevel
          )
        : nextLevel;
    var nextLevel = Math.min(
      audioArray[i + 1] == 0
        ? audioArray[i + 1]
        : audioArray[i + 1] + state.minLevel,
      1 + state.minLevel
    );

    // LINE 1 - Bass frequencies (left-bottom direction)
    var line1Level = level;
    if (i < bassEnd) {
      line1Level = level * 1.2;
    } else if (i > midsEnd) {
      line1Level = level * 0.4;
    } else {
      line1Level = level * 0.7;
    }
    var line1NextLevel = nextLevel;
    if (i + 1 < bassEnd) {
      line1NextLevel = nextLevel * 1.2;
    } else if (i + 1 > midsEnd) {
      line1NextLevel = nextLevel * 0.4;
    } else {
      line1NextLevel = nextLevel * 0.7;
    }

    var xOffset = [
      (i * (lines.line1B.x - lines.line1A.x)) / audioArray.length +
        lines.line1A.x,
      ((i + 1) * (lines.line1B.x - lines.line1A.x)) / audioArray.length +
        lines.line1A.x,
    ];
    var yOffset = [
      i * ((lines.line1B.y - lines.line1A.y) / audioArray.length) +
        lines.line1A.y,
      (i + 1) * ((lines.line1B.y - lines.line1A.y) / audioArray.length) +
        lines.line1A.y,
    ];
    if (
      xOffset[0] > centerX - centerRadius.w &&
      yOffset[0] < centerY + centerRadius.h
    ) {
      grt = tctx.createRadialGradient(
        xOffset[0],
        yOffset[0],
        1,
        xOffset[1],
        yOffset[1],
        state.maxLevel * 4
      );
      grt.addColorStop(0, state.primaryColor);
      grt.addColorStop(
        0.5 * line1Level,
        colorWithAlpha(state.backgroundColor, 0)
      );
    } else {
      grt = tctx.createRadialGradient(
        xOffset[0],
        yOffset[0],
        1,
        xOffset[1],
        yOffset[1],
        state.maxLevel * 4
      );
      grt.addColorStop(0, state.secondaryColor);
    }
    tctx.fillStyle = grt;
    tctx.beginPath();
    tctx.moveTo(xOffset[0] - 4, yOffset[0] - 4);
    if (
      xOffset[1] > centerX - centerRadius.w &&
      yOffset[1] < centerY + centerRadius.h
    ) {
      if (!isLineInner.l1) {
        isLineInner.l1 = true;
        tctx.lineTo(centerX - centerRadius.w, centerY);
        tctx.bezierCurveTo(
          xOffset[1] - line1NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] + line1NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] - line1Level * state.maxLevel * state.smoothing,
          yOffset[0] + line1Level * state.maxLevel * state.smoothing,
          xOffset[1] - line1NextLevel * state.maxLevel,
          yOffset[1] + line1NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      } else {
        tctx.lineTo(
          xOffset[0] - line1Level * state.maxLevel,
          yOffset[0] + line1Level * state.maxLevel
        );
        tctx.bezierCurveTo(
          xOffset[1] - line1NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] + line1NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] - line1Level * state.maxLevel * state.smoothing,
          yOffset[0] + line1Level * state.maxLevel * state.smoothing,
          xOffset[1] - line1NextLevel * state.maxLevel,
          yOffset[1] + line1NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      }
    } else {
      if (isLineInner.l1) {
        isLineInner.l1 = false;
        tctx.lineTo(centerX, centerY + centerRadius.h);
        tctx.bezierCurveTo(
          xOffset[1] + line1NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] - line1NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] + line1Level * state.maxLevel * state.smoothing,
          yOffset[0] - line1Level * state.maxLevel * state.smoothing,
          xOffset[1] + line1NextLevel * state.maxLevel,
          yOffset[1] - line1NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      } else {
        tctx.lineTo(
          xOffset[0] + line1Level * state.maxLevel,
          yOffset[0] - line1Level * state.maxLevel
        );
        tctx.bezierCurveTo(
          xOffset[1] + line1NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] - line1NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] + line1Level * state.maxLevel * state.smoothing,
          yOffset[0] - line1Level * state.maxLevel * state.smoothing,
          xOffset[1] + line1NextLevel * state.maxLevel,
          yOffset[1] - line1NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      }
    }
    tctx.fill();
    tctx.closePath();

    // LINE 2 - Mid frequencies (right-top direction)
    var line2Level = level;
    if (i < bassEnd) {
      line2Level = level * 0.5;
    } else if (i > midsEnd) {
      line2Level = level * 0.5;
    } else {
      line2Level = level * 1.1;
    }
    var line2NextLevel = nextLevel;
    if (i + 1 < bassEnd) {
      line2NextLevel = nextLevel * 0.5;
    } else if (i + 1 > midsEnd) {
      line2NextLevel = nextLevel * 0.5;
    } else {
      line2NextLevel = nextLevel * 1.1;
    }

    xOffset = [
      (i * (lines.line2B.x - lines.line2A.x)) / audioArray.length +
        lines.line2A.x,
      ((i + 1) * (lines.line2B.x - lines.line2A.x)) / audioArray.length +
        lines.line2A.x,
    ];
    yOffset = [
      i * ((lines.line2B.y - lines.line2A.y) / audioArray.length) +
        lines.line2A.y,
      (i + 1) * ((lines.line2B.y - lines.line2A.y) / audioArray.length) +
        lines.line2A.y,
    ];
    if (
      xOffset[0] < centerX + centerRadius.w &&
      yOffset[0] > centerY - centerRadius.h
    ) {
      grt = tctx.createRadialGradient(
        xOffset[0],
        yOffset[0],
        1,
        xOffset[1],
        yOffset[1],
        state.maxLevel * 4
      );
      grt.addColorStop(0 * line2Level, state.primaryColor);
      grt.addColorStop(
        0.5 * line2Level,
        colorWithAlpha(state.backgroundColor, 0)
      );
    } else {
      grt = tctx.createRadialGradient(
        xOffset[0],
        yOffset[0],
        1,
        xOffset[1],
        yOffset[1],
        state.maxLevel * 4
      );
      grt.addColorStop(0 * line2Level, state.secondaryColor);
      grt.addColorStop(
        0.5 * line2Level,
        colorWithAlpha(state.backgroundColor, 0)
      );
    }
    tctx.fillStyle = grt;
    tctx.beginPath();
    tctx.moveTo(xOffset[0] - 4, yOffset[0] - 4);
    if (
      xOffset[1] < centerX + centerRadius.w &&
      yOffset[1] > centerY - centerRadius.h
    ) {
      if (!isLineInner.l2) {
        isLineInner.l2 = true;
        tctx.lineTo(centerX + centerRadius.w, centerY);
        tctx.bezierCurveTo(
          xOffset[1] + line2NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] - line2NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] + line2Level * state.maxLevel * state.smoothing,
          yOffset[0] - line2Level * state.maxLevel * state.smoothing,
          xOffset[1] + line2NextLevel * state.maxLevel,
          yOffset[1] - line2NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      } else {
        tctx.lineTo(
          xOffset[0] + line2Level * state.maxLevel,
          yOffset[0] - line2Level * state.maxLevel
        );
        tctx.bezierCurveTo(
          xOffset[1] + line2NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] - line2NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] + line2Level * state.maxLevel * state.smoothing,
          yOffset[0] - line2Level * state.maxLevel * state.smoothing,
          xOffset[1] + line2NextLevel * state.maxLevel,
          yOffset[1] - line2NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      }
    } else {
      if (isLineInner.l2) {
        isLineInner.l2 = false;
        tctx.lineTo(centerX, centerY - centerRadius.h);
        tctx.bezierCurveTo(
          xOffset[1] - line2NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] + line2NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] - line2Level * state.maxLevel * state.smoothing,
          yOffset[0] + line2Level * state.maxLevel * state.smoothing,
          xOffset[1] - line2NextLevel * state.maxLevel,
          yOffset[1] + line2NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      } else {
        tctx.lineTo(
          xOffset[0] - line2Level * state.maxLevel,
          yOffset[0] + line2Level * state.maxLevel
        );
        tctx.bezierCurveTo(
          xOffset[1] - line2NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] + line2NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] - line2Level * state.maxLevel * state.smoothing,
          yOffset[0] + line2Level * state.maxLevel * state.smoothing,
          xOffset[1] - line2NextLevel * state.maxLevel,
          yOffset[1] + line2NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      }
    }
    tctx.fill();
    tctx.closePath();

    // LINE 3 - High frequencies (left-top direction)
    var line3Level = level;
    if (i < bassEnd) {
      line3Level = level * 0.3;
    } else if (i > midsEnd) {
      line3Level = level * 1.3;
    } else {
      line3Level = level * 0.6;
    }
    var line3NextLevel = nextLevel;
    if (i + 1 < bassEnd) {
      line3NextLevel = nextLevel * 0.3;
    } else if (i + 1 > midsEnd) {
      line3NextLevel = nextLevel * 1.3;
    } else {
      line3NextLevel = nextLevel * 0.6;
    }

    xOffset = [
      (i * (lines.line3B.x - lines.line3A.x)) / audioArray.length +
        lines.line3A.x,
      ((i + 1) * (lines.line3B.x - lines.line3A.x)) / audioArray.length +
        lines.line3A.x,
    ];
    yOffset = [
      i * ((lines.line3B.y - lines.line3A.y) / audioArray.length) +
        lines.line3A.y,
      (i + 1) * ((lines.line3B.y - lines.line3A.y) / audioArray.length) +
        lines.line3A.y,
    ];
    if (
      xOffset[0] > centerX - centerRadius.w &&
      yOffset[0] > centerY - centerRadius.h
    ) {
      grt = tctx.createRadialGradient(
        xOffset[0],
        yOffset[0],
        1,
        xOffset[1],
        yOffset[1],
        state.maxLevel * 4
      );
      grt.addColorStop(0 * line3Level, state.primaryColor);
      grt.addColorStop(
        0.5 * line3Level,
        colorWithAlpha(state.backgroundColor, 0)
      );
    } else {
      grt = tctx.createRadialGradient(
        xOffset[0],
        yOffset[0],
        1,
        xOffset[1],
        yOffset[1],
        state.maxLevel * 4
      );
      grt.addColorStop(0 * line3Level, state.secondaryColor);
      grt.addColorStop(
        0.5 * line3Level,
        colorWithAlpha(state.backgroundColor, 0)
      );
    }
    tctx.fillStyle = grt;
    tctx.beginPath();
    tctx.moveTo(xOffset[0] + 4, yOffset[0] - 4);
    if (
      xOffset[1] > centerX - centerRadius.w &&
      yOffset[1] > centerY - centerRadius.h
    ) {
      if (!isLineInner.l3) {
        isLineInner.l3 = true;
        tctx.lineTo(centerX - centerRadius.w, centerY);
        tctx.bezierCurveTo(
          xOffset[1] - line3NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] - line3NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] - line3Level * state.maxLevel * state.smoothing,
          yOffset[0] - line3Level * state.maxLevel * state.smoothing,
          xOffset[1] - line3NextLevel * state.maxLevel,
          yOffset[1] - line3NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      } else {
        tctx.lineTo(
          xOffset[0] - line3Level * state.maxLevel,
          yOffset[0] - line3Level * state.maxLevel
        );
        tctx.bezierCurveTo(
          xOffset[1] - line3NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] - line3NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] - line3Level * state.maxLevel * state.smoothing,
          yOffset[0] - line3Level * state.maxLevel * state.smoothing,
          xOffset[1] - line3NextLevel * state.maxLevel,
          yOffset[1] - line3NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      }
    } else {
      if (isLineInner.l3) {
        isLineInner.l3 = false;
        tctx.lineTo(centerX, centerY - centerRadius.h);
        tctx.bezierCurveTo(
          xOffset[1] + line3NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] + line3NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] + line3Level * state.maxLevel * state.smoothing,
          yOffset[0] + line3Level * state.maxLevel * state.smoothing,
          xOffset[1] + line3NextLevel * state.maxLevel,
          yOffset[1] + line3NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      } else {
        tctx.lineTo(
          xOffset[0] + line3Level * state.maxLevel,
          yOffset[0] + line3Level * state.maxLevel
        );
        tctx.bezierCurveTo(
          xOffset[1] + line3NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] + line3NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] + line3Level * state.maxLevel * state.smoothing,
          yOffset[0] + line3Level * state.maxLevel * state.smoothing,
          xOffset[1] + line3NextLevel * state.maxLevel,
          yOffset[1] + line3NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      }
    }
    tctx.fill();
    tctx.closePath();

    // LINE 4 - Overall spectrum (right-bottom direction)
    var line4Level = level;
    var line4NextLevel = nextLevel;

    xOffset = [
      (i * (lines.line4B.x - lines.line4A.x)) / audioArray.length +
        lines.line4A.x,
      ((i + 1) * (lines.line4B.x - lines.line4A.x)) / audioArray.length +
        lines.line4A.x,
    ];
    yOffset = [
      i * ((lines.line4B.y - lines.line4A.y) / audioArray.length) +
        lines.line4A.y,
      (i + 1) * ((lines.line4B.y - lines.line4A.y) / audioArray.length) +
        lines.line4A.y,
    ];
    if (
      xOffset[0] < centerX + centerRadius.w &&
      yOffset[0] < centerY + centerRadius.h
    ) {
      grt = tctx.createRadialGradient(
        xOffset[0],
        yOffset[0],
        1,
        xOffset[1],
        yOffset[1],
        state.maxLevel * 4
      );
      grt.addColorStop(0 * line4Level, state.primaryColor);
      grt.addColorStop(
        0.5 * line4Level,
        colorWithAlpha(state.backgroundColor, 0)
      );
    } else {
      grt = tctx.createRadialGradient(
        xOffset[0],
        yOffset[0],
        1,
        xOffset[1],
        yOffset[1],
        state.maxLevel * 4
      );
      grt.addColorStop(0 * line4Level, state.secondaryColor);
      grt.addColorStop(
        0.5 * line4Level,
        colorWithAlpha(state.backgroundColor, 0)
      );
    }
    tctx.fillStyle = grt;
    tctx.beginPath();
    tctx.moveTo(xOffset[0] + 4, yOffset[0] - 4);
    if (
      xOffset[1] < centerX + centerRadius.w &&
      yOffset[1] < centerY + centerRadius.h
    ) {
      if (!isLineInner.l4) {
        isLineInner.l4 = true;
        tctx.lineTo(centerX + centerRadius.w, centerY);
        tctx.bezierCurveTo(
          xOffset[1] + line4NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] + line4NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] + line4Level * state.maxLevel * state.smoothing,
          yOffset[0] + line4Level * state.maxLevel * state.smoothing,
          xOffset[1] + line4NextLevel * state.maxLevel,
          yOffset[1] + line4NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      } else {
        tctx.lineTo(
          xOffset[0] + line4Level * state.maxLevel,
          yOffset[0] + line4Level * state.maxLevel
        );
        tctx.bezierCurveTo(
          xOffset[1] + line4NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] + line4NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] + line4Level * state.maxLevel * state.smoothing,
          yOffset[0] + line4Level * state.maxLevel * state.smoothing,
          xOffset[1] + line4NextLevel * state.maxLevel,
          yOffset[1] + line4NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      }
    } else {
      if (isLineInner.l4) {
        isLineInner.l4 = false;
        tctx.lineTo(centerX, centerY + centerRadius.h);
        tctx.bezierCurveTo(
          xOffset[1] - line4NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] - line4NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] - line4Level * state.maxLevel * state.smoothing,
          yOffset[0] - line4Level * state.maxLevel * state.smoothing,
          xOffset[1] - line4NextLevel * state.maxLevel,
          yOffset[1] - line4NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      } else {
        tctx.lineTo(
          xOffset[0] - line4Level * state.maxLevel,
          yOffset[0] - line4Level * state.maxLevel
        );
        tctx.bezierCurveTo(
          xOffset[1] - line4NextLevel * state.maxLevel * state.smoothing,
          yOffset[1] - line4NextLevel * state.maxLevel * state.smoothing,
          xOffset[0] - line4Level * state.maxLevel * state.smoothing,
          yOffset[0] - line4Level * state.maxLevel * state.smoothing,
          xOffset[1] - line4NextLevel * state.maxLevel,
          yOffset[1] - line4NextLevel * state.maxLevel
        );
        tctx.lineTo(xOffset[1], yOffset[1]);
      }
    }
    tctx.fill();
    tctx.closePath();
  }
}
