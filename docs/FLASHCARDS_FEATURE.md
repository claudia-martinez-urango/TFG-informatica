# Feature: Spaced Repetition Flashcards

Branch: `feature/spaced-repetition-flashcards`
Last updated: 2026-06-11

---

## Purpose

Adds a spaced repetition flashcard system on top of the existing Student Personal Glossary.
Each personal glossary term can be turned into a flashcard that the student reviews over time.
The system implements three educational principles:

- **Retrieval practice** — the answer is hidden until the student deliberately reveals it.
- **Spaced repetition** — each card is rescheduled based on how well the student recalled it.
- **Spacing effect** — successful recall increases the review interval; difficulty shortens it.

The system is **flexible**: it never penalises a student for not logging in on a scheduled day.
If a card is overdue the student simply sees it as overdue the next time they open the app.

---

## Mastery rule

A glossary term is marked **Mastered** (`student_glossary_terms.is_mastered = true`) automatically
inside `review_my_flashcard` when **all three conditions** are met:

| Condition | Meaning |
|-----------|---------|
| `rating = 'easy'` | Student rated the card "Very easy" in this review |
| `new repetition_count ≥ 5` | Card has been recalled correctly at least 5 times |
| `new interval_days ≥ 21` | SM-2 schedules the next review in 3+ weeks |

Students can also mark terms mastered manually from the Personal Glossary panel.
The flashcard `MASTERED` stat counts all terms where `is_mastered = true`,
regardless of whether they were marked manually or automatically.

---

## Algorithm

Simplified SM-2. Stored per card: `repetition_count`, `ease_factor` (default 2.5), `interval_days`, `due_at`.

| Rating | repetition_count | interval_days | ease_factor |
|--------|-----------------|---------------|-------------|
| Again  | reset to 0      | 1             | EF − 0.20 (min 1.3) |
| Hard   | +1              | max(1, round(interval × 1.2)) | EF − 0.15 (min 1.3) |
| Good   | +1              | 1 / 3 / round(interval × EF) | unchanged |
| Easy   | +1              | 4 / round(interval × EF × 1.3) | EF + 0.15 |

`Again` does not count as a correct review. `Hard`, `Good`, `Easy` do.

---

## Files created

### Database

| File | Purpose |
|------|---------|
| `database/spaced_repetition_schema.sql` | Tables, RLS policies, and all 7 RPC functions. Safe to re-run (idempotent). |

#### Tables

- **`flashcard_review_state`** — one row per (student_glossary_term, student). Stores current SM-2 state.
- **`flashcard_review_history`** — append-only log of every review session with before/after values.

#### RPC functions (8)

| Function | Purpose |
|----------|---------|
| `ensure_flashcard_state_for_my_term(p_student_glossary_term_id)` | Creates or returns the review state for a term |
| `delete_my_flashcard_state(p_student_glossary_term_id)` | Deletes review state + cascades history for a term |
| `get_my_due_flashcards()` | Returns all cards where `due_at ≤ now()`, ordered by most overdue first |
| `get_my_flashcard_overview()` | Returns stats counts + a friendly reminder message |
| `review_my_flashcard(p_review_state_id, p_rating)` | Applies SM-2, updates state, inserts history row |
| `get_my_upcoming_flashcards(p_limit)` | Returns cards due in the future, ordered by due date |
| `get_my_flashcard_reminder()` | Lightweight – returns `due_count`, `overdue_count`, `reminder_message` for the Navbar |
| `get_my_all_glossary_terms_with_flashcard_status()` | Returns every personal glossary term with `has_flashcard_state` flag + `folder_id` + `folder_name`. Used by enrollment panel. |

### Frontend – new files

| File | Purpose |
|------|---------|
| `frontend/src/api/flashcardsApi.js` | Supabase RPC wrappers for all 8 functions, including `deleteMyFlashcardState` |
| `frontend/src/pages/StudentFlashcardsPage.jsx` | Protected route `/student/flashcards` |
| `frontend/src/components/flashcards/FlashcardReviewCard.jsx` | Card flip UX + rating buttons |
| `frontend/src/components/flashcards/FlashcardStats.jsx` | 6-cell stats overview grid |
| `frontend/src/components/flashcards/UpcomingFlashcardsList.jsx` | List of upcoming scheduled reviews |
| `frontend/src/components/flashcards/FlashcardReminderBadge.jsx` | Navbar badge with due/overdue count |
| `frontend/src/components/flashcards/FlashcardEnrollPanel.jsx` | Split-layout enrollment panel: search, filter tabs (All/To add/Added), remove with confirmation |
| `frontend/src/components/flashcards/FlashcardMultipleChoice.jsx` | Multiple-choice card for terms that have a Spanish translation |

