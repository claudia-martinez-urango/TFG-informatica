-- =============================================================
--  Word Detail – RPC Functions
--  Branch: feature/dashboard-overview
-- =============================================================
--
--  Provides per-word drill-down: which students saved a given
--  word and whether they have completed Bloom activities for it.
--
--  Triggered from the "Most Saved Words" and "Most Difficult
--  Words" bar charts on the teacher analytics page.
--
--  Required tables (core):
--    profiles, learning_folders, folder_sections, readings,
--    student_glossary_terms
--
--  Optional tables (bloom, wrapped in EXECUTE + exception handler):
--    student_bloom_activities, student_bloom_activity_responses
-- =============================================================

drop function if exists public.get_teacher_analytics_word_detail(text, uuid);
drop function if exists public.get_teacher_analytics_word_bloom(text, uuid);


-- =============================================================
--  1. get_teacher_analytics_word_detail
--     Returns one row per student who saved the specified word
--     from the specified reading, scoped to the authenticated
--     teacher's content.
-- =============================================================
create or replace function public.get_teacher_analytics_word_detail(
  p_selected_text text,
  p_reading_id    uuid
)
returns table (
  student_id   uuid,
  student_name text,
  is_mastered  boolean,
  saved_at     timestamp with time zone
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
      sgt.student_id,
      trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) as student_name,
      sgt.is_mastered,
      sgt.created_at                                                        as saved_at
    from public.student_glossary_terms sgt
    join public.profiles         p  on p.id  = sgt.student_id
    join public.readings         r  on r.id  = sgt.reading_id
    join public.folder_sections  fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    where sgt.selected_text = p_selected_text
      and sgt.reading_id    = p_reading_id
      and lf.teacher_id     = v_teacher_id
    order by sgt.is_mastered desc, p.last_name, p.first_name;
end;
$$;


-- =============================================================
--  2. get_teacher_analytics_word_bloom
--     Returns Bloom activity counts per student for the
--     specified word + reading combination.
--     OPTIONAL – returns empty if bloom tables do not exist.
-- =============================================================
create or replace function public.get_teacher_analytics_word_bloom(
  p_selected_text text,
  p_reading_id    uuid
)
returns table (
  student_id     uuid,
  bloom_total    bigint,
  bloom_answered bigint
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

  begin
    return query execute '
      select
        sgt.student_id,
        count(distinct sba.id)::bigint   as bloom_total,
        count(distinct sbar.id)::bigint  as bloom_answered
      from public.student_bloom_activities sba
      left join public.student_bloom_activity_responses sbar
             on sbar.student_bloom_activity_id = sba.id
      join public.student_glossary_terms sgt on sgt.id  = sba.student_glossary_term_id
      join public.readings               r   on r.id    = sgt.reading_id
      join public.folder_sections        fs  on fs.id   = r.section_id
      join public.learning_folders       lf  on lf.id   = fs.folder_id
      where sgt.selected_text = $1
        and sgt.reading_id    = $2
        and lf.teacher_id     = $3
      group by sgt.student_id
    ' using p_selected_text, p_reading_id, v_teacher_id;
  exception when others then
    return;
  end;
end;
$$;


-- ─────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
