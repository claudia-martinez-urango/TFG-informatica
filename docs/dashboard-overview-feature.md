# Feature: Dashboard Overview + Analytics Pages
**Branch:** `feature/dashboard-overview`  
**Status:** Complete

---

## Objective

Two complementary features:

1. **Dashboard Overview** — Replace the minimal placeholder dashboards with full-featured
   overview pages for both teacher and student roles. The teacher gains visibility into
   student activity and content management shortcuts. The student gains learning progress
   tracking, adaptive recommendations and a quick analytics summary.

2. **Analytics Pages** — Dedicated `/teacher/analytics` and `/student/analytics` routes
   accessible from the Navbar. Both pages offer cascading filters (Folder → Section →
   Reading) and the teacher view additionally filters by individual student. Charts are
   pure CSS horizontal bar charts (no external library).

---

## Architecture

```
Smart Glossary Assistant
├── database/
│   ├── dashboard_overview_schema.sql    ← 7 overview RPC functions
│   ├── dashboard_analytics_schema.sql  ← 5 dashboard analytics RPC functions
│   ├── analytics_pages_schema.sql      ← 10 analytics page RPC functions
│   └── analytics_word_detail_schema.sql ← 2 word drill-down RPC functions (NEW)
└── frontend/src/
    ├── api/
    │   ├── dashboardApi.js              ← 12 API functions
    │   └── analyticsApi.js             ← 12 API functions (10 + 2 word detail NEW)
    ├── components/dashboard/
    │   ├── DashboardStatCard.jsx
    │   ├── DashboardQuickActions.jsx
    │   ├── TeacherFolderOverview.jsx
    │   ├── RecentActivityList.jsx
    │   ├── StudentProgressPanel.jsx
    │   ├── StudentRecommendationCard.jsx
    │   ├── DashboardBarChart.jsx
    │   ├── TeacherAnalyticsPanel.jsx
    │   └── StudentAnalyticsPanel.jsx
    ├── pages/
    │   ├── TeacherDashboardPage.jsx     ← full rewrite
    │   ├── StudentDashboardPage.jsx     ← enhanced, existing logic kept
    │   ├── TeacherFoldersPage.jsx       ← patched: deep-link support
    │   ├── StudentAnalyticsPage.jsx     ← NEW
    │   └── TeacherAnalyticsPage.jsx     ← NEW
    ├── router/
    │   └── AppRouter.jsx               ← 2 new routes added
    ├── components/layout/
    │   └── Navbar.jsx                  ← Analytics links added
    └── styles/
        └── global.css                  ← dashboard + analytics CSS added
```

---

## Database Changes

### Run order
```
1. database/dashboard_overview_schema.sql
2. database/dashboard_analytics_schema.sql
3. database/analytics_pages_schema.sql
4. database/analytics_word_detail_schema.sql
```

All files are safe to re-run (each starts with `DROP FUNCTION IF EXISTS`).

---

### dashboard_overview_schema.sql — RPC functions

| Function | Caller | Returns |
|---|---|---|
| `get_teacher_dashboard_overview()` | teacher | 1 row: 13 aggregate stats |
| `get_teacher_folder_overview()` | teacher | N rows: per-folder counts |
| `get_teacher_recent_activity()` | teacher | up to 20 recent items (folders, readings, glossary, join requests) |
| `get_student_dashboard_overview()` | student | 1 row: 9 aggregate stats |
| `get_student_recent_readings()` | student | up to 5 most recent accessible readings |
| `get_student_recent_personal_terms()` | student | up to 5 most recently added personal terms |
| `get_student_learning_recommendation()` | student | 1 row: adaptive learning recommendation |

All functions use `SECURITY DEFINER`, `SET search_path = public` and check `auth.uid()`.

Optional tables (`flashcard_review_state`, `flashcard_review_history`,
`student_bloom_activities`, `student_bloom_activity_responses`) are queried
via `EXECUTE ... USING` inside nested `BEGIN … EXCEPTION WHEN others THEN` blocks
so the function compiles and returns gracefully even if those tables do not exist.

---

### dashboard_analytics_schema.sql — RPC functions