---

## Files modified

### `frontend/src/router/AppRouter.jsx`

Added route:
```jsx
<Route
  path="/student/flashcards"
  element={
    <ProtectedRoute allowedRole="student">
      <StudentFlashcardsPage />
    </ProtectedRoute>
  }
/>
```

### `frontend/src/components/layout/Navbar.jsx`

- Imported `FlashcardReminderBadge`.
- Added `<FlashcardReminderBadge />` inside the student nav links block.
- Renders with class `flashcard-navbar-link` (same visual style as all other navbar links).
- Shows a numeric badge when cards are due; badge turns red when cards are overdue.

### `frontend/src/components/readings/StudentPersonalGlossary.jsx`

- Imported `ensureFlashcardStateForMyTerm` from `flashcardsApi`.
- Added state: `flashcardIds` (Set of term IDs already in flashcards), `flashcardAdding`.
- Added handler `handleAddToFlashcards(term)` — calls the RPC, updates local Set.
- Added **"Add to flashcards"** button in each term's action row.
- Once added, the button is replaced by an **"In flashcards"** badge.

### `frontend/src/pages/StudentDashboardPage.jsx`

- Imported `getMyFlashcardReminder`.
- Loads reminder data on mount (silently ignores errors).
- Renders a reminder widget above the folder list when `due_count > 0`:
  - Overdue message: "Some vocabulary cards are overdue, but you can review them whenever you are ready."
  - Normal due message: from `reminder_message`.
  - "Review now" button → `/student/flashcards`.

### `frontend/src/pages/StudentFlashcardsPage.jsx`

- Added `FlashcardEnrollPanel` at the bottom of the page with `onTermAdded={refreshStats}` and `onTermRemoved={refreshStats}`.
- Passes `allCards={dueCards}` to `FlashcardReviewCard` so distractor selection for multiple-choice mode works client-side.
- Added `refreshStats` callback (updates overview + upcoming without resetting the active review queue).
- Removed the old "You have no flashcards" text block; the enrollment panel replaces it.
- Overdue notice changed from `.flashcard-reminder` block to `.flashcard-info-notice` (warning yellow, not the navbar/reminder blue).

### `frontend/src/styles/global.css`

New CSS classes:

```
Navbar
  .flashcard-navbar-link          Inline nav link style (matches Dashboard/Join Folder exactly)
  .flashcard-reminder-badge       Circular count bubble on the navbar link
  .flashcard-reminder-badge--overdue  Red variant

Stats grid
  .flashcard-stats-grid           Responsive CSS grid
  .flashcard-stat-card            Individual stat cell
  .flashcard-stat-card--highlight Highlighted when count > 0
  .flashcard-stat-value           Large number
  .flashcard-stat-label           Caption text

Review card
  .flashcard-review-card          Card container
  .flashcard-front / .flashcard-back
  .flashcard-term                 Large word
  .flashcard-context              Context sentence (left-border accent)
  .retrieval-hint                 "Try to recall…" hint
  .flashcard-answer-section       Definition area on back face
  .spacing-info                   "From: reading" small text
  .rating-buttons                 Again/Hard/Good/Easy container
  .rating-again / .rating-hard / .rating-good / .rating-easy

Badges
  .flashcard-overdue-badge        Red "Overdue"
  .flashcard-due-badge            Indigo "New" / "In flashcards"

Notices
  .flashcard-reminder             Blue info block (Dashboard widget)
  .flashcard-info-notice          Yellow warning block (overdue notice on flashcards page)

Upcoming list
  .upcoming-flashcards-list
  .upcoming-flashcard-item

Multiple choice card
  .flashcard-review-card--mc      Blue-tinted border for MC cards
  .mc-type-badge                  "Translation" badge (purple)
  .mc-type-badge--definition      "Definition" badge (grey)
  .mc-options                     Vertical stack of option buttons
  .mc-option                      Single selectable option
  .mc-option--correct             Green highlight after selection
  .mc-option--wrong               Red strikethrough on wrong pick
  .mc-option--disabled            Faded out for unchosen options
  .mc-feedback                    Correct / Incorrect feedback line
  .mc-feedback--correct           Green text
  .mc-feedback--wrong             Red text

Enrollment panel
  .enroll-split-layout            CSS grid 1fr / 280px (collapses to 1 col on ≤700px)
  .enroll-detail-panel            Left panel (term detail)
  .enroll-detail-empty            Placeholder when nothing is selected
  .enroll-term-list               Right column container (search + tabs + list)
  .enroll-search                  Search input wrapper
  .enroll-search-input            Text search field
  .enroll-filter-tabs             Tab bar (All / To add / Added)
  .enroll-filter-tab              Individual tab button
  .enroll-filter-tab--active      Active tab (primary colour)
  .enroll-folder-tabs             Folder selector bar (only rendered when student has >1 folder)
  .enroll-folder-tab              Individual folder pill (shows name + added/total badge)
  .enroll-folder-tab--active      Active folder (primary colour)
  .enroll-folder-tab-name         Truncated folder name (max-width: 110px)
  .enroll-folder-tab-count        "3/8" counter bubble inside each tab
  .enroll-term-list-body          Scrollable word list (max-height: 360px)
  .enroll-reading-group           Group per reading title
  .enroll-reading-title           Uppercase reading label with (added/total) counter
  .enroll-term-item               Single word row (button)
  .enroll-term-item--selected     Active selection highlight
  .enroll-term-item--added        Dimmed style when already in flashcards
  .enroll-term-word               Word text
  .enroll-term-status             + / ✓ icon
  .enroll-term-status--added      Green ✓
```

