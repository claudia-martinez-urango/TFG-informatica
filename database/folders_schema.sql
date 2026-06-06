create extension if not exists pgcrypto;

drop function if exists public.join_folder_by_code(text);
drop function if exists public.request_join_folder_by_code(text);
drop function if exists public.get_my_student_folders();
drop function if exists public.get_folder_students(uuid);
drop function if exists public.get_folder_join_requests(uuid);
drop function if exists public.approve_folder_join_request(uuid);
drop function if exists public.reject_folder_join_request(uuid);
drop function if exists public.remove_student_from_folder(uuid, uuid);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default now()
);

create table if not exists public.learning_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  join_code text not null unique,
  created_at timestamp with time zone default now()
);

create table if not exists public.folder_members (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.learning_folders(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamp with time zone default now(),
  unique(folder_id, student_id)
);

create table if not exists public.folder_join_requests (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.learning_folders(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamp with time zone default now(),
  responded_at timestamp with time zone,
  unique(folder_id, student_id)
);

create unique index if not exists organizations_teacher_unique
on public.organizations(teacher_id);

alter table public.organizations enable row level security;
alter table public.learning_folders enable row level security;
alter table public.folder_members enable row level security;
alter table public.folder_join_requests enable row level security;

drop policy if exists "Teachers can read own organizations" on public.organizations;
drop policy if exists "Teachers can create organizations" on public.organizations;
drop policy if exists "Teachers can update own organizations" on public.organizations;
drop policy if exists "Teachers can delete own organizations" on public.organizations;

create policy "Teachers can read own organizations"
on public.organizations
for select
to authenticated
using (teacher_id = auth.uid());

create policy "Teachers can create organizations"
on public.organizations
for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

create policy "Teachers can update own organizations"
on public.organizations
for update
to authenticated
using (teacher_id = auth.uid())
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

create policy "Teachers can delete own organizations"
on public.organizations
for delete
to authenticated
using (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

drop policy if exists "Teachers can read own folders" on public.learning_folders;
drop policy if exists "Teachers can create folders" on public.learning_folders;
drop policy if exists "Teachers can update own folders" on public.learning_folders;
drop policy if exists "Teachers can delete own folders" on public.learning_folders;

create policy "Teachers can read own folders"
on public.learning_folders
for select
to authenticated
using (teacher_id = auth.uid());

create policy "Teachers can create folders"
on public.learning_folders
for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
  and exists (
    select 1
    from public.organizations o
    where o.id = organization_id
      and o.teacher_id = auth.uid()
  )
);

create policy "Teachers can update own folders"
on public.learning_folders
for update
to authenticated
using (teacher_id = auth.uid())
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

create policy "Teachers can delete own folders"
on public.learning_folders
for delete
to authenticated
using (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  )
);

drop policy if exists "Students can read own memberships" on public.folder_members;
drop policy if exists "Teachers can read members of own folders" on public.folder_members;
drop policy if exists "Teachers can delete members of own folders" on public.folder_members;

create policy "Students can read own memberships"
on public.folder_members
for select
to authenticated
using (student_id = auth.uid());

create policy "Teachers can read members of own folders"
on public.folder_members
for select
to authenticated
using (
  exists (
    select 1
    from public.learning_folders lf
    where lf.id = folder_members.folder_id
      and lf.teacher_id = auth.uid()
  )
);

create policy "Teachers can delete members of own folders"
on public.folder_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.learning_folders lf
    where lf.id = folder_members.folder_id
      and lf.teacher_id = auth.uid()
  )
);

drop policy if exists "Students can read own join requests" on public.folder_join_requests;
drop policy if exists "Teachers can read requests for own folders" on public.folder_join_requests;

create policy "Students can read own join requests"
on public.folder_join_requests
for select
to authenticated
using (student_id = auth.uid());

create policy "Teachers can read requests for own folders"
on public.folder_join_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.learning_folders lf
    where lf.id = folder_join_requests.folder_id
      and lf.teacher_id = auth.uid()
  )
);

create or replace function public.request_join_folder_by_code(p_folder_code text)
returns table (
  result_request_id uuid,
  result_folder_id uuid,
  result_folder_name text,
  result_status text,
  result_organization_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid;
  v_target_folder_id uuid;
  v_request_id uuid;
begin
  v_current_user_id := auth.uid();

  if v_current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_current_user_id
      and p.role = 'student'
  ) then
    raise exception 'Only students can request access to folders';
  end if;

  select lf.id
  into v_target_folder_id
  from public.learning_folders lf
  where lf.join_code = p_folder_code;

  if v_target_folder_id is null then
    raise exception 'Folder not found';
  end if;

  if exists (
    select 1
    from public.folder_members fm
    where fm.folder_id = v_target_folder_id
      and fm.student_id = v_current_user_id
  ) then
    raise exception 'You are already a member of this folder';
  end if;

  insert into public.folder_join_requests (
    folder_id,
    student_id,
    status
  )
  values (
    v_target_folder_id,
    v_current_user_id,
    'pending'
  )
  on conflict (folder_id, student_id) do update
  set
    status = 'pending',
    requested_at = now(),
    responded_at = null
  returning id into v_request_id;

  return query
  select
    fjr.id as result_request_id,
    lf.id as result_folder_id,
    lf.name as result_folder_name,
    fjr.status as result_status,
    o.name as result_organization_name
  from public.folder_join_requests fjr
  join public.learning_folders lf on lf.id = fjr.folder_id
  join public.organizations o on o.id = lf.organization_id
  where fjr.id = v_request_id;
