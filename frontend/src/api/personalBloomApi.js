import { supabase } from '../auth/supabaseClient';

function mapActivity(row) {
  return {
    id:                       row.result_id,
    student_glossary_term_id: row.result_student_glossary_term_id,
    student_id:               row.result_student_id,
    bloom_level:              row.result_bloom_level,
    prompt:                   row.result_prompt,
    expected_answer:          row.result_expected_answer ?? null,
    activity_source:          row.result_activity_source,
    ai_model:                 row.result_ai_model ?? null,
    created_at:               row.result_created_at,
    updated_at:               row.result_updated_at,
  };
}

function mapResponse(row) {
  return {
    id:                        row.result_id,
    student_bloom_activity_id: row.result_student_bloom_activity_id,
    student_id:                row.result_student_id,
    answer:                    row.result_answer,
    submitted_at:              row.result_submitted_at,
    updated_at:                row.result_updated_at,
  };
}

export async function getMyStudentBloomActivities(studentGlossaryTermId) {
  const { data, error } = await supabase.rpc('get_my_student_bloom_activities', {
    p_student_glossary_term_id: studentGlossaryTermId,
  });
  if (error) throw new Error(error.message);
  return (data || []).map(mapActivity);
}

export async function saveAIGeneratedStudentBloomActivities({
  studentGlossaryTermId,
  activities,
  aiModel = null,
}) {
  const { data, error } = await supabase.rpc(
    'save_ai_generated_student_bloom_activities',
    {
      p_student_glossary_term_id: studentGlossaryTermId,
      p_activities:               activities,
      p_ai_model:                 aiModel,
    }
  );
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getMyStudentBloomActivityResponse(activityId) {
  const { data, error } = await supabase.rpc(
    'get_my_student_bloom_activity_response',
    { p_activity_id: activityId }
  );
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  return mapResponse(data[0]);
}

export async function saveMyStudentBloomActivityResponse({ activityId, answer }) {
  const { data, error } = await supabase.rpc(
    'save_my_student_bloom_activity_response',
    {
      p_activity_id: activityId,
      p_answer:      answer,
    }
  );
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('No data returned from save operation.');
  return mapResponse(data[0]);
}
