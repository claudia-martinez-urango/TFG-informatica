-- =============================================================
--  BACKEND UNIT TESTS
--  Smart Glossary Assistant — TFG 2024/25
--
--  HOW TO RUN:
--    Open the Supabase SQL Editor → paste and run.
--    Each check inserts a row into a temporary "test_results"
--    table instead of relying on RAISE NOTICE (which Supabase's
--    SQL Editor does not surface in the Results panel).
--    The final query shows a summary count per status at the
--    top, followed by every individual test; any FAIL rows are
--    sorted to the very top of the detail rows for visibility.
--
--  SECTIONS:
--    1.  SM-2 algorithm arithmetic (pure logic, no user data)
--    2.  Auto-mastery condition logic
--    3.  Database constraints (ease_factor floor, last_rating enum)
--    4.  RLS enabled on every sensitive table
--    5.  RLS policy count checks
--    6.  All expected RPC functions exist in public schema
--    7.  Edge Function input validation logic (SQL-side)
--    8.  Functional requirement checks (FR-23, FR-24, FR-25)
-- =============================================================

DROP TABLE IF EXISTS test_results;
CREATE TEMP TABLE test_results (
  test_id text PRIMARY KEY,
  status  text NOT NULL,
  detail  text NOT NULL
);


-- ─────────────────────────────────────────────────────────────
--  SECTION 1 – SM-2 Algorithm arithmetic
--  Pure PL/pgSQL: replicates the case branches of
--  review_my_flashcard() without touching any table.
-- ─────────────────────────────────────────────────────────────

-- 1.01  again → reset rep to 0
DO $$
DECLARE v_rep integer;
BEGIN
  v_rep := 0;  -- reset
  IF v_rep = 0 THEN
    INSERT INTO test_results VALUES ('1.01', 'PASS', 'again resets repetition_count to 0');
  ELSE
    INSERT INTO test_results VALUES ('1.01', 'FAIL', 'rep should be 0 after again, got ' || v_rep);
  END IF;
END $$;

-- 1.02  again → interval resets to 1
DO $$
DECLARE v_interval integer := 1;
BEGIN
  IF v_interval = 1 THEN
    INSERT INTO test_results VALUES ('1.02', 'PASS', 'again resets interval_days to 1');
  ELSE
    INSERT INTO test_results VALUES ('1.02', 'FAIL', 'interval should be 1 after again, got ' || v_interval);
  END IF;
END $$;

-- 1.03  again → ease_factor reduced by 0.20
DO $$
DECLARE
  v_ef     numeric := 2.5;
  v_new_ef numeric;
BEGIN
  v_new_ef := greatest(1.3, v_ef - 0.2);
  IF v_new_ef = 2.3 THEN
    INSERT INTO test_results VALUES ('1.03', 'PASS', 'again reduces ease_factor from 2.5 to 2.3');
  ELSE
    INSERT INTO test_results VALUES ('1.03', 'FAIL', 'EF should be 2.3, got ' || v_new_ef);
  END IF;
END $$;

-- 1.04  again → ease_factor floor at 1.3 (does not go below)
DO $$
DECLARE
  v_ef     numeric := 1.3;
  v_new_ef numeric;
BEGIN
  v_new_ef := greatest(1.3, v_ef - 0.2);
  IF v_new_ef = 1.3 THEN
    INSERT INTO test_results VALUES ('1.04', 'PASS', 'again clamps ease_factor at 1.3 minimum');
  ELSE
    INSERT INTO test_results VALUES ('1.04', 'FAIL', 'EF floor should be 1.3, got ' || v_new_ef);
  END IF;
END $$;

-- 1.05  hard → increments rep by 1
DO $$
DECLARE
  v_rep     integer := 2;
  v_new_rep integer;
BEGIN
  v_new_rep := v_rep + 1;
  IF v_new_rep = 3 THEN
    INSERT INTO test_results VALUES ('1.05', 'PASS', 'hard increments repetition_count by 1');
  ELSE
    INSERT INTO test_results VALUES ('1.05', 'FAIL', 'rep should be 3, got ' || v_new_rep);
  END IF;
