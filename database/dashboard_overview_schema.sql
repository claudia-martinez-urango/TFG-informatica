-- =============================================================
--  Dashboard Overview – RPC Functions
--  Branch: feature/dashboard-overview
-- =============================================================
--
--  Required tables (core – always present):
--    profiles, organizations, learning_folders, folder_sections,
--    readings, glossary_terms, folder_members, folder_join_requests,
--    student_glossary_terms
--
--  Optional tables (wrapped in EXECUTE + exception handler):
--    flashcard_review_state    → spaced_repetition_schema.sql
--    flashcard_review_history  → spaced_repetition_schema.sql
--    student_bloom_activities  → ai_personal_bloom_schema.sql
--    student_bloom_activity_responses → ai_personal_bloom_schema.sql
--
--  Column note:
--    student_glossary_terms.spanish_translation was added by
--    translation_feature_schema.sql – remove from
--    get_student_recent_personal_terms if that migration is absent.
--
--  Hierarchy (join path):
--    readings
--      → folder_sections  (readings.section_id = folder_sections.id)
--      → learning_folders (folder_sections.folder_id = learning_folders.id)
--      → organizations    (learning_folders.organization_id = organizations.id)
-- =============================================================


-- ─────────────────────────────────────────────────────────────
--  Drop existing functions (safe re-run)
-- ─────────────────────────────────────────────────────────────
drop function if exists public.get_teacher_dashboard_overview();
drop function if exists public.get_teacher_folder_overview();
drop function if exists public.get_teacher_recent_activity();
drop function if exists public.get_student_dashboard_overview();
drop function if exists public.get_student_recent_readings();
drop function if exists public.get_student_recent_personal_terms();
drop function if exists public.get_student_learning_recommendation();