---

## Bug fix — "Review state not found or does not belong to you"

### What happened

When a student **removes a card and then re-adds it** via the enrollment panel without
reloading the page, the old `flashcard_review_state` row is deleted (cascade) and a new
row is created with a different UUID.  
The active review queue (`dueCards`) in `StudentFlashcardsPage` was not refreshed at that
point, so it still held the old (now-deleted) `review_state_id`. The next review attempt
passed a UUID that no longer existed to `review_my_flashcard`, which raised the exception.

### Fix applied (2026-06-11)

1. **`database/spaced_repetition_schema.sql`** — removed `FOR UPDATE` from the SELECT in
   `review_my_flashcard`. The ownership check (`student_id = v_student_id`) is sufficient;
   the pessimistic lock is unnecessary and can behave unexpectedly with Supabase's pgBouncer
   connection pool in transaction mode.

2. **`frontend/src/pages/StudentFlashcardsPage.jsx`** — `refreshStats` (called after every
   enrollment add/remove) now also re-fetches `dueCards`. An `activeReviewIdRef` tracks the
   card the student is currently on; after the refresh, `cardIndex` is restored to that same
   card (or clamped if it no longer exists).

---

## Known deployment issues

### PostgreSQL idempotency rules

There are two distinct idempotency problems in PostgreSQL. Both are handled in the SQL file.

---

#### 1. `CREATE POLICY` is not idempotent

PostgreSQL has no `CREATE POLICY IF NOT EXISTS` or `CREATE OR REPLACE POLICY`.  
Re-running the file gives:

```
ERROR: 42710: policy "students_select_own_flashcard_state"
       for table "flashcard_review_state" already exists
```

**Fix applied:** every `CREATE POLICY` is preceded by `DROP POLICY IF EXISTS`.

```sql
drop policy if exists "students_select_own_flashcard_state" on public.flashcard_review_state;
create policy "students_select_own_flashcard_state" ...
```

---

#### 2. `CREATE OR REPLACE FUNCTION` cannot change return type

When a function's `RETURNS TABLE(...)` signature is extended (new columns added),
PostgreSQL rejects the replacement:

```
ERROR: 42P13: cannot change return type of existing function
DETAIL: Row type defined by OUT parameters is different.
HINT: Use DROP FUNCTION get_my_all_glossary_terms_with_flashcard_status() first.
```

This happened when `folder_id uuid` and `folder_name text` were added to
`get_my_all_glossary_terms_with_flashcard_status`.

**Fix applied:** a `DROP FUNCTION IF EXISTS` precedes the affected `CREATE OR REPLACE`:

```sql
drop function if exists public.get_my_all_glossary_terms_with_flashcard_status();
create or replace function public.get_my_all_glossary_terms_with_flashcard_status() ...
```