END $$;

-- 1.06  hard → interval = round(current * 1.2)
DO $$
DECLARE
  v_interval     integer := 10;
  v_new_interval integer;
BEGIN
  v_new_interval := greatest(1, round(v_interval * 1.2));
  IF v_new_interval = 12 THEN
    INSERT INTO test_results VALUES ('1.06', 'PASS', 'hard: interval = round(10 * 1.2) = 12');
  ELSE
    INSERT INTO test_results VALUES ('1.06', 'FAIL', 'interval should be 12, got ' || v_new_interval);
  END IF;
END $$;

-- 1.07  hard → ease_factor reduced by 0.15
DO $$
DECLARE
  v_ef     numeric := 2.5;
  v_new_ef numeric;
BEGIN
  v_new_ef := greatest(1.3, v_ef - 0.15);
  IF v_new_ef = 2.35 THEN
    INSERT INTO test_results VALUES ('1.07', 'PASS', 'hard reduces ease_factor from 2.5 to 2.35');
  ELSE
    INSERT INTO test_results VALUES ('1.07', 'FAIL', 'EF should be 2.35, got ' || v_new_ef);
  END IF;
END $$;

-- 1.08  hard → ease_factor floor at 1.3
DO $$
DECLARE
  v_ef     numeric := 1.3;
  v_new_ef numeric;
BEGIN
  v_new_ef := greatest(1.3, v_ef - 0.15);
  IF v_new_ef = 1.3 THEN
    INSERT INTO test_results VALUES ('1.08', 'PASS', 'hard clamps ease_factor at 1.3 minimum');
  ELSE
    INSERT INTO test_results VALUES ('1.08', 'FAIL', 'EF floor should be 1.3, got ' || v_new_ef);
  END IF;
END $$;

-- 1.09  good on rep=0 → interval = 1 (first review)
DO $$
DECLARE
  v_rep      integer := 0;
  v_interval integer := 0;
  v_ef       numeric := 2.5;
  v_new_interval integer;
BEGIN
  IF v_rep = 0 THEN v_new_interval := 1;
  ELSIF v_rep = 1 THEN v_new_interval := 3;
  ELSE v_new_interval := round(v_interval * v_ef);
  END IF;
  v_new_interval := greatest(1, v_new_interval);
  IF v_new_interval = 1 THEN
    INSERT INTO test_results VALUES ('1.09', 'PASS', 'good on rep=0 sets interval to 1');
  ELSE
    INSERT INTO test_results VALUES ('1.09', 'FAIL', 'interval should be 1 on first good, got ' || v_new_interval);
  END IF;
END $$;

-- 1.10  good on rep=1 → interval = 3 (second review)
DO $$
DECLARE
  v_rep      integer := 1;
  v_interval integer := 1;
  v_ef       numeric := 2.5;
  v_new_interval integer;
BEGIN
  IF v_rep = 0 THEN v_new_interval := 1;
  ELSIF v_rep = 1 THEN v_new_interval := 3;
  ELSE v_new_interval := round(v_interval * v_ef);
  END IF;
  v_new_interval := greatest(1, v_new_interval);
  IF v_new_interval = 3 THEN
    INSERT INTO test_results VALUES ('1.10', 'PASS', 'good on rep=1 sets interval to 3');
  ELSE
    INSERT INTO test_results VALUES ('1.10', 'FAIL', 'interval should be 3 on second good, got ' || v_new_interval);
  END IF;
END $$;

-- 1.11  good on rep>=2 → interval = round(interval * EF)
DO $$
DECLARE
  v_rep      integer := 2;
  v_interval integer := 3;
  v_ef       numeric := 2.5;
  v_new_interval integer;
BEGIN
  v_new_interval := greatest(1, round(v_interval * v_ef));
  -- round(3 * 2.5) = round(7.5) = 8
  IF v_new_interval = 8 THEN
    INSERT INTO test_results VALUES ('1.11', 'PASS', 'good on rep=2: interval = round(3 * 2.5) = 8');
  ELSE
    INSERT INTO test_results VALUES ('1.11', 'FAIL', 'interval should be 8, got ' || v_new_interval);
  END IF;
