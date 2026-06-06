-- Glossary Terms Schema
-- Stores vocabulary terms associated with readings.
-- Teachers manage all terms; students only see visible ones.

drop function if exists public.get_reading_glossary_terms(uuid);

create table if not exists public.glossary_terms (
  id                    uuid primary key default gen_random_uuid(),
  reading_id            uuid not null references public.readings(id) on delete cascade,
  term                  text not null,
  definition            text not null,
  example_sentence      text,
  context_sentence      text,
  is_visible_to_students boolean not null default false,
  created_at            timestamp with time zone default now(),
  updated_at            timestamp with time zone default now()
);

alter table public.glossary_terms enable row level security;

drop policy if exists "Teachers can read glossary terms in own readings"   on public.glossary_terms;
drop policy if exists "Students can read visible glossary terms"           on public.glossary_terms;
drop policy if exists "Teachers can create glossary terms in own readings" on public.glossary_terms;
drop policy if exists "Teachers can update glossary terms in own readings" on public.glossary_terms;
drop policy if exists "Teachers can delete glossary terms in own readings" on public.glossary_terms;

-- Teachers: full read access to all terms in their readings
create policy "Teachers can read glossary terms in own readings"
on public.glossary_terms
for select
to authenticated
using (
  exists (
    select 1
    from public.readings r
    join public.folder_sections fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    where r.id = glossary_terms.reading_id
      and lf.teacher_id = auth.uid()
  )
);

-- Students: only see visible terms from visible readings they belong to
create policy "Students can read visible glossary terms"
on public.glossary_terms
for select
to authenticated
using (
  glossary_terms.is_visible_to_students = true
  and exists (
    select 1
    from public.readings r
    join public.folder_sections fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    join public.folder_members fm on fm.folder_id = lf.id
    where r.id = glossary_terms.reading_id
      and r.is_visible_to_students = true
      and fs.is_visible_to_students = true
      and lf.is_visible_to_students = true
      and fm.student_id = auth.uid()
  )
);

-- Teachers: insert terms only in readings they own
create policy "Teachers can create glossary terms in own readings"
on public.glossary_terms
for insert
to authenticated
with check (
  exists (
    select 1
    from public.readings r
    join public.folder_sections fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    where r.id = reading_id
      and lf.teacher_id = auth.uid()
  )
);

-- Teachers: update terms only in readings they own
create policy "Teachers can update glossary terms in own readings"
on public.glossary_terms
for update
to authenticated
using (
  exists (
    select 1
    from public.readings r
    join public.folder_sections fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    where r.id = glossary_terms.reading_id
      and lf.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.readings r
    join public.folder_sections fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    where r.id = reading_id
      and lf.teacher_id = auth.uid()
  )
);

-- Teachers: delete terms only in readings they own
create policy "Teachers can delete glossary terms in own readings"
on public.glossary_terms
for delete
to authenticated
using (
  exists (
    select 1
    from public.readings r
    join public.folder_sections fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    where r.id = glossary_terms.reading_id
      and lf.teacher_id = auth.uid()
  )
);

-- RPC: get_reading_glossary_terms
-- Teachers receive all terms; students receive only visible ones
-- (subject to folder/section/reading visibility and membership).
create or replace function public.get_reading_glossary_terms(p_reading_id uuid)
returns table (
  result_id                     uuid,
  result_reading_id             uuid,
  result_term                   text,
  result_definition             text,
  result_example_sentence       text,
  result_context_sentence       text,
  result_is_visible_to_students boolean,
  result_created_at             timestamp with time zone,
  result_updated_at             timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id    uuid;
  v_is_teacher         boolean;
  v_is_student_allowed boolean;
begin
  v_current_user_id := auth.uid();

  if v_current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  -- Is the caller a teacher who owns the folder containing this reading?
  select exists (
    select 1
    from public.readings r
    join public.folder_sections fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    where r.id = p_reading_id
      and lf.teacher_id = v_current_user_id
  )
  into v_is_teacher;

  -- Is the caller a student who may access this reading?
  -- Requires: folder member + folder/section/reading all visible.
  select exists (
    select 1
    from public.readings r
    join public.folder_sections fs on fs.id = r.section_id
    join public.learning_folders lf on lf.id = fs.folder_id
    join public.folder_members fm on fm.folder_id = lf.id
    where r.id = p_reading_id
      and r.is_visible_to_students = true
      and fs.is_visible_to_students = true
      and lf.is_visible_to_students = true
      and fm.student_id = v_current_user_id
  )
  into v_is_student_allowed;

  if not v_is_teacher and not v_is_student_allowed then
    raise exception 'You are not allowed to view glossary terms for this reading';
  end if;

  return query
  select
    gt.id,
    gt.reading_id,
    gt.term,
    gt.definition,
    gt.example_sentence,
    gt.context_sentence,
    gt.is_visible_to_students,
    gt.created_at,
    gt.updated_at
  from public.glossary_terms gt
  where gt.reading_id = p_reading_id
    and (
      v_is_teacher = true
      or gt.is_visible_to_students = true
    )
  order by gt.created_at asc;
end;
$$;

grant execute on function public.get_reading_glossary_terms(uuid) to authenticated;

notify pgrst, 'reload schema';
