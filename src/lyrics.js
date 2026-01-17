/**
 * Lyrics Fetcher - Enhanced version with precise timing synchronization
 * Priority: Better Lyrics > Musixmatch > LRClib > Genius
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
 * Parses synced lyrics with timestamps into array with duration calculations
 * Returns array: [{text, startTime, duration, endTime}, ...]
 */
export function parseEnhancedLRC(lrcContent) {
  if (!lrcContent) return [];

  const lines = lrcContent.split("\n");
  const lyricsArray = [];
  const timeRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)$/;

  // First pass: extract all lines with timestamps
  for (let line of lines) {
    const match = line.match(timeRegex);
    if (!match) continue;

    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    const milliseconds = parseInt(match[3]);
    const startTime = minutes * 60 + seconds + milliseconds / 1000;
    const text = match[4].trim();

    if (text) {
      lyricsArray.push({
        text,
        startTime,
        duration: 0, // Will be calculated
        endTime: 0,
      });
    }
  }

  // Second pass: calculate durations
  for (let i = 0; i < lyricsArray.length; i++) {
    if (i < lyricsArray.length - 1) {
      lyricsArray[i].duration =
        lyricsArray[i + 1].startTime - lyricsArray[i].startTime;
      lyricsArray[i].endTime = lyricsArray[i + 1].startTime;
    } else {
      // Last lyric: estimate duration (assume ~3 seconds)
      lyricsArray[i].duration = 3;
      lyricsArray[i].endTime = lyricsArray[i].startTime + 3;
    }
  }

  // Third pass: fill gaps with silence markers
  const filledArray = [];
  for (let i = 0; i < lyricsArray.length; i++) {
    const current = lyricsArray[i];

    // Check if there's a gap before this lyric
    if (i === 0 && current.startTime > 0.5) {
      // Gap at the beginning
      filledArray.push({
        text: "-",
        startTime: 0,
        duration: current.startTime,
        endTime: current.startTime,
        isGap: true,
      });
    } else if (i > 0) {
      const prev = lyricsArray[i - 1];
      if (current.startTime - prev.endTime > 0.5) {
        // Gap between lyrics
        filledArray.push({
          text: "-",
          startTime: prev.endTime,
          duration: current.startTime - prev.endTime,
          endTime: current.startTime,
          isGap: true,
        });
      }
    }

    filledArray.push(current);
  }

  return filledArray;
}

/**
 * Updates the lyrics container with YouTube Music-style display
 * Uses precise timing to highlight current lyric
 */
export function updateLyricsSync(currentTime, state) {
  const container = document.getElementById("lyrics-container");
  if (!state.currentLyrics || !container || state.currentLyrics.length === 0)
    return;

  // Find which lyric is currently playing
  let activeIndex = 0;
  for (let i = 0; i < state.currentLyrics.length; i++) {
    if (
      currentTime >= state.currentLyrics[i].startTime &&
      currentTime < state.currentLyrics[i].endTime
    ) {
      activeIndex = i;
      break;
    }
  }

  const titleElement = document.getElementById("track-title");
  const titleColor =
    window.getComputedStyle(titleElement).color || "rgb(255, 255, 255)";

  let html = `<div class="lyrics-source">From: ${state.lyricsSource}</div>`;

  // Show current lyric and upcoming lyrics
  for (
    let i = activeIndex;
    i < Math.min(activeIndex + 10, state.currentLyrics.length);
    i++
  ) {
    const lyric = state.currentLyrics[i];
    const isActive = i === activeIndex;

    const textColor = isActive ? titleColor : "rgba(255,255,255,0.5)";
    const fontWeight = isActive ? "700" : "500";
    const displayText = lyric.text || "-";

    html += `<div class="lyrics-line ${isActive ? "active-line" : ""}" style="
      color: ${textColor};
      font-weight: ${fontWeight};
      opacity: ${isActive ? "1" : "0.6"};
    ">${displayText}</div>`;
  }

  container.innerHTML = html;

  // Auto-scroll to active line
  setTimeout(() => {
    const activeElements = container.querySelectorAll(".active-line");
    if (activeElements.length > 0) {
      const activeElement = activeElements[0];
      const containerRect = container.getBoundingClientRect();
      const elementRect = activeElement.getBoundingClientRect();

      if (
        elementRect.top < containerRect.top ||
        elementRect.bottom > containerRect.bottom
      ) {
        activeElement.scrollIntoView({ behavior: "auto", block: "center" });
      }
    }
  }, 0);
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

      if (!response.ok) throw new Error("Failed");

      const data = await response.json();
      if (!data.tracks || data.tracks.length === 0) return null;

      const track = data.tracks[0];
      if (!track.syncedLyrics) return null;

      return {
        lyrics: track.syncedLyrics,
        source: "Better Lyrics",
        synced: true,
      };
    } catch (e) {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
        url
      )}`;
      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) return null;

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
      };
    }
  } catch (error) {
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
    if (!apiKey) return null;

    const { artistClean, titleClean } = formatSearch(artist, title);

    const response = await fetch(
      `https://api.musixmatch.com/ws/1.1/matcher.lyrics.get?q_artist=${encodeURIComponent(
        artistClean
      )}&q_track=${encodeURIComponent(titleClean)}&apikey=${apiKey}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!response.ok) return null;

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
    return null;
  }
}