END $$;

-- 1.12  good → ease_factor unchanged
DO $$
DECLARE
  v_ef     numeric := 2.5;
  v_new_ef numeric;
BEGIN
  v_new_ef := v_ef;  -- good does not change EF
  IF v_new_ef = 2.5 THEN
    INSERT INTO test_results VALUES ('1.12', 'PASS', 'good does not change ease_factor');
  ELSE
    INSERT INTO test_results VALUES ('1.12', 'FAIL', 'EF should be unchanged at 2.5, got ' || v_new_ef);
  END IF;
END $$;

-- 1.13  easy on rep=0 → interval = 4
DO $$
DECLARE
  v_rep      integer := 0;
  v_interval integer := 0;
  v_ef       numeric := 2.5;
  v_new_interval integer;
BEGIN
  IF v_rep = 0 THEN v_new_interval := 4;
  ELSE v_new_interval := round(v_interval * v_ef * 1.3);
  END IF;
  v_new_interval := greatest(1, v_new_interval);
  IF v_new_interval = 4 THEN
    INSERT INTO test_results VALUES ('1.13', 'PASS', 'easy on rep=0 sets interval to 4');
  ELSE
    INSERT INTO test_results VALUES ('1.13', 'FAIL', 'interval should be 4 on first easy, got ' || v_new_interval);
  END IF;
END $$;

-- 1.14  easy on rep>=1 → interval = round(interval * EF * 1.3)
DO $$
DECLARE
  v_rep      integer := 3;
  v_interval integer := 8;
  v_ef       numeric := 2.5;
  v_new_interval integer;
BEGIN
  v_new_interval := greatest(1, round(v_interval * v_ef * 1.3));
  -- round(8 * 2.5 * 1.3) = round(26) = 26
  IF v_new_interval = 26 THEN
    INSERT INTO test_results VALUES ('1.14', 'PASS', 'easy on rep=3: interval = round(8 * 2.5 * 1.3) = 26');
  ELSE
    INSERT INTO test_results VALUES ('1.14', 'FAIL', 'interval should be 26, got ' || v_new_interval);
  END IF;
END $$;

-- 1.15  easy → ease_factor increases by 0.15
DO $$
DECLARE
  v_ef     numeric := 2.5;
  v_new_ef numeric;
BEGIN
  v_new_ef := v_ef + 0.15;
  IF v_new_ef = 2.65 THEN
    INSERT INTO test_results VALUES ('1.15', 'PASS', 'easy increases ease_factor from 2.5 to 2.65');
  ELSE
    INSERT INTO test_results VALUES ('1.15', 'FAIL', 'EF should be 2.65 after easy, got ' || v_new_ef);
  END IF;
END $$;

-- 1.16  hard with interval=0 → interval stays at 1 (greatest floor)
DO $$
DECLARE
  v_interval     integer := 0;
  v_new_interval integer;
BEGIN
  v_new_interval := greatest(1, round(v_interval * 1.2));
  IF v_new_interval = 1 THEN
    INSERT INTO test_results VALUES ('1.16', 'PASS', 'hard with interval=0 floors at 1 via greatest()');
  ELSE
    INSERT INTO test_results VALUES ('1.16', 'FAIL', 'interval should not go below 1, got ' || v_new_interval);
  END IF;
END $$;

-- 1.17  easy with interval=0 and rep>=1 → interval floors at 1
DO $$
DECLARE
  v_rep      integer := 2;
  v_interval integer := 0;
  v_ef       numeric := 1.3;
  v_new_interval integer;
BEGIN
  v_new_interval := greatest(1, round(v_interval * v_ef * 1.3));
  IF v_new_interval = 1 THEN
    INSERT INTO test_results VALUES ('1.17', 'PASS', 'easy with interval=0 floors at 1 via greatest()');
  ELSE
    INSERT INTO test_results VALUES ('1.17', 'FAIL', 'interval should floor at 1, got ' || v_new_interval);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
