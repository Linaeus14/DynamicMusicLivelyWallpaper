/**
 * Property Listener
 * Handles LivelyProperties.json changes from user settings
 */

import { setDynamicColors } from "./colors.js";
import { render } from "./renderer.js";

/**
 * Called when a property in LivelyProperties.json is changed by the user
 * @param {string} name - Property name
 * @param {any} val - New property value
 * @param {Object} state - Application state object
 * @param {Object} lines - Line coordinate objects
 * @param {HTMLImageElement} img - Album art image element
 */
export function livelyPropertyListener(name, val, state, lines, img) {
  switch (name) {
    case "displayMusicArt":
      state.displayMusicArt = val;
      img.src = val ? state.image : null;
      if (!state.displayMusicArt) {
        state.backgroundColor = state.defaultBackgroundColor;
        state.lineColor = state.defaultLineColor;
        state.primaryColor = state.defaultPrimaryColor;
        state.secondaryColor = state.defaultSecondaryColor;
        state.useFilter = false;
        state.useDynamicBackground = false;
        state.useDynamicColors = false;
      } else {
        state.useDynamicBackground = state.tempUseDynamicBackground;
        state.useDynamicColors = state.tempUseDynamicColors;
        state.useFilter = state.tempUsefilter;
      }
      setDynamicColors(state);
      render(state, lines, img);
      break;
    case "filter":
      state.tempUsefilter = val;
      if (state.displayMusicArt) {
        state.useFilter = val;
        render(state, lines, img);
      }
      break;
    case "filterPower":
      state.filterPower = val;
      setDynamicColors(state);
      render(state, lines, img);
      break;
    case "dynamicBackground":
      state.tempUseDynamicBackground = val;
      if (state.displayMusicArt) {
        state.useDynamicBackground = val;
      } else {
        state.backgroundColor = state.defaultBackgroundColor;
        state.lineColor = state.defaultLineColor;
      }
      setDynamicColors(state);
      render(state, lines, img);
      break;
    case "backgroundColor":
      state.defaultBackgroundColor = val;
      if (!state.useDynamicBackground) {
        state.backgroundColor = val;
        render(state, lines, img);
      }
      break;
    case "lineColor":
      state.defaultLineColor = val;
      if (!state.useDynamicBackground) {
        state.lineColor = val;
        setDynamicColors(state);
        render(state, lines, img);
      }
      break;
    case "useDynamicColors":
      state.tempUseDynamicColors = val;
      if (state.displayMusicArt) {
        state.useDynamicColors = val;
      } else {
        state.primaryColor = state.defaultPrimaryColor;
        state.secondaryColor = state.defaultSecondaryColor;
      }
      setDynamicColors(state);
      render(state, lines, img);
      break;
    case "primaryColor":
      state.defaultPrimaryColor = val;
      if (!state.useDynamicColors) {
        state.primaryColor = val;
      }
      break;
    case "secondaryColor":
      state.defaultSecondaryColor = val;
      if (!state.useDynamicColors) {
        state.secondaryColor = val;
      }
      break;
    case "minLevel":
      state.minLevel = val;
      break;
    case "maxLevel":
      state.maxLevel = val;
      break;
    case "smoothing":
      state.smoothing = val;
      break;
    case "musixmatchKey":
      state.musixmatchKey = val || null;
      break;
    case "geniusKey":
      state.geniusKey = val || null;
      break;
  }
}