| Function | Caller | Returns |
|---|---|---|
| `get_teacher_analytics_by_folder()` | teacher | per-folder: terms_added, terms_mastered, mastery_rate |
| `get_teacher_difficult_terms(p_limit)` | teacher | hardest terms sorted by lowest student mastery rate |
| `get_teacher_pending_join_requests()` | teacher | all pending requests across folders (used by dashboard widget) |
| `get_student_folder_progress()` | student | per-folder: terms_added, terms_mastered, mastery_rate |
| `get_student_bloom_stats()` | student | Bloom activity completion by cognitive level (optional) |

---

## Frontend Changes

### dashboardApi.js

12 exported functions, each calling the corresponding RPC via `supabase.rpc()`.
All numeric BigInt values returned by PostgreSQL are cast to `Number()`.

| Function | RPC |
|---|---|
| `getTeacherDashboardOverview()` | `get_teacher_dashboard_overview` |
| `getTeacherFolderOverview()` | `get_teacher_folder_overview` |
| `getTeacherRecentActivity()` | `get_teacher_recent_activity` |
| `getStudentDashboardOverview()` | `get_student_dashboard_overview` |
| `getStudentRecentReadings()` | `get_student_recent_readings` |
| `getStudentRecentPersonalTerms()` | `get_student_recent_personal_terms` |
| `getStudentLearningRecommendation()` | `get_student_learning_recommendation` |
| `getTeacherAnalyticsByFolder()` | `get_teacher_analytics_by_folder` |
| `getTeacherDifficultTerms(limit)` | `get_teacher_difficult_terms` |
| `getTeacherPendingJoinRequests()` | `get_teacher_pending_join_requests` |
| `getStudentFolderProgress()` | `get_student_folder_progress` |
| `getStudentBloomStats()` | `get_student_bloom_stats` |

---

### TeacherDashboardPage

**Layout:**
1. Hero banner (gradient, teacher name + subtitle)
2. Stats grid (13 cards: folders, students, requests, sections, readings, glossary, student activity)
3. Quick Actions (redesigned — see below)
4. Two-column section: Folder Overview table | Recent Activity feed
5. Student Analytics panel (tabbed charts)

**Quick Actions redesign:**
- `Manage Folders` → navigates to `/teacher/folders`
- `Join Requests (N)` → **expandable inline panel** — fetches all pending requests, allows approve/reject without leaving the dashboard. Badge shows count. Uses `get_teacher_pending_join_requests` + existing `approveFolderJoinRequest` / `rejectFolderJoinRequest` from `foldersApi.js`.
- `Recent Readings` → **expandable inline panel** — shows latest readings from recent activity data already loaded.
- `Manage Glossary` → navigates to `/teacher/folders`

**Student Analytics panel (TeacherAnalyticsPanel):**
Three tabs:
- **Student Engagement** — horizontal bar chart, terms saved per folder
- **Mastery Rate** — horizontal bar chart, % mastered per folder
- **Difficult Terms** — table sorted by lowest mastery rate (what students struggle with most)

---

### StudentDashboardPage

All existing functionality is preserved:
- Folder tree with expand/collapse
- Folder search input
- Sections → Readings → Glossary per folder
- Flashcard reminder badge (unchanged)

New sections added above the existing folder tree:
1. Hero banner
2. Stats grid (9 cards)
3. Recommendation card (adaptive, based on current state)
4. Progress panel (two animated progress bars)
5. Continue Learning (recent readings + recent personal terms with direct open links)
6. **My Learning Analytics** (StudentAnalyticsPanel — only shown when the student has at least 1 personal term)

**StudentAnalyticsPanel:**
Two side-by-side charts:
- **My Mastery by Folder** — horizontal bar chart, mastery rate % per folder
- **Bloom Activities by Level** — horizontal bar chart, answered activities per cognitive level

---

### TeacherFolderOverview component

The **Manage** button now uses React Router `state` to deep-link into the folder:
```jsx
<Link to="/teacher/folders" state={{ openFolderId: folder.folder_id }}>
  Manage
</Link>
```

---

### TeacherFoldersPage (patch)

Minimal non-breaking addition:
- `useLocation` imported from react-router-dom
- New `useEffect` reads `location.state?.openFolderId` after folders load, auto-expands
  that folder and scrolls to it smoothly
