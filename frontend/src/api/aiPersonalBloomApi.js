import { supabase } from '../auth/supabaseClient';

/**
 * Calls the Supabase Edge Function to generate Bloom activities for one personal glossary term.
 * The OpenAI API key is never exposed to the frontend — it lives only in the Edge Function.
 *
 * Returns: { activities: [{ bloom_level, prompt, expected_answer }], ai_model }
 */
export async function generatePersonalBloomActivitiesWithAI({
  studentGlossaryTermId,
  selectedText,
  definition,
  definitionSource,
  contextSentence,
  readingTitle,
  readingExcerpt,
  selectedLevels,
}) {
  const { data, error } = await supabase.functions.invoke(
    'generate-personal-bloom-activities',
    {
      body: {
        studentGlossaryTermId,
        selectedText,
        definition:       definition       ?? null,
        definitionSource: definitionSource ?? null,
        contextSentence:  contextSentence  ?? null,
        readingTitle,
        readingExcerpt:   readingExcerpt   ?? null,
        selectedLevels:   selectedLevels   ?? [],
      },
    }
  );

  if (error) throw new Error(error.message || 'Edge Function error');

  if (data?.error) throw new Error(data.error);

  if (!data?.activities || !Array.isArray(data.activities)) {
    throw new Error('Unexpected response format from AI service');
  }

  return {
    activities: data.activities,
    aiModel:    data.ai_model ?? null,
  };
}
