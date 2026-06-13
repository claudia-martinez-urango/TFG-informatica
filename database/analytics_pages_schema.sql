-- =============================================================
--  Analytics Pages – RPC Functions
--  Branch: feature/dashboard-overview
-- =============================================================
--
--  Provides filterable analytics for the dedicated Analytics pages
--  (accessible via the Navbar) for both teacher and student roles.
--
--  Filter pattern: all p_* params are nullable (default null).
--  Conditional filtering: (p_id is null or col = p_id)
--
--  Required tables (core):
--    profiles, learning_folders, folder_sections, readings,
--    folder_members, student_glossary_terms
--
--  Optional tables (wrapped in EXECUTE + exception handler):
--    student_bloom_activities, student_bloom_activity_responses
--
--  Hierarchy:
--    readings → folder_sections → learning_folders
-- =============================================================

drop function if exists public.get_student_analytics_filters();
drop function if exists public.get_student_analytics_summary(uuid, uuid, uuid);
drop function if exists public.get_student_analytics_terms(uuid, uuid, uuid);
drop function if exists public.get_student_analytics_bloom(uuid, uuid, uuid);
drop function if exists public.get_teacher_analytics_filters();
drop function if exists public.get_teacher_analytics_students(uuid);
drop function if exists public.get_teacher_analytics_summary(uuid, uuid, uuid, uuid);
drop function if exists public.get_teacher_analytics_word_stats(uuid, uuid, uuid, uuid);
drop function if exists public.get_teacher_analytics_bloom(uuid, uuid, uuid, uuid);
drop function if exists public.get_teacher_analytics_student_comparison(uuid, uuid, uuid);


