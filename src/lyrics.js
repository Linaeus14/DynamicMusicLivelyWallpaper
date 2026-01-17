/**
 * Lyrics Fetcher - Fixed with Better Priority System & Debug Display
 * Priority: Better Lyrics (syllable) > Musixmatch (word) > YouTube > LRClib (line) > Genius (line)
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
 * Display debug message in lyrics container (appends to existing)
 */
function displayDebug(message) {
  const container = document.getElementById("lyrics-container");
  if (container) {
    const existing = container.innerHTML;
    const newMessage = `<div class="lyrics-source" style="white-space: pre-wrap; font-size: 0.8em; color: #aaa; margin-bottom: 0.5em;">${message}</div>`;
    container.innerHTML = existing + newMessage;
    container.scrollTop = container.scrollHeight; // Auto-scroll to bottom
  }
}

/**
 * Parses LRC and Enhanced LRC (syllable-based) formats
 */
export function parseEnhancedLRC(lrcContent) {
  if (!lrcContent) return [];

  const lines = lrcContent.split("\n");
  const lyricsArray = [];

  const lineTimeRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  const wordTimeRegex = /<(\d{2}):(\d{2})\.(\d{2,3})>/g;

  for (let line of lines) {
    const match = line.match(lineTimeRegex);
    if (!match) continue;

    const startTime =
      parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 100;
    let text = line.replace(lineTimeRegex, "").trim();

    const words = [];
    let cleanLineText = text.replace(/<[^>]+>/g, "");

    // Check for syllable/word timing
    if (wordTimeRegex.test(text)) {
      wordTimeRegex.lastIndex = 0; // Reset regex
      const parts = text.split(/(<[^>]+>)/).filter(Boolean);
      let currentTime = startTime;

      parts.forEach((part) => {
        const wordMatch = part.match(/<(\d{2}):(\d{2})\.(\d{2,3})>/);
        if (wordMatch) {
          currentTime =
            parseInt(wordMatch[1]) * 60 +
            parseInt(wordMatch[2]) +
            parseInt(wordMatch[3]) / 100;
        } else if (part.trim()) {
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
      words: words.length > 0 ? words : null,
    });
  }

  return lyricsArray.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Updates the lyrics container based on current playback time
 */
export function updateLyricsSync(currentTime, state) {
  const container = document.getElementById("lyrics-container");
  if (!state.currentLyrics || !container) return;

  const activeLine = [...state.currentLyrics]
    .reverse()
    .find((l) => currentTime >= l.startTime);

  if (!activeLine) return;

  let html = `<div class="lyrics-source">From: ${state.lyricsSource}</div>`;

  if (
    (state.lyricsType === "syllable" || state.lyricsType === "word") &&
    activeLine.words
  ) {
    html += `<div class="active-line">`;
    activeLine.words.forEach((word) => {
      const isPast = currentTime >= word.time;
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
    html += `<div class="active-line" style="color: white;">${activeLine.text}</div>`;
  }

  container.innerHTML = html;
  const activeElement = container.querySelector(".active-line");
  if (activeElement) {
    activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/**
 * Better Lyrics API - Syllable/Word level support
 */
async function fetchFromBetterLyrics(artist, title) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const { artistClean, titleClean } = formatSearch(artist, title);
    const url = `https://api.betterlyrics.com/search?q=${encodeURIComponent(
      `${artistClean} ${titleClean}`
    )}`;

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (!data.tracks || data.tracks.length === 0) return null;

      const track = data.tracks[0];
      if (!track.syncedLyrics) return null;

      return {
        lyrics: track.syncedLyrics,
        source: "Better Lyrics",
        synced: true,
        type: "syllable",
      };
    } catch (e) {
      // Try with proxy
      displayDebug(`Better Lyrics: Direct failed, trying proxy...`);
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
        url
      )}`;
      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);

      const proxyData = await response.json();
      if (!proxyData.contents) return null;

      const data = JSON.parse(proxyData.contents);
      if (!data.tracks || data.tracks.length === 0) return null;

      const track = data.tracks[0];
      if (!track.syncedLyrics) return null;

      return {
        lyrics: track.syncedLyrics,
        source: "Better Lyrics",
        synced: true,
        type: "syllable",
      };
    }
  } catch (error) {
    displayDebug(`Better Lyrics: ${error.message}`);
    return null;
  }
}

/**
 * Musixmatch API - Word level support
 */
async function fetchFromMusixmatch(artist, title, apiKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    if (!apiKey) {
      displayDebug(`Musixmatch: No API key provided`);
      return null;
    }

    const { artistClean, titleClean } = formatSearch(artist, title);

    const response = await fetch(
      `https://api.musixmatch.com/ws/1.1/matcher.lyrics.get?q_artist=${encodeURIComponent(
        artistClean
      )}&q_track=${encodeURIComponent(titleClean)}&apikey=${apiKey}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (data.message.status === 200 && data.message.body.lyrics) {
      return {
        lyrics: data.message.body.lyrics.lyrics_body,
        source: "Musixmatch",
        synced: false,
        type: "word",
      };
    }

    displayDebug(`Musixmatch: Status ${data.message.status}`);
    return null;
  } catch (error) {
    displayDebug(`Musixmatch: ${error.message}`);
    return null;
  }
}

/**
 * YouTube Captions
 */
async function fetchFromYouTube(artist, title) {
  displayDebug(`YouTube: Not implemented`);
  return null;
}

/**
 * LRClib API - No auth required, best reliability
 */
async function fetchFromLRClib(artist, title) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const { artistClean, titleClean } = formatSearch(artist, title);

    // Try different query formats
    const queries = [
      // Format 1: artist and track params
      `https://lrclib.net/api/search?artist=${encodeURIComponent(
        artistClean
      )}&track=${encodeURIComponent(titleClean)}`,
      // Format 2: combined query
      `https://lrclib.net/api/search?q=${encodeURIComponent(
        `${artistClean} ${titleClean}`
      )}`,
    ];

    for (let apiUrl of queries) {
      try {
        displayDebug(`LRClib: Trying ${apiUrl.substring(0, 50)}...`);

        let response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          mode: "cors",
        });

        if (!response.ok) {
          // Try with proxy
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
            apiUrl
          )}`;
          response = await fetch(proxyUrl, {
            signal: controller.signal,
          });

          if (!response.ok) continue;

          const proxyData = await response.json();
          if (!proxyData.contents) continue;

          const results = JSON.parse(proxyData.contents);

          if (!results || results.length === 0) continue;

          const track = results.find((t) => t.syncedLyrics) || results[0];

          if (!track.syncedLyrics && !track.plainLyrics) continue;

          displayDebug(`LRClib: ✓ Found ${results.length} result(s)`);

          return {
            lyrics: track.syncedLyrics || track.plainLyrics,
            source: "LRClib",
            synced: !!track.syncedLyrics,
            type: "line",
          };
        }

        clearTimeout(timeoutId);
        const results = await response.json();

        if (!results || results.length === 0) continue;

        const track = results.find((t) => t.syncedLyrics) || results[0];

        if (!track.syncedLyrics && !track.plainLyrics) continue;

        displayDebug(`LRClib: ✓ Found ${results.length} result(s)`);

        return {
          lyrics: track.syncedLyrics || track.plainLyrics,
          source: "LRClib",
          synced: !!track.syncedLyrics,
          type: "line",
        };
      } catch (e) {
        displayDebug(`LRClib: Format failed, trying next...`);
        continue;
      }
    }

    displayDebug(`LRClib: ✗ All formats exhausted`);
    return null;
  } catch (error) {
    displayDebug(`LRClib: ${error.message}`);
    return null;
  }
}

/**
 * Genius API
 */
async function fetchFromGenius(artist, title, accessToken) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    if (!accessToken) {
      displayDebug(`Genius: No API token provided`);
      return null;
    }

    const { artistClean, titleClean } = formatSearch(artist, title);
    const query = `${titleClean} ${artistClean}`;

    const response = await fetch(
      `https://api.genius.com/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const hits = data.response.hits;

    if (!hits || hits.length === 0) {
      displayDebug(`Genius: No hits found`);
      return null;
    }

    const hit = hits[0];

    return {
      lyrics: `"${hit.result.title}" by ${hit.result.primary_artist.name}\n\nView full lyrics: ${hit.result.url}`,
      source: "Genius",
      synced: false,
      type: "line",
      url: hit.result.url,
    };
  } catch (error) {
    displayDebug(`Genius: ${error.message}`);
    return null;
  }
}

