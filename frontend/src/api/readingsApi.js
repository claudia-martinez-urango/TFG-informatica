import { supabase } from "../auth/supabaseClient";

const READING_SELECT =
  "id, section_id, title, content, is_visible_to_students, created_at, updated_at";

export async function getSectionReadings(sectionId) {
  const { data, error } = await supabase.rpc("get_section_readings", {
    p_section_id: sectionId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((reading) => ({
    id: reading.result_reading_id,
    section_id: reading.result_section_id,
    title: reading.result_title,
    content: reading.result_content,
    is_visible_to_students: reading.result_is_visible_to_students,
    created_at: reading.result_created_at,
    updated_at: reading.result_updated_at,
  }));
}

export async function createReading({ sectionId, title, content }) {
  const { data, error } = await supabase
    .from("readings")
    .insert({
      section_id: sectionId,
      title,
      content,
      is_visible_to_students: false,
    })
    .select(READING_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateReading({ readingId, title, content }) {
  const { data, error } = await supabase
    .from("readings")
    .update({
      title,
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", readingId)
    .select(READING_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateReadingVisibility({
  readingId,
  isVisibleToStudents,
}) {
  const { data, error } = await supabase
    .from("readings")
    .update({
      is_visible_to_students: isVisibleToStudents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", readingId)
    .select(READING_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateReadingTranslation({ readingId, isTranslationEnabled }) {
  const { error } = await supabase
    .from('readings')
    .update({
      is_translation_enabled: isTranslationEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', readingId);

  if (error) throw new Error(error.message);
  return true;
}

export async function deleteReading(readingId) {
  const { error } = await supabase
    .from("readings")
    .delete()
    .eq("id", readingId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}