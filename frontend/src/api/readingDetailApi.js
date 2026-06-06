import { supabase } from '../auth/supabaseClient';

export async function getReadingDetail(readingId) {
  const { data, error } = await supabase.rpc('get_reading_detail', {
    p_reading_id: readingId,
  });

  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Reading not found.');

  const row = data[0];
  return {
    reading_id:                        row.result_reading_id,
    title:                             row.result_title,
    content:                           row.result_content,
    is_visible_to_students:            row.result_is_visible_to_students,
    section_id:                        row.result_section_id,
    section_name:                      row.result_section_name,
    section_is_visible_to_students:    row.result_section_is_visible_to_students,
    folder_id:                         row.result_folder_id,
    folder_name:                       row.result_folder_name,
    folder_is_visible_to_students:     row.result_folder_is_visible_to_students,
    organization_id:                   row.result_organization_id,
    organization_name:                 row.result_organization_name,
  };
}