/**
 * LRClib API - No auth required, best reliability
 */
async function fetchFromLRClib(artist, title) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const { artistClean, titleClean } = formatSearch(artist, title);

    const queries = [
      `https://lrclib.net/api/search?artist=${encodeURIComponent(
        artistClean
      )}&track=${encodeURIComponent(titleClean)}`,
      `https://lrclib.net/api/search?q=${encodeURIComponent(
        `${artistClean} ${titleClean}`
      )}`,
    ];

    for (let apiUrl of queries) {
      try {
        let response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          mode: "cors",
        });

        if (!response.ok) {
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
            apiUrl
          )}`;
          response = await fetch(proxyUrl, { signal: controller.signal });

          if (!response.ok) continue;

          const proxyData = await response.json();
          if (!proxyData.contents) continue;

          const results = JSON.parse(proxyData.contents);

          if (!results || results.length === 0) continue;

          const track = results.find((t) => t.syncedLyrics) || results[0];

          if (!track.syncedLyrics && !track.plainLyrics) continue;

          clearTimeout(timeoutId);
          return {
            lyrics: track.syncedLyrics || track.plainLyrics,
            source: "LRClib",
            synced: !!track.syncedLyrics,
          };
        }

        clearTimeout(timeoutId);
        const results = await response.json();

        if (!results || results.length === 0) continue;

        const track = results.find((t) => t.syncedLyrics) || results[0];

        if (!track.syncedLyrics && !track.plainLyrics) continue;

        return {
          lyrics: track.syncedLyrics || track.plainLyrics,
          source: "LRClib",
          synced: !!track.syncedLyrics,
        };
      } catch (e) {
        continue;
      }
    }

    return null;
  } catch (error) {
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
    if (!accessToken) return null;

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

    if (!response.ok) return null;

    const data = await response.json();
    const hits = data.response.hits;

    if (!hits || hits.length === 0) return null;

    const hit = hits[0];

    return {
      lyrics: `"${hit.result.title}" by ${hit.result.primary_artist.name}\n\nView full lyrics: ${hit.result.url}`,
      source: "Genius",
      synced: false,
      url: hit.result.url,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Main lyrics fetcher with priority-based fallback
 */
export async function fetchLyrics(artist, title, apiKeys = {}) {
  try {
    // Priority 1: Better Lyrics (highest quality syncing)
    let result = await fetchFromBetterLyrics(artist, title);
    if (result && result.lyrics) {
      const parsed = parseEnhancedLRC(result.lyrics);
      if (parsed && parsed.length > 0) {
        return {
          ...result,
          parsedLyrics: parsed,
        };
      }
    }

    // Priority 2: Musixmatch
    result = await fetchFromMusixmatch(artist, title, apiKeys.musixmatchKey);
    if (result && result.lyrics) {
      const parsed = parseEnhancedLRC(result.lyrics);
      if (parsed && parsed.length > 0) {
        return {
          ...result,
          parsedLyrics: parsed,
        };
      }
    }

    // Priority 3: LRClib (best reliability)
    result = await fetchFromLRClib(artist, title);
    if (result && result.lyrics) {
      const parsed = parseEnhancedLRC(result.lyrics);
      if (parsed && parsed.length > 0) {
        return {
          ...result,
          parsedLyrics: parsed,
        };
      }
    }

    // Priority 4: Genius
    result = await fetchFromGenius(artist, title, apiKeys.geniusKey);
    if (result && result.lyrics) {
      const parsed = parseEnhancedLRC(result.lyrics);
      if (parsed && parsed.length > 0) {
        return {
          ...result,
          parsedLyrics: parsed,
        };
      }
    }

    return null;
  } catch (e) {
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
