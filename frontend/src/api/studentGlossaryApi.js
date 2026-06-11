import { supabase } from '../auth/supabaseClient';

function mapTerm(row) {
  return {
    id:                        row.result_id,
    student_id:                row.result_student_id,
    reading_id:                row.result_reading_id,
    linked_glossary_term_id:   row.result_linked_glossary_term_id,
    selected_text:             row.result_selected_text,
    normalized_term:           row.result_normalized_term,
    definition:                row.result_definition,
    example_sentence:          row.result_example_sentence,
    context_sentence:          row.result_context_sentence,
    student_note:              row.result_student_note,
    is_mastered:               row.result_is_mastered,
    definition_source:         row.result_definition_source ?? 'manual_pending',
    dictionary_word:           row.result_dictionary_word ?? null,
    dictionary_part_of_speech: row.result_dictionary_part_of_speech ?? null,
    spanish_translation:       row.result_spanish_translation ?? null,
    translation_source:        row.result_translation_source ?? 'manual_pending',
    translation_confidence:    row.result_translation_confidence ?? 0,
    created_at:                row.result_created_at,
    updated_at:                row.result_updated_at,
  };
}

export async function getMyPersonalGlossaryForReading(readingId) {
  const { data, error } = await supabase.rpc('get_my_personal_glossary_for_reading', {
    p_reading_id: readingId,
  });
  if (error) throw new Error(error.message);
  return (data || []).map(mapTerm);
}

export async function previewSelectedTermForReading({ readingId, selectedText, contextSentence }) {
  const { data, error } = await supabase.rpc('preview_selected_term_for_reading', {
    p_reading_id:       readingId,
    p_selected_text:    selectedText,
    p_context_sentence: contextSentence,
  });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;

  const row = data[0];
  return {
    selected_text:           row.result_selected_text,
    normalized_term:         row.result_normalized_term,
    linked_glossary_term_id: row.result_linked_glossary_term_id,
    definition:              row.result_definition,
    example_sentence:        row.result_example_sentence,
    context_sentence:        row.result_context_sentence,
    source_type:             row.result_source_type,
  };
}

export async function addSelectedTermToMyGlossary({
  readingId,
  selectedText,
  contextSentence,
  definition             = null,
  definitionSource       = 'manual_pending',
  dictionaryWord         = null,
  dictionaryPartOfSpeech = null,
  spanishTranslation     = null,
  translationSource      = 'manual_pending',
  translationConfidence  = 0,
}) {
  const { data, error } = await supabase.rpc('add_selected_term_to_my_glossary', {
    p_reading_id:                readingId,
    p_selected_text:             selectedText,
    p_context_sentence:          contextSentence,
    p_definition:                definition,
    p_definition_source:         definitionSource,
    p_dictionary_word:           dictionaryWord,
    p_dictionary_part_of_speech: dictionaryPartOfSpeech,
    p_spanish_translation:       spanishTranslation,
    p_translation_source:        translationSource,
    p_translation_confidence:    translationConfidence,
  });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('No data returned from add operation.');
  return mapTerm(data[0]);
}

export async function updateMyPersonalGlossaryTerm({ termId, studentNote, isMastered }) {
  const { data, error } = await supabase.rpc('update_my_personal_glossary_term', {
    p_term_id:      termId,
    p_student_note: studentNote ?? null,
    p_is_mastered:  isMastered,
  });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('No data returned from update operation.');

  const row = data[0];
  return {
    id:           row.result_id,
    student_note: row.result_student_note,
    is_mastered:  row.result_is_mastered,
    updated_at:   row.result_updated_at,
  };
}

export async function deleteMyPersonalGlossaryTerm(termId) {
  const { error } = await supabase.rpc('delete_my_personal_glossary_term', {
    p_term_id: termId,
  });
  if (error) throw new Error(error.message);
  return true;
}
