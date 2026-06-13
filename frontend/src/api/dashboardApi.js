import { supabase } from '../auth/supabaseClient';

// ── Mappers ───────────────────────────────────────────────────

function mapTeacherOverview(row) {
  return {
    total_folders:                Number(row.total_folders),
    visible_folders:              Number(row.visible_folders),
    hidden_folders:               Number(row.hidden_folders),
    total_students:               Number(row.total_students),
    pending_join_requests:        Number(row.pending_join_requests),
    total_sections:               Number(row.total_sections),
    total_readings:               Number(row.total_readings),
    published_readings:           Number(row.published_readings),
    total_glossary_terms:         Number(row.total_glossary_terms),
    visible_glossary_terms:       Number(row.visible_glossary_terms),
    student_personal_terms_count: Number(row.student_personal_terms_count),
    flashcard_reviews_count:      Number(row.flashcard_reviews_count),
    bloom_responses_count:        Number(row.bloom_responses_count),
  };
}

function mapTeacherFolder(row) {
  return {
    folder_id:              row.folder_id,
    folder_name:            row.folder_name,
    organization_name:      row.organization_name,
    is_visible_to_students: row.is_visible_to_students,
    students_count:         Number(row.students_count),
    sections_count:         Number(row.sections_count),
    readings_count:         Number(row.readings_count),
    pending_requests_count: Number(row.pending_requests_count),
    created_at:             row.created_at,
  };
}

function mapActivityItem(row) {
  return {
    item_type:  row.item_type,
    item_id:    row.item_id,
    title:      row.title,
    subtitle:   row.subtitle,
    created_at: row.created_at,
  };
}

function mapStudentOverview(row) {
  return {
    my_folders_count:          Number(row.my_folders_count),
    available_readings_count:  Number(row.available_readings_count),
    personal_terms_count:      Number(row.personal_terms_count),
    mastered_terms_count:      Number(row.mastered_terms_count),
    not_mastered_terms_count:  Number(row.not_mastered_terms_count),
    due_flashcards_count:      Number(row.due_flashcards_count),
    upcoming_flashcards_count: Number(row.upcoming_flashcards_count),
    bloom_answers_count:       Number(row.bloom_answers_count),
    reviewed_today_count:      Number(row.reviewed_today_count),
  };
}

function mapRecentReading(row) {
  return {
    reading_id:        row.reading_id,
    reading_title:     row.reading_title,
    section_name:      row.section_name,
    folder_name:       row.folder_name,
    organization_name: row.organization_name,
    created_at:        row.created_at,
  };
}

function mapRecentTerm(row) {
  return {
    term_id:             row.term_id,
    selected_text:       row.selected_text,
    definition:          row.definition,
    spanish_translation: row.spanish_translation,
    is_mastered:         row.is_mastered,
    reading_id:          row.reading_id,
    reading_title:       row.reading_title,
    created_at:          row.created_at,
  };
}

function mapRecommendation(row) {
  return {
    recommendation_type:    row.recommendation_type,
    recommendation_title:   row.recommendation_title,
    recommendation_message: row.recommendation_message,
    action_label:           row.action_label,
    action_url:             row.action_url,
  };
}

// ── Teacher API ───────────────────────────────────────────────

export async function getTeacherDashboardOverview() {
  const { data, error } = await supabase.rpc('get_teacher_dashboard_overview');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  return mapTeacherOverview(data[0]);
}

export async function getTeacherFolderOverview() {
  const { data, error } = await supabase.rpc('get_teacher_folder_overview');
  if (error) throw new Error(error.message);
  return (data || []).map(mapTeacherFolder);
}

export async function getTeacherRecentActivity() {
  const { data, error } = await supabase.rpc('get_teacher_recent_activity');
  if (error) throw new Error(error.message);
  return (data || []).map(mapActivityItem);
}

// ── Student API ───────────────────────────────────────────────

export async function getStudentDashboardOverview() {
  const { data, error } = await supabase.rpc('get_student_dashboard_overview');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  return mapStudentOverview(data[0]);
}

export async function getStudentRecentReadings() {
  const { data, error } = await supabase.rpc('get_student_recent_readings');
  if (error) throw new Error(error.message);
  return (data || []).map(mapRecentReading);
}

export async function getStudentRecentPersonalTerms() {
  const { data, error } = await supabase.rpc('get_student_recent_personal_terms');
  if (error) throw new Error(error.message);
  return (data || []).map(mapRecentTerm);
}

export async function getStudentLearningRecommendation() {
  const { data, error } = await supabase.rpc('get_student_learning_recommendation');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  return mapRecommendation(data[0]);
}

// ── Analytics API ─────────────────────────────────────────────

export async function getTeacherAnalyticsByFolder() {
  const { data, error } = await supabase.rpc('get_teacher_analytics_by_folder');
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    folder_id:      row.folder_id,
    folder_name:    row.folder_name,
    terms_added:    Number(row.terms_added),
    terms_mastered: Number(row.terms_mastered),
    mastery_rate:   row.mastery_rate !== null ? Number(row.mastery_rate) : null,
  }));
}

export async function getTeacherDifficultTerms(limit = 10) {
  const { data, error } = await supabase.rpc('get_teacher_difficult_terms', { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    selected_text:     row.selected_text,
    reading_title:     row.reading_title,
    folder_name:       row.folder_name,
    students_saved:    Number(row.students_saved),
    students_mastered: Number(row.students_mastered),
    mastery_rate:      row.mastery_rate !== null ? Number(row.mastery_rate) : null,
  }));
}

export async function getTeacherPendingJoinRequests() {
  const { data, error } = await supabase.rpc('get_teacher_pending_join_requests');
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    request_id:   row.request_id,
    folder_id:    row.folder_id,
    folder_name:  row.folder_name,
    student_id:   row.student_id,
    first_name:   row.first_name,
    last_name:    row.last_name,
    email:        row.email,
    requested_at: row.requested_at,
  }));
}

export async function getStudentFolderProgress() {
  const { data, error } = await supabase.rpc('get_student_folder_progress');
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    folder_id:      row.folder_id,
    folder_name:    row.folder_name,
    terms_added:    Number(row.terms_added),
    terms_mastered: Number(row.terms_mastered),
    mastery_rate:   row.mastery_rate !== null ? Number(row.mastery_rate) : null,
  }));
}

export async function getStudentBloomStats() {
  const { data, error } = await supabase.rpc('get_student_bloom_stats');
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    bloom_level:      row.bloom_level,
    total_activities: Number(row.total_activities),
    answered_count:   Number(row.answered_count),
    completion_rate:  row.completion_rate !== null ? Number(row.completion_rate) : null,
  }));
}
