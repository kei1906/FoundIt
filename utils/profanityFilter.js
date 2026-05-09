// utils/profanityFilter.js
// Loads the profanity word list once and checks text for inappropriate content.
// Uses word-boundary matching to avoid false positives (e.g., "class" matching "ass").

let cachedWords = null;

/**
 * Loads and caches the profanity word list from /profanity-list.json.
 * @returns {Promise<string[]>} Array of blocked words
 */
export async function loadProfanityList() {
  if (cachedWords) return cachedWords;
  try {
    const res = await fetch("/profanity-list.json");
    const data = await res.json();
    cachedWords = (data.words || []).map((w) => w.toLowerCase());
    return cachedWords;
  } catch (err) {
    console.error("Failed to load profanity list:", err);
    return [];
  }
}

/**
 * Checks if the given text contains any profane words.
 * Uses word-boundary regex to avoid partial matches.
 *
 * @param {string} text - The message text to check
 * @returns {Promise<{ isClean: boolean, flaggedWord: string | null }>}
 */
export async function containsProfanity(text) {
  const words = await loadProfanityList();
  if (!words.length) return { isClean: true, flaggedWord: null };

  const normalized = text.toLowerCase();

  for (const word of words) {
    // Use word boundary regex — handles spaces, punctuation, start/end of string
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(normalized)) {
      return { isClean: false, flaggedWord: word };
    }
  }

  return { isClean: true, flaggedWord: null };
}