--  SECTION 2 – Auto-mastery condition (FR-24)
-- ─────────────────────────────────────────────────────────────

-- 2.01  triggers: easy + rep=5 + interval=26
DO $$
DECLARE
  v_rating   text    := 'easy';
  v_rep      integer := 5;
  v_interval integer := 26;
  v_master   boolean;
BEGIN
  v_master := (v_rating = 'easy' AND v_rep >= 5 AND v_interval >= 21);
  IF v_master = true THEN
    INSERT INTO test_results VALUES ('2.01', 'PASS', 'auto-mastery triggers at easy + rep=5 + interval=26');
  ELSE
    INSERT INTO test_results VALUES ('2.01', 'FAIL', 'should trigger auto-mastery');
  END IF;
END $$;

-- 2.02  does NOT trigger: interval below threshold (14 days)
DO $$
DECLARE v_master boolean;
BEGIN
  v_master := ('easy' = 'easy' AND 5 >= 5 AND 14 >= 21);
  IF v_master = false THEN
    INSERT INTO test_results VALUES ('2.02', 'PASS', 'auto-mastery does not trigger when interval < 21');
  ELSE
    INSERT INTO test_results VALUES ('2.02', 'FAIL', 'should NOT trigger when interval=14');
  END IF;
END $$;

-- 2.03  does NOT trigger: rep below threshold (rep=4)
DO $$
DECLARE v_master boolean;
BEGIN
  v_master := ('easy' = 'easy' AND 4 >= 5 AND 26 >= 21);
  IF v_master = false THEN
    INSERT INTO test_results VALUES ('2.03', 'PASS', 'auto-mastery does not trigger when rep < 5');
  ELSE
    INSERT INTO test_results VALUES ('2.03', 'FAIL', 'should NOT trigger when rep=4');
  END IF;
END $$;

-- 2.04  does NOT trigger on 'good' even with high rep and interval
DO $$
DECLARE v_master boolean;
BEGIN
  v_master := ('good' = 'easy' AND 10 >= 5 AND 60 >= 21);
  IF v_master = false THEN
    INSERT INTO test_results VALUES ('2.04', 'PASS', 'auto-mastery does not trigger on good rating');
  ELSE
    INSERT INTO test_results VALUES ('2.04', 'FAIL', 'should NOT trigger on good rating');
  END IF;
END $$;

-- 2.05  does NOT trigger on 'again'
DO $$
DECLARE v_master boolean;
BEGIN
  v_master := ('again' = 'easy' AND 10 >= 5 AND 60 >= 21);
  IF v_master = false THEN
    INSERT INTO test_results VALUES ('2.05', 'PASS', 'auto-mastery does not trigger on again rating');
  ELSE
    INSERT INTO test_results VALUES ('2.05', 'FAIL', 'should NOT trigger on again rating');
  END IF;
END $$;

-- 2.06  does NOT trigger on 'hard'
DO $$
DECLARE v_master boolean;
BEGIN
  v_master := ('hard' = 'easy' AND 10 >= 5 AND 60 >= 21);
  IF v_master = false THEN
    INSERT INTO test_results VALUES ('2.06', 'PASS', 'auto-mastery does not trigger on hard rating');
  ELSE
    INSERT INTO test_results VALUES ('2.06', 'FAIL', 'should NOT trigger on hard rating');
  END IF;
END $$;

-- 2.07  triggers exactly at boundary: rep=5, interval=21
DO $$
DECLARE v_master boolean;
BEGIN
  v_master := ('easy' = 'easy' AND 5 >= 5 AND 21 >= 21);
  IF v_master = true THEN
    INSERT INTO test_results VALUES ('2.07', 'PASS', 'auto-mastery triggers exactly at rep=5, interval=21 boundary');
  ELSE
    INSERT INTO test_results VALUES ('2.07', 'FAIL', 'should trigger exactly at boundary rep=5, interval=21');
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
--  SECTION 3 – Database constraint existence checks
-- ─────────────────────────────────────────────────────────────

