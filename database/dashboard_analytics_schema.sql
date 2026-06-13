-- =============================================================
--  Dashboard Analytics – RPC Functions
--  Branch: feature/dashboard-overview
-- =============================================================
--
--  Provides per-folder and term-difficulty analytics for the
--  teacher dashboard, and per-folder progress + Bloom stats for
--  the student dashboard.
--
--  Required tables (core):
--    profiles, learning_folders, folder_sections, readings,
--    folder_members, folder_join_requests,
--    student_glossary_terms
--
--  Optional tables (wrapped in EXECUTE + exception handler):
--    student_bloom_activities, student_bloom_activity_responses
-- =============================================================

drop function if exists public.get_teacher_analytics_by_folder();
drop function if exists public.get_teacher_difficult_terms(integer);
drop function if exists public.get_teacher_pending_join_requests();
drop function if exists public.get_student_folder_progress();
drop function if exists public.get_student_bloom_stats();


-- =============================================================
--  1. get_teacher_analytics_by_folder
--     Per-folder student engagement & mastery rates.
--     Teacher sees how many personal terms students have saved
--     and what percentage they have mastered, broken down by folder.
-- =============================================================
create or replace function public.get_teacher_analytics_by_folder()
returns table (
  folder_id     uuid,
  folder_name   text,
  terms_added   bigint,
  terms_mastered bigint,
  mastery_rate  numeric
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
      lf.id                                                              as folder_id,
      lf.name                                                            as folder_name,
      coalesce(count(sgt.id), 0)                                        as terms_added,
      coalesce(count(sgt.id) filter (where sgt.is_mastered = true), 0) as terms_mastered,
      round(
        coalesce(count(sgt.id) filter (where sgt.is_mastered = true), 0)::numeric
        / nullif(count(sgt.id), 0)::numeric * 100,
        1
      )                                                                  as mastery_rate
    from public.learning_folders lf
    left join public.folder_sections fs   on fs.folder_id  = lf.id
    left join public.readings r           on r.section_id  = fs.id
    left join public.student_glossary_terms sgt on sgt.reading_id = r.id
    where lf.teacher_id = v_teacher_id
    group by lf.id, lf.name
    order by terms_added desc;
end;
$$;


-- =============================================================
--  2. get_teacher_difficult_terms
--     Student-saved terms from teacher's readings, sorted by
--     lowest mastery rate (= what students struggle with most).
-- =============================================================
create or replace function public.get_teacher_difficult_terms(
  p_limit integer default 10
)
returns table (
  selected_text     text,
  reading_title     text,
  folder_name       text,
  students_saved    bigint,
  students_mastered bigint,
  mastery_rate      numeric
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
      sgt.selected_text,
      r.title                                                            as reading_title,
      lf.name                                                            as folder_name,
      count(sgt.id)                                                      as students_saved,
      count(sgt.id) filter (where sgt.is_mastered = true)               as students_mastered,
      round(
        count(sgt.id) filter (where sgt.is_mastered = true)::numeric
        / nullif(count(sgt.id), 0)::numeric * 100,
        1
      )                                                                  as mastery_rate
    from public.student_glossary_terms sgt
    join public.readings r       on r.id  = sgt.reading_id
    join public.folder_sections fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    where lf.teacher_id = v_teacher_id
    group by sgt.selected_text, r.id, r.title, lf.id, lf.name
    order by mastery_rate asc nulls last, students_saved desc
    limit p_limit;
end;
$$;


-- =============================================================
--  3. get_teacher_pending_join_requests
--     All pending join requests across all of this teacher's
--     folders, used by the dashboard quick-action panel.
-- =============================================================
create or replace function public.get_teacher_pending_join_requests()
returns table (
  request_id   uuid,
  folder_id    uuid,
  folder_name  text,
  student_id   uuid,
  first_name   text,
  last_name    text,
  email        text,
  requested_at timestamp with time zone
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
      fjr.id           as request_id,
      fjr.folder_id,
      lf.name          as folder_name,
      fjr.student_id,
      p.first_name,
      p.last_name,
      p.email,
      fjr.requested_at
    from public.folder_join_requests fjr
    join public.learning_folders lf on lf.id  = fjr.folder_id
    join public.profiles p           on p.id   = fjr.student_id
    where lf.teacher_id = v_teacher_id
      and fjr.status    = 'pending'
    order by fjr.requested_at asc;
end;
$$;


-- =============================================================
--  4. get_student_folder_progress
--     Per-folder mastery stats for the authenticated student.
--     Shows which folders have the lowest mastery (need most work).
-- =============================================================
create or replace function public.get_student_folder_progress()
returns table (
  folder_id      uuid,
  folder_name    text,
  terms_added    bigint,
  terms_mastered bigint,
  mastery_rate   numeric
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
      lf.id                                                              as folder_id,
      lf.name                                                            as folder_name,
      coalesce(count(sgt.id), 0)                                        as terms_added,
      coalesce(count(sgt.id) filter (where sgt.is_mastered = true), 0) as terms_mastered,
      round(
        coalesce(count(sgt.id) filter (where sgt.is_mastered = true), 0)::numeric
        / nullif(count(sgt.id), 0)::numeric * 100,
        1
      )                                                                  as mastery_rate
    from public.student_glossary_terms sgt
    join public.readings r       on r.id   = sgt.reading_id
    join public.folder_sections fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    where sgt.student_id = v_student_id
    group by lf.id, lf.name
    order by mastery_rate asc nulls last;
end;
$$;


-- =============================================================
--  5. get_student_bloom_stats
--     Bloom activity completion rate by cognitive level for the
--     authenticated student.
--     OPTIONAL: depends on student_bloom_activities and
--     student_bloom_activity_responses tables.
--     Returns empty if those tables do not exist.
-- =============================================================
create or replace function public.get_student_bloom_stats()
returns table (
  bloom_level       text,
  total_activities  bigint,
  answered_count    bigint,
  completion_rate   numeric
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

  begin
    return query execute '
      select
        sba.bloom_level,
        count(distinct sba.id)::bigint                                       as total_activities,
        count(distinct sbar.id)::bigint                                      as answered_count,
        round(
          count(distinct sbar.id)::numeric
          / nullif(count(distinct sba.id), 0)::numeric * 100,
          1
        )                                                                    as completion_rate
      from public.student_bloom_activities sba
      left join public.student_bloom_activity_responses sbar
        on sbar.student_bloom_activity_id = sba.id
       and sbar.student_id = $1
      where sba.student_id = $1
      group by sba.bloom_level
      order by
        case sba.bloom_level
          when ''remember''   then 1
          when ''understand'' then 2
          when ''apply''      then 3
          when ''analyze''    then 4
          when ''evaluate''   then 5
          when ''create''     then 6
          else 7
        end
    ' using v_student_id;
  exception when others then
    return;
  end;
end;
$$;


-- ─────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
