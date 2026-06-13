# Feature: Glossary Enhancements — PDF Export + Word Pronunciation + Real-time Notifications
**Branch:** `feature/glossary-enhancements`  
**Status:** Complete

---

## Objective

Three complementary enhancements delivered in this branch:

1. **PDF Export** — Students can download their personal glossary for a reading as a
   formatted PDF file, including word, definition, Spanish translation (when available),
   mastery status, and date saved.

2. **Word Pronunciation** — A speaker button (🔊) appears next to each word in the
   reading term panel and in the personal glossary. Clicking it plays a real human
   pronunciation audio (English). Only shown when the reading has DeepL translation
   enabled, which signals the reading is in a foreign language (English) and pronunciation
   is pedagogically relevant.

3. **Real-time Notifications** — A notification bell (🔔) in the Navbar subscribes to
   Supabase Realtime and delivers instant in-app notifications without page reload:
   teachers are notified when a student requests to join a folder; students are notified
   when their request is approved or rejected.

---

## Architecture

```
feature/glossary-enhancements
└── frontend/src/
    ├── main.jsx                        ← MODIFIED: added NotificationProvider
    ├── context/
    │   └── NotificationContext.jsx     ← NEW: Supabase Realtime subscriptions + state
    ├── utils/
    │   └── pronunciation.js            ← NEW shared pronunciation utility
    ├── api/
    │   └── dictionaryApi.js            ← MODIFIED: now returns audioUrl
    └── components/
        ├── layout/
        │   └── Navbar.jsx              ← MODIFIED: NotificationBell added
        ├── ui/
        │   └── NotificationBell.jsx    ← NEW: bell icon + dropdown panel
        └── readings/
            ├── ReadingTermPanel.jsx    ← MODIFIED: 🔊 button in word header
            └── StudentPersonalGlossary.jsx ← MODIFIED: 🔊 button + Export PDF button
```

**New npm dependencies:** `jspdf` + `jspdf-autotable` (PDF generation)

---

## Feature 1 — PDF Export (two entry points)

There are two independent PDF exports, each with a different scope:

| Entry point | File | Scope | Grouping |
|-------------|------|-------|---------|
| Personal Glossary (reading page) | `StudentPersonalGlossary.jsx` | Terms for one reading | Single table |
| Analytics page | `StudentAnalyticsPage.jsx` | All terms (respects active filters) | One table per reading, with headers |

---

### 1a — Per-reading export (`StudentPersonalGlossary`)

#### Where
Button "↓ Export PDF" in the header of the `StudentPersonalGlossary` component,
visible only when the student has at least one term saved.

### What it generates
A formatted PDF named `{reading_title}_glossary.pdf` containing:

| Column | Content |
|--------|---------|
| Word | The selected text (bold) |
| Definition | English definition or `—` |
| Translation (ES) | Spanish translation — column only appears if at least one term has a translation |
| Status | "Mastered" (green) / "Learning" (orange) |
| Added | Save date in `DD Mon YYYY` format |

### Implementation
- Library: `jsPDF` + `jspdf-autotable`
- Color coding in Status column via `didParseCell` hook
- Header row styled with primary color (`#6366F1`)
- Title and export date printed above the table
- Translation column is conditionally included: only shown if
  `terms.some(t => t.spanish_translation)` — this means the PDF adapts
  to whether the reading had DeepL enabled

### Data flow
```
Student clicks "↓ Export PDF"
  → handleExportPdf()
  → reads local `terms` state (already loaded — no extra network call)
  → new jsPDF() + autoTable(doc, { head, body, … })
  → doc.save('reading_title_glossary.pdf')
  → browser triggers file download
```

---

### 1b — Analytics export grouped by reading (`StudentAnalyticsPage`)

#### Where
Button "↓ Export PDF" in the header of the "My Terms" section on
`/student/analytics`. Visible whenever `terms.length > 0`.

#### What it generates
A single PDF named `my_vocabulary.pdf` containing:

1. **Cover header**: title in primary purple, active filter label, export date, total term count and reading count.
2. **One block per reading** (in the same order as the current table view):
   - Reading title (bold)
   - Breadcrumb: `Folder Name › Section Name` (grey, small)
   - Table: Word | Definition | Status (coloured) | Added

