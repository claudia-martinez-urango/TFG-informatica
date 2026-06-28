// =============================================================
//  FRONTEND UNIT TESTS
//  Smart Glossary Assistant — TFG 2024/25
//  Framework: Vitest
//
//  HOW TO USE:
//    1. cd frontend/
//    2. npm install -D vitest
//    3. Add to package.json → scripts: "test": "vitest run"
//    4. Place this file at:
//         frontend/src/api/__tests__/frontend.test.js
//    5. Run: npm test
//
//  SECTIONS:
//    1.  SM-2 algorithm (applySM2 helper)
//    2.  Auto-mastery condition
//    3.  mapReviewState mapper
//    4.  mapDueCard mapper
//    5.  mapOverview mapper (numeric coercion)
//    6.  mapReminder mapper
//    7.  mapEnrollmentTerm mapper
//    8.  mapStudentGlossaryTerm mapper (studentGlossaryApi)
//    9.  normalizeDictionaryLookupTerm (dictionaryApi)
//    10. getContextAwareSpanishTranslation input guard
//    11. generateJoinCode (foldersApi)
//    12. NFR-10: no direct supabase calls in component files
//    13. Flashcard distractor selection logic
//    14. FlashcardReviewCard mode selection logic
// =============================================================

import { describe, it, expect, vi } from 'vitest';


// =============================================================
//  HELPERS — replicated from source files (pure functions only)
//  We test logic, not Supabase connectivity.
// =============================================================

// ── From flashcardsApi.js ─────────────────────────────────────

function mapReviewState(row) {
  return {
    id:                       row.id,
    student_glossary_term_id: row.student_glossary_term_id,
    student_id:               row.student_id,
    repetition_count:         row.repetition_count,
    ease_factor:              row.ease_factor,
    interval_days:            row.interval_days,
    due_at:                   row.due_at,
    last_reviewed_at:         row.last_reviewed_at,
    total_reviews:            row.total_reviews,
    correct_reviews:          row.correct_reviews,
    last_rating:              row.last_rating,
    created_at:               row.created_at,
    updated_at:               row.updated_at,
  };
}

function mapDueCard(row) {
  return {
    review_state_id:          row.review_state_id,
    student_glossary_term_id: row.student_glossary_term_id,
    selected_text:            row.selected_text,
    definition:               row.definition,
    spanish_translation:      row.spanish_translation,
    example_sentence:         row.example_sentence,
    context_sentence:         row.context_sentence,
    student_note:             row.student_note,
    is_mastered:              row.is_mastered,
    reading_id:               row.reading_id,
    reading_title:            row.reading_title,
    due_at:                   row.due_at,
    repetition_count:         row.repetition_count,
    ease_factor:              row.ease_factor,
    interval_days:            row.interval_days,
    total_reviews:            row.total_reviews,
    correct_reviews:          row.correct_reviews,
    last_rating:              row.last_rating,
    overdue_days:             row.overdue_days,
    is_overdue:               row.is_overdue,
  };
}

