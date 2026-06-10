-- AI Personal Bloom Activities Schema
-- Stores AI-generated Bloom's Taxonomy practice activities for each student personal glossary term,
-- and the student's answers to those activities.

-- ===== DROP EXISTING FUNCTIONS =====

drop function if exists public.get_my_student_bloom_activities(uuid);
drop function if exists public.save_ai_generated_student_bloom_activities(uuid, jsonb, text);
drop function if exists public.get_my_student_bloom_activity_response(uuid);
drop function if exists public.save_my_student_bloom_activity_response(uuid, text);

-- ===== TABLE: student_bloom_activities =====

create table if not exists public.student_bloom_activities (
  id                       uuid primary key default gen_random_uuid(),
  student_glossary_term_id uuid not null references public.student_glossary_terms(id) on delete cascade,
  student_id               uuid not null references public.profiles(id) on delete cascade,
  bloom_level              text not null,
  prompt                   text not null,
  expected_answer          text,
  activity_source          text not null default 'ai_generated',
  ai_model                 text,
  created_at               timestamp with time zone default now(),
  updated_at               timestamp with time zone default now(),

  constraint bloom_level_check check (
    bloom_level in ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')
  ),
  constraint activity_source_check check (
    activity_source in ('ai_generated', 'manual')
  )
);

alter table public.student_bloom_activities enable row level security;

-- ===== TABLE: student_bloom_activity_responses =====

create table if not exists public.student_bloom_activity_responses (
  id                        uuid primary key default gen_random_uuid(),
  student_bloom_activity_id uuid not null references public.student_bloom_activities(id) on delete cascade,
  student_id                uuid not null references public.profiles(id) on delete cascade,
  answer                    text not null,
  submitted_at              timestamp with time zone default now(),
  updated_at                timestamp with time zone default now(),

  constraint unique_activity_response unique (student_bloom_activity_id, student_id)
);

alter table public.student_bloom_activity_responses enable row level security;

-- ===== RLS: student_bloom_activities =====

drop policy if exists "Students can read their own bloom activities"   on public.student_bloom_activities;
drop policy if exists "Students can insert their own bloom activities" on public.student_bloom_activities;
drop policy if exists "Students can update their own bloom activities" on public.student_bloom_activities;
drop policy if exists "Students can delete their own bloom activities" on public.student_bloom_activities;

create policy "Students can read their own bloom activities"
on public.student_bloom_activities
for select
to authenticated
using (student_id = auth.uid());

create policy "Students can insert their own bloom activities"
on public.student_bloom_activities
for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.student_glossary_terms sgt
    where sgt.id = student_glossary_term_id
      and sgt.student_id = auth.uid()
  )
);

create policy "Students can update their own bloom activities"
on public.student_bloom_activities
for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "Students can delete their own bloom activities"
on public.student_bloom_activities
for delete
to authenticated
using (student_id = auth.uid());

-- ===== RLS: student_bloom_activity_responses =====

drop policy if exists "Students can read their own bloom responses"   on public.student_bloom_activity_responses;
drop policy if exists "Students can insert their own bloom responses" on public.student_bloom_activity_responses;
drop policy if exists "Students can update their own bloom responses" on public.student_bloom_activity_responses;

create policy "Students can read their own bloom responses"
on public.student_bloom_activity_responses
for select
to authenticated
using (student_id = auth.uid());

create policy "Students can insert their own bloom responses"
on public.student_bloom_activity_responses
for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.student_bloom_activities sba
    where sba.id = student_bloom_activity_id
      and sba.student_id = auth.uid()
  )
);

create policy "Students can update their own bloom responses"
on public.student_bloom_activity_responses
for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

-- ===== VALID BLOOM LEVELS =====