#### Grouping logic
```js
function groupTermsByReading(terms) {
  // Preserves the existing sort order (not-mastered first, then by reading)
  // Groups consecutive terms with the same reading_id into a bucket
  const order = [];
  const map   = new Map();
  for (const t of terms) {
    if (!map.has(t.reading_id)) {
      map.set(t.reading_id, { reading_title, section_name, folder_name, terms: [] });
      order.push(t.reading_id);
    }
    map.get(t.reading_id).terms.push(t);
  }
  return order.map(id => map.get(id));
}
```

#### Respects active filters
The export uses whatever `terms` is currently in state — so if the student has
selected Folder X → Section Y, the PDF only contains those terms. The filter label
is printed in the cover header so the exported file is self-documenting.

#### Page management
After each table, `doc.lastAutoTable.finalY` is read. If less than 255 px remain
before the next reading block, a new page is added. Within a single table,
`jspdf-autotable` handles row page-breaks automatically.

#### Data flow
```
Student applies filters (or leaves "All Folders")
  → terms state already loaded from get_student_analytics_terms RPC
Student clicks "↓ Export PDF"
  → handleExportPdf()
  → groupTermsByReading(terms)
  → for each group:
       doc.text(reading_title + breadcrumb)
       autoTable(doc, { startY, head, body, … })
       y = doc.lastAutoTable.finalY + 14
       if (y > 255) doc.addPage()
  → doc.save('my_vocabulary.pdf')
  → browser file download (no network call)
```

---

## Feature 2 — Word Pronunciation

### Design decision: only for translation-enabled readings
The 🔊 button is intentionally restricted to readings where the teacher has enabled
DeepL translation (`isTranslationEnabled === true`). The reasoning:

- Translation enabled → reading is in English (foreign language for the student)
- Pronunciation of foreign words is a core language-learning need
- If translation is disabled the reading is likely in the student's native language,
  making English pronunciation less relevant or potentially confusing

In `StudentPersonalGlossary`, the proxy for this is `term.spanish_translation !== null`:
if a term has a stored Spanish translation, it was saved from a translation-enabled reading.

### Audio resolution — two-tier approach

```
User clicks 🔊 on a word
  │
  ▼
pronounceWord(text)           [src/utils/pronunciation.js]
  │
  ├─ fetchDictionaryDefinition(text)
  │     Free Dictionary API → GET /api/v2/entries/en/{word}
  │     extracts phonetics[].audio  (prefers '-us' accent)
  │
  ├─ audioUrl found?
  │     YES → new Audio(audioUrl).play()
  │            Real MP3 recorded by native speaker ✓
  │
  └─ NO audioUrl (word not in API, multi-word, technical term…)
        → fallbackSpeech(text)
              window.speechSynthesis — Web Speech API
              Waits for voiceschanged event if voices not loaded yet
              Voice priority:
                1. Google US English
                2. Microsoft US English
                3. Any en-US voice
                4. Any en-* voice
```

### Known limitations of the audio tier

| Case | Behaviour |
|------|-----------|
| Common single English word | MP3 from Free Dictionary API ✓ |
| Technical / uncommon single word | Web Speech fallback |
| Multi-word expression (2+ words) | Web Speech fallback — API only supports single words |
| Browser without Web Speech API | Button not rendered (graceful hide) |
| No internet connection | Web Speech fallback (runs locally) |

The inconsistency between single words (some native, some Web Speech) is a known
limitation of the Free Dictionary API's coverage — not all English words have recorded
audio in their dataset.

### Where the button appears

**`ReadingTermPanel.jsx`** — next to the word title when a student selects text:
- Condition: `isTranslationEnabled && pronunciationSupported && !loading`
- Visual feedback: `.pronunciation-btn--speaking` CSS class scales the button
  for 800 ms after clicking

**`StudentPersonalGlossary.jsx`** — on each saved term card:
- Condition: `term.spanish_translation && pronunciationSupported`
- Each card tracks its own `speakingId` so the animation is per-card

### Changes to `dictionaryApi.js`

`fetchDictionaryDefinition` now also extracts `audioUrl` from the response:

