/**
 * Lyrics Fetcher
 * Fetches lyrics from multiple sources with fallback logic
 * Priority: Musixmatch > YouTube > LRCli > Genius
 */

/**
 * Format artist and title for API calls
 */
function formatSearch(artist, title) {
  return {
    artist: (artist || "").trim().toLowerCase(),
    title: (title || "").trim().toLowerCase(),
    artistClean: (artist || "").trim().toLowerCase().replace(/\s+/g, " "),
    titleClean: (title || "").trim().toLowerCase().replace(/\s+/g, " "),
  };
}

/**
 * Parses LRC and Enhanced LRC (syllable-based) formats
 * @param {string} lrcContent - The raw LRC string
 * @returns {Array} Array of line objects with optional word-level timing
 */
export function parseEnhancedLRC(lrcContent) {
  const lines = lrcContent.split("\n");
  const lyricsArray = [];

  // Regex for line timing: [00:12.34]
  const lineTimeRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  // Regex for word/syllable timing: <00:12.34>
  const wordTimeRegex = /<(\d{2}):(\d{2})\.(\d{2,3})>/g;

  for (let line of lines) {
    const match = line.match(lineTimeRegex);
    if (!match) continue;

    const startTime =
      parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 100;
    let text = line.replace(lineTimeRegex, "").trim();

    // Check for syllable/word timing (Enhanced LRC)
    const words = [];
    let lastWordMatch;
    let cleanLineText = text.replace(/<[^>]+>/g, ""); // Text without <tags>

    // If the line has <00:00.00> tags, it's Syllable/Word level
    if (wordTimeRegex.test(text)) {
      const parts = text.split(/(<[^>]+>)/).filter(Boolean);
      let currentTime = startTime;

      parts.forEach((part) => {
        const wordMatch = part.match(/<(\d{2}):(\d{2})\.(\d{2,3})>/);
        if (wordMatch) {
          currentTime =
            parseInt(wordMatch[1]) * 60 +
            parseInt(wordMatch[2]) +
            parseInt(wordMatch[3]) / 100;
        } else {
          words.push({
            text: part,
            time: currentTime,
          });
        }
      });
    }

    lyricsArray.push({
      startTime,
      text: cleanLineText,
      words: words.length > 0 ? words : null, // null if only line-synced
    });
  }

  return lyricsArray.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Updates the lyrics container based on current playback time
 * @param {number} currentTime - Current playback time in seconds
 * @param {Object} state - Application state
 */
export function updateLyricsSync(currentTime, state) {
  const container = document.getElementById("lyrics-container");
  if (!state.currentLyrics || !container) return;

  const activeLine = [...state.currentLyrics]
    .reverse()
    .find((l) => currentTime >= l.startTime);

  if (!activeLine) return;

  let html = `<div class="lyrics-source">From: ${state.lyricsSource}</div>`;

  // Check if we actually have word data for syllable/word mode
  if (
    (state.lyricsType === "syllable" || state.lyricsType === "word") &&
    activeLine.words
  ) {
    html += `<div class="active-line">`;
    activeLine.words.forEach((word) => {
      const isPast = currentTime >= word.time;
      // We use opacity and text-shadow to make it look 'glowing'
      const color = isPast ? "#fff" : "rgba(255,255,255,0.2)";
      const shadow = isPast ? "0 0 10px rgba(255,255,255,0.5)" : "none";
      const scale = isPast ? "1.05" : "1";

      html += `<span style="
        color: ${color};
        text-shadow: ${shadow};
        transform: scale(${scale});
        display: inline-block;
        margin-right: 5px;
        transition: all 0.2s ease-out;
        ">${word.text}</span>`;
    });
    html += `</div>`;
  } else {
    // Fallback to standard line display
    html += `<div class="active-line" style="color: white;">${activeLine.text}</div>`;
  }

  container.innerHTML = html;
  const activeElement = container.querySelector(".active-line");
  if (activeElement) {
    activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/**
 * LRClib API - Best option, no auth required, CORS friendly
 * Returns synchronized lyrics in LRC format
 */
async function fetchFromLRClib(artist, title) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second limit

  try {
    const { artistClean, titleClean } = formatSearch(artist, title);
    const query = encodeURIComponent(`${artistClean} ${titleClean}`);
    const apiUrl = `https://lrclib.net/api/search?q=${query}`;

    // Switch back to a more direct proxy format that works better with Lively
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
      apiUrl
    )}`;

    const response = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error("Proxy Error");

    const data = await response.json();

    // IMPORTANT: AllOrigins wraps the result. We MUST parse 'contents'
    if (!data.contents) return null;
    const results = JSON.parse(data.contents);

    if (!results || results.length === 0) return null;

    // Better Lyrics logic: find the one with the most metadata
    const track = results.find((t) => t.syncedLyrics) || results[0];

    return {
      lyrics: track.syncedLyrics || track.plainLyrics,
      source: "LRClib",
      synced: !!track.syncedLyrics,
    };
  } catch (error) {
    console.error("Fetch failed or timed out:", error);
    return null;
  }
}

/**
 * Musixmatch API - Requires API key
 * Free tier limited but available
 */
async function fetchFromMusixmatch(artist, title, apiKey) {
  try {
    if (!apiKey) return null;

    const { artistClean, titleClean } = formatSearch(artist, title);

    const response = await fetch(
      `https://api.musixmatch.com/ws/1.1/matcher.lyrics.get?q_artist=${encodeURIComponent(
        artistClean
      )}&q_track=${encodeURIComponent(titleClean)}&apikey=${apiKey}`,
      { mode: "cors" }
    );

    if (!response.ok) throw new Error("Musixmatch API error");

    const data = await response.json();

    if (data.message.status === 200 && data.message.body.lyrics) {
      return {
        lyrics: data.message.body.lyrics.lyrics_body,
        source: "Musixmatch",
        synced: false,
      };
    }

    return null;
  } catch (error) {
    console.log("Musixmatch fetch failed:", error.message);
    return null;
  }
}

/**
 * Placeholder for Better Lyrics / Custom Source
 */
async function fetchCustomSource(artist, title, type) {
  if (type === "syllable") {
    return {
      lyrics:
        "[00:00.00] <00:00.01>Testing <00:00.50>the <00:01.00>syllable <00:01.50>syncing!",
      source: "Debug Source",
      synced: true,
    };
  }
  return null;
}

/**
 * Genius API - Requires API key
 * Large database but returns search results, not full lyrics
 */
async function fetchFromGenius(artist, title, accessToken) {
  try {
    if (!accessToken) return null;

    const { artistClean, titleClean } = formatSearch(artist, title);
    const query = `${titleClean} ${artistClean}`;

    const response = await fetch(
      `https://api.genius.com/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        mode: "cors",
      }
    );

    if (!response.ok) throw new Error("Genius API error");

    const data = await response.json();
    const hits = data.response.hits;

    if (!hits || hits.length === 0) return null;

    // Get the first hit's URL (user would need to visit to see full lyrics)
    const hit = hits[0];

    return {
      lyrics: `"${hit.result.title}" by ${hit.result.primary_artist.name}\n\nView full lyrics: ${hit.result.url}`,
      source: "Genius",
      synced: false,
      url: hit.result.url,
    };
  } catch (error) {
    console.log("Genius fetch failed:", error.message);
    return null;
  }
}

