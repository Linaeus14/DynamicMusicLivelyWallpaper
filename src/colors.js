/**
 * Color Utilities and Manipulation
 * Handles color conversions, quantization, and dynamic color selection
 */

/**
 * Adds alpha transparency to a color string
 * @param {string} color - Color in hex (#RRGGBB), rgb(), or rgba() format
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} Color with alpha channel applied
 */
export function colorWithAlpha(color, alpha) {
  if (!color) return color;
  alpha = Math.max(0, Math.min(1, alpha));
  if (color.startsWith("#")) {
    let hex = color;
    if (hex.length === 4) {
      hex = "#" + [...hex.slice(1)].map((c) => c + c).join("");
    }
    const aHex = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, "0");
    return hex + aHex;
  } else if (color.startsWith("rgb(")) {
    return color.replace(/^rgb\(/, "rgba(").replace(/\)$/, `,${alpha})`);
  } else if (color.startsWith("rgba(")) {
    return color.replace(/rgba\(\s*([^\)]+),\s*([0-9.]+)\s*\)/, (m, inner) => {
      const parts = inner.split(",").map((p) => p.trim());
      const rgbParts = parts.slice(0, 3).join(",");
      return `rgba(${rgbParts},${alpha})`;
    });
  } else {
    return color;
  }
}

/**
 * Determines contrasting text color (light or dark) based on background color luminance
 * @param {string} rgbColor - Color in rgb() format
 * @returns {string} Either "#222222" (dark) or "#FAFAFA" (light)
 */
export function getContrastingColor(rgbColor) {
  const parts = rgbColor.match(/\d+/g).map(Number);
  const r = parts[0];
  const g = parts[1];
  const b = parts[2];

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#222222" : "#FAFAFA";
}

/**
 * Extracts a solid color from the top or bottom edge of an image
 * @param {ImageData} imageData - Image data object
 * @param {boolean} isTop - If true, samples from top; if false, samples from bottom
 * @returns {string} RGB color string
 */
export function getSolidColor(imageData, isTop) {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  let r = 0,
    g = 0,
    b = 0,
    count = 0;

  const rowIndex = isTop ? 0 : height - 1;
  const startCol = Math.floor(width * 0.25);
  const endCol = Math.ceil(width * 0.75);

  const startIndex = (rowIndex * width + startCol) * 4;
  const endIndex = (rowIndex * width + endCol) * 4;

  for (let i = startIndex; i < endIndex; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }

  if (count === 0) return "rgb(0,0,0)";
  return `rgb(${Math.round(r / count)},${Math.round(g / count)},${Math.round(
    b / count
  )})`;
}

/**
 * Builds RGB value array from image data
 * @param {ImageData} imageData - Image data object
 * @returns {Array} Array of RGB objects {r, g, b}
 */
export function buildRgb(imageData) {
  var rgbValues = [];
  for (let i = 0; i < imageData.data.length; i += 4) {
    var rgb = {
      r: imageData.data[i],
      g: imageData.data[i + 1],
      b: imageData.data[i + 2],
    };
    rgbValues.push(rgb);
  }
  return rgbValues;
}

/**
 * Finds the color component (r, g, or b) with the biggest range in an array of colors
 * @param {Array} rgbValues - Array of RGB color objects
 * @returns {string} "r", "g", or "b"
 */
export function findBiggestColorRange(rgbValues) {
  let rMin = Number.MAX_VALUE,
    gMin = Number.MAX_VALUE,
    bMin = Number.MAX_VALUE;
  let rMax = Number.MIN_VALUE,
    gMax = Number.MIN_VALUE,
    bMax = Number.MIN_VALUE;

  rgbValues.forEach((pixel) => {
    rMin = Math.min(rMin, pixel.r);
    gMin = Math.min(gMin, pixel.g);
    bMin = Math.min(bMin, pixel.b);
    rMax = Math.max(rMax, pixel.r);
    gMax = Math.max(gMax, pixel.g);
    bMax = Math.max(bMax, pixel.b);
  });

  const rRange = rMax - rMin;
  const gRange = gMax - gMin;
  const bRange = bMax - bMin;
  const biggestRange = Math.max(rRange, gRange, bRange);

  if (biggestRange === rRange) {
    return "r";
  } else if (biggestRange === gRange) {
    return "g";
  } else {
    return "b";
  }
}