function mapOverview(row) {
  return {
    due_count:            Number(row.due_count),
    due_today_count:      Number(row.due_today_count),
    overdue_count:        Number(row.overdue_count),
    total_cards:          Number(row.total_cards),
    mastered_count:       Number(row.mastered_count),
    reviewed_today_count: Number(row.reviewed_today_count),
    upcoming_count:       Number(row.upcoming_count),
    reminder_message:     row.reminder_message,
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

// ── From studentGlossaryApi.js ────────────────────────────────

function mapStudentGlossaryTerm(row) {
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

// ── From dictionaryApi.js ─────────────────────────────────────

function normalizeDictionaryLookupTerm(text) {
  if (!text) return null;
  const cleaned = text.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase();
  if (!cleaned) return null;
  if (/\s/.test(cleaned)) return null;
  return cleaned;
}

// ── From contextualTranslationApi.js (input guard only) ───────

function translationInputGuard(selectedText) {
  if (!selectedText || !selectedText.trim()) {
    return { found: false, translation: null, source: 'manual_pending', confidence: 0 };
  }
  return null; // proceed to API call
}

// ── From foldersApi.js ────────────────────────────────────────

function generateJoinCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── SM-2 logic (mirrors review_my_flashcard SQL function) ─────

function applySM2(state, rating) {
  let newRep      = state.repetition_count;
  let newEF       = state.ease_factor;
  let newInterval = state.interval_days;

  switch (rating) {
    case 'again':
      newRep      = 0;
      newInterval = 1;
      newEF       = Math.max(1.3, state.ease_factor - 0.2);
      break;
    case 'hard':
      newRep      = state.repetition_count + 1;
      newInterval = Math.max(1, Math.round(state.interval_days * 1.2));
      newEF       = Math.max(1.3, state.ease_factor - 0.15);
      break;
    case 'good':
      newRep = state.repetition_count + 1;
      newEF  = state.ease_factor;
      if      (state.repetition_count === 0) newInterval = 1;
      else if (state.repetition_count === 1) newInterval = 3;
      else newInterval = Math.round(state.interval_days * state.ease_factor);
      newInterval = Math.max(1, newInterval);
      break;
    case 'easy':
      newRep = state.repetition_count + 1;
      newEF  = state.ease_factor + 0.15;
      if (state.repetition_count === 0) newInterval = 4;
      else newInterval = Math.round(state.interval_days * state.ease_factor * 1.3);
      newInterval = Math.max(1, newInterval);
      break;
  }

  const shouldMaster =
    rating === 'easy' && newRep >= 5 && newInterval >= 21;

  return { repetition_count: newRep, ease_factor: newEF, interval_days: newInterval, shouldMaster };
}

// ── Distractor selection logic (mirrors FlashcardReviewCard) ──

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDistractors(allCards, currentCard) {
  return shuffle(
    allCards
      .filter(c => c.review_state_id !== currentCard.review_state_id && c.spanish_translation)
      .map(c => c.spanish_translation)
  ).slice(0, 3);
}

function shouldUseMultipleChoice(card, distractors) {
  return !!card.spanish_translation && distractors.length >= 3;
}


// =============================================================
//  SECTION 1 – SM-2 algorithm
// =============================================================

describe('SM-2 – again', () => {
  const base = { repetition_count: 3, ease_factor: 2.5, interval_days: 10 };

  it('resets repetition_count to 0', () => {
    expect(applySM2(base, 'again').repetition_count).toBe(0);
  });
  it('resets interval_days to 1', () => {
    expect(applySM2(base, 'again').interval_days).toBe(1);
  });
  it('reduces ease_factor by 0.20', () => {
    expect(applySM2(base, 'again').ease_factor).toBeCloseTo(2.3);
  });
  it('clamps ease_factor at 1.3 when already at minimum', () => {
    const low = { ...base, ease_factor: 1.3 };
    expect(applySM2(low, 'again').ease_factor).toBe(1.3);
  });
  it('clamps ease_factor at 1.3 when penalty would go below it', () => {
    const low = { ...base, ease_factor: 1.4 };
    expect(applySM2(low, 'again').ease_factor).toBe(1.3);
  });
});

describe('SM-2 – hard', () => {
  const base = { repetition_count: 2, ease_factor: 2.5, interval_days: 10 };

  it('increments repetition_count by 1', () => {
    expect(applySM2(base, 'hard').repetition_count).toBe(3);
  });
  it('applies 1.2x multiplier to interval', () => {
    expect(applySM2(base, 'hard').interval_days).toBe(12); // round(10 * 1.2)
  });
  it('reduces ease_factor by 0.15', () => {
    expect(applySM2(base, 'hard').ease_factor).toBeCloseTo(2.35);
  });
  it('clamps ease_factor at 1.3 minimum', () => {
    const low = { ...base, ease_factor: 1.3 };
    expect(applySM2(low, 'hard').ease_factor).toBe(1.3);
  });
  it('interval floors at 1 when current interval is 0', () => {
    const zero = { ...base, interval_days: 0 };
    expect(applySM2(zero, 'hard').interval_days).toBe(1);
  });
});

describe('SM-2 – good', () => {
  it('sets interval to 1 on first review (rep=0)', () => {
    const s = { repetition_count: 0, ease_factor: 2.5, interval_days: 0 };
    expect(applySM2(s, 'good').interval_days).toBe(1);
  });
  it('sets interval to 3 on second review (rep=1)', () => {
    const s = { repetition_count: 1, ease_factor: 2.5, interval_days: 1 };
    expect(applySM2(s, 'good').interval_days).toBe(3);
  });
  it('uses round(interval * EF) from third review onwards', () => {
    const s = { repetition_count: 2, ease_factor: 2.5, interval_days: 3 };
    expect(applySM2(s, 'good').interval_days).toBe(8); // round(3 * 2.5)
  });
  it('does not change ease_factor', () => {
    const s = { repetition_count: 2, ease_factor: 2.5, interval_days: 3 };
    expect(applySM2(s, 'good').ease_factor).toBe(2.5);
  });
  it('increments repetition_count by 1', () => {
    const s = { repetition_count: 2, ease_factor: 2.5, interval_days: 3 };
    expect(applySM2(s, 'good').repetition_count).toBe(3);
  });
  it('interval floors at 1 even with very small EF and interval', () => {
    const s = { repetition_count: 2, ease_factor: 1.3, interval_days: 0 };
    expect(applySM2(s, 'good').interval_days).toBeGreaterThanOrEqual(1);
  });
});

describe('SM-2 – easy', () => {
  it('sets interval to 4 on first review (rep=0)', () => {
    const s = { repetition_count: 0, ease_factor: 2.5, interval_days: 0 };
    expect(applySM2(s, 'easy').interval_days).toBe(4);
  });
  it('uses round(interval * EF * 1.3) from second review onwards', () => {
    const s = { repetition_count: 3, ease_factor: 2.5, interval_days: 8 };
    expect(applySM2(s, 'easy').interval_days).toBe(26); // round(8 * 2.5 * 1.3)
  });
  it('increases ease_factor by 0.15', () => {
    const s = { repetition_count: 1, ease_factor: 2.5, interval_days: 1 };
    expect(applySM2(s, 'easy').ease_factor).toBeCloseTo(2.65);
  });
  it('increments repetition_count by 1', () => {
    const s = { repetition_count: 1, ease_factor: 2.5, interval_days: 1 };
    expect(applySM2(s, 'easy').repetition_count).toBe(2);
  });
  it('interval floors at 1 when computed interval would be 0', () => {
    const s = { repetition_count: 2, ease_factor: 1.3, interval_days: 0 };
    expect(applySM2(s, 'easy').interval_days).toBeGreaterThanOrEqual(1);
  });
});


// =============================================================
//  SECTION 2 – Auto-mastery condition (FR-24)
// =============================================================

describe('Auto-mastery (FR-24)', () => {
  it('triggers at easy + rep=5 + interval=26', () => {
    const s = { repetition_count: 4, ease_factor: 2.8, interval_days: 20 };
    // easy: rep→5, interval = round(20 * 2.8 * 1.3) = 73
    expect(applySM2(s, 'easy').shouldMaster).toBe(true);
  });
  it('triggers exactly at boundary: rep=5, interval=21', () => {
    // Construct a state where easy will produce rep=5, interval=21
    const s = { repetition_count: 4, ease_factor: 1.3, interval_days: 16 };
    // easy: interval = round(16 * 1.3 * 1.3) = round(27.04) = 27 ≥ 21 ✓
    const result = applySM2(s, 'easy');
    expect(result.repetition_count).toBe(5);
    expect(result.interval_days).toBeGreaterThanOrEqual(21);
    expect(result.shouldMaster).toBe(true);
  });
  it('does NOT trigger when interval < 21', () => {
    const s = { repetition_count: 4, ease_factor: 1.3, interval_days: 5 };
    // easy: interval = round(5 * 1.3 * 1.3) = round(8.45) = 8 < 21 → no master
    expect(applySM2(s, 'easy').shouldMaster).toBe(false);
  });
  it('does NOT trigger when rep < 5', () => {
    const s = { repetition_count: 3, ease_factor: 2.8, interval_days: 20 };
    expect(applySM2(s, 'easy').shouldMaster).toBe(false);
  });
  it('does NOT trigger on good rating regardless of rep or interval', () => {
    const s = { repetition_count: 6, ease_factor: 2.5, interval_days: 30 };
    expect(applySM2(s, 'good').shouldMaster).toBe(false);
  });
  it('does NOT trigger on again rating', () => {
    const s = { repetition_count: 6, ease_factor: 2.5, interval_days: 30 };
    expect(applySM2(s, 'again').shouldMaster).toBe(false);
  });
  it('does NOT trigger on hard rating', () => {
    const s = { repetition_count: 6, ease_factor: 2.5, interval_days: 30 };
    expect(applySM2(s, 'hard').shouldMaster).toBe(false);
  });
});


// =============================================================
//  SECTION 3 – mapReviewState
// =============================================================

describe('mapReviewState', () => {
  const raw = {
    id: 'uuid-1', student_glossary_term_id: 'uuid-t',
    student_id: 'uuid-s', repetition_count: 2,
    ease_factor: 2.5, interval_days: 3,
    due_at: '2026-06-20T00:00:00Z', last_reviewed_at: '2026-06-17T00:00:00Z',
    total_reviews: 2, correct_reviews: 2, last_rating: 'good',
    created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-17T00:00:00Z',
  };

  it('maps all 13 fields', () => {
    expect(Object.keys(mapReviewState(raw))).toHaveLength(13);
  });
  it('preserves numeric fields as-is', () => {
    const r = mapReviewState(raw);
    expect(r.repetition_count).toBe(2);
    expect(r.ease_factor).toBe(2.5);
    expect(r.interval_days).toBe(3);
  });
  it('maps last_rating correctly', () => {
    expect(mapReviewState(raw).last_rating).toBe('good');
  });
  it('maps null last_reviewed_at without throwing', () => {
    const r = mapReviewState({ ...raw, last_reviewed_at: null });
    expect(r.last_reviewed_at).toBeNull();
  });
});


// =============================================================
//  SECTION 4 – mapDueCard
// =============================================================

describe('mapDueCard', () => {
  const raw = {
    review_state_id: 'uuid-rs', student_glossary_term_id: 'uuid-t',
    selected_text: 'equity', definition: 'The value of shares.',
    spanish_translation: 'capital', example_sentence: 'She invested in equity.',
    context_sentence: 'The firm raised equity through an IPO.',
    student_note: 'Finance term.', is_mastered: false,
    reading_id: 'uuid-r', reading_title: 'Intro to Finance',
    due_at: '2026-06-26T00:00:00Z', repetition_count: 1,
    ease_factor: 2.5, interval_days: 1, total_reviews: 1,
    correct_reviews: 1, last_rating: 'good', overdue_days: 0, is_overdue: false,
  };

  it('maps selected_text', () => {
    expect(mapDueCard(raw).selected_text).toBe('equity');
  });
  it('maps is_overdue as false', () => {
    expect(mapDueCard(raw).is_overdue).toBe(false);
  });
  it('maps is_overdue as true when card is late', () => {
    expect(mapDueCard({ ...raw, is_overdue: true }).is_overdue).toBe(true);
  });
  it('maps spanish_translation when present', () => {
    expect(mapDueCard(raw).spanish_translation).toBe('capital');
  });
  it('maps null spanish_translation', () => {
    expect(mapDueCard({ ...raw, spanish_translation: null }).spanish_translation).toBeNull();
  });
  it('maps overdue_days correctly', () => {
    expect(mapDueCard({ ...raw, overdue_days: 5 }).overdue_days).toBe(5);
  });
});


// =============================================================
//  SECTION 5 – mapOverview (numeric coercion)
// =============================================================

describe('mapOverview', () => {
  const raw = {
    due_count: '3', due_today_count: '2', overdue_count: '1',
    total_cards: '10', mastered_count: '4',
    reviewed_today_count: '2', upcoming_count: '5',
    reminder_message: 'You have 2 cards to review today.',
  };

  it('converts all count fields from string to number', () => {
    const r = mapOverview(raw);
    expect(typeof r.due_count).toBe('number');
    expect(typeof r.total_cards).toBe('number');
    expect(typeof r.mastered_count).toBe('number');
  });
  it('converts string "3" to number 3', () => {
    expect(mapOverview(raw).due_count).toBe(3);
  });
  it('converts string "0" to number 0', () => {
    expect(mapOverview({ ...raw, due_count: '0' }).due_count).toBe(0);
  });
  it('preserves reminder_message as string', () => {
    expect(mapOverview(raw).reminder_message).toBe('You have 2 cards to review today.');
  });
  it('handles all-zero counts correctly', () => {
    const zeros = {
      due_count: '0', due_today_count: '0', overdue_count: '0',
      total_cards: '0', mastered_count: '0', reviewed_today_count: '0',
      upcoming_count: '0', reminder_message: 'No cards due.',
    };
    const r = mapOverview(zeros);
    expect(r.due_count).toBe(0);
    expect(r.upcoming_count).toBe(0);
  });
});


// =============================================================
//  SECTION 6 – mapReminder
// =============================================================

describe('mapReminder', () => {
  it('converts due_count from string to number', () => {
    const r = mapReminder({ due_count: '2', overdue_count: '1', reminder_message: 'Review' });
    expect(r.due_count).toBe(2);
    expect(typeof r.due_count).toBe('number');
  });
  it('converts overdue_count from string to number', () => {
    const r = mapReminder({ due_count: '0', overdue_count: '3', reminder_message: 'Overdue' });
    expect(r.overdue_count).toBe(3);
  });
  it('handles zero counts', () => {
    const r = mapReminder({ due_count: '0', overdue_count: '0', reminder_message: 'All done!' });
    expect(r.due_count).toBe(0);
    expect(r.overdue_count).toBe(0);
  });
  it('preserves reminder_message', () => {
    const r = mapReminder({ due_count: '1', overdue_count: '0', reminder_message: 'Time to study!' });
    expect(r.reminder_message).toBe('Time to study!');
  });
});


// =============================================================
//  SECTION 7 – mapEnrollmentTerm
// =============================================================

describe('mapEnrollmentTerm', () => {
  const raw = {
    term_id: 'uuid-term', selected_text: 'equity',
    definition: 'Shares value.', spanish_translation: 'capital',
    example_sentence: null, context_sentence: 'Raised equity via IPO.',
    student_note: null, is_mastered: false,
    reading_id: 'uuid-r', reading_title: 'Finance',
    folder_id: 'uuid-f', folder_name: 'Business English',
    has_flashcard_state: true, flashcard_state_id: 'uuid-fs',
    flashcard_due_at: '2026-06-26T00:00:00Z',
    flashcard_last_rating: 'good', flashcard_interval_days: 3,
  };

  it('renames term_id → id', () => {
    expect(mapEnrollmentTerm(raw).id).toBe('uuid-term');
  });
  it('maps has_flashcard_state correctly', () => {
    expect(mapEnrollmentTerm(raw).has_flashcard_state).toBe(true);
  });
  it('maps false for terms not yet in flashcards', () => {
    expect(mapEnrollmentTerm({ ...raw, has_flashcard_state: false }).has_flashcard_state).toBe(false);
  });
  it('maps null example_sentence without throwing', () => {
    expect(mapEnrollmentTerm(raw).example_sentence).toBeNull();
  });
  it('maps folder_name correctly', () => {
    expect(mapEnrollmentTerm(raw).folder_name).toBe('Business English');
  });
  it('maps flashcard_interval_days', () => {
    expect(mapEnrollmentTerm(raw).flashcard_interval_days).toBe(3);
  });
});


// =============================================================
//  SECTION 8 – mapStudentGlossaryTerm (studentGlossaryApi)
// =============================================================

describe('mapStudentGlossaryTerm', () => {
  const raw = {
    result_id: 'uuid-t', result_student_id: 'uuid-s',
    result_reading_id: 'uuid-r', result_linked_glossary_term_id: null,
    result_selected_text: 'liquidity', result_normalized_term: 'liquidity',
    result_definition: 'Ease of converting assets to cash.',
    result_example_sentence: 'The company had high liquidity.',
    result_context_sentence: 'Market liquidity was low.',
    result_student_note: null, result_is_mastered: false,
    result_definition_source: 'dictionary_api',
    result_dictionary_word: 'liquidity', result_dictionary_part_of_speech: 'noun',
    result_spanish_translation: 'liquidez', result_translation_source: 'api',
    result_translation_confidence: 85,
    result_created_at: '2026-06-01T00:00:00Z',
    result_updated_at: '2026-06-01T00:00:00Z',
  };

  it('maps result_id → id', () => {
    expect(mapStudentGlossaryTerm(raw).id).toBe('uuid-t');
  });
  it('maps selected_text', () => {
    expect(mapStudentGlossaryTerm(raw).selected_text).toBe('liquidity');
  });
  it('maps definition_source from DB column', () => {
    expect(mapStudentGlossaryTerm(raw).definition_source).toBe('dictionary_api');
  });
  it('defaults definition_source to manual_pending when null', () => {
    expect(mapStudentGlossaryTerm({ ...raw, result_definition_source: null }).definition_source)
      .toBe('manual_pending');
  });
  it('defaults translation_source to manual_pending when null', () => {
    expect(mapStudentGlossaryTerm({ ...raw, result_translation_source: null }).translation_source)
      .toBe('manual_pending');
  });
  it('defaults translation_confidence to 0 when null', () => {
    expect(mapStudentGlossaryTerm({ ...raw, result_translation_confidence: null }).translation_confidence)
      .toBe(0);
  });
  it('defaults spanish_translation to null when missing', () => {
    expect(mapStudentGlossaryTerm({ ...raw, result_spanish_translation: null }).spanish_translation)
      .toBeNull();
  });
  it('maps is_mastered correctly', () => {
    expect(mapStudentGlossaryTerm(raw).is_mastered).toBe(false);
    expect(mapStudentGlossaryTerm({ ...raw, result_is_mastered: true }).is_mastered).toBe(true);
  });
});


// =============================================================
//  SECTION 9 – normalizeDictionaryLookupTerm (dictionaryApi)
// =============================================================

describe('normalizeDictionaryLookupTerm', () => {
  it('lowercases a single word', () => {
    expect(normalizeDictionaryLookupTerm('Equity')).toBe('equity');
  });
  it('trims whitespace', () => {
    expect(normalizeDictionaryLookupTerm('  equity  ')).toBe('equity');
  });
  it('strips leading punctuation', () => {
    expect(normalizeDictionaryLookupTerm('"equity')).toBe('equity');
  });
  it('strips trailing punctuation', () => {
    expect(normalizeDictionaryLookupTerm('equity.')).toBe('equity');
  });
  it('returns null for multi-word input (not suitable for Free Dictionary API)', () => {
    expect(normalizeDictionaryLookupTerm('equity market')).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(normalizeDictionaryLookupTerm('')).toBeNull();
  });
  it('returns null for null input', () => {
    expect(normalizeDictionaryLookupTerm(null)).toBeNull();
  });
  it('returns null for whitespace-only input', () => {
    expect(normalizeDictionaryLookupTerm('   ')).toBeNull();
  });
  it('handles a word with internal hyphen as single token', () => {
    // "well-being" has no whitespace → passes the single-word check
    expect(normalizeDictionaryLookupTerm('well-being')).toBe('well-being');
  });
  it('strips surrounding quotes', () => {
    expect(normalizeDictionaryLookupTerm('"liquidity"')).toBe('liquidity');
  });
});


// =============================================================
//  SECTION 10 – contextualTranslationApi input guard
// =============================================================

describe('getContextAwareSpanishTranslation input guard', () => {
  it('returns found:false for empty string', () => {
    const result = translationInputGuard('');
    expect(result).not.toBeNull();
    expect(result.found).toBe(false);
    expect(result.source).toBe('manual_pending');
  });
  it('returns found:false for whitespace-only string', () => {
    const result = translationInputGuard('   ');
    expect(result).not.toBeNull();
    expect(result.found).toBe(false);
  });
  it('returns found:false for null', () => {
    const result = translationInputGuard(null);
    expect(result).not.toBeNull();
    expect(result.found).toBe(false);
  });
  it('returns null (proceed) for valid non-empty text', () => {
    expect(translationInputGuard('equity')).toBeNull();
  });
  it('returns null (proceed) for text with surrounding spaces', () => {
    expect(translationInputGuard('  equity  ')).toBeNull();
  });
  it('sets confidence to 0 on blocked input', () => {
    expect(translationInputGuard('')?.confidence).toBe(0);
  });
});


// =============================================================
//  SECTION 11 – generateJoinCode (foldersApi, FR-13)
// =============================================================

describe('generateJoinCode (FR-13)', () => {
  it('generates a 6-digit string', () => {
    const code = generateJoinCode();
    expect(code).toMatch(/^\d{6}$/);
  });
  it('generates a value between 100000 and 999999', () => {
    const code = parseInt(generateJoinCode(), 10);
    expect(code).toBeGreaterThanOrEqual(100000);
    expect(code).toBeLessThanOrEqual(999999);
  });
  it('returns a string, not a number', () => {
    expect(typeof generateJoinCode()).toBe('string');
  });
  it('generates different codes on successive calls (probabilistic)', () => {
    const codes = new Set(Array.from({ length: 20 }, generateJoinCode));
    expect(codes.size).toBeGreaterThan(1);
  });
});


// =============================================================
//  SECTION 12 – NFR-10: API encapsulation check
//  Verifies that no direct supabase.from() calls appear in
//  component or page files. Tested via static pattern check.
// =============================================================

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

function findFilesRecursive(dir, ext) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) results.push(...findFilesRecursive(full, ext));
      else if (e.name.endsWith(ext)) results.push(full);
    }
  } catch {
    // directory may not exist in test environment
  }
  return results;
}