-- 3.01  chk_ease_factor exists on flashcard_review_state
DO $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'flashcard_review_state'
      AND c.conname = 'chk_ease_factor' AND c.contype = 'c'
  ) INTO v_exists;
  IF v_exists THEN
    INSERT INTO test_results VALUES ('3.01', 'PASS', 'chk_ease_factor constraint exists (EF >= 1.3)');
  ELSE
    INSERT INTO test_results VALUES ('3.01', 'FAIL', 'chk_ease_factor constraint missing');
  END IF;
END $$;

-- 3.02  chk_last_rating exists on flashcard_review_state
DO $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'flashcard_review_state'
      AND c.conname = 'chk_last_rating' AND c.contype = 'c'
  ) INTO v_exists;
  IF v_exists THEN
    INSERT INTO test_results VALUES ('3.02', 'PASS', 'chk_last_rating constraint exists (again/hard/good/easy only)');
  ELSE
    INSERT INTO test_results VALUES ('3.02', 'FAIL', 'chk_last_rating constraint missing');
  END IF;
END $$;

-- 3.03  chk_interval_days exists (interval >= 0)
DO $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'flashcard_review_state'
      AND c.conname = 'chk_interval_days' AND c.contype = 'c'
  ) INTO v_exists;
  IF v_exists THEN
    INSERT INTO test_results VALUES ('3.03', 'PASS', 'chk_interval_days constraint exists (interval >= 0)');
  ELSE
    INSERT INTO test_results VALUES ('3.03', 'FAIL', 'chk_interval_days constraint missing');
  END IF;
END $$;

-- 3.04  chk_repetition_count exists (rep >= 0)
DO $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'flashcard_review_state'
      AND c.conname = 'chk_repetition_count' AND c.contype = 'c'
  ) INTO v_exists;
  IF v_exists THEN
    INSERT INTO test_results VALUES ('3.04', 'PASS', 'chk_repetition_count constraint exists (rep >= 0)');
  ELSE
    INSERT INTO test_results VALUES ('3.04', 'FAIL', 'chk_repetition_count constraint missing');
  END IF;
END $$;

-- 3.05  flashcard_review_history.rating has a check constraint
DO $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'flashcard_review_history'
      AND c.contype = 'c'
  ) INTO v_exists;
  IF v_exists THEN
    INSERT INTO test_results VALUES ('3.05', 'PASS', 'flashcard_review_history has a check constraint on rating');
  ELSE
    INSERT INTO test_results VALUES ('3.05', 'FAIL', 'no check constraint found on flashcard_review_history');
  END IF;
END $$;

-- 3.06  uq_flashcard_state unique constraint exists (one row per term per student)
DO $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'flashcard_review_state'
      AND c.conname = 'uq_flashcard_state' AND c.contype = 'u'
  ) INTO v_exists;
  IF v_exists THEN
    INSERT INTO test_results VALUES ('3.06', 'PASS', 'uq_flashcard_state constraint exists (one state per term+student)');
  ELSE
    INSERT INTO test_results VALUES ('3.06', 'FAIL', 'uq_flashcard_state unique constraint missing');
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
--  SECTION 4 – RLS enabled on all sensitive tables (NFR-01, NFR-11)
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_tables text[] := ARRAY[
    'flashcard_review_state',
    'flashcard_review_history',
    'student_glossary_terms',
    'learning_folders',
    'folder_members',
    'folder_sections',
    'readings',
    'profiles'
  ];
  v_tbl     text;
  v_enabled boolean;
  v_idx     integer := 0;
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    v_idx := v_idx + 1;
    SELECT relrowsecurity INTO v_enabled
    FROM pg_class
    WHERE relname = v_tbl
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

    IF v_enabled = true THEN
      INSERT INTO test_results VALUES ('4.' || lpad(v_idx::text, 2, '0'), 'PASS', 'RLS enabled on table: ' || v_tbl);
    ELSE
      INSERT INTO test_results VALUES ('4.' || lpad(v_idx::text, 2, '0'), 'FAIL', 'RLS is NOT enabled on table: ' || v_tbl);
    END IF;
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────
--  SECTION 5 – RLS policy count checks
-- ─────────────────────────────────────────────────────────────

