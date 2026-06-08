-- Student Personal Glossary Schema
-- Stores words/expressions selected by students from reading content.
-- Students manage their own terms; teachers have no access.

drop function if exists public._student_can_access_reading(uuid);
drop function if exists public.get_my_personal_glossary_for_reading(uuid);
drop function if exists public.preview_selected_term_for_reading(uuid, text, text);
drop function if exists public.add_selected_term_to_my_glossary(uuid, text, text);
drop function if exists public.update_my_personal_glossary_term(uuid, text, boolean);
drop function if exists public.delete_my_personal_glossary_term(uuid);

-- ===== TABLE =====

create table if not exists public.student_glossary_terms (
  id                      uuid primary key default gen_random_uuid(),
  student_id              uuid not null references public.profiles(id) on delete cascade,
  reading_id              uuid not null references public.readings(id) on delete cascade,
  linked_glossary_term_id uuid references public.glossary_terms(id) on delete set null,
  selected_text           text not null,
  normalized_term         text not null,
  definition              text,
  example_sentence        text,
  context_sentence        text,
  student_note            text,
  is_mastered             boolean not null default false,
  created_at              timestamp with time zone default now(),
  updated_at              timestamp with time zone default now(),
  unique (student_id, reading_id, normalized_term)
);

alter table public.student_glossary_terms enable row level security;

-- ===== RLS POLICIES =====

drop policy if exists "Students can read their own personal glossary terms"   on public.student_glossary_terms;
drop policy if exists "Students can insert their own personal glossary terms" on public.student_glossary_terms;
drop policy if exists "Students can update their own personal glossary terms" on public.student_glossary_terms;
drop policy if exists "Students can delete their own personal glossary terms" on public.student_glossary_terms;

-- Read: own terms only
create policy "Students can read their own personal glossary terms"
on public.student_glossary_terms
for select
to authenticated
using (
  student_id = auth.uid()
);

-- Insert: own terms, only for readings the student can access
create policy "Students can insert their own personal glossary terms"
on public.student_glossary_terms
for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.readings r
    join public.folder_sections fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    join public.folder_members fm on fm.folder_id = lf.id
    where r.id = reading_id
      and r.is_visible_to_students  = true
      and fs.is_visible_to_students = true
      and lf.is_visible_to_students = true
      and fm.student_id = auth.uid()
  )
);

-- Update: own terms only
create policy "Students can update their own personal glossary terms"
on public.student_glossary_terms
for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

-- Delete: own terms only
create policy "Students can delete their own personal glossary terms"
on public.student_glossary_terms
for delete
to authenticated
using (
  student_id = auth.uid()
);

-- ===== HELPER: access check =====
-- Returns true when the calling user is a student who can access the given reading.
-- Used as a guard inside all RPCs below.

