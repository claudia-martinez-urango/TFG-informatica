create extension if not exists pgcrypto;

drop function if exists public.get_folder_sections(uuid);

create table if not exists public.folder_sections (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.learning_folders(id) on delete cascade,
  name text not null,
  description text,
  order_index integer not null default 0,
  is_visible_to_students boolean not null default false,
  created_at timestamp with time zone default now()
);

alter table public.folder_sections
add column if not exists is_visible_to_students boolean not null default false;

alter table public.folder_sections enable row level security;

drop policy if exists "Teachers can read sections of own folders" on public.folder_sections;
drop policy if exists "Students can read sections of joined folders" on public.folder_sections;
drop policy if exists "Teachers can create sections in own folders" on public.folder_sections;
drop policy if exists "Teachers can update sections in own folders" on public.folder_sections;
drop policy if exists "Teachers can delete sections in own folders" on public.folder_sections;

create policy "Teachers can read sections of own folders"
on public.folder_sections
for select
to authenticated
using (
  exists (
    select 1
    from public.learning_folders lf
    where lf.id = folder_sections.folder_id
      and lf.teacher_id = auth.uid()
  )
);

create policy "Students can read sections of joined folders"
on public.folder_sections
for select
to authenticated
using (
  is_visible_to_students = true
  and exists (
    select 1
    from public.folder_members fm
    where fm.folder_id = folder_sections.folder_id
      and fm.student_id = auth.uid()
  )
);

create policy "Teachers can create sections in own folders"
on public.folder_sections
for insert
to authenticated
with check (
  exists (
    select 1
    from public.learning_folders lf
    where lf.id = folder_id
      and lf.teacher_id = auth.uid()
  )
);

create policy "Teachers can update sections in own folders"
on public.folder_sections
for update
to authenticated
using (
  exists (
    select 1
    from public.learning_folders lf
    where lf.id = folder_sections.folder_id
      and lf.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.learning_folders lf
    where lf.id = folder_id
      and lf.teacher_id = auth.uid()
  )
);

create policy "Teachers can delete sections in own folders"
on public.folder_sections
for delete
to authenticated
using (
  exists (
    select 1
    from public.learning_folders lf
    where lf.id = folder_sections.folder_id
      and lf.teacher_id = auth.uid()
  )
);

create or replace function public.get_folder_sections(p_folder_id uuid)
returns table (
  result_section_id uuid,
  result_folder_id uuid,
  result_name text,
  result_description text,
  result_order_index integer,
  result_is_visible_to_students boolean,
  result_created_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid;
  v_is_teacher boolean;
  v_is_student_member boolean;
begin
  v_current_user_id := auth.uid();

  if v_current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  select exists (
    select 1
    from public.learning_folders lf
    where lf.id = p_folder_id
      and lf.teacher_id = v_current_user_id
  )
  into v_is_teacher;

  select exists (
    select 1
    from public.folder_members fm
    where fm.folder_id = p_folder_id
      and fm.student_id = v_current_user_id
  )
  into v_is_student_member;

  if not v_is_teacher and not v_is_student_member then
    raise exception 'You are not allowed to view sections for this folder';
  end if;

  return query
  select
    fs.id as result_section_id,
    fs.folder_id as result_folder_id,
    fs.name as result_name,
    fs.description as result_description,
    fs.order_index as result_order_index,
    fs.is_visible_to_students as result_is_visible_to_students,
    fs.created_at as result_created_at
  from public.folder_sections fs
  where fs.folder_id = p_folder_id
    and (
      v_is_teacher = true
      or fs.is_visible_to_students = true
    )
  order by fs.order_index asc, fs.created_at asc;
end;
$$;

grant execute on function public.get_folder_sections(uuid) to authenticated;

notify pgrst, 'reload schema';