```js
// Before — only returned: found, word, definition, partOfSpeech, example
// After  — also returns: audioUrl

const phonetics = entry.phonetics ?? [];
const audioUrl =
  phonetics.find(p => p.audio?.includes('-us'))?.audio ||  // prefer US accent
  phonetics.find(p => p.audio)?.audio ||                    // any accent
  null;

return { found: true, word, definition, partOfSpeech, example, audioUrl };
```

---

## CSS classes added (`global.css`)

| Class | Purpose |
|-------|---------|
| `.pronunciation-btn` | Speaker button — borderless, 28×28px, hover highlights |
| `.pronunciation-btn--speaking` | Scale animation while audio plays |
| `.student-glossary-header` | Flex row: glossary title + Export PDF button |
| `.glossary-export-btn` | Export PDF button style |

---

## Data flow — full sequence for pronunciation

```
[ReadingTermPanel]
Student selects text in reading
  → isTranslationEnabled? YES → 🔊 button rendered
  → Student clicks 🔊
  → pronounceWord(selectedText)
      → fetchDictionaryDefinition(selectedText)
          → GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}
          → parse phonetics → extract audioUrl
      → audioUrl? YES → new Audio(url).play()
                  NO  → fallbackSpeech(selectedText)
                            → getVoices() → pick best en-US
                            → speechSynthesis.speak(utterance)

[StudentPersonalGlossary]
Student clicks 🔊 on a saved glossary card
  → term.spanish_translation !== null? YES → button shown
  → same pronounceWord() call as above
  → setSpeakingId(term.id) → animation for that specific card
```

---

## Data flow — PDF export sequence

```
[StudentPersonalGlossary]
terms already loaded in local state from getMyPersonalGlossaryForReading(readingId)

Student clicks "↓ Export PDF"
  → handleExportPdf()
  → const hasTranslation = terms.some(t => t.spanish_translation)
  → build head[] and body[] arrays from terms state
  → new jsPDF()
  → doc.text(title, date)
  → autoTable(doc, { head, body, styles, headStyles, didParseCell })
      didParseCell: colour Status column green/orange
  → doc.save('{reading_name}_glossary.pdf')
  → browser download triggered (no server involved)
```

---

## Deployment

No SQL changes required — this is a pure frontend enhancement.

**npm install required:**
```
npm install jspdf jspdf-autotable
```

**Files changed:**
- `frontend/src/utils/pronunciation.js` — NEW
- `frontend/src/api/dictionaryApi.js` — MODIFIED
- `frontend/src/components/readings/ReadingTermPanel.jsx` — MODIFIED
- `frontend/src/components/readings/StudentPersonalGlossary.jsx` — MODIFIED
- `frontend/src/styles/global.css` — MODIFIED (CSS classes appended)
- `frontend/package.json` — MODIFIED (jspdf + jspdf-autotable added)

---

---

## Feature 3 — Real-time Notifications (Supabase Realtime)

### How Supabase Realtime works here
Supabase exposes a WebSocket connection via `supabase.channel()`. By subscribing to
`postgres_changes`, the client receives events (INSERT / UPDATE / DELETE) on a table
in real time. RLS applies: each user only receives events they are allowed to SELECT.

### Provider placement
```
main.jsx
  AuthProvider          ← provides user + profile
    NotificationProvider  ← reads user/profile, opens WS channel
      App
        Navbar + Routes
```

`NotificationProvider` must be **inside** `AuthProvider` because it uses `useAuth()`
to know the user's role before subscribing.

### Subscription logic (`NotificationContext.jsx`)

**Teacher** — subscribes to `INSERT` on `folder_join_requests`:
```
Event: INSERT on folder_join_requests
RLS filter (automatic): only requests for teacher's own folders reach the client
→ addNotification({ type: 'new_request', link: '/teacher/folders' })
```

**Student** — subscribes to `UPDATE` on `folder_join_requests` with explicit filter:
```
filter: student_id=eq.{user.id}
Event: UPDATE → check payload.new.status
  'approved' → addNotification({ type: 'approved', link: '/student/dashboard' })
  'rejected' → addNotification({ type: 'rejected', link: '/join' })
```

Channel is torn down and rebuilt whenever `user` or `profile` changes
(logout / re-login handled automatically via the `useEffect` cleanup).

### UI — `NotificationBell.jsx`
- Bell icon in Navbar, visible to all authenticated users
- Red badge shows unread count (capped at "9+")
- Opening the dropdown marks all as read
- Each notification shows: icon | title | message | time ago
- Clicking a notification navigates to `notification.link` and dismisses it
- "Clear all" button removes all notifications
- Click-outside closes the dropdown