-- =============================================================
--  1. get_teacher_dashboard_overview
--     One row with aggregate stats for the authenticated teacher.
--     Only counts data in folders owned by the teacher.
-- =============================================================
create or replace function public.get_teacher_dashboard_overview()
returns table (
  total_folders                bigint,
  visible_folders              bigint,
  hidden_folders               bigint,
  total_students               bigint,
  pending_join_requests        bigint,
  total_sections               bigint,
  total_readings               bigint,
  published_readings           bigint,
  total_glossary_terms         bigint,
  visible_glossary_terms       bigint,
  student_personal_terms_count bigint,
  flashcard_reviews_count      bigint,
  bloom_responses_count        bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id                   uuid;
  v_total_folders                bigint := 0;
  v_visible_folders              bigint := 0;
  v_hidden_folders               bigint := 0;
  v_total_students               bigint := 0;
  v_pending_join_requests        bigint := 0;
  v_total_sections               bigint := 0;
  v_total_readings               bigint := 0;
  v_published_readings           bigint := 0;
  v_total_glossary_terms         bigint := 0;
  v_visible_glossary_terms       bigint := 0;
  v_student_personal_terms_count bigint := 0;
  v_flashcard_reviews_count      bigint := 0;
  v_bloom_responses_count        bigint := 0;
begin
  v_teacher_id := auth.uid();
  if v_teacher_id is null then
    raise exception 'Not authenticated';
  end if;

  -- ── Folders ──────────────────────────────────────────────────
  select
    coalesce(count(*), 0),
    coalesce(count(*) filter (where lf.is_visible_to_students = true),  0),
    coalesce(count(*) filter (where lf.is_visible_to_students = false), 0)
  into v_total_folders, v_visible_folders, v_hidden_folders
  from public.learning_folders lf
  where lf.teacher_id = v_teacher_id;

  -- ── Students across all teacher folders ──────────────────────
  select coalesce(count(distinct fm.student_id), 0) into v_total_students
  from public.folder_members fm
  join public.learning_folders lf on lf.id = fm.folder_id
  where lf.teacher_id = v_teacher_id;

  -- ── Pending join requests ─────────────────────────────────────
  select coalesce(count(*), 0) into v_pending_join_requests
  from public.folder_join_requests fjr
  join public.learning_folders lf on lf.id = fjr.folder_id
  where lf.teacher_id = v_teacher_id
    and fjr.status = 'pending';

  -- ── Sections ─────────────────────────────────────────────────
  select coalesce(count(*), 0) into v_total_sections
  from public.folder_sections fs
  join public.learning_folders lf on lf.id = fs.folder_id
  where lf.teacher_id = v_teacher_id;

  -- ── Readings ─────────────────────────────────────────────────
  select
    coalesce(count(*), 0),
    coalesce(count(*) filter (where r.is_visible_to_students = true), 0)
  into v_total_readings, v_published_readings
  from public.readings r
  join public.folder_sections fs on fs.id = r.section_id
  join public.learning_folders lf on lf.id = fs.folder_id
  where lf.teacher_id = v_teacher_id;

  -- ── Glossary terms ────────────────────────────────────────────
  select
    coalesce(count(*), 0),
    coalesce(count(*) filter (where gt.is_visible_to_students = true), 0)
  into v_total_glossary_terms, v_visible_glossary_terms
  from public.glossary_terms gt
  join public.readings r on r.id = gt.reading_id
  join public.folder_sections fs on fs.id = r.section_id
  join public.learning_folders lf on lf.id = fs.folder_id
  where lf.teacher_id = v_teacher_id;

  -- ── Student personal glossary terms in teacher's folders ──────
  select coalesce(count(*), 0) into v_student_personal_terms_count
  from public.student_glossary_terms sgt
  join public.readings r on r.id = sgt.reading_id
  join public.folder_sections fs on fs.id = r.section_id
  join public.learning_folders lf on lf.id = fs.folder_id
  where lf.teacher_id = v_teacher_id;

  -- ── OPTIONAL: Flashcard reviews ──────────────────────────────
  -- Remove this block if flashcard_review_history does not exist.
  begin
    execute '
      select coalesce(count(*), 0)
      from public.flashcard_review_history frh
      join public.student_glossary_terms sgt
        on sgt.id = frh.student_glossary_term_id
      join public.readings r on r.id = sgt.reading_id
      join public.folder_sections fs on fs.id = r.section_id
      join public.learning_folders lf on lf.id = fs.folder_id
      where lf.teacher_id = $1
    ' into v_flashcard_reviews_count using v_teacher_id;
  exception when others then
    v_flashcard_reviews_count := 0;
  end;

  -- ── OPTIONAL: Bloom responses ────────────────────────────────
  -- Remove this block if student_bloom_activity_responses does not exist.
  begin
    execute '
      select coalesce(count(*), 0)
      from public.student_bloom_activity_responses sbar
      join public.student_bloom_activities sba
        on sba.id = sbar.student_bloom_activity_id
      join public.student_glossary_terms sgt
        on sgt.id = sba.student_glossary_term_id
      join public.readings r on r.id = sgt.reading_id
      join public.folder_sections fs on fs.id = r.section_id
      join public.learning_folders lf on lf.id = fs.folder_id
      where lf.teacher_id = $1
    ' into v_bloom_responses_count using v_teacher_id;
  exception when others then
    v_bloom_responses_count := 0;
  end;

  return query select
    v_total_folders,
    v_visible_folders,
    v_hidden_folders,
    v_total_students,
    v_pending_join_requests,
    v_total_sections,
    v_total_readings,
    v_published_readings,
    v_total_glossary_terms,
    v_visible_glossary_terms,
    v_student_personal_terms_count,
    v_flashcard_reviews_count,
    v_bloom_responses_count;
end;
$$;


-- =============================================================
--  2. get_teacher_folder_overview
--     One row per folder owned by the authenticated teacher.
-- =============================================================
create or replace function public.get_teacher_folder_overview()
returns table (
  folder_id              uuid,
  folder_name            text,
  organization_name      text,
  is_visible_to_students boolean,
  students_count         bigint,
  sections_count         bigint,
  readings_count         bigint,
  pending_requests_count bigint,
  created_at             timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
begin
  v_teacher_id := auth.uid();
  if v_teacher_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
    select
      lf.id                   as folder_id,
      lf.name                 as folder_name,
      o.name                  as organization_name,
      lf.is_visible_to_students,
      coalesce((
        select count(distinct fm.student_id)
        from public.folder_members fm
        where fm.folder_id = lf.id
      ), 0)                   as students_count,
      coalesce((
        select count(*)
        from public.folder_sections fs
        where fs.folder_id = lf.id
      ), 0)                   as sections_count,
      coalesce((
        select count(*)
        from public.readings r
        join public.folder_sections fs2 on fs2.id = r.section_id
        where fs2.folder_id = lf.id
      ), 0)                   as readings_count,
      coalesce((
        select count(*)
        from public.folder_join_requests fjr
        where fjr.folder_id = lf.id
          and fjr.status = 'pending'
      ), 0)                   as pending_requests_count,
      lf.created_at
    from public.learning_folders lf
    join public.organizations o on o.id = lf.organization_id
    where lf.teacher_id = v_teacher_id
    order by lf.created_at desc;
end;
$$;


-- =============================================================
--  3. get_teacher_recent_activity
--     Up to 20 most recent items across folders, readings,
--     glossary terms, and join requests for this teacher.
-- =============================================================
create or replace function public.get_teacher_recent_activity()
returns table (
  item_type  text,
  item_id    uuid,
  title      text,
  subtitle   text,
  created_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
begin
  v_teacher_id := auth.uid();
  if v_teacher_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
    select combined.item_type, combined.item_id, combined.title, combined.subtitle, combined.created_at
    from (
      -- Recent folders
      select
        'folder'::text                                 as item_type,
        lf.id                                          as item_id,
        lf.name                                        as title,
        o.name                                         as subtitle,
        lf.created_at
      from public.learning_folders lf
      join public.organizations o on o.id = lf.organization_id
      where lf.teacher_id = v_teacher_id

      union all

      -- Recent readings
      select
        'reading'::text,
        r.id,
        r.title,
        lf.name,
        r.created_at
      from public.readings r
      join public.folder_sections fs on fs.id = r.section_id
      join public.learning_folders lf on lf.id = fs.folder_id
      where lf.teacher_id = v_teacher_id

      union all

      -- Recent glossary terms
      select
        'glossary_term'::text,
        gt.id,
        gt.term,
        r2.title,
        gt.created_at
      from public.glossary_terms gt
      join public.readings r2 on r2.id = gt.reading_id
      join public.folder_sections fs2 on fs2.id = r2.section_id
      join public.learning_folders lf2 on lf2.id = fs2.folder_id
      where lf2.teacher_id = v_teacher_id

      union all

      -- Recent join requests
      select
        'join_request'::text,
        fjr.id,
        trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
        lf3.name,
        fjr.requested_at
      from public.folder_join_requests fjr
      join public.learning_folders lf3 on lf3.id = fjr.folder_id
      join public.profiles p on p.id = fjr.student_id
      where lf3.teacher_id = v_teacher_id
    ) as combined
    order by combined.created_at desc
    limit 20;
end;
$$;


-- =============================================================
--  4. get_student_dashboard_overview
--     One row with aggregate stats for the authenticated student.
--     Only counts visible content the student has access to.
-- =============================================================
create or replace function public.get_student_dashboard_overview()
returns table (
  my_folders_count          bigint,
  available_readings_count  bigint,
  personal_terms_count      bigint,
  mastered_terms_count      bigint,
  not_mastered_terms_count  bigint,
  due_flashcards_count      bigint,
  upcoming_flashcards_count bigint,
  bloom_answers_count       bigint,
  reviewed_today_count      bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id                uuid;
  v_my_folders_count          bigint := 0;
  v_available_readings_count  bigint := 0;
  v_personal_terms_count      bigint := 0;
  v_mastered_terms_count      bigint := 0;
  v_not_mastered_terms_count  bigint := 0;
  v_due_flashcards_count      bigint := 0;
  v_upcoming_flashcards_count bigint := 0;
  v_bloom_answers_count       bigint := 0;
  v_reviewed_today_count      bigint := 0;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Not authenticated';
  end if;

  -- ── Visible folders the student belongs to ────────────────────
  select coalesce(count(distinct lf.id), 0) into v_my_folders_count
  from public.folder_members fm
  join public.learning_folders lf on lf.id = fm.folder_id
  where fm.student_id = v_student_id
    and lf.is_visible_to_students = true;

  -- ── Visible readings (folder + section + reading all visible) ──
  select coalesce(count(*), 0) into v_available_readings_count
  from public.readings r
  join public.folder_sections fs on fs.id = r.section_id
  join public.learning_folders lf on lf.id = fs.folder_id
  join public.folder_members fm on fm.folder_id = lf.id
  where fm.student_id = v_student_id
    and lf.is_visible_to_students = true
    and fs.is_visible_to_students = true
    and r.is_visible_to_students  = true;

  -- ── Personal glossary terms ───────────────────────────────────
  select
    coalesce(count(*), 0),
    coalesce(count(*) filter (where sgt.is_mastered = true),  0),
    coalesce(count(*) filter (where sgt.is_mastered = false), 0)
  into v_personal_terms_count, v_mastered_terms_count, v_not_mastered_terms_count
  from public.student_glossary_terms sgt
  where sgt.student_id = v_student_id;

  -- ── OPTIONAL: Flashcard counts ────────────────────────────────
  -- Remove this block if flashcard_review_state does not exist.
  begin
    execute '
      select
        coalesce(count(*) filter (where due_at <= now()), 0),
        coalesce(count(*) filter (where due_at > now()), 0),
        coalesce(count(*) filter (where last_reviewed_at >= date_trunc(''day'', now())), 0)
      from public.flashcard_review_state
      where student_id = $1
    ' into v_due_flashcards_count, v_upcoming_flashcards_count, v_reviewed_today_count
    using v_student_id;
  exception when others then
    v_due_flashcards_count      := 0;
    v_upcoming_flashcards_count := 0;
    v_reviewed_today_count      := 0;
  end;

  -- ── OPTIONAL: Bloom answers ───────────────────────────────────
  -- Remove this block if student_bloom_activity_responses does not exist.
  begin
    execute '
      select coalesce(count(*), 0)
      from public.student_bloom_activity_responses
      where student_id = $1
    ' into v_bloom_answers_count using v_student_id;
  exception when others then
    v_bloom_answers_count := 0;
  end;

  return query select
    v_my_folders_count,
    v_available_readings_count,
    v_personal_terms_count,
    v_mastered_terms_count,
    v_not_mastered_terms_count,
    v_due_flashcards_count,
    v_upcoming_flashcards_count,
    v_bloom_answers_count,
    v_reviewed_today_count;
end;
$$;


-- =============================================================
--  5. get_student_recent_readings
--     Up to 5 most recently created accessible readings.
-- =============================================================
create or replace function public.get_student_recent_readings()
returns table (
  reading_id        uuid,
  reading_title     text,
  section_name      text,
  folder_name       text,
  organization_name text,
  created_at        timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
    select
      r.id    as reading_id,
      r.title as reading_title,
      fs.name as section_name,
      lf.name as folder_name,
      o.name  as organization_name,
      r.created_at
    from public.readings r
    join public.folder_sections fs  on fs.id  = r.section_id
    join public.learning_folders lf on lf.id  = fs.folder_id
    join public.organizations    o  on o.id   = lf.organization_id
    join public.folder_members   fm on fm.folder_id = lf.id
    where fm.student_id              = v_student_id
      and lf.is_visible_to_students  = true
      and fs.is_visible_to_students  = true
      and r.is_visible_to_students   = true
    order by r.created_at desc
    limit 5;
end;
$$;


-- =============================================================
--  6. get_student_recent_personal_terms
--     Up to 5 most recently added personal glossary terms.
--
--  NOTE: spanish_translation requires translation_feature_schema.sql.
--        Remove that column from both the RETURNS TABLE and the SELECT
--        if the translation migration has not been applied.
-- =============================================================
create or replace function public.get_student_recent_personal_terms()
returns table (
  term_id             uuid,
  selected_text       text,
  definition          text,
  spanish_translation text,
  is_mastered         boolean,
  reading_id          uuid,
  reading_title       text,
  created_at          timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
    select
      sgt.id                  as term_id,
      sgt.selected_text,
      sgt.definition,
      sgt.spanish_translation,
      sgt.is_mastered,
      r.id                    as reading_id,
      r.title                 as reading_title,
      sgt.created_at
    from public.student_glossary_terms sgt
    join public.readings r on r.id = sgt.reading_id
    where sgt.student_id = v_student_id
    order by sgt.created_at desc
    limit 5;
end;
$$;


-- =============================================================
--  7. get_student_learning_recommendation
--     Single row with a context-aware learning recommendation.
-- =============================================================
create or replace function public.get_student_learning_recommendation()
returns table (
  recommendation_type    text,
  recommendation_title   text,
  recommendation_message text,
  action_label           text,
  action_url             text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id         uuid;
  v_due_count          bigint := 0;
  v_terms_count        bigint := 0;
  v_not_mastered_count bigint := 0;
  v_rec_type           text;
  v_rec_title          text;
  v_rec_message        text;
  v_action_label       text;
  v_action_url         text;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Personal terms counts
  select
    coalesce(count(*), 0),
    coalesce(count(*) filter (where is_mastered = false), 0)
  into v_terms_count, v_not_mastered_count
  from public.student_glossary_terms
  where student_id = v_student_id;

  -- OPTIONAL: Due flashcards
  begin
    execute '
      select coalesce(count(*), 0)
      from public.flashcard_review_state
      where student_id = $1
        and due_at <= now()
    ' into v_due_count using v_student_id;
  exception when others then
    v_due_count := 0;
  end;

  -- Build recommendation
  if v_due_count > 0 then
    v_rec_type     := 'review_flashcards';
    v_rec_title    := 'Time to Review Flashcards';
    v_rec_message  := 'You have ' || v_due_count || ' flashcard' ||
                      case when v_due_count = 1 then '' else 's' end ||
                      ' due for review. Keep your vocabulary fresh!';
    v_action_label := 'Go to Flashcards';
    v_action_url   := '/student/flashcards';

  elsif v_terms_count = 0 then
    v_rec_type     := 'start_glossary';
    v_rec_title    := 'Start Building Your Glossary';
    v_rec_message  := 'Open a reading and select words you do not understand to build your personal vocabulary.';
    v_action_label := 'View My Folders';
    v_action_url   := '/student/dashboard';

  elsif v_not_mastered_count > 0 then
    v_rec_type     := 'practice_vocabulary';
    v_rec_title    := 'Practice Your Vocabulary';
    v_rec_message  := 'You have ' || v_not_mastered_count || ' term' ||
                      case when v_not_mastered_count = 1 then '' else 's' end ||
                      ' still to master. Use flashcards to reinforce your learning!';
    v_action_label := 'Review Flashcards';
    v_action_url   := '/student/flashcards';

  else
    v_rec_type     := 'all_done';
    v_rec_title    := 'Excellent Work!';
    v_rec_message  := 'You have mastered all your vocabulary terms. Keep reading to discover new words.';
    v_action_label := 'View My Folders';
    v_action_url   := '/student/dashboard';
  end if;

  return query select
    v_rec_type,
    v_rec_title,
    v_rec_message,
    v_action_label,
    v_action_url;
end;
$$;


-- ─────────────────────────────────────────────────────────────
--  Notify PostgREST to reload schema
-- ─────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
