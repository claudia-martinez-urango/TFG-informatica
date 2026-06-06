import { supabase } from "../auth/supabaseClient";

const TERM_SELECT =
  "id, reading_id, term, definition, example_sentence, context_sentence, is_visible_to_students, created_at, updated_at";

export async function getReadingGlossaryTerms(readingId) {
  const { data, error } = await supabase.rpc("get_reading_glossary_terms", {
    p_reading_id: readingId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row) => ({
    id: row.result_id,
    reading_id: row.result_reading_id,
    term: row.result_term,
    definition: row.result_definition,
    example_sentence: row.result_example_sentence,
    context_sentence: row.result_context_sentence,
    is_visible_to_students: row.result_is_visible_to_students,
    created_at: row.result_created_at,
    updated_at: row.result_updated_at,
  }));
}

export async function createGlossaryTerm({
  readingId,
  term,
  definition,
  exampleSentence,
  contextSentence,
}) {
  const { data, error } = await supabase
    .from("glossary_terms")
    .insert({
      reading_id: readingId,
      term,
      definition,
      example_sentence: exampleSentence || null,
      context_sentence: contextSentence || null,
      is_visible_to_students: false,
    })
    .select(TERM_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateGlossaryTerm({
  termId,
  term,
  definition,
  exampleSentence,
  contextSentence,
}) {
  const { data, error } = await supabase
    .from("glossary_terms")
    .update({
      term,
      definition,
      example_sentence: exampleSentence || null,
      context_sentence: contextSentence || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", termId)
    .select(TERM_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateGlossaryTermVisibility({ termId, isVisibleToStudents }) {
  const { data, error } = await supabase
    .from("glossary_terms")
    .update({
      is_visible_to_students: isVisibleToStudents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", termId)
    .select(TERM_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteGlossaryTerm(termId) {
  const { error } = await supabase
    .from("glossary_terms")
    .delete()
    .eq("id", termId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function bulkCreateGlossaryTerms(readingId, terms) {
  const rows = terms.map((t) => ({
    reading_id: readingId,
    term: t.term,
    definition: t.definition,
    example_sentence: t.exampleSentence || null,
    context_sentence: t.contextSentence || null,
    is_visible_to_students: false,
  }));

  const { data, error } = await supabase
    .from("glossary_terms")
    .insert(rows)
    .select(TERM_SELECT);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