### Notification types

| Type | Who | Icon | Trigger | Link |
|------|-----|------|---------|------|
| `new_request` | Teacher | 🔔 | Student requests to join folder | `/teacher/folders` |
| `approved` | Student | ✅ | Teacher approves request | `/student/dashboard` |
| `rejected` | Student | ❌ | Teacher rejects request | `/join` |

### Data flow
```
[Teacher side]
Student submits join request
  → INSERT into folder_join_requests (via request_join_folder_by_code RPC)
  → Supabase Realtime emits INSERT event
  → Teacher's channel receives event (RLS: only their folders)
  → addNotification({ type: 'new_request' })
  → Bell badge increments, dropdown shows notification
  → Teacher clicks notification → navigate('/teacher/folders')

[Student side]
Teacher approves/rejects in TeacherFoldersPage
  → approve_folder_join_request / reject_folder_join_request RPC
  → UPDATE on folder_join_requests
  → Supabase Realtime emits UPDATE (filter: student_id=eq.{id})
  → addNotification({ type: 'approved' | 'rejected' })
  → Student sees notification in Navbar → clicks → dashboard/join page
```

### CSS classes added

| Class | Purpose |
|-------|---------|
| `.notification-bell` | Wrapper with `position: relative` |
| `.notification-bell-btn` | Ghost button for the 🔔 icon |
| `.notification-badge` | Red dot with count (top-right corner) |
| `.notification-dropdown` | Absolute-positioned panel, z-index 1000 |
| `.notification-dropdown-header` | Title + "Clear all" row |
| `.notification-list` | Scrollable list (max 360px) |
| `.notification-item` | One row: icon + body + dismiss button |
| `.notification-item--unread` | Blue-tinted background for unread |
| `.notification-body` | title + message + time |
| `.notification-dismiss` | ✕ button, hover red |

---

## Deployment

No SQL changes required — all features are pure frontend.

**npm install required (already done):**
```
npm install jspdf jspdf-autotable
```

**Files changed:**
- `frontend/src/main.jsx` — MODIFIED (NotificationProvider added)
- `frontend/src/context/NotificationContext.jsx` — NEW
- `frontend/src/components/ui/NotificationBell.jsx` — NEW
- `frontend/src/components/layout/Navbar.jsx` — MODIFIED
- `frontend/src/utils/pronunciation.js` — NEW
- `frontend/src/api/dictionaryApi.js` — MODIFIED
- `frontend/src/components/readings/ReadingTermPanel.jsx` — MODIFIED
- `frontend/src/components/readings/StudentPersonalGlossary.jsx` — MODIFIED (per-reading PDF export removed; pronunciation retained)
- `frontend/src/pages/StudentAnalyticsPage.jsx` — MODIFIED (PDF groups by folder then reading; single export entry point)
- `frontend/src/pages/HomePage.jsx` — MODIFIED (all features listed; role cards and feature grid updated)
- `frontend/src/styles/global.css` — MODIFIED (CSS classes appended; features grid 3-column)
- `frontend/package.json` — MODIFIED (jspdf + jspdf-autotable added)
- `frontend/vercel.json` — NEW (SPA routing rewrites for Vercel deployment)

**Supabase configuration:** Realtime must be enabled for the `folder_join_requests`
table in the Supabase dashboard → Table Editor → Realtime toggle ON.

---

## Known Limitations / Future Work

- **Multi-word expressions** have no MP3 audio — Free Dictionary API is single-word only.
  A future improvement could split the phrase and pronounce each word sequentially, or
  integrate a TTS API (e.g. Google Cloud TTS, ElevenLabs) for full phrase support.
- **PDF styling** is basic — future version could include the app logo, student name
  from `profiles`, and a QR code linking back to the reading.
- **Export from Analytics page** — the `StudentAnalyticsPage` terms table shows all
  terms across all readings; a global export from there would complement the per-reading
  export implemented here.
- **Phonetic transcription** — the Free Dictionary API also returns IPA phonetic strings
  (e.g. `/ˈvɒkjʊləri/`). These could be displayed below the word in the panel for
  additional learning value.