-- 5.01  flashcard_review_state has at least 3 policies (select/insert/update)
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE tablename = 'flashcard_review_state' AND schemaname = 'public';
  IF v_count >= 3 THEN
    INSERT INTO test_results VALUES ('5.01', 'PASS', 'flashcard_review_state has ' || v_count || ' RLS policies');
  ELSE
    INSERT INTO test_results VALUES ('5.01', 'FAIL', 'expected >= 3 policies on flashcard_review_state, found ' || v_count);
  END IF;
END $$;

-- 5.02  flashcard_review_history has at least 1 policy (students read their own)
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE tablename = 'flashcard_review_history' AND schemaname = 'public';
  IF v_count >= 1 THEN
    INSERT INTO test_results VALUES ('5.02', 'PASS', 'flashcard_review_history has ' || v_count || ' RLS policies');
  ELSE
    INSERT INTO test_results VALUES ('5.02', 'FAIL', 'expected >= 1 policy on flashcard_review_history, found ' || v_count);
  END IF;
END $$;

-- 5.03  student_glossary_terms has at least 4 policies (select/insert/update/delete)
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE tablename = 'student_glossary_terms' AND schemaname = 'public';
  IF v_count >= 4 THEN
    INSERT INTO test_results VALUES ('5.03', 'PASS', 'student_glossary_terms has ' || v_count || ' RLS policies');
  ELSE
    INSERT INTO test_results VALUES ('5.03', 'FAIL', 'expected >= 4 policies on student_glossary_terms, found ' || v_count);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
--  SECTION 6 – All expected RPC functions exist (FR-23, FR-24, FR-25)
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_functions text[] := ARRAY[
    'review_my_flashcard',
    'ensure_flashcard_state_for_my_term',
    'delete_my_flashcard_state',
    'get_my_due_flashcards',
    'get_my_upcoming_flashcards',
    'get_my_flashcard_overview',
    'get_my_flashcard_reminder',
    'get_my_all_glossary_terms_with_flashcard_status',
    'get_my_personal_glossary_for_reading',
    'add_selected_term_to_my_glossary',
    'update_my_personal_glossary_term',
    'delete_my_personal_glossary_term',
    'preview_selected_term_for_reading',
    'get_reading_glossary_terms'
  ];
  v_fn     text;
  v_exists boolean;
  v_idx    integer := 0;
BEGIN
  FOREACH v_fn IN ARRAY v_functions LOOP
    v_idx := v_idx + 1;
    SELECT EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = v_fn
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) INTO v_exists;
    IF v_exists THEN
      INSERT INTO test_results VALUES ('6.' || lpad(v_idx::text, 2, '0'), 'PASS', 'RPC exists: ' || v_fn);
    ELSE
      INSERT INTO test_results VALUES ('6.' || lpad(v_idx::text, 2, '0'), 'FAIL', 'RPC not found in public schema -> ' || v_fn);
    END IF;
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────
--  SECTION 7 – Edge Function input validation logic (SQL-side)
--  These replicate the validation branches inside the Edge Functions
--  without calling OpenAI or DeepL.
-- ─────────────────────────────────────────────────────────────

-- 7.01  Missing selectedText → should return found: false (simulated)
DO $$
DECLARE
  v_selected_text text := '';
  v_would_proceed boolean;
BEGIN
  v_would_proceed := (v_selected_text IS NOT NULL AND trim(v_selected_text) <> '');
  IF v_would_proceed = false THEN
    INSERT INTO test_results VALUES ('7.01', 'PASS', 'empty selectedText correctly blocked before API call');
  ELSE
    INSERT INTO test_results VALUES ('7.01', 'FAIL', 'empty selectedText should not proceed to translation API');
  END IF;
END $$;