- Each folder `<article>` gets `id={`folder-${folder.id}`}` for the scroll target

This means clicking **Manage** on any folder in the dashboard sends the teacher directly
to that folder, expanded and scrolled into view.

---

### DashboardBarChart

Pure CSS horizontal bar chart component — no external chart library needed.
- Props: `data`, `labelKey`, `valueKey`, `maxValue`, `unit`, `color`, `emptyMessage`
- Colors: `primary` (indigo), `success` (green), `warning` (amber), `info` (sky), `muted`
- Bar widths are computed as `(value / max) * 100%` inline styles
- Value label renders inside the bar when wide enough, outside otherwise
- Gracefully shows `emptyMessage` when data is empty

---

### CSS additions (global.css)

**Fixes:**
- `.dashboard-section-grid > *` — `min-width: 0` prevents grid children from overflowing
- `.dashboard-section-grid` — changed to `3fr 2fr` proportions (folder overview gets more space)
- `.recent-activity-list` — `max-height: 480px; overflow-y: auto` prevents infinite growth

**New classes:**
- `.dashboard-action-card--btn` — button-style action card (for expandable panels)
- `.dashboard-action-card--active` — highlighted state when panel is open
- `.action-badge` — warning badge on Join Requests count
- `.quick-panel`, `.quick-panel-header`, `.quick-panel-item`, `.quick-panel-approve`,
  `.quick-panel-reject`, `.quick-panel-open` — expandable panel system
- `.analytics-panel`, `.analytics-tabs`, `.analytics-tab`, `.analytics-body` — tabbed analytics container
- `.bar-chart`, `.bar-chart-row`, `.bar-chart-label`, `.bar-chart-track`,
  `.bar-chart-bar`, `.bar-chart-bar--*`, `.bar-chart-bar-value`, `.bar-chart-out-value` — bar chart
- `.analytics-table`, `.analytics-mastery-badge--*` — difficult terms table
- `.analytics-student-grid`, `.analytics-student-block` — student two-column analytics layout

---

## Data Flow

### Teacher dashboard load sequence

```
TeacherDashboardPage mounts
  └── Promise.all([
        getTeacherDashboardOverview()  → 13 aggregate stats
        getTeacherFolderOverview()     → per-folder table rows
        getTeacherRecentActivity()     → 20 recent items (used also by readings panel)
      ])

User clicks "Join Requests"
  └── getTeacherPendingJoinRequests() → all pending requests
      User clicks "Approve" → approveFolderJoinRequest(requestId)
                            → refresh requests + overview

TeacherAnalyticsPanel mounts
  └── Promise.all([
        getTeacherAnalyticsByFolder() → engagement + mastery bars
        getTeacherDifficultTerms(12) → difficult terms table
      ])
```

### Student dashboard load sequence

```
StudentDashboardPage mounts
  ├── loadFoldersSectionsAndReadings()   (existing — folder tree)
  ├── getMyFlashcardReminder()           (existing — reminder badge)
  └── Promise.all([
        getStudentDashboardOverview()         → 9 stats
        getStudentRecentReadings()            → 5 recent accessible readings
        getStudentRecentPersonalTerms()       → 5 recent personal terms
        getStudentLearningRecommendation()    → adaptive recommendation
      ])

StudentAnalyticsPanel mounts (only if personal_terms_count > 0)
  └── Promise.all([
        getStudentFolderProgress()  → mastery per folder
        getStudentBloomStats()      → bloom completion (optional, silent fail)
      ])
```

---

## Learning Recommendation Logic

The `get_student_learning_recommendation()` function returns one of four recommendations:

| Condition | Type | Message |
|---|---|---|
| due flashcards > 0 | `review_flashcards` | Review X flashcards now → `/student/flashcards` |
| personal terms = 0 | `start_glossary` | Open a reading and select words → `/student/dashboard` |
| not mastered terms > 0 | `practice_vocabulary` | Practice X terms with flashcards → `/student/flashcards` |
| all mastered | `all_done` | Congratulations → `/student/dashboard` |

---

## Folder Deep-Link Flow

