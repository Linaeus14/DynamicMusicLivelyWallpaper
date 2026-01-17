/**
 * Configuration and Constants
 * Contains all default settings, scaling ratios, and constants
 */

// ============================================
// Default Colors
// ============================================
export const DEFAULT_COLORS = {
  line: "#FAFAFA",
  background: "rgb(0,0,0)",
  primary: "#25D9C0",
  secondary: "#fff4e0",
};

// ============================================
// Audio Visualization Settings
// ============================================
export const AUDIO_DEFAULTS = {
  filterPower: 0.8,
  minLevel: 0.03,
  maxLevel: 80,
  smoothing: 0.8,
};

// ============================================
// Canvas Scaling Constants
// ============================================
// These ratios are based on a 1920x1080 reference resolution
export const SCALE = {
  // Image positioning
  imgCenterX: 1474 / 1920,
  imgCenterY: 499 / 1080,
  imgRadius: 445 / 1920,
  imgRadiusY: 445 / 1080,
  imgWidth: 886 / 1920,
  imgHeight: 887 / 1080,

  // Line 1 coordinates
  line1AX: 531 / 1920,
  line1BX: 1610 / 1920,
  line1BXOffset: 15,

  // Line 2 coordinates
  line2AX: 1421 / 1920,

  // Line 3 coordinates
  line3AX: 1529 / 1920,
  line3BX: 450 / 1920,

  // Line 4 coordinates
  line4BX: 1340 / 1920,
  line4BXOffset: 15,

  // Image center Y
  imgCenterYRatio: 499 / 1080,

  // Font size ratio
  fontSizeRatio: 100 / 1080,

  // Gradient scale
  gradientScale: 1.08,
};
