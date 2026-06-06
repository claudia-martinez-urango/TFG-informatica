-- Reading Detail RPC
-- ****

CREATE OR REPLACE FUNCTION public.get_reading_detail(p_reading_id uuid)
RETURNS TABLE (
  result_reading_id                   uuid,
  result_title                        text,
  result_content                      text,
  result_is_visible_to_students       boolean,
  result_section_id                   uuid,
  result_section_name                 text,
  result_section_is_visible_to_students boolean,
  result_folder_id                    uuid,
  result_folder_name                  text,
  result_folder_is_visible_to_students boolean,
  result_organization_id              uuid,
  result_organization_name            text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_user_role        text;
  v_folder_id        uuid;
  v_org_id           uuid;
  v_reading_visible  boolean;
  v_section_visible  boolean;
  v_folder_visible   boolean;
  v_is_member        boolean;
  v_is_owner         boolean;
BEGIN
  -- Get the calling user's role
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  -- Resolve folder and org for this reading
  SELECT
    s.folder_id,
    lf.organization_id,
    r.is_visible_to_students,
    s.is_visible_to_students,
    lf.is_visible_to_students
  INTO
    v_folder_id,
    v_org_id,
    v_reading_visible,
    v_section_visible,
    v_folder_visible
  FROM public.readings r
  JOIN public.folder_sections s ON s.id = r.section_id
  JOIN public.learning_folders lf ON lf.id = s.folder_id
  WHERE r.id = p_reading_id;

  IF v_folder_id IS NULL THEN
    RAISE EXCEPTION 'You are not allowed to view this reading';
  END IF;

  -- Teacher ownership check
  IF v_user_role = 'teacher' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.learning_folders lf
      JOIN public.organizations o ON o.id = lf.organization_id
      JOIN public.profiles p ON p.organization_id = o.id
      WHERE lf.id = v_folder_id
        AND p.id = v_user_id
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
      RAISE EXCEPTION 'You are not allowed to view this reading';
    END IF;
  ELSIF v_user_role = 'student' THEN
    -- Visibility checks
    IF NOT (v_reading_visible AND v_section_visible AND v_folder_visible) THEN
      RAISE EXCEPTION 'You are not allowed to view this reading';
    END IF;

    -- Membership check
    SELECT EXISTS (
      SELECT 1 FROM public.folder_members fm
      WHERE fm.folder_id = v_folder_id
        AND fm.student_id = v_user_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RAISE EXCEPTION 'You are not allowed to view this reading';
    END IF;
  ELSE
    RAISE EXCEPTION 'You are not allowed to view this reading';
  END IF;

  -- Return the reading detail
  RETURN QUERY
  SELECT
    r.id,
    r.title,
    r.content,
    r.is_visible_to_students,
    s.id,
    s.name,
    s.is_visible_to_students,
    lf.id,
    lf.name,
    lf.is_visible_to_students,
    o.id,
    o.name
  FROM public.readings r
  JOIN public.folder_sections s ON s.id = r.section_id
  JOIN public.learning_folders lf ON lf.id = s.folder_id
  JOIN public.organizations o ON o.id = lf.organization_id
  WHERE r.id = p_reading_id;
END;
$$;

NOTIFY pgrst, 'reload schema';