/**
 * YouTube Captions - Complex implementation
 * Requires video URL, uses subtitle parsing
 */
async function fetchFromYouTube(artist, title) {
  try {
    // YouTube requires finding the video first, then parsing captions
    // This is complex without a server proxy, returning null for now
    console.log("YouTube captions require server-side proxy");
    return null;
  } catch (error) {
    console.log("YouTube fetch failed:", error.message);
    return null;
  }
}

/**
 * Main lyrics fetcher with fallback logic
 * @param {string} artist - Track artist
 * @param {string} title - Track title
 * @param {Object} apiKeys - Object with keys { musixmatchKey, geniusKey }
 */
export async function fetchLyrics(artist, title, apiKeys = {}) {
  const lyricsContainer = document.getElementById("lyrics-container");

  try {
    // Inside fetchLyrics (lyrics.js)
    const result = await fetchFromLRClib(artist, title);

    if (!result) {
      // If the function returned null, it means the API search was empty or failed
      document.getElementById(
        "lyrics-container"
      ).innerHTML = `<div class="lyrics-source">Search failed for: ${title} by ${artist}</div>`;
      return null;
    }

    if (result && result.lyrics) {
      return {
        ...result,
        parsedLyrics: parseEnhancedLRC(result.lyrics),
        displayType: result.synced ? "line" : "unsynced",
      };
    } else {
      lyricsContainer.innerHTML = `<div class="lyrics-source">No lyrics found for: ${title}</div>`;
      return null;
    }
  } catch (e) {
    // THIS WILL SHOW US THE ACTUAL ERROR ON SCREEN
    lyricsContainer.innerHTML = `
      <div class="lyrics-source" style="color: #ff5555;">
        <strong>Fetch Error:</strong><br>
        ${e.message}<br><br>
        <small>Try checking if the proxy URL is correct.</small>
      </div>`;
    console.error("Lyrics Fetch Error:", e);
    return null;
  }
}

/**
 * Parse LRC format lyrics to plain text or timestamped format
 * @param {string} lrcText - LRC format lyrics
 * @returns {string} Formatted lyrics
 */
export function parseLRCLyrics(lrcText) {
  if (!lrcText) return "";

  // Remove LRC timestamps [MM:SS.XX]
  return lrcText
    .split("\n")
    .map((line) => line.replace(/^\[\d{2}:\d{2}.\d{2}\]\s*/g, "").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Clean and format lyrics for display
 * @param {string} lyrics - Raw lyrics text
 * @returns {string} Formatted lyrics
 */
export function formatLyrics(lyrics) {
  if (!lyrics) return "";

  return (
    lyrics
      // Remove excessive whitespace
      .replace(/\n\n\n+/g, "\n\n")
      // Trim each line
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim()
  );
}

/**
 * Truncate lyrics for display with max lines
 * @param {string} lyrics - Lyrics text
 * @param {number} maxLines - Maximum lines to display
 * @returns {string} Truncated lyrics
 */
export function truncateLyrics(lyrics, maxLines = 20) {
  if (!lyrics) return "";

  const lines = lyrics.split("\n");
  if (lines.length <= maxLines) return lyrics;

  return lines.slice(0, maxLines).join("\n") + "\n\n[...]";
}
