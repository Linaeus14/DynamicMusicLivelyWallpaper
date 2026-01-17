/**
 * Main Application
 * Initializes the app and connects all modules
 */

import { DEFAULT_COLORS, AUDIO_DEFAULTS } from "./config.js";
import { livelyPropertyListener } from "./propertyListener.js";
import { livelyCurrentTrack } from "./trackListener.js";
import { renderAudioVisualization } from "./audio.js";
import { render } from "./renderer.js";
import { setDynamicColors } from "./colors.js";
import { updateLyricsSync } from "./lyrics.js";

/**
 * Application state
 */
export const state = {
  // Display Settings
  displayMusicArt: true,
  displayTitle: true,
  displayArtist: true,

  // Rendering Options
  useFilter: true,
  useDynamicColors: true,
  useDynamicBackground: true,

  tempUsefilter: true,
  tempUseDynamicBackground: true,
  tempUseDynamicColors: true,

  // Color Settings
  defaultLineColor: DEFAULT_COLORS.line,
  defaultBackgroundColor: DEFAULT_COLORS.background,
  defaultPrimaryColor: DEFAULT_COLORS.primary,
  defaultSecondaryColor: DEFAULT_COLORS.secondary,

  primarySampledColor: DEFAULT_COLORS.primary,
  secondarySampledColor: DEFAULT_COLORS.secondary,

  backgroundColor: DEFAULT_COLORS.background,
  lineColor: DEFAULT_COLORS.line,
  primaryColor: DEFAULT_COLORS.primary,
  secondaryColor: DEFAULT_COLORS.secondary,

  // Audio and Visualization Settings
  filterPower: AUDIO_DEFAULTS.filterPower,
  minLevel: AUDIO_DEFAULTS.minLevel,
  maxLevel: AUDIO_DEFAULTS.maxLevel,
  smoothing: AUDIO_DEFAULTS.smoothing,

  isAudioActive: false,

  // Image and Color Data
  image: null,
  quantColors: null,

  // Lyrics API Keys (optional - set via propertyListener or hardcoded)
  musixmatchKey: null,
  geniusKey: null,

  // Lyrics Timing - Array of {text, startTime, duration, endTime, isGap}
  currentPosition: 0,
  currentLyrics: null,
  lyricsSource: "",
};

/**
 * Line coordinates
 */
export const lines = {
  line1A: { x: 0, y: 0 },
  line1B: { x: 0, y: 0 },
  line2A: { x: 0, y: 0 },
  line2B: { x: 0, y: 0 },
  line3A: { x: 0, y: 0 },
  line3B: { x: 0, y: 0 },
  line4A: { x: 0, y: 0 },
  line4B: { x: 0, y: 0 },
};

/**
 * Album art image
 */
export const img = new Image();
img.src = "./art.png";

/**
 * Main update loop - runs every frame
 */
function updateLoop(timestamp) {
  // Update lyrics if available
  if (state.currentLyrics && state.currentLyrics.length > 0) {
    updateLyricsSync(state.currentPosition, state);
  }

  requestAnimationFrame(updateLoop);
}

/**
 * Initialize the application
 */
export function initializeApp() {
  const canvas = document.getElementById("canvas");
  const TopCanvas = document.getElementById("TopCanvas");

  // Set initial canvas dimensions
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  TopCanvas.width = window.innerWidth;
  TopCanvas.height = window.innerHeight;

  // Set up global Lively callbacks
  window.livelyPropertyListener = (name, val) => {
    livelyPropertyListener(name, val, state, lines, img);
  };

  window.livelyAudioListener = (audioArray) => {
    renderAudioVisualization(audioArray, state, lines);
  };

  // Initial render
  setDynamicColors(state);
  render(state, lines, img);

  // Handle window resize with debouncing
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      TopCanvas.width = window.innerWidth;
      TopCanvas.height = window.innerHeight;
      render(state, lines, img);
    }, 100);
  });

  // Start update loop
  requestAnimationFrame(updateLoop);
}

// Initialize on load
window.addEventListener("load", initializeApp);

// Handle track changes - receives position updates continuously
window.livelyCurrentTrack = (data) => {
  if (!data) return;

  const trackData = JSON.parse(data);

  // Update current playback position from Lively (in milliseconds)
  if (trackData && trackData.Position !== undefined) {
    state.currentPosition = trackData.Position / 1000; // Convert to seconds
  } else if (trackData && trackData.Progress !== undefined) {
    state.currentPosition = trackData.Progress / 1000; // Convert to seconds
  }

  // Handle new track (song change)
  livelyCurrentTrack(data, state, lines, img);
};