```
Teacher Dashboard
  └── TeacherFolderOverview "Manage" button
        └── <Link to="/teacher/folders" state={{ openFolderId: "uuid" }}>

TeacherFoldersPage
  └── useEffect reads location.state.openFolderId (runs when folders load)
        └── setExpandedFolders(prev => new Set([...prev, openFolderId]))
        └── setTimeout → document.getElementById(`folder-${id}`).scrollIntoView()
```

The folder page behaves identically when navigated to normally (state is undefined).

---

## Deployment Checklist

**SQL (run in order in Supabase SQL editor):**
- [ ] `database/dashboard_overview_schema.sql`
- [ ] `database/dashboard_analytics_schema.sql`
- [ ] `database/analytics_pages_schema.sql`
- [ ] `database/analytics_word_detail_schema.sql`
- [ ] Verify `notify pgrst, 'reload schema'` executed at end of each file

**Dashboard — Teacher:**
- [ ] Stats load, join request approve/reject works from dashboard
- [ ] Manage button on folder overview opens correct folder expanded
- [ ] Analytics tabs (Student Engagement / Mastery Rate / Difficult Terms) show charts

**Dashboard — Student:**
- [ ] Stats, recommendation, progress bars load
- [ ] Existing folder tree, search, expand still works
- [ ] My Learning Analytics section appears after first personal term is added

**Analytics Page — Teacher (`/teacher/analytics`):**
- [ ] Navbar "Analytics" link visible for teacher role
- [ ] Filter dropdowns populate (folders → sections → readings cascade)
- [ ] Student dropdown shows all students; filters to folder when folder selected
- [ ] Summary cards update when filters change
- [ ] Most Difficult Words chart shows correct data
- [ ] Student Comparison chart shows per-student mastery bars
- [ ] Bloom chart shows activity data (or empty state if no activities)
- [ ] Word Statistics table responds to sort tabs (Most Difficult / Popular / Mastered)
- [ ] Selecting a student shows individual view (comparison chart hidden, student bloom shown)

**Analytics Page — Student (`/student/analytics`):**
- [ ] Navbar "Analytics" link visible for student role
- [ ] Filter dropdowns populate from student's accessible content
- [ ] Summary cards update when filters change
- [ ] Progress bar chart title and grouping adapt to filter level
- [ ] Bloom chart shows or hides based on data
- [ ] Terms table shows filtered terms with mastery badges

**Security:**
- [ ] Teacher sees only own folders' student data
- [ ] Student sees only own terms and own bloom activities

---

## Security

All RPC functions:
- Use `SECURITY DEFINER` + `SET search_path = public`
- Check `auth.uid()` and raise exception if unauthenticated
- Teacher functions filter by `learning_folders.teacher_id = auth.uid()`
- Student functions filter by `student_id = auth.uid()` or via folder membership
- Visibility chain is enforced in student queries:
  `lf.is_visible_to_students AND fs.is_visible_to_students AND r.is_visible_to_students`

---

---

## Analytics Pages (NEW)

### Routes
| Path | Role | Component |
|---|---|---|
| `/student/analytics` | student | `StudentAnalyticsPage.jsx` |
| `/teacher/analytics` | teacher | `TeacherAnalyticsPage.jsx` |

Both are linked from the Navbar alongside Dashboard / Folders.

---

### database/analytics_pages_schema.sql — RPC functions

All 10 functions accept nullable filter parameters so any combination of filters works.
Conditional filter pattern: `(p_id is null or col = p_id)`.

**Student functions:**

| Function | Returns |
|---|---|
| `get_student_analytics_filters()` | Folder → Section → Reading hierarchy the student can access (for dropdowns) |
| `get_student_analytics_summary(p_folder_id, p_section_id, p_reading_id)` | total_terms, mastered, not_mastered, mastery_rate %, bloom_answers |
| `get_student_analytics_terms(p_folder_id, p_section_id, p_reading_id)` | Full term list with folder/section/reading context and mastery status |
| `get_student_analytics_bloom(p_folder_id, p_section_id, p_reading_id)` | Bloom completion by cognitive level (OPTIONAL, EXECUTE guard) |

**Teacher functions:**