-- =============================================================
--  1. get_student_analytics_filters
--     Full hierarchy (folder → section → reading) accessible to
--     the authenticated student. Used to populate filter dropdowns.
-- =============================================================
create or replace function public.get_student_analytics_filters()
returns table (
  folder_id     uuid,
  folder_name   text,
  section_id    uuid,
  section_name  text,
  reading_id    uuid,
  reading_title text
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
      lf.id    as folder_id,
      lf.name  as folder_name,
      fs.id    as section_id,
      fs.name  as section_name,
      r.id     as reading_id,
      r.title  as reading_title
    from public.folder_members fm
    join public.learning_folders lf  on lf.id = fm.folder_id
    join public.folder_sections  fs  on fs.folder_id = lf.id
    join public.readings          r  on r.section_id  = fs.id
    where fm.student_id             = v_student_id
      and lf.is_visible_to_students = true
      and fs.is_visible_to_students = true
      and r.is_visible_to_students  = true
    order by lf.name, fs.order_index, r.title;
end;
$$;


-- =============================================================
--  2. get_student_analytics_summary
--     Aggregate vocabulary + Bloom stats for the student,
--     optionally scoped to a folder, section, or reading.
-- =============================================================
create or replace function public.get_student_analytics_summary(
  p_folder_id  uuid default null,
  p_section_id uuid default null,
  p_reading_id uuid default null
)
returns table (
  total_terms        bigint,
  mastered_terms     bigint,
  not_mastered_terms bigint,
  mastery_rate       numeric,
  bloom_answers      bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id   uuid;
  v_total        bigint  := 0;
  v_mastered     bigint  := 0;
  v_not_mastered bigint  := 0;
  v_bloom        bigint  := 0;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    coalesce(count(*), 0),
    coalesce(count(*) filter (where sgt.is_mastered = true),  0),
    coalesce(count(*) filter (where sgt.is_mastered = false), 0)
  into v_total, v_mastered, v_not_mastered
  from public.student_glossary_terms sgt
  join public.readings          r  on r.id  = sgt.reading_id
  join public.folder_sections   fs on fs.id = r.section_id
  join public.learning_folders  lf on lf.id = fs.folder_id
  where sgt.student_id = v_student_id
    and (p_reading_id is null or sgt.reading_id  = p_reading_id)
    and (p_section_id is null or r.section_id    = p_section_id)
    and (p_folder_id  is null or fs.folder_id    = p_folder_id);

  begin
    execute '
      select coalesce(count(*), 0)
      from public.student_bloom_activity_responses sbar
      join public.student_bloom_activities         sba  on sba.id             = sbar.student_bloom_activity_id
      join public.student_glossary_terms           sgt  on sgt.id             = sba.student_glossary_term_id
      join public.readings                         r    on r.id               = sgt.reading_id
      join public.folder_sections                  fs   on fs.id              = r.section_id
      where sba.student_id = $1
        and ($2 is null or sgt.reading_id = $2)
        and ($3 is null or r.section_id   = $3)
        and ($4 is null or fs.folder_id   = $4)
    ' into v_bloom
    using v_student_id, p_reading_id, p_section_id, p_folder_id;
  exception when others then
    v_bloom := 0;
  end;

  return query select
    v_total,
    v_mastered,
    v_not_mastered,
    round(v_mastered::numeric / nullif(v_total, 0)::numeric * 100, 1),
    v_bloom;
end;
$$;


-- =============================================================
--  3. get_student_analytics_terms
--     Individual personal terms for the student, optionally
--     scoped. Includes full context (folder / section / reading).
--     Ordered: not mastered first, then newest first.
-- =============================================================
create or replace function public.get_student_analytics_terms(
  p_folder_id  uuid default null,
  p_section_id uuid default null,
  p_reading_id uuid default null
)
returns table (
  term_id       uuid,
  selected_text text,
  definition    text,
  is_mastered   boolean,
  reading_id    uuid,
  reading_title text,
  section_id    uuid,
  section_name  text,
  folder_id     uuid,
  folder_name   text,
  created_at    timestamp with time zone
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
      sgt.id,
      sgt.selected_text,
      sgt.definition,
      sgt.is_mastered,
      r.id,
      r.title,
      fs.id,
      fs.name,
      lf.id,
      lf.name,
      sgt.created_at
    from public.student_glossary_terms sgt
    join public.readings         r  on r.id  = sgt.reading_id
    join public.folder_sections  fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    where sgt.student_id = v_student_id
      and (p_reading_id is null or sgt.reading_id = p_reading_id)
      and (p_section_id is null or r.section_id   = p_section_id)
      and (p_folder_id  is null or fs.folder_id   = p_folder_id)
    order by sgt.is_mastered asc, sgt.created_at desc;
end;
$$;


-- =============================================================
--  4. get_student_analytics_bloom
--     Bloom activity completion by cognitive level, optionally
--     scoped to a folder / section / reading.
--     OPTIONAL – returns empty if bloom tables do not exist.
-- =============================================================
create or replace function public.get_student_analytics_bloom(
  p_folder_id  uuid default null,
  p_section_id uuid default null,
  p_reading_id uuid default null
)
returns table (
  bloom_level      text,
  total_activities bigint,
  answered_count   bigint,
  completion_rate  numeric
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
        count(distinct sba.id)::bigint                                              as total_activities,
        count(distinct sbar.id)::bigint                                             as answered_count,
        round(
          count(distinct sbar.id)::numeric
          / nullif(count(distinct sba.id), 0)::numeric * 100, 1
        )                                                                           as completion_rate
      from public.student_bloom_activities sba
      left join public.student_bloom_activity_responses sbar
             on sbar.student_bloom_activity_id = sba.id
            and sbar.student_id                = $1
      join public.student_glossary_terms sgt on sgt.id        = sba.student_glossary_term_id
      join public.readings               r   on r.id          = sgt.reading_id
      join public.folder_sections        fs  on fs.id         = r.section_id
      where sba.student_id = $1
        and ($2 is null or sgt.reading_id = $2)
        and ($3 is null or r.section_id   = $3)
        and ($4 is null or fs.folder_id   = $4)
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
    ' using v_student_id, p_reading_id, p_section_id, p_folder_id;
  exception when others then
    return;
  end;
end;
$$;


-- =============================================================
--  5. get_teacher_analytics_filters
--     Full hierarchy (folder → section → reading) owned by the
--     authenticated teacher. Used to populate filter dropdowns.
-- =============================================================
create or replace function public.get_teacher_analytics_filters()
returns table (
  folder_id     uuid,
  folder_name   text,
  section_id    uuid,
  section_name  text,
  reading_id    uuid,
  reading_title text
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
      lf.id    as folder_id,
      lf.name  as folder_name,
      fs.id    as section_id,
      fs.name  as section_name,
      r.id     as reading_id,
      r.title  as reading_title
    from public.learning_folders lf
    join public.folder_sections  fs on fs.folder_id = lf.id
    join public.readings          r on r.section_id  = fs.id
    where lf.teacher_id = v_teacher_id
    order by lf.name, fs.order_index, r.title;
end;
$$;


-- =============================================================
--  6. get_teacher_analytics_students
--     Students enrolled in the teacher's folders, optionally
--     scoped to a single folder. One row per student with
--     aggregate mastery stats. Used for the student filter
--     dropdown and the comparison bar chart.
-- =============================================================
create or replace function public.get_teacher_analytics_students(
  p_folder_id uuid default null
)
returns table (
  student_id   uuid,
  student_name text,
  first_name   text,
  last_name    text,
  email        text,
  terms_count  bigint,
  mastery_rate numeric
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
      p.id                                                                         as student_id,
      trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))        as student_name,
      p.first_name,
      p.last_name,
      p.email,
      coalesce(count(distinct sgt.id), 0)                                         as terms_count,
      round(
        coalesce(count(distinct sgt.id) filter (where sgt.is_mastered = true), 0)::numeric
        / nullif(count(distinct sgt.id), 0)::numeric * 100, 1
      )                                                                            as mastery_rate
    from public.folder_members fm
    join public.learning_folders lf on lf.id = fm.folder_id
    join public.profiles         p  on p.id  = fm.student_id
    left join public.student_glossary_terms sgt
           on sgt.student_id = fm.student_id
          and exists (
            select 1
            from public.readings          r2
            join public.folder_sections   fs2 on fs2.id = r2.section_id
            where r2.id       = sgt.reading_id
              and fs2.folder_id = lf.id
          )
    where lf.teacher_id = v_teacher_id
      and (p_folder_id is null or lf.id = p_folder_id)
    group by p.id, p.first_name, p.last_name, p.email
    order by p.last_name, p.first_name;
end;
$$;


-- =============================================================
--  7. get_teacher_analytics_summary
--     Aggregate class-wide stats, optionally scoped to
--     folder / section / reading / individual student.
-- =============================================================
create or replace function public.get_teacher_analytics_summary(
  p_folder_id  uuid default null,
  p_section_id uuid default null,
  p_reading_id uuid default null,
  p_student_id uuid default null
)
returns table (
  total_students   bigint,
  terms_saved      bigint,
  terms_mastered   bigint,
  avg_mastery_rate numeric,
  bloom_answers    bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id  uuid;
  v_students    bigint  := 0;
  v_saved       bigint  := 0;
  v_mastered    bigint  := 0;
  v_avg_mastery numeric := 0;
  v_bloom       bigint  := 0;
begin
  v_teacher_id := auth.uid();
  if v_teacher_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    coalesce(count(distinct sgt.student_id), 0),
    coalesce(count(sgt.id), 0),
    coalesce(count(sgt.id) filter (where sgt.is_mastered = true), 0),
    round(
      coalesce(count(sgt.id) filter (where sgt.is_mastered = true), 0)::numeric
      / nullif(count(sgt.id), 0)::numeric * 100, 1
    )
  into v_students, v_saved, v_mastered, v_avg_mastery
  from public.student_glossary_terms sgt
  join public.readings         r  on r.id  = sgt.reading_id
  join public.folder_sections  fs on fs.id = r.section_id
  join public.learning_folders lf on lf.id = fs.folder_id
  where lf.teacher_id = v_teacher_id
    and (p_student_id is null or sgt.student_id  = p_student_id)
    and (p_reading_id is null or sgt.reading_id  = p_reading_id)
    and (p_section_id is null or r.section_id    = p_section_id)
    and (p_folder_id  is null or lf.id           = p_folder_id);

  begin
    execute '
      select coalesce(count(*), 0)
      from public.student_bloom_activity_responses sbar
      join public.student_bloom_activities         sba  on sba.id  = sbar.student_bloom_activity_id
      join public.student_glossary_terms           sgt  on sgt.id  = sba.student_glossary_term_id
      join public.readings                         r    on r.id    = sgt.reading_id
      join public.folder_sections                  fs   on fs.id   = r.section_id
      join public.learning_folders                 lf   on lf.id   = fs.folder_id
      where lf.teacher_id = $1
        and ($2 is null or sgt.student_id = $2)
        and ($3 is null or sgt.reading_id = $3)
        and ($4 is null or r.section_id   = $4)
        and ($5 is null or lf.id          = $5)
    ' into v_bloom
    using v_teacher_id, p_student_id, p_reading_id, p_section_id, p_folder_id;
  exception when others then
    v_bloom := 0;
  end;

  return query select v_students, v_saved, v_mastered, v_avg_mastery, v_bloom;
end;
$$;


-- =============================================================
--  8. get_teacher_analytics_word_stats
--     Per-word stats across all students, optionally scoped.
--     Groups by (selected_text, reading) for uniqueness.
--     Returns all words – frontend sorts for different views.
-- =============================================================
create or replace function public.get_teacher_analytics_word_stats(
  p_folder_id  uuid default null,
  p_section_id uuid default null,
  p_reading_id uuid default null,
  p_student_id uuid default null
)
returns table (
  selected_text     text,
  reading_id        uuid,
  reading_title     text,
  section_name      text,
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
      r.id                                                                         as reading_id,
      r.title                                                                      as reading_title,
      fs.name                                                                      as section_name,
      lf.name                                                                      as folder_name,
      count(sgt.id)                                                                as students_saved,
      count(sgt.id) filter (where sgt.is_mastered = true)                         as students_mastered,
      round(
        count(sgt.id) filter (where sgt.is_mastered = true)::numeric
        / nullif(count(sgt.id), 0)::numeric * 100, 1
      )                                                                            as mastery_rate
    from public.student_glossary_terms sgt
    join public.readings         r  on r.id  = sgt.reading_id
    join public.folder_sections  fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    where lf.teacher_id = v_teacher_id
      and (p_student_id is null or sgt.student_id  = p_student_id)
      and (p_reading_id is null or sgt.reading_id  = p_reading_id)
      and (p_section_id is null or r.section_id    = p_section_id)
      and (p_folder_id  is null or lf.id           = p_folder_id)
    group by sgt.selected_text, r.id, r.title, fs.name, lf.name
    order by mastery_rate asc nulls last, students_saved desc;
end;
$$;


-- =============================================================
--  9. get_teacher_analytics_bloom
--     Bloom completion rate by cognitive level across all
--     students, optionally scoped to folder / section /
--     reading / individual student.
--     OPTIONAL – returns empty if bloom tables do not exist.
-- =============================================================
create or replace function public.get_teacher_analytics_bloom(
  p_folder_id  uuid default null,
  p_section_id uuid default null,
  p_reading_id uuid default null,
  p_student_id uuid default null
)
returns table (
  bloom_level      text,
  total_activities bigint,
  answered_count   bigint,
  completion_rate  numeric
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
        sba.bloom_level,
        count(distinct sba.id)::bigint                                              as total_activities,
        count(distinct sbar.id)::bigint                                             as answered_count,
        round(
          count(distinct sbar.id)::numeric
          / nullif(count(distinct sba.id), 0)::numeric * 100, 1
        )                                                                           as completion_rate
      from public.student_bloom_activities sba
      left join public.student_bloom_activity_responses sbar
             on sbar.student_bloom_activity_id = sba.id
      join public.student_glossary_terms sgt on sgt.id  = sba.student_glossary_term_id
      join public.readings               r   on r.id    = sgt.reading_id
      join public.folder_sections        fs  on fs.id   = r.section_id
      join public.learning_folders       lf  on lf.id   = fs.folder_id
      where lf.teacher_id = $1
        and ($2 is null or sba.student_id  = $2)
        and ($3 is null or sgt.reading_id  = $3)
        and ($4 is null or r.section_id    = $4)
        and ($5 is null or lf.id           = $5)
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
    ' using v_teacher_id, p_student_id, p_reading_id, p_section_id, p_folder_id;
  exception when others then
    return;
  end;
end;
$$;


-- =============================================================
--  10. get_teacher_analytics_student_comparison
--      Per-student mastery stats, optionally scoped.
--      Used for the student comparison bar chart.
-- =============================================================
create or replace function public.get_teacher_analytics_student_comparison(
  p_folder_id  uuid default null,
  p_section_id uuid default null,
  p_reading_id uuid default null
)
returns table (
  student_id     uuid,
  student_name   text,
  terms_added    bigint,
  terms_mastered bigint,
  mastery_rate   numeric
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
      trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))         as student_name,
      count(sgt.id)                                                                 as terms_added,
      count(sgt.id) filter (where sgt.is_mastered = true)                          as terms_mastered,
      round(
        count(sgt.id) filter (where sgt.is_mastered = true)::numeric
        / nullif(count(sgt.id), 0)::numeric * 100, 1
      )                                                                             as mastery_rate
    from public.student_glossary_terms sgt
    join public.readings         r  on r.id  = sgt.reading_id
    join public.folder_sections  fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    join public.profiles         p  on p.id  = sgt.student_id
    where lf.teacher_id = v_teacher_id
      and (p_reading_id is null or sgt.reading_id = p_reading_id)
      and (p_section_id is null or r.section_id   = p_section_id)
      and (p_folder_id  is null or lf.id          = p_folder_id)
    group by sgt.student_id, p.first_name, p.last_name
    order by mastery_rate desc nulls last, terms_added desc;
end;
$$;


-- ─────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