create or replace function public._student_can_access_reading(p_reading_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role    text;
  v_allowed boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return false;
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role <> 'student' then
    return false;
  end if;

  select exists (
    select 1
    from public.readings r
    join public.folder_sections fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    join public.folder_members fm on fm.folder_id = lf.id
    where r.id = p_reading_id
      and r.is_visible_to_students  = true
      and fs.is_visible_to_students = true
      and lf.is_visible_to_students = true
      and fm.student_id = v_user_id
  ) into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

-- ===== RPC 1: get_my_personal_glossary_for_reading =====

create or replace function public.get_my_personal_glossary_for_reading(p_reading_id uuid)
returns table (
  result_id                      uuid,
  result_student_id              uuid,
  result_reading_id              uuid,
  result_linked_glossary_term_id uuid,
  result_selected_text           text,
  result_normalized_term         text,
  result_definition              text,
  result_example_sentence        text,
  result_context_sentence        text,
  result_student_note            text,
  result_is_mastered             boolean,
  result_created_at              timestamp with time zone,
  result_updated_at              timestamp with time zone
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
    raise exception 'Only students can access personal glossary terms';
  end if;

  if not public._student_can_access_reading(p_reading_id) then
    raise exception 'You are not allowed to access this reading';
  end if;

  return query
  select
    sgt.id,
    sgt.student_id,
    sgt.reading_id,
    sgt.linked_glossary_term_id,
    sgt.selected_text,
    sgt.normalized_term,
    sgt.definition,
    sgt.example_sentence,
    sgt.context_sentence,
    sgt.student_note,
    sgt.is_mastered,
    sgt.created_at,
    sgt.updated_at
  from public.student_glossary_terms sgt
  where sgt.student_id = v_user_id
    and sgt.reading_id = p_reading_id
  order by sgt.created_at asc;
end;
$$;

grant execute on function public.get_my_personal_glossary_for_reading(uuid) to authenticated;

-- ===== RPC 2: preview_selected_term_for_reading =====
-- Returns preview data before saving: checks if a teacher glossary term matches.

create or replace function public.preview_selected_term_for_reading(
  p_reading_id        uuid,
  p_selected_text     text,
  p_context_sentence  text
)
returns table (
  result_selected_text           text,
  result_normalized_term         text,
  result_linked_glossary_term_id uuid,
  result_definition              text,
  result_example_sentence        text,
  result_context_sentence        text,
  result_source_type             text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id               uuid;
  v_role                  text;
  v_normalized            text;
  v_matched_id            uuid;
  v_definition            text;
  v_example_sentence      text;
  v_teacher_ctx           text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role <> 'student' then
    raise exception 'Only students can preview terms';
  end if;

  if not public._student_can_access_reading(p_reading_id) then
    raise exception 'You are not allowed to access this reading';
  end if;

  v_normalized := lower(trim(p_selected_text));

  -- Look for a visible teacher glossary term that matches exactly (case-insensitive)
  select gt.id, gt.definition, gt.example_sentence, gt.context_sentence
  into   v_matched_id, v_definition, v_example_sentence, v_teacher_ctx
  from   public.glossary_terms gt
  where  gt.reading_id = p_reading_id
    and  gt.is_visible_to_students = true
    and  lower(trim(gt.term)) = v_normalized
  limit 1;

  if v_matched_id is not null then
    return query select
      p_selected_text,
      v_normalized,
      v_matched_id,
      v_definition,
      v_example_sentence,
      coalesce(v_teacher_ctx, p_context_sentence),
      'teacher_glossary'::text;
  else
    return query select
      p_selected_text,
      v_normalized,
      null::uuid,
      null::text,
      null::text,
      p_context_sentence,
      'no_definition'::text;
  end if;
end;
$$;

grant execute on function public.preview_selected_term_for_reading(uuid, text, text) to authenticated;

-- ===== RPC 3: add_selected_term_to_my_glossary =====
-- Upserts the term so the same word is never duplicated per student+reading.

create or replace function public.add_selected_term_to_my_glossary(
  p_reading_id        uuid,
  p_selected_text     text,
  p_context_sentence  text
)
returns table (
  result_id                      uuid,
  result_student_id              uuid,
  result_reading_id              uuid,
  result_linked_glossary_term_id uuid,
  result_selected_text           text,
  result_normalized_term         text,
  result_definition              text,
  result_example_sentence        text,
  result_context_sentence        text,
  result_student_note            text,
  result_is_mastered             boolean,
  result_created_at              timestamp with time zone,
  result_updated_at              timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id           uuid;
  v_role              text;
  v_normalized        text;
  v_matched_id        uuid;
  v_definition        text;
  v_example_sentence  text;
  v_teacher_ctx       text;
  v_final_ctx         text;
  v_saved             public.student_glossary_terms;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role <> 'student' then
    raise exception 'Only students can add terms to their personal glossary';
  end if;

  if not public._student_can_access_reading(p_reading_id) then
    raise exception 'You are not allowed to access this reading';
  end if;

  v_normalized := lower(trim(p_selected_text));

  select gt.id, gt.definition, gt.example_sentence, gt.context_sentence
  into   v_matched_id, v_definition, v_example_sentence, v_teacher_ctx
  from   public.glossary_terms gt
  where  gt.reading_id = p_reading_id
    and  gt.is_visible_to_students = true
    and  lower(trim(gt.term)) = v_normalized
  limit 1;

  v_final_ctx := coalesce(v_teacher_ctx, p_context_sentence);

  insert into public.student_glossary_terms (
    student_id, reading_id, linked_glossary_term_id,
    selected_text, normalized_term, definition,
    example_sentence, context_sentence, updated_at
  )
  values (
    v_user_id, p_reading_id, v_matched_id,
    p_selected_text, v_normalized, v_definition,
    v_example_sentence, v_final_ctx, now()
  )
  on conflict (student_id, reading_id, normalized_term)
  do update set
    linked_glossary_term_id = excluded.linked_glossary_term_id,
    selected_text           = excluded.selected_text,
    definition              = excluded.definition,
    example_sentence        = excluded.example_sentence,
    context_sentence        = excluded.context_sentence,
    updated_at              = now()
  returning * into v_saved;

  return query select
    v_saved.id,
    v_saved.student_id,
    v_saved.reading_id,
    v_saved.linked_glossary_term_id,
    v_saved.selected_text,
    v_saved.normalized_term,
    v_saved.definition,
    v_saved.example_sentence,
    v_saved.context_sentence,
    v_saved.student_note,
    v_saved.is_mastered,
    v_saved.created_at,
    v_saved.updated_at;
end;
$$;

grant execute on function public.add_selected_term_to_my_glossary(uuid, text, text) to authenticated;

-- ===== RPC 4: update_my_personal_glossary_term =====
-- Updates only student_note and is_mastered for the calling student's own term.

create or replace function public.update_my_personal_glossary_term(
  p_term_id       uuid,
  p_student_note  text,
  p_is_mastered   boolean
)
returns table (
  result_id           uuid,
  result_student_note text,
  result_is_mastered  boolean,
  result_updated_at   timestamp with time zone
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
    raise exception 'Only students can update their own glossary terms';
  end if;

  update public.student_glossary_terms
  set
    student_note = p_student_note,
    is_mastered  = p_is_mastered,
    updated_at   = now()
  where id = p_term_id
    and student_id = v_user_id;

  if not found then
    raise exception 'Term not found or you do not have permission to update it';
  end if;

  return query
  select sgt.id, sgt.student_note, sgt.is_mastered, sgt.updated_at
  from   public.student_glossary_terms sgt
  where  sgt.id = p_term_id;
end;
$$;

grant execute on function public.update_my_personal_glossary_term(uuid, text, boolean) to authenticated;

-- ===== RPC 5: delete_my_personal_glossary_term =====

create or replace function public.delete_my_personal_glossary_term(p_term_id uuid)
returns void
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
    raise exception 'Only students can delete their own glossary terms';
  end if;

  delete from public.student_glossary_terms
  where id = p_term_id
    and student_id = v_user_id;

  if not found then
    raise exception 'Term not found or you do not have permission to delete it';
  end if;
end;
$$;

grant execute on function public.delete_my_personal_glossary_term(uuid) to authenticated;

notify pgrst, 'reload schema';
