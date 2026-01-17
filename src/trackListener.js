/**
 * Track Listener
 * Handles track changes and album art processing
 */

import { buildRgb, quantization, setDynamicColors } from "./colors.js";
import { render } from "./renderer.js";
import { fetchLyrics, updateLyricsSync } from "./lyrics.js";

/**
 * Called when the current playing track changes
 */
export async function livelyCurrentTrack(data, state, lines, img) {
  let obj = JSON.parse(data);

  // --- 1. Handle Album Art & Colors ---
  if (obj != null && obj.Thumbnail != null && state.displayMusicArt) {
    const img64 = !obj.Thumbnail.startsWith("data:image/")
      ? "data:image/png;base64," + obj.Thumbnail
      : obj.Thumbnail;
    const newImg = new Image();
    newImg.src = img64;

    newImg.onload = () => {
      img.src = newImg.src;
      const off = document.createElement("canvas");
      off.width = newImg.naturalWidth;
      off.height = newImg.naturalHeight;
      const offCtx = off.getContext("2d");
      offCtx.drawImage(newImg, 0, 0);

      const imageData = offCtx.getImageData(0, 0, off.width, off.height);
      const rgbValues = buildRgb(imageData);
      state.quantColors = quantization(rgbValues, 0);
      setDynamicColors(state);
      render(state, lines, img);
    };
    state.image = img64;
  } else {
    img.src = "";
    state.quantColors = null;
    setDynamicColors(state);
    render(state, lines, img);
  }

  // --- 2. Handle Text & Lyrics ---
  if (obj != null) {
    document.getElementById("track-title").innerHTML = state.displayTitle
      ? obj.Title
      : "";
    document.getElementById("track-artist").innerHTML = state.displayArtist
      ? obj.Artist
      : "";

    // Reset state
    state.currentLyrics = null;
    const container = document.getElementById("lyrics-container");
    container.innerHTML =
      '<div class="lyrics-source">Searching lyrics...</div>';

    if (obj.Title && obj.Artist) {
      // Use an async function inside setTimeout to handle errors properly
      setTimeout(async () => {
        try {
          const result = await fetchLyrics(obj.Artist, obj.Title);

          if (result && result.parsedLyrics) {
            state.currentLyrics = result.parsedLyrics;
            state.lyricsSource = result.source;
            state.lyricsType = result.displayType;
            updateLyricsSync(state.currentPosition, state);
          } else {
            // This ensures "Searching..." disappears if no results found
            container.innerHTML = `<div class="lyrics-source">No lyrics found for "${obj.Title}"</div>`;
          }
        } catch (err) {
          container.innerHTML = `<div class="lyrics-source" style="color:red">Error loading lyrics</div>`;
        }
      }, 500);
    }
  } else {
    // Reset everything if no track is playing
    document.getElementById("track-title").innerHTML = "";
    document.getElementById("track-artist").innerHTML = "";
    document.getElementById("lyrics-container").innerHTML = "";
    state.currentLyrics = null;
  }
}