/**
 * Recursively quantizes colors in an image to find the dominant colors
 * @param {Array} rgbValues - Array of RGB color objects
 * @param {number} depth - Current recursion depth
 * @returns {Array} Array of averaged color objects
 */
export function quantization(rgbValues, depth) {
  const MAX_DEPTH = 4;

  if (depth === MAX_DEPTH || rgbValues.length === 0) {
    const color = rgbValues.reduce(
      (prev, curr) => {
        prev.r += curr.r;
        prev.g += curr.g;
        prev.b += curr.b;
        return prev;
      },
      { r: 0, g: 0, b: 0 }
    );
    color.r = Math.round(color.r / rgbValues.length);
    color.g = Math.round(color.g / rgbValues.length);
    color.b = Math.round(color.b / rgbValues.length);
    return [color];
  }

  const componentToSortBy = findBiggestColorRange(rgbValues);
  rgbValues.sort((p1, p2) => {
    return p1[componentToSortBy] - p2[componentToSortBy];
  });
  const mid = rgbValues.length / 2;
  return [
    ...quantization(rgbValues.slice(0, mid), depth + 1),
    ...quantization(rgbValues.slice(mid + 1), depth + 1),
  ];
}

/**
 * Updates dynamic colors based on current settings and image quantization
 * @param {Object} state - Application state object
 */
export function setDynamicColors(state) {
  if (
    state.quantColors != null &&
    (state.useDynamicBackground || state.useDynamicColors)
  ) {
    let color = state.quantColors[0];
    if (color.r < 120 || color.g < 120 || color.b < 120) {
      color = { r: color.r + 100, g: color.g + 100, b: color.b + 100 };
    }
    state.primaryColor = `rgb(${color.r},${color.g},${color.b})`;

    color = state.quantColors[1];
    if (color.r < 120 || color.g < 120 || color.b < 120) {
      color = { r: color.r + 100, g: color.g + 100, b: color.b + 100 };
    }
    state.secondaryColor = `rgb(${color.r},${color.g},${color.b})`;

    state.primarySampledColor = state.primaryColor;
    state.secondarySampledColor = state.secondaryColor;
  }

  if (state.useDynamicBackground) {
    const canvas = document.getElementById("canvas");
    const offCanvas = document.createElement("canvas");
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    const offCtx = offCanvas.getContext("2d");

    let bgGrad = offCtx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, state.primaryColor);
    bgGrad.addColorStop(1, state.secondaryColor);
    offCtx.fillStyle = bgGrad;
    offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);

    const sampledData = offCtx.getImageData(
      offCanvas.width / 2,
      offCanvas.height / 2,
      1,
      1
    ).data;

    const sampledRgb = `rgb(${sampledData[0]},${sampledData[1]},${sampledData[2]})`;
    state.backgroundColor = sampledRgb;
    const contrastColor = getContrastingColor(state.backgroundColor);

    document.getElementById("track-title").style.color = contrastColor;
    document.getElementById("track-artist").style.color = contrastColor;
    state.lineColor = contrastColor;
  } else {
    state.backgroundColor = state.defaultBackgroundColor;
    document.getElementById("track-title").style.color = state.defaultLineColor;
    document.getElementById("track-artist").style.color =
      state.defaultLineColor;
    state.lineColor = state.defaultLineColor;
  }

  if (!state.useDynamicColors) {
    state.primaryColor = state.defaultPrimaryColor;
    state.secondaryColor = state.defaultSecondaryColor;
  }
}