create or replace function public._valid_bloom_levels()
returns text[]
language sql
immutable
as $$
  select array['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
$$;

-- ===== RPC 1: get_my_student_bloom_activities =====
-- Returns all Bloom activities for one personal glossary term belonging to the current student.

create or replace function public.get_my_student_bloom_activities(
  p_student_glossary_term_id uuid
)
returns table (
  result_id                       uuid,
  result_student_glossary_term_id uuid,
  result_student_id               uuid,
  result_bloom_level              text,
  result_prompt                   text,
  result_expected_answer          text,
  result_activity_source          text,
  result_ai_model                 text,
  result_created_at               timestamp with time zone,
  result_updated_at               timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role    text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role <> 'student' then
    raise exception 'Only students can access their Bloom activities';
  end if;

  -- Verify the student owns the glossary term
  if not exists (
    select 1
    from public.student_glossary_terms sgt
    where sgt.id = p_student_glossary_term_id
      and sgt.student_id = v_user_id
  ) then
    raise exception 'You do not own this glossary term';
  end if;

  return query
  select
    sba.id,
    sba.student_glossary_term_id,
    sba.student_id,
    sba.bloom_level,
    sba.prompt,
    sba.expected_answer,
    sba.activity_source,
    sba.ai_model,
    sba.created_at,
    sba.updated_at
  from public.student_bloom_activities sba
  where sba.student_glossary_term_id = p_student_glossary_term_id
    and sba.student_id = v_user_id
  order by
    array_position(public._valid_bloom_levels(), sba.bloom_level),
    sba.created_at asc;
end;
$$;

grant execute on function public.get_my_student_bloom_activities(uuid) to authenticated;

-- ===== RPC 2: save_ai_generated_student_bloom_activities =====
-- Replaces all existing activities for a term with the new AI-generated set.
-- Validates: ownership, reading accessibility, valid bloom levels.

create or replace function public.save_ai_generated_student_bloom_activities(
  p_student_glossary_term_id uuid,
  p_activities               jsonb,
  p_ai_model                 text default null
)
returns table (
  result_id          uuid,
  result_bloom_level text,
  result_prompt      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid;
  v_role       text;
  v_reading_id uuid;
  v_activity   jsonb;
  v_level      text;
  v_prompt     text;
  v_expected   text;
  v_new_id     uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role <> 'student' then
    raise exception 'Only students can save Bloom activities';
  end if;

  -- Verify the student owns the glossary term and get reading_id
  select sgt.reading_id into v_reading_id
  from public.student_glossary_terms sgt
  where sgt.id = p_student_glossary_term_id
    and sgt.student_id = v_user_id;

  if v_reading_id is null then
    raise exception 'Glossary term not found or you do not own it';
  end if;

  -- Verify the student can still access the reading
  if not public._student_can_access_reading(v_reading_id) then
    raise exception 'You are not allowed to access the reading for this term';
  end if;

  -- Validate each activity in the JSON array
  for v_activity in select * from jsonb_array_elements(p_activities)
  loop
    v_level := v_activity->>'bloom_level';
    if v_level is null or not (v_level = any(public._valid_bloom_levels())) then
      raise exception 'Invalid bloom_level: %', coalesce(v_level, 'null');
    end if;
    if (v_activity->>'prompt') is null then
      raise exception 'Each activity must have a prompt';
    end if;
  end loop;

  -- Delete all existing activities for this term (supports regeneration)
  delete from public.student_bloom_activities
  where student_glossary_term_id = p_student_glossary_term_id
    and student_id = v_user_id;

  -- Insert new activities
  for v_activity in select * from jsonb_array_elements(p_activities)
  loop
    v_level    := v_activity->>'bloom_level';
    v_prompt   := v_activity->>'prompt';
    v_expected := v_activity->>'expected_answer';

    insert into public.student_bloom_activities (
      student_glossary_term_id,
      student_id,
      bloom_level,
      prompt,
      expected_answer,
      activity_source,
      ai_model,
      updated_at
    )
    values (
      p_student_glossary_term_id,
      v_user_id,
      v_level,
      v_prompt,
      v_expected,
      'ai_generated',
      p_ai_model,
      now()
    )
    returning id into v_new_id;

    return next;
    result_id          := v_new_id;
    result_bloom_level := v_level;
    result_prompt      := v_prompt;
  end loop;
end;
$$;

grant execute on function public.save_ai_generated_student_bloom_activities(uuid, jsonb, text) to authenticated;

-- ===== RPC 3: get_my_student_bloom_activity_response =====
-- Returns the current student's response to one activity, or nothing if not yet answered.

create or replace function public.get_my_student_bloom_activity_response(
  p_activity_id uuid
)
returns table (
  result_id                        uuid,
  result_student_bloom_activity_id uuid,
  result_student_id                uuid,
  result_answer                    text,
  result_submitted_at              timestamp with time zone,
  result_updated_at                timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role    text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role <> 'student' then
    raise exception 'Only students can access their responses';
  end if;

  -- Verify the activity belongs to this student
  if not exists (
    select 1
    from public.student_bloom_activities sba
    where sba.id = p_activity_id
      and sba.student_id = v_user_id
  ) then
    raise exception 'Activity not found or you do not own it';
  end if;

  return query
  select
    sbr.id,
    sbr.student_bloom_activity_id,
    sbr.student_id,
    sbr.answer,
    sbr.submitted_at,
    sbr.updated_at
  from public.student_bloom_activity_responses sbr
  where sbr.student_bloom_activity_id = p_activity_id
    and sbr.student_id = v_user_id;
end;
$$;

grant execute on function public.get_my_student_bloom_activity_response(uuid) to authenticated;

-- ===== RPC 4: save_my_student_bloom_activity_response =====
-- Creates or updates the student's answer to one activity (upsert via ON CONFLICT).

create or replace function public.save_my_student_bloom_activity_response(
  p_activity_id uuid,
  p_answer      text
)
returns table (
  result_id           uuid,
  result_answer       text,
  result_submitted_at timestamp with time zone,
  result_updated_at   timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role    text;
  v_saved   public.student_bloom_activity_responses;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role <> 'student' then
    raise exception 'Only students can submit responses';
  end if;

  if p_answer is null or trim(p_answer) = '' then
    raise exception 'Answer cannot be empty';
  end if;

  -- Verify the activity belongs to this student
  if not exists (
    select 1
    from public.student_bloom_activities sba
    where sba.id = p_activity_id
      and sba.student_id = v_user_id
  ) then
    raise exception 'Activity not found or you do not own it';
  end if;

  insert into public.student_bloom_activity_responses (
    student_bloom_activity_id,
    student_id,
    answer,
    updated_at
  )
  values (
    p_activity_id,
    v_user_id,
    p_answer,
    now()
  )
  on conflict (student_bloom_activity_id, student_id)
  do update set
    answer     = excluded.answer,
    updated_at = now()
  returning * into v_saved;

  return query
  select
    v_saved.id,
    v_saved.answer,
    v_saved.submitted_at,
    v_saved.updated_at;
end;
$$;

grant execute on function public.save_my_student_bloom_activity_response(uuid, text) to authenticated;

notify pgrst, 'reload schema';