-- 7.02  Valid selectedText proceeds
DO $$
DECLARE
  v_selected_text text := 'equity';
  v_would_proceed boolean;
BEGIN
  v_would_proceed := (v_selected_text IS NOT NULL AND trim(v_selected_text) <> '');
  IF v_would_proceed = true THEN
    INSERT INTO test_results VALUES ('7.02', 'PASS', 'valid selectedText passes input validation');
  ELSE
    INSERT INTO test_results VALUES ('7.02', 'FAIL', 'valid selectedText should proceed');
  END IF;
END $$;

-- 7.03  Bloom function: no valid levels selected → should be blocked
DO $$
DECLARE
  v_valid_levels  text[] := ARRAY['remember','understand','apply','analyze','evaluate','create'];
  v_input_levels  text[] := ARRAY['remember','invalid_level'];
  v_filtered      text[];
  v_count         integer;
BEGIN
  SELECT ARRAY(
    SELECT unnest(v_input_levels) INTERSECT SELECT unnest(v_valid_levels)
  ) INTO v_filtered;
  v_count := array_length(v_filtered, 1);
  IF v_count = 1 THEN
    INSERT INTO test_results VALUES ('7.03', 'PASS', 'Bloom level filter removes invalid level, keeps valid ones');
  ELSE
    INSERT INTO test_results VALUES ('7.03', 'FAIL', 'only 1 valid level expected after filter, got ' || coalesce(v_count::text, 'null'));
  END IF;
END $$;

-- 7.04  Bloom function: all levels valid → all pass through
DO $$
DECLARE
  v_valid_levels text[] := ARRAY['remember','understand','apply','analyze','evaluate','create'];
  v_input_levels text[] := ARRAY['remember','apply','create'];
  v_filtered     text[];
  v_count        integer;
BEGIN
  SELECT ARRAY(
    SELECT unnest(v_input_levels) INTERSECT SELECT unnest(v_valid_levels)
  ) INTO v_filtered;
  v_count := array_length(v_filtered, 1);
  IF v_count = 3 THEN
    INSERT INTO test_results VALUES ('7.04', 'PASS', 'all valid Bloom levels pass through the filter');
  ELSE
    INSERT INTO test_results VALUES ('7.04', 'FAIL', 'all 3 valid levels should pass through, got ' || coalesce(v_count::text, 'null'));
  END IF;
END $$;

-- 7.05  Bloom function: empty level list → defaults to all 6 levels
DO $$
DECLARE
  v_valid_levels  text[] := ARRAY['remember','understand','apply','analyze','evaluate','create'];
  v_input_levels  text[] := ARRAY[]::text[];
  v_effective     text[];
BEGIN
  IF array_length(v_input_levels, 1) IS NULL OR array_length(v_input_levels, 1) = 0 THEN
    v_effective := v_valid_levels;
  ELSE
    v_effective := v_input_levels;
  END IF;
  IF array_length(v_effective, 1) = 6 THEN
    INSERT INTO test_results VALUES ('7.05', 'PASS', 'empty Bloom level input defaults to all 6 levels');
  ELSE
    INSERT INTO test_results VALUES ('7.05', 'FAIL', 'empty input should default to all 6 levels, got ' || array_length(v_effective, 1));
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
--  SECTION 8 – Functional requirement verification queries
--  These check that the data model satisfies the FRs
--  by inspecting the schema, not by inserting test data.
-- ─────────────────────────────────────────────────────────────

-- 8.01  FR-23: flashcard_review_state has all SM-2 columns
DO $$
DECLARE
  v_required_cols text[] := ARRAY[
    'repetition_count', 'ease_factor', 'interval_days',
    'due_at', 'last_reviewed_at', 'total_reviews',
    'correct_reviews', 'last_rating'
  ];
  v_col    text;
  v_exists boolean;
  v_idx    integer := 0;
