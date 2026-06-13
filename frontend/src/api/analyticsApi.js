import { supabase } from '../auth/supabaseClient';

function num(v) {
  return v === null || v === undefined ? null : Number(v);
}

// ── Student ────────────────────────────────────────────────────

export async function getStudentAnalyticsFilters() {
  const { data, error } = await supabase.rpc('get_student_analytics_filters');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStudentAnalyticsSummary(folderId = null, sectionId = null, readingId = null) {
  const { data, error } = await supabase.rpc('get_student_analytics_summary', {
    p_folder_id:  folderId,
    p_section_id: sectionId,
    p_reading_id: readingId,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0] ?? null;
  if (!row) return null;
  return {
    ...row,
    total_terms:        num(row.total_terms),
    mastered_terms:     num(row.mastered_terms),
    not_mastered_terms: num(row.not_mastered_terms),
    mastery_rate:       num(row.mastery_rate),
    bloom_answers:      num(row.bloom_answers),
  };
}

export async function getStudentAnalyticsTerms(folderId = null, sectionId = null, readingId = null) {
  const { data, error } = await supabase.rpc('get_student_analytics_terms', {
    p_folder_id:  folderId,
    p_section_id: sectionId,
    p_reading_id: readingId,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStudentAnalyticsBloom(folderId = null, sectionId = null, readingId = null) {
  const { data, error } = await supabase.rpc('get_student_analytics_bloom', {
    p_folder_id:  folderId,
    p_section_id: sectionId,
    p_reading_id: readingId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({ ...r, total_activities: num(r.total_activities), answered_count: num(r.answered_count) }));
}

// ── Teacher ────────────────────────────────────────────────────

export async function getTeacherAnalyticsFilters() {
  const { data, error } = await supabase.rpc('get_teacher_analytics_filters');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTeacherAnalyticsStudents(folderId = null) {
  const { data, error } = await supabase.rpc('get_teacher_analytics_students', {
    p_folder_id: folderId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({ ...r, terms_count: num(r.terms_count), mastery_rate: num(r.mastery_rate) }));
}

export async function getTeacherAnalyticsSummary(folderId = null, sectionId = null, readingId = null, studentId = null) {
  const { data, error } = await supabase.rpc('get_teacher_analytics_summary', {
    p_folder_id:  folderId,
    p_section_id: sectionId,
    p_reading_id: readingId,
    p_student_id: studentId,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0] ?? null;
  if (!row) return null;
  return {
    ...row,
    total_students:   num(row.total_students),
    terms_saved:      num(row.terms_saved),
    terms_mastered:   num(row.terms_mastered),
    avg_mastery_rate: num(row.avg_mastery_rate),
    bloom_answers:    num(row.bloom_answers),
  };
}

export async function getTeacherAnalyticsWordStats(folderId = null, sectionId = null, readingId = null, studentId = null) {
  const { data, error } = await supabase.rpc('get_teacher_analytics_word_stats', {
    p_folder_id:  folderId,
    p_section_id: sectionId,
    p_reading_id: readingId,
    p_student_id: studentId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({
    ...r,
    students_saved:    num(r.students_saved),
    students_mastered: num(r.students_mastered),
    mastery_rate:      num(r.mastery_rate),
  }));
}

export async function getTeacherAnalyticsBloom(folderId = null, sectionId = null, readingId = null, studentId = null) {
  const { data, error } = await supabase.rpc('get_teacher_analytics_bloom', {
    p_folder_id:  folderId,
    p_section_id: sectionId,
    p_reading_id: readingId,
    p_student_id: studentId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({ ...r, total_activities: num(r.total_activities), answered_count: num(r.answered_count) }));
}

export async function getTeacherAnalyticsStudentComparison(folderId = null, sectionId = null, readingId = null) {
  const { data, error } = await supabase.rpc('get_teacher_analytics_student_comparison', {
    p_folder_id:  folderId,
    p_section_id: sectionId,
    p_reading_id: readingId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({
    ...r,
    terms_added:    num(r.terms_added),
    terms_mastered: num(r.terms_mastered),
    mastery_rate:   num(r.mastery_rate),
  }));
}

// ── Word detail (drill-down from chart bars) ───────────────────

export async function getTeacherAnalyticsWordDetail(selectedText, readingId) {
  const { data, error } = await supabase.rpc('get_teacher_analytics_word_detail', {
    p_selected_text: selectedText,
    p_reading_id:    readingId,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTeacherAnalyticsWordBloom(selectedText, readingId) {
  const { data, error } = await supabase.rpc('get_teacher_analytics_word_bloom', {
    p_selected_text: selectedText,
    p_reading_id:    readingId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({
    ...r,
    bloom_total:    num(r.bloom_total),
    bloom_answered: num(r.bloom_answered),
  }));
}
