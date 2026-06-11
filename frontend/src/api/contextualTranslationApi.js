import { supabase } from '../auth/supabaseClient';

// Returns:
//   { found: true,  translation, source: 'api', confidence: 85 }
//   { found: false, translation: null, source: 'manual_pending', confidence: 0 }
export async function getContextAwareSpanishTranslation(selectedText, contextSentence) {
  if (!selectedText || !selectedText.trim()) {
    return { found: false, translation: null, source: 'manual_pending', confidence: 0 };
  }

  try {
    const { data, error } = await supabase.functions.invoke('translate-term', {
      body: {
        selectedText:    selectedText.trim(),
        contextSentence: contextSentence ?? null,
      },
    });

    if (error || !data?.found) {
      return { found: false, translation: null, source: 'manual_pending', confidence: 0 };
    }

    return {
      found:       true,
      translation: data.translation,
      source:      'api',
      confidence:  85,
    };
  } catch {
    return { found: false, translation: null, source: 'manual_pending', confidence: 0 };
  }
}