**If you hit this error manually:** run the `DROP FUNCTION` line in the Supabase SQL editor,
then re-run the full file (or the function block alone).

---

## Security

- All RPCs are `SECURITY DEFINER` and validate `auth.uid()`.
- Students can only create/read/update their own `flashcard_review_state` rows.
- Students can only read their own `flashcard_review_history` rows; inserts are done only inside `review_my_flashcard`.
- `ensure_flashcard_state_for_my_term` verifies the glossary term belongs to `auth.uid()` before inserting.
- `get_my_all_glossary_terms_with_flashcard_status` only returns terms owned by `auth.uid()`.
- Teachers have no policies on either table in this version.

---

## How to deploy (first time)

1. Run `database/spaced_repetition_schema.sql` in the Supabase SQL editor.
2. Verify the two tables appear in Database → Tables.
3. Verify the 7 RPC functions appear in Database → Functions.
4. Run `npm run dev` (or deploy the frontend build).

## How to re-deploy (already deployed once)

The SQL file is now idempotent — you can re-run it safely.
Alternatively, for adding only the new enrollment function, paste just that `CREATE OR REPLACE FUNCTION` block.

---

## Testing checklist

1. Log in as a student and open a reading.
2. Add words to My Personal Glossary.
3. Navigate to `/student/flashcards`.
4. In the **"Add vocabulary to flashcards"** section (bottom of page):
   - Click a word in the right list → details appear on the left.
   - Click **Add to flashcards** → word gets a green ✓ in the list.
   - Stats counter ("X of Y words added") updates.
5. Click **Add to flashcards** on a term from the Personal Glossary on the reading page — button becomes **"In flashcards"** badge.
6. Both the glossary button and the enrollment panel must not create duplicate rows (test by adding the same word twice).
7. Confirm stats grid updates (Total cards, Due today, etc.).
8. Confirm front side shows term and context but hides the definition.
9. Click **Show answer** → definition, Spanish translation, example and note appear.
10. Click each rating (Again, Hard, Good, Easy) on different cards.
11. After rating, confirm the card disappears from the due list.
12. Reload the page — reviewed cards should not appear if scheduled for the future.
13. Confirm upcoming list shows future cards with due dates and intervals.
14. Manually set `due_at` to the past in Supabase → confirm it appears as overdue with the red badge.
15. Confirm Navbar link "Flashcards" looks identical to other nav links, with a numeric badge when cards are due.
16. Confirm the Dashboard shows the reminder widget with "Review now" button.
17. **Remove from flashcards:** select an added word in the enrollment panel → click "Remove from flashcards" → confirm inline → word reverts to `+` status → stats counter decreases.
18. **Search:** type a word in the search box → list filters in real time → clear search → all words reappear.
19. **Filter tabs:** click "To add" → only non-added words show. Click "Added" → only added words show.
20. **Multiple-choice mode:** ensure ≥4 cards with Spanish translations are in flashcards → go to review → card shows 4 options instead of "Show answer". Click wrong → card advances after 1.2s. Click correct → confidence buttons appear.
21. **Standard mode:** add a card that has no Spanish translation → review it → shows "Show answer" + Again/Hard/Good/Easy, not multiple choice.
22. **MC distractor quality:** confirm the 3 distractors are all different from the correct answer and come from other cards in the student's session.
23. Log in as a second student — confirm they see only their own flashcards and glossary terms.
18. Log in as a teacher — confirm no access to student flashcard data.
19. Confirm existing features still work: auth, reading detail, personal glossary, dictionary API, AI Bloom activities.

---

## Git commands

```bash
git checkout -b feature/spaced-repetition-flashcards
git add database/spaced_repetition_schema.sql \
        frontend/src/api/flashcardsApi.js \
        frontend/src/pages/StudentFlashcardsPage.jsx \
        frontend/src/components/flashcards/ \
        frontend/src/router/AppRouter.jsx \
        frontend/src/components/layout/Navbar.jsx \
        frontend/src/components/readings/StudentPersonalGlossary.jsx \
        frontend/src/pages/StudentDashboardPage.jsx \
        frontend/src/styles/global.css \
        docs/FLASHCARDS_FEATURE.md
git commit -m "feat: spaced repetition flashcards for student personal glossary"
git push -u origin feature/spaced-repetition-flashcards
```
