create extension if not exists pgcrypto;

drop function if exists public.get_section_readings(uuid);

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.folder_sections(id) on delete cascade,
  title text not null,
  content text not null,
  is_visible_to_students boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.readings
add column if not exists is_visible_to_students boolean not null default false;

alter table public.readings
add column if not exists updated_at timestamp with time zone default now();

alter table public.readings enable row level security;

drop policy if exists "Teachers can read readings in own sections" on public.readings;
drop policy if exists "Students can read visible readings" on public.readings;
drop policy if exists "Teachers can create readings in own sections" on public.readings;
drop policy if exists "Teachers can update readings in own sections" on public.readings;
drop policy if exists "Teachers can delete readings in own sections" on public.readings;

create policy "Teachers can read readings in own sections"
on public.readings
for select
to authenticated
using (
  exists (
    select 1
    from public.folder_sections fs
    join public.learning_folders lf
      on lf.id = fs.folder_id
    where fs.id = readings.section_id
      and lf.teacher_id = auth.uid()
  )
);

create policy "Students can read visible readings"
on public.readings
for select
to authenticated
using (
  readings.is_visible_to_students = true
  and exists (
    select 1
    from public.folder_sections fs
    join public.folder_members fm
      on fm.folder_id = fs.folder_id
    where fs.id = readings.section_id
      and fs.is_visible_to_students = true
      and fm.student_id = auth.uid()
  )
);

create policy "Teachers can create readings in own sections"
on public.readings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.folder_sections fs
    join public.learning_folders lf
      on lf.id = fs.folder_id
    where fs.id = section_id
      and lf.teacher_id = auth.uid()
  )
);

create policy "Teachers can update readings in own sections"
on public.readings
for update
to authenticated
using (
  exists (
    select 1
    from public.folder_sections fs
    join public.learning_folders lf
      on lf.id = fs.folder_id
    where fs.id = readings.section_id
      and lf.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.folder_sections fs
    join public.learning_folders lf
      on lf.id = fs.folder_id
    where fs.id = section_id
      and lf.teacher_id = auth.uid()
  )
);

create policy "Teachers can delete readings in own sections"
on public.readings
for delete
to authenticated
using (
  exists (
    select 1
    from public.folder_sections fs
    join public.learning_folders lf
      on lf.id = fs.folder_id
    where fs.id = readings.section_id
      and lf.teacher_id = auth.uid()
  )
);

create or replace function public.get_section_readings(p_section_id uuid)
returns table (
  result_reading_id uuid,
  result_section_id uuid,
  result_title text,
  result_content text,
  result_is_visible_to_students boolean,
  result_created_at timestamp with time zone,
  result_updated_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid;
  v_is_teacher boolean;
  v_is_student_allowed boolean;
begin
  v_current_user_id := auth.uid();

  if v_current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  select exists (
    select 1
    from public.folder_sections fs
    join public.learning_folders lf
      on lf.id = fs.folder_id
    where fs.id = p_section_id
      and lf.teacher_id = v_current_user_id
  )
  into v_is_teacher;

  select exists (
    select 1
    from public.folder_sections fs
    join public.folder_members fm
      on fm.folder_id = fs.folder_id
    where fs.id = p_section_id
      and fs.is_visible_to_students = true
      and fm.student_id = v_current_user_id
  )
  into v_is_student_allowed;

  if not v_is_teacher and not v_is_student_allowed then
    raise exception 'You are not allowed to view readings for this section';
  end if;

  return query
  select
    r.id as result_reading_id,
    r.section_id as result_section_id,
    r.title as result_title,
    r.content as result_content,
    r.is_visible_to_students as result_is_visible_to_students,
    r.created_at as result_created_at,
    r.updated_at as result_updated_at
  from public.readings r
  where r.section_id = p_section_id
    and (
      v_is_teacher = true
      or r.is_visible_to_students = true
    )
  order by r.created_at desc;
end;
$$;

grant execute on function public.get_section_readings(uuid) to authenticated;

notify pgrst, 'reload schema';