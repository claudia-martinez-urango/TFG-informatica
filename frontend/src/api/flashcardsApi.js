import { supabase } from '../auth/supabaseClient';

// ── Mappers ──────────────────────────────────────────────────

function mapReviewState(row) {
  return {
    id:                        row.id,
    student_glossary_term_id:  row.student_glossary_term_id,
    student_id:                row.student_id,
    repetition_count:          row.repetition_count,
    ease_factor:               row.ease_factor,
    interval_days:             row.interval_days,
    due_at:                    row.due_at,
    last_reviewed_at:          row.last_reviewed_at,
    total_reviews:             row.total_reviews,
    correct_reviews:           row.correct_reviews,
    last_rating:               row.last_rating,
    created_at:                row.created_at,
    updated_at:                row.updated_at,
  };
}

function mapDueCard(row) {
  return {
    review_state_id:           row.review_state_id,
    student_glossary_term_id:  row.student_glossary_term_id,
    selected_text:             row.selected_text,
    definition:                row.definition,
    spanish_translation:       row.spanish_translation,
    example_sentence:          row.example_sentence,
    context_sentence:          row.context_sentence,
    student_note:              row.student_note,
    is_mastered:               row.is_mastered,
    reading_id:                row.reading_id,
    reading_title:             row.reading_title,
    due_at:                    row.due_at,
    repetition_count:          row.repetition_count,
    ease_factor:               row.ease_factor,
    interval_days:             row.interval_days,
    total_reviews:             row.total_reviews,
    correct_reviews:           row.correct_reviews,
    last_rating:               row.last_rating,
    overdue_days:              row.overdue_days,
    is_overdue:                row.is_overdue,
  };
}

function mapUpcomingCard(row) {
  return {
    review_state_id:           row.review_state_id,
    student_glossary_term_id:  row.student_glossary_term_id,
    selected_text:             row.selected_text,
    due_at:                    row.due_at,
    interval_days:             row.interval_days,
    last_rating:               row.last_rating,
    reading_title:             row.reading_title,
  };
}

function mapOverview(row) {
  return {
    due_count:             Number(row.due_count),
    due_today_count:       Number(row.due_today_count),
    overdue_count:         Number(row.overdue_count),
    total_cards:           Number(row.total_cards),
    mastered_count:        Number(row.mastered_count),
    reviewed_today_count:  Number(row.reviewed_today_count),
    upcoming_count:        Number(row.upcoming_count),
    reminder_message:      row.reminder_message,
  };
}

function mapReminder(row) {
  return {
    due_count:        Number(row.due_count),
    overdue_count:    Number(row.overdue_count),
    reminder_message: row.reminder_message,
  };
}

function mapEnrollmentTerm(row) {
  return {
    id:                      row.term_id,
    selected_text:           row.selected_text,
    definition:              row.definition,
    spanish_translation:     row.spanish_translation,
    example_sentence:        row.example_sentence,
    context_sentence:        row.context_sentence,
    student_note:            row.student_note,
    is_mastered:             row.is_mastered,
    reading_id:              row.reading_id,
    reading_title:           row.reading_title,
    folder_id:               row.folder_id,
    folder_name:             row.folder_name,
    has_flashcard_state:     row.has_flashcard_state,
    flashcard_state_id:      row.flashcard_state_id,
    flashcard_due_at:        row.flashcard_due_at,
    flashcard_last_rating:   row.flashcard_last_rating,
    flashcard_interval_days: row.flashcard_interval_days,
  };
}

// ── API functions ─────────────────────────────────────────────

export async function ensureFlashcardStateForMyTerm(studentGlossaryTermId) {
  const { data, error } = await supabase.rpc('ensure_flashcard_state_for_my_term', {
    p_student_glossary_term_id: studentGlossaryTermId,
  });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('No review state returned.');
  return mapReviewState(data[0]);
}

export async function getMyDueFlashcards() {
  const { data, error } = await supabase.rpc('get_my_due_flashcards');
  if (error) throw new Error(error.message);
  return (data || []).map(mapDueCard);
}

export async function getMyFlashcardOverview() {
  const { data, error } = await supabase.rpc('get_my_flashcard_overview');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    return {
      due_count: 0,
      due_today_count: 0,
      overdue_count: 0,
      total_cards: 0,
      mastered_count: 0,
      reviewed_today_count: 0,
      upcoming_count: 0,
      reminder_message: 'No cards due right now.',
    };
  }
  return mapOverview(data[0]);
}

export async function reviewMyFlashcard({ reviewStateId, rating }) {
  const { data, error } = await supabase.rpc('review_my_flashcard', {
    p_review_state_id: reviewStateId,
    p_rating:          rating,
  });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('No data returned from review.');
  return mapReviewState(data[0]);
}

export async function getMyUpcomingFlashcards(limit = 20) {
  const { data, error } = await supabase.rpc('get_my_upcoming_flashcards', {
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data || []).map(mapUpcomingCard);
}

export async function deleteMyFlashcardState(studentGlossaryTermId) {
  const { error } = await supabase.rpc('delete_my_flashcard_state', {
    p_student_glossary_term_id: studentGlossaryTermId,
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function getAllMyGlossaryTermsWithFlashcardStatus() {
  const { data, error } = await supabase.rpc('get_my_all_glossary_terms_with_flashcard_status');
  if (error) throw new Error(error.message);
  return (data || []).map(mapEnrollmentTerm);
}

export async function getMyFlashcardReminder() {
  const { data, error } = await supabase.rpc('get_my_flashcard_reminder');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    return { due_count: 0, overdue_count: 0, reminder_message: 'Flashcards' };
  }
  return mapReminder(data[0]);
}