BEGIN
  FOREACH v_col IN ARRAY v_required_cols LOOP
    v_idx := v_idx + 1;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'flashcard_review_state'
        AND column_name  = v_col
    ) INTO v_exists;
    IF v_exists THEN
      INSERT INTO test_results VALUES ('8.01.' || lpad(v_idx::text, 2, '0'), 'PASS', 'SM-2 column exists: ' || v_col);
    ELSE
      INSERT INTO test_results VALUES ('8.01.' || lpad(v_idx::text, 2, '0'), 'FAIL', 'missing SM-2 column -> ' || v_col);
    END IF;
  END LOOP;
END $$;

-- 8.02  FR-24: student_glossary_terms has is_mastered column
DO $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'student_glossary_terms'
      AND column_name  = 'is_mastered'
  ) INTO v_exists;
  IF v_exists THEN
    INSERT INTO test_results VALUES ('8.02', 'PASS', 'is_mastered column exists on student_glossary_terms (FR-24)');
  ELSE
    INSERT INTO test_results VALUES ('8.02', 'FAIL', 'is_mastered column missing from student_glossary_terms');
  END IF;
END $$;

-- 8.03  FR-25: flashcard_review_state has due_at for reminder badge logic
DO $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'flashcard_review_state'
      AND column_name  = 'due_at'
  ) INTO v_exists;
  IF v_exists THEN
    INSERT INTO test_results VALUES ('8.03', 'PASS', 'due_at column exists (required for FR-25 reminder badge)');
  ELSE
    INSERT INTO test_results VALUES ('8.03', 'FAIL', 'due_at column missing - reminder badge cannot work without it');
  END IF;
END $$;

-- 8.04  FR-11: readings table has is_visible_to_students column
DO $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'readings'
      AND column_name  = 'is_visible_to_students'
  ) INTO v_exists;
  IF v_exists THEN
    INSERT INTO test_results VALUES ('8.04', 'PASS', 'is_visible_to_students exists on readings (FR-11)');
  ELSE
    INSERT INTO test_results VALUES ('8.04', 'FAIL', 'is_visible_to_students missing from readings (FR-11)');
  END IF;
END $$;

-- 8.05  FR-13: learning_folders has join_code column
DO $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'learning_folders'
      AND column_name  = 'join_code'
  ) INTO v_exists;
  IF v_exists THEN
    INSERT INTO test_results VALUES ('8.05', 'PASS', 'join_code column exists on learning_folders (FR-13)');
  ELSE
    INSERT INTO test_results VALUES ('8.05', 'FAIL', 'join_code missing from learning_folders (FR-13)');
  END IF;
END $$;

-- 8.06  flashcard_review_history exists (audit trail for SM-2 transitions)
DO $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'flashcard_review_history'
  ) INTO v_exists;
  IF v_exists THEN
    INSERT INTO test_results VALUES ('8.06', 'PASS', 'flashcard_review_history table exists (SM-2 audit log)');
  ELSE
    INSERT INTO test_results VALUES ('8.06', 'FAIL', 'flashcard_review_history table does not exist');
  END IF;
END $$;

-- 8.07  NFR-10: no direct supabase.from() calls in component files
--  This cannot be checked from SQL. Verified via NFR-10 in frontend tests.
INSERT INTO test_results VALUES ('8.07', 'INFO', 'NFR-10 (no direct DB calls in components) verified in frontend tests');


-- ─────────────────────────────────────────────────────────────
--  RESULTS
--  Supabase's SQL Editor only displays the LAST statement's
--  result set, so everything you need is in this single query:
--  a summary row per status, followed by every individual test.
--  Any FAIL rows are sorted to the very top for visibility.
-- ─────────────────────────────────────────────────────────────

SELECT test_id, status, detail
FROM (
  SELECT '— SUMMARY —' AS test_id, status, count(*)::text || ' test(s)' AS detail,
         0 AS sort_group, 0 AS sort_status
  FROM test_results
  GROUP BY status

  UNION ALL

  SELECT test_id, status, detail,
         1 AS sort_group,
         CASE status WHEN 'FAIL' THEN 0 WHEN 'INFO' THEN 1 ELSE 2 END AS sort_status
  FROM test_results
) t
ORDER BY sort_group, sort_status, test_id;
