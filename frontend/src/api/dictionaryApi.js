// Free Dictionary API — https://api.dictionaryapi.dev
// No API key required. English only. Single words only.
// Structured so this module can later be moved to a Supabase Edge Function
// without changing the call signature.

// Returns the normalized, lowercase single word to query,
// or null if the input is multi-word or empty.
export function normalizeDictionaryLookupTerm(text) {
  if (!text) return null;
  const cleaned = text.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase();
  if (!cleaned) return null;
  if (/\s/.test(cleaned)) return null;
  return cleaned;
}

// Returns:
//   { found: true, word, definition, partOfSpeech, example }
//   { found: false }
export async function fetchDictionaryDefinition(term) {
  const word = normalizeDictionaryLookupTerm(term);
  if (!word) return { found: false };

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { found: false };

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return { found: false };

    const entry   = data[0];
    const meaning = entry.meanings?.[0];
    const defObj  = meaning?.definitions?.[0];

    if (!defObj?.definition) return { found: false };

    return {
      found:        true,
      word:         entry.word ?? word,
      definition:   defObj.definition,
      partOfSpeech: meaning?.partOfSpeech ?? null,
      example:      defObj.example ?? null,
    };
  } catch {
    return { found: false };
  }
}

// Wiktionary Definition API — free, no API key, covers single words AND multi-word expressions.
// Uses /page/definition/ (not /page/summary/ which is designed for Wikipedia articles
// and returns empty content for most Wiktionary entries).
// Returns:
//   { found: true, word, definition, partOfSpeech, example }
//   { found: false }
export async function fetchWiktionaryDefinition(term) {
  if (!term || !term.trim()) return { found: false };

  // Wiktionary requires underscores instead of spaces in the URL slug
  const slug = term.trim().toLowerCase().replace(/\s+/g, '_');

  // Helper: strip HTML tags that Wiktionary includes in definition strings
  const stripHtml = (str) => str?.replace(/<[^>]+>/g, '').trim() ?? null;

  try {
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(slug)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { found: false };

    const data = await res.json();

    // Response is keyed by language code; we want the English section
    const english = data?.en;
    if (!Array.isArray(english) || english.length === 0) return { found: false };

    const entry  = english[0];
    const defObj = entry?.definitions?.[0];
    if (!defObj?.definition) return { found: false };

    const definition = stripHtml(defObj.definition);
    if (!definition) return { found: false };

    const example = stripHtml(defObj.parsedExamples?.[0]?.example) || null;

    return {
      found:        true,
      word:         term,
      definition,
      partOfSpeech: entry.partOfSpeech ?? null,
      example,
    };
  } catch {
    return { found: false };
  }
}