| Function | Returns |
|---|---|
| `get_teacher_analytics_filters()` | Folder → Section → Reading hierarchy the teacher owns (for dropdowns) |
| `get_teacher_analytics_students(p_folder_id)` | All students with aggregate terms + mastery (for dropdown + comparison) |
| `get_teacher_analytics_summary(p_folder_id, p_section_id, p_reading_id, p_student_id)` | total_students, terms_saved, terms_mastered, avg_mastery_rate, bloom_answers |
| `get_teacher_analytics_word_stats(p_folder_id, p_section_id, p_reading_id, p_student_id)` | Per-word: students_saved count, students_mastered count, mastery %, reading/folder context |
| `get_teacher_analytics_bloom(p_folder_id, p_section_id, p_reading_id, p_student_id)` | Bloom completion by level, class-wide or per student (OPTIONAL, EXECUTE guard) |
| `get_teacher_analytics_student_comparison(p_folder_id, p_section_id, p_reading_id)` | Per-student: terms_added, terms_mastered, mastery_rate (for comparison chart) |

---

### analyticsApi.js

10 exported functions — each wraps the corresponding RPC via `supabase.rpc()`.
BigInt columns are cast with `Number()` via an internal `num()` helper.

**Import path (critical):** `import { supabase } from '../auth/supabaseClient';`

---

### StudentAnalyticsPage

**URL:** `/student/analytics`

**Layout:**
1. Hero banner
2. Filter bar — Folder → Section → Reading (cascading; next dropdown disabled until previous selected)
3. Summary cards (5): Total Terms | Mastered | To Master | Mastery Rate | Bloom Activities
4. Charts (2-col):
   - **Left — Vocabulary Progress bar chart**: title and grouping adapt to filter level:
     - No filter → mastery % by Folder
     - Folder selected → mastery % by Section
     - Section selected → mastery % by Reading
     - Reading selected → text hint to see terms table below
   - **Right — Bloom Activity Completion**: answered activities per cognitive level
5. Terms table (shown whenever terms exist): Word | Definition | Reading | Section | Folder | Status | Added date

**Filter cascade logic (frontend, `useMemo`):**
- `sections` filtered by `selectedFolder`
- `readings` filtered by `selectedFolder` + `selectedSection`
- Selecting a parent resets children (e.g. changing folder clears section + reading)

---

### TeacherAnalyticsPage

**URL:** `/teacher/analytics`

**Layout:**
1. Hero banner (changes subtitle when a student is selected)
2. Filter bar — Folder → Section → Reading → Student (student list refreshes when folder changes)
3. Summary cards (4 or 5): Active Students (hidden in single-student mode) | Terms Saved | Terms Mastered | Avg Mastery Rate | Bloom Activities
4. **Charts row 1** (2-col):
   - **Left — Most Difficult Words**: top 12 words sorted by lowest mastery %, bar chart
   - **Right**: when no student selected → **Student Comparison** (mastery % per student); when student selected → **Bloom Activities for that student**
5. **Charts row 2** (hidden in single-student mode, 2-col):
   - **Left — Bloom Activities by Level**: class-wide answers per cognitive level
   - **Right — Most Saved Words**: top 12 words by number of students who saved them
6. **Word Statistics Table** with sort tabs:
   - **Most Difficult** — sorted by mastery % ASC (what students fail most)
   - **Most Popular** — sorted by students_saved DESC (most frequently saved)
   - **Best Mastered** — sorted by mastery % DESC
   - Columns: Word | Reading | Section | Folder | Students Saved | Students Mastered | Mastery %
   - Each mastery cell shows a color badge (red < 30 %, yellow 30–70 %, green ≥ 70 %)

---

### Navbar changes

```jsx
// Student
<Link to="/student/analytics">Analytics</Link>

// Teacher
<Link to="/teacher/analytics">Analytics</Link>
```

---

### CSS additions for Analytics Pages (global.css)