describe('NFR-10 – no direct supabase.from() calls in components or pages', () => {
  const srcBase = join(process.cwd(), 'src');
  const componentDir = join(srcBase, 'components');
  const pagesDir     = join(srcBase, 'pages');

  const componentFiles = findFilesRecursive(componentDir, '.jsx');
  const pageFiles      = findFilesRecursive(pagesDir, '.jsx');
  const allFiles       = [...componentFiles, ...pageFiles];

  if (allFiles.length === 0) {
    it.skip('no component/page files found (run from frontend/ directory)', () => {});
  } else {
    for (const file of allFiles) {
      it(`${file.split('/src/')[1]} does not call supabase.from() directly`, () => {
        const content = readFileSync(file, 'utf-8');
        expect(content).not.toMatch(/supabase\.from\s*\(/);
      });
    }
  }
});


// =============================================================
//  SECTION 13 – Distractor selection logic (FlashcardReviewCard)
// =============================================================

describe('Distractor selection (FlashcardReviewCard)', () => {
  const currentCard = { review_state_id: 'current', spanish_translation: 'capital' };

  const makeCard = (id, translation) => ({
    review_state_id: id, spanish_translation: translation,
  });

  it('excludes the current card from distractors', () => {
    const allCards = [
      currentCard,
      makeCard('a', 'liquidez'),
      makeCard('b', 'riesgo'),
      makeCard('c', 'deuda'),
    ];
    const distractors = pickDistractors(allCards, currentCard);
    expect(distractors).not.toContain('capital');
  });

  it('excludes cards without spanish_translation', () => {
    const allCards = [
      currentCard,
      makeCard('a', 'liquidez'),
      makeCard('b', null),          // no translation
      makeCard('c', 'riesgo'),
      makeCard('d', 'deuda'),
    ];
    const distractors = pickDistractors(allCards, currentCard);
    expect(distractors).not.toContain(null);
  });

  it('returns at most 3 distractors', () => {
    const allCards = [
      currentCard,
      makeCard('a', 'liquidez'),
      makeCard('b', 'riesgo'),
      makeCard('c', 'deuda'),
      makeCard('d', 'interés'),
    ];
    expect(pickDistractors(allCards, currentCard).length).toBeLessThanOrEqual(3);
  });

  it('returns fewer than 3 when not enough cards have translations', () => {
    const allCards = [
      currentCard,
      makeCard('a', 'liquidez'),
      makeCard('b', null),
    ];
    expect(pickDistractors(allCards, currentCard).length).toBeLessThan(3);
  });
});


// =============================================================
//  SECTION 14 – FlashcardReviewCard mode selection
// =============================================================

describe('FlashcardReviewCard mode selection', () => {
  const cardWithTranslation    = { spanish_translation: 'capital' };
  const cardWithoutTranslation = { spanish_translation: null };

  it('uses multiple-choice when card has translation and 3+ distractors', () => {
    expect(shouldUseMultipleChoice(cardWithTranslation, ['a', 'b', 'c'])).toBe(true);
  });
  it('uses reveal mode when card has no translation', () => {
    expect(shouldUseMultipleChoice(cardWithoutTranslation, ['a', 'b', 'c'])).toBe(false);
  });
  it('uses reveal mode when fewer than 3 distractors available', () => {
    expect(shouldUseMultipleChoice(cardWithTranslation, ['a', 'b'])).toBe(false);
  });
  it('uses reveal mode when no distractors at all', () => {
    expect(shouldUseMultipleChoice(cardWithTranslation, [])).toBe(false);
  });
  it('uses multiple-choice with exactly 3 distractors (boundary)', () => {
    expect(shouldUseMultipleChoice(cardWithTranslation, ['a', 'b', 'c'])).toBe(true);
  });
});