export async function fetchLyrics(artist, title, apiKeys = {}) {
  try {
    const container = document.getElementById("lyrics-container");
    container.innerHTML = `<div class="lyrics-source" style="white-space: pre-wrap; font-size: 0.8em; color: #aaa;">Searching: ${artist} - ${title}\n\nTrying sources...</div>`;

    // Priority 1: Better Lyrics (syllable support)
    let result = await fetchFromBetterLyrics(artist, title);
    if (result && result.lyrics) {
      const parsed = parseEnhancedLRC(result.lyrics);
      if (parsed && parsed.length > 0) {
        displayDebug(`✓ Better Lyrics (${parsed.length} lines)`);
        return {
          ...result,
          parsedLyrics: parsed,
          displayType: result.type,
        };
      }
    }

    // Priority 2: Musixmatch (word support)
    result = await fetchFromMusixmatch(artist, title, apiKeys.musixmatchKey);
    if (result && result.lyrics) {
      const parsed = parseEnhancedLRC(result.lyrics);
      if (parsed && parsed.length > 0) {
        displayDebug(`✓ Musixmatch (${parsed.length} lines)`);
        return {
          ...result,
          parsedLyrics: parsed,
          displayType: result.type,
        };
      }
    }

    // Priority 3: LRClib (line sync, no auth) - moved up since YouTube not implemented
    result = await fetchFromLRClib(artist, title);
    if (result && result.lyrics) {
      const parsed = parseEnhancedLRC(result.lyrics);
      if (parsed && parsed.length > 0) {
        displayDebug(`✓ LRClib (${parsed.length} lines)`);
        return {
          ...result,
          parsedLyrics: parsed,
          displayType: result.type,
        };
      }
    }

    // Priority 4: Genius (line sync, requires key)
    result = await fetchFromGenius(artist, title, apiKeys.geniusKey);
    if (result && result.lyrics) {
      const parsed = parseEnhancedLRC(result.lyrics);
      if (parsed && parsed.length > 0) {
        displayDebug(`✓ Genius (${parsed.length} lines)`);
        return {
          ...result,
          parsedLyrics: parsed,
          displayType: result.type,
        };
      }
    }

    // No lyrics found anywhere
    displayDebug(`✗ No lyrics found - Tried all sources`);
    return null;
  } catch (e) {
    displayDebug(`✗ Error: ${e.message}`);
    return null;
  }
}

/**
 * Parse LRC format lyrics to plain text
 */
export function parseLRCLyrics(lrcText) {
  if (!lrcText) return "";

  return lrcText
    .split("\n")
    .map((line) => line.replace(/^\[\d{2}:\d{2}.\d{2}\]\s*/g, "").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Clean and format lyrics for display
 */
export function formatLyrics(lyrics) {
  if (!lyrics) return "";

  return lyrics
    .replace(/\n\n\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * Truncate lyrics for display
 */
export function truncateLyrics(lyrics, maxLines = 20) {
  if (!lyrics) return "";

  const lines = lyrics.split("\n");
  if (lines.length <= maxLines) return lyrics;

  return lines.slice(0, maxLines).join("\n") + "\n\n[...]";
}