New classes:
- `.analytics-page` — page max-width container
- `.analytics-filter-section` — white card wrapper for filter bar
- `.analytics-filter-bar` — flex row of filter groups
- `.analytics-filter-group` — label + select pair
- `.analytics-filter-label` — uppercase 12 px label
- `.analytics-filter-select` — select input with focus ring
- `.analytics-filter-reset` — reset button (turns red on hover)
- `.analytics-loading-hint` — subtle "Updating…" indicator
- `.analytics-charts-grid` — 2-col grid (`1fr 1fr`)
- `.analytics-chart-block` — card: white + border + shadow
- `.analytics-chart-title` / `.analytics-chart-caption` — typography inside chart block
- `.analytics-count-badge` — indigo pill badge next to section titles
- `.analytics-word-table-header` — flex row: title + sort tabs
- `.analytics-word-sort-tabs` / `.analytics-word-sort-tab` / `--active` — sort tab pills
- `.analytics-table-wrapper` — overflow-x: auto wrapper
- `.analytics-table-def` / `.analytics-table-date` / `.analytics-table-num` — cell variants

---

## Analytics Data Flow

### Student analytics page load sequence

```
StudentAnalyticsPage mounts
  └── getStudentAnalyticsFilters() → populate folder/section/reading dropdowns

User selects/changes any filter
  └── Promise.all([
        getStudentAnalyticsSummary(fId, sId, rId)   → 5 stat cards
        getStudentAnalyticsTerms(fId, sId, rId)     → terms table + progress chart data
        getStudentAnalyticsBloom(fId, sId, rId)     → bloom bar chart
      ])

Progress chart data: aggregated from terms in-browser by folder/section/reading level
```

### Teacher analytics page load sequence

```
TeacherAnalyticsPage mounts
  └── Promise.all([
        getTeacherAnalyticsFilters()       → populate folder/section/reading dropdowns
        getTeacherAnalyticsStudents(null)  → populate student dropdown
      ])

User changes folder filter
  └── getTeacherAnalyticsStudents(folderId) → refresh student list

User selects/changes any filter
  └── Promise.all([
        getTeacherAnalyticsSummary(fId, sId, rId, stId)          → stat cards
        getTeacherAnalyticsWordStats(fId, sId, rId, stId)         → word table + charts
        getTeacherAnalyticsBloom(fId, sId, rId, stId)             → bloom chart
        !stId → getTeacherAnalyticsStudentComparison(fId, sId, rId) → comparison chart
      ])

Word table sorting: in-browser sort of wordStats array by sortMode state
('difficult' | 'popular' | 'mastered')
```

---

---

## Fixes (post-initial implementation)

### 1. analyticsApi.js — wrong import path
**Bug:** `import { supabase } from '../supabaseClient'` — file does not exist at that path.  
**Fix:** Changed to `import { supabase } from '../auth/supabaseClient'` (matches all other API files).

### 2. Teacher Analytics — data never loaded on first render
**Bug:** The data-loading `useEffect` started with `if (loading) return`. Since `loading` was `true`
on first mount, the effect exited early. After filters loaded and `loading` became `false`, the
dependency array `[selectedFolder, …]` had not changed, so the effect never re-fired → charts
always showed empty state with "All Folders" selected.  
**Fix:** Added `loading` to the dependency array of both the data-loading effect and the
student-list-refresh effect. When `loading` flips to `false`, both effects re-fire and populate
the page.

### 3. Teacher Dashboard — Folder Overview cut off inside grid
**Bug:** `TeacherFolderOverview` was inside a `3fr / 2fr` CSS grid alongside Recent Activity.
Grid row height is controlled by the tallest column, and with a height-capped Recent Activity
list, the folder table appeared truncated or misaligned for teachers with several folders.  
**Fix:** Moved Folder Overview into its own full-width `<section>` above Recent Activity,
removing both from the `dashboard-section-grid`. Now the table expands to show all folders
with no height constraint.

### 4. Interactive bar charts
**Change:** `DashboardBarChart` now accepts an optional `onBarClick(item)` prop.
When provided, each bar row gets `cursor: pointer`, a hover highlight
(`.bar-chart-row--clickable`), and fires `onBarClick` with the full data object on click
(also handles `Enter` / `Space` for keyboard accessibility).