end;
$$;

grant execute on function public.request_join_folder_by_code(text) to authenticated;

create or replace function public.get_my_student_folders()
returns table (
  result_folder_id uuid,
  result_folder_name text,
  result_folder_description text,
  result_join_code text,
  result_organization_name text,
  result_joined_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid;
begin
  v_current_user_id := auth.uid();

  if v_current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  return query
  select
    lf.id as result_folder_id,
    lf.name as result_folder_name,
    lf.description as result_folder_description,
    lf.join_code as result_join_code,
    o.name as result_organization_name,
    fm.joined_at as result_joined_at
  from public.folder_members fm
  join public.learning_folders lf
    on lf.id = fm.folder_id
  join public.organizations o
    on o.id = lf.organization_id
  where fm.student_id = v_current_user_id
  order by fm.joined_at desc;
end;
$$;

grant execute on function public.get_my_student_folders() to authenticated;

create or replace function public.get_folder_students(p_folder_id uuid)
returns table (
  result_student_id uuid,
  result_first_name text,
  result_last_name text,
  result_email text,
  result_joined_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid;
begin
  v_current_user_id := auth.uid();

  if v_current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  if not exists (
    select 1
    from public.learning_folders lf
    where lf.id = p_folder_id
      and lf.teacher_id = v_current_user_id
  ) then
    raise exception 'You are not allowed to view this folder';
  end if;

  return query
  select
    p.id as result_student_id,
    p.first_name as result_first_name,
    p.last_name as result_last_name,
    p.email as result_email,
    fm.joined_at as result_joined_at
  from public.folder_members fm
  join public.profiles p
    on p.id = fm.student_id
  where fm.folder_id = p_folder_id
  order by fm.joined_at desc;
end;
$$;

grant execute on function public.get_folder_students(uuid) to authenticated;

create or replace function public.get_folder_join_requests(p_folder_id uuid)
returns table (
  result_request_id uuid,
  result_student_id uuid,
  result_first_name text,
  result_last_name text,
  result_email text,
  result_status text,
  result_requested_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid;
begin
  v_current_user_id := auth.uid();

  if v_current_user_id is null then
    raise exception 'User is not authenticated';
  end if;

  if not exists (
    select 1
    from public.learning_folders lf
    where lf.id = p_folder_id
      and lf.teacher_id = v_current_user_id
  ) then
    raise exception 'You are not allowed to view requests for this folder';
  end if;

  return query
  select
    fjr.id as result_request_id,
    p.id as result_student_id,
    p.first_name as result_first_name,
    p.last_name as result_last_name,
    p.email as result_email,
    fjr.status as result_status,
    fjr.requested_at as result_requested_at
  from public.folder_join_requests fjr
  join public.profiles p
    on p.id = fjr.student_id
  where fjr.folder_id = p_folder_id
  order by fjr.requested_at desc;
end;
$$;

grant execute on function public.get_folder_join_requests(uuid) to authenticated;

create or replace function public.approve_folder_join_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid;
  v_folder_id uuid;
  v_student_id uuid;
begin
  v_current_user_id := auth.uid();

  select fjr.folder_id, fjr.student_id
  into v_folder_id, v_student_id
  from public.folder_join_requests fjr
  join public.learning_folders lf
    on lf.id = fjr.folder_id
  where fjr.id = p_request_id
    and lf.teacher_id = v_current_user_id;

  if v_folder_id is null then
    raise exception 'Request not found or not allowed';
  end if;

  update public.folder_join_requests
  set status = 'approved',
      responded_at = now()
  where id = p_request_id;

  insert into public.folder_members (
    folder_id,
    student_id
  )
  values (
    v_folder_id,
    v_student_id
  )
  on conflict (folder_id, student_id) do nothing;

  return true;
end;
$$;

grant execute on function public.approve_folder_join_request(uuid) to authenticated;

create or replace function public.reject_folder_join_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid;
begin
  v_current_user_id := auth.uid();

  if not exists (
    select 1
    from public.folder_join_requests fjr
    join public.learning_folders lf
      on lf.id = fjr.folder_id
    where fjr.id = p_request_id
      and lf.teacher_id = v_current_user_id
  ) then
    raise exception 'Request not found or not allowed';
  end if;

  update public.folder_join_requests
  set status = 'rejected',
      responded_at = now()
  where id = p_request_id;

  return true;
end;
$$;

grant execute on function public.reject_folder_join_request(uuid) to authenticated;

create or replace function public.remove_student_from_folder(
  p_folder_id uuid,
  p_student_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid;
begin
  v_current_user_id := auth.uid();

  if not exists (
    select 1
    from public.learning_folders lf
    where lf.id = p_folder_id
      and lf.teacher_id = v_current_user_id
  ) then
    raise exception 'You are not allowed to remove students from this folder';
  end if;

  delete from public.folder_members
  where folder_id = p_folder_id
    and student_id = p_student_id;

  update public.folder_join_requests
  set status = 'rejected',
      responded_at = now()
  where folder_id = p_folder_id
    and student_id = p_student_id;

  return true;
end;
$$;

grant execute on function public.remove_student_from_folder(uuid, uuid) to authenticated;