-- Añade columna de visibilidad a las carpetas de aprendizaje
alter table public.learning_folders
add column if not exists is_visible_to_students boolean not null default true;

-- Actualiza el RPC para que los alumnos solo vean carpetas visibles
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
    and lf.is_visible_to_students = true
  order by fm.joined_at desc;
end;
$$;

grant execute on function public.get_my_student_folders() to authenticated;

notify pgrst, 'reload schema';