**Student Analytics — progress chart click to filter:**
- `buildProgressData` now stores the `id` field (folder/section/reading UUID) alongside `label`.
- Clicking a bar sets the appropriate filter level:
  - No folder active → sets `selectedFolder`
  - Folder active, no section → sets `selectedSection`
  - Section active, no reading → sets `selectedReading`
- A "Click a bar to filter by folder/section/reading" hint appears below the chart.

**Teacher Analytics — student comparison click to filter:**
- `comparisonChartData` now carries `student_id` on each item.
- Clicking a student bar sets `selectedStudent` to that student's UUID.
- "Click a bar to filter by student." hint appears in the chart caption.

### 5. Word detail panel — click to see who saved a word
**Change:** Clicking a bar in the "Most Difficult Words" or "Most Saved Words" chart (and any row
in the Word Statistics table) opens an inline detail panel showing exactly which students saved
that specific word and how many Bloom activities they have completed for it.

**New SQL functions (`analytics_word_detail_schema.sql`):**
- `get_teacher_analytics_word_detail(p_selected_text, p_reading_id)` — returns one row per
  student who saved the word from that reading: `student_id`, `student_name`, `is_mastered`,
  `saved_at`. Scoped to the authenticated teacher's content via a join on `learning_folders`.
- `get_teacher_analytics_word_bloom(p_selected_text, p_reading_id)` — returns per-student Bloom
  activity counts (`bloom_total`, `bloom_answered`) using the `EXECUTE … EXCEPTION WHEN others`
  pattern so the function compiles and returns empty if Bloom tables do not exist.

**New API functions (`analyticsApi.js`):**
- `getTeacherAnalyticsWordDetail(selectedText, readingId)`
- `getTeacherAnalyticsWordBloom(selectedText, readingId)`

**`TeacherAnalyticsPage.jsx` changes:**
- `useRef` added to React imports; `wordDetailRef` attached to the panel for auto-scroll.
- Three new state vars: `selectedWord`, `wordDetail`, `wordDetailLoading`.
- `onWordBarClick(item)` — async handler: sets `selectedWord`, fires both RPC calls in parallel,
  merges Bloom results into the detail rows by `student_id`, scrolls the panel into view.
- "Most Difficult Words" and "Most Saved Words" chart data mappings now include `selected_text`,
  `reading_id`, `reading_title`, `students_saved`, `students_mastered` so `onWordBarClick`
  receives all the data it needs.
- Both charts now have `onBarClick={onWordBarClick}` and a "Click a bar to see which students
  saved this word." hint.
- Word Statistics table rows are also clickable via the same handler and receive the
  `.analytics-table-row--clickable` CSS class.
- Detail panel (`word-detail-panel`) sits between the charts and the word stats table. It renders
  a header (word, reading, counts) with a close button, then a student table with: name, mastery
  badge, saved date, Bloom total, Bloom answered.

**New CSS classes in `global.css`:**
`.word-detail-panel`, `.word-detail-header`, `.word-detail-title`, `.word-detail-meta`,
`.word-detail-close`, `.analytics-table-row--clickable`

**Data flow:**
```
user clicks bar (Most Saved / Most Difficult) or table row
  → onWordBarClick({ selected_text, reading_id, … })
  → setSelectedWord(word) → panel appears (loading state)
  → Promise.all([
      get_teacher_analytics_word_detail(text, readingId),
      get_teacher_analytics_word_bloom(text, readingId)
    ])
  → merge by student_id → setWordDetail(rows)
  → panel renders student table
  → wordDetailRef scrolls into view
  → close button → setSelectedWord(null)
```

---

## Known Limitations / Future Work

- **Charts are CSS-only** — no zoom, tooltip or hover detail. Could be enhanced with
  Recharts or Chart.js in a future PR.
- **Recent Readings quick panel** — links go to `/teacher/folders` since there is no
  dedicated teacher reading route. A `/teacher/reading/:id` route would improve this.
- **Analytics by reading** — currently only by folder. A "by reading" breakdown would
  require an additional SQL function and UI selector.
- **Time-series charts** — activity over time (e.g. terms added per week) would require
  storing timestamps and building a histogram function.
- **spanish_translation** in `get_student_recent_personal_terms` depends on
  `translation_feature_schema.sql` having been applied. Remove that column from the
  function if the translation migration was not run.
