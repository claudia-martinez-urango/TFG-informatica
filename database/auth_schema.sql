create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  role text not null default 'student',
  created_at timestamp with time zone default now()
);

alter table public.profiles
add column if not exists first_name text default '';

alter table public.profiles
add column if not exists last_name text default '';

alter table public.profiles
add column if not exists email text default '';

alter table public.profiles
add column if not exists role text default 'student';

alter table public.profiles
add column if not exists created_at timestamp with time zone default now();

update public.profiles
set first_name = ''
where first_name is null;

update public.profiles
set last_name = ''
where last_name is null;

update public.profiles
set email = ''
where email is null;

update public.profiles
set role = 'student'
where role is null;

alter table public.profiles
alter column first_name set not null;

alter table public.profiles
alter column last_name set not null;

alter table public.profiles
alter column email set not null;

alter table public.profiles
alter column role set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
    add constraint profiles_role_check
    check (role in ('teacher', 'student'));
  end if;
end $$;

create unique index if not exists profiles_email_unique
on public.profiles(email)
where email <> '';

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    email,
    role
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'student')
  )
  on conflict (id) do update
  set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();