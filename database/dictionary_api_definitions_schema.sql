-- ============================================================
-- dictionary_api_definitions_schema.sql
-- Adds definition source tracking to student_glossary_terms
-- and updates RPCs to support Dictionary API definitions.
--
-- Run AFTER student_personal_glossary_schema.sql
-- ============================================================

-- ── 1. Add new columns ───────────────────────────────────────

ALTER TABLE public.student_glossary_terms
  ADD COLUMN IF NOT EXISTS definition_source         text NOT NULL DEFAULT 'manual_pending',
  ADD COLUMN IF NOT EXISTS dictionary_word           text,
  ADD COLUMN IF NOT EXISTS dictionary_part_of_speech text;

-- ── 2. Add check constraint (idempotent) ─────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'student_glossary_terms_definition_source_check'
       AND conrelid = 'public.student_glossary_terms'::regclass
  ) THEN
    ALTER TABLE public.student_glossary_terms
      ADD CONSTRAINT student_glossary_terms_definition_source_check
      CHECK (definition_source IN ('teacher_glossary', 'dictionary_api', 'manual_pending'));
  END IF;
END;
$$;

-- ── 3. RPC: preview_selected_term_for_reading ────────────────
-- Returns teacher glossary data when available.
-- source_type = 'teacher_glossary' | 'no_definition'
-- The dictionary lookup happens on the frontend after this call.

DROP FUNCTION IF EXISTS public.preview_selected_term_for_reading(uuid, text, text);

CREATE OR REPLACE FUNCTION public.preview_selected_term_for_reading(
  p_reading_id       uuid,
  p_selected_text    text,
  p_context_sentence text DEFAULT ''
)
RETURNS TABLE (
  result_selected_text           text,
  result_normalized_term         text,
  result_linked_glossary_term_id uuid,
  result_definition              text,
  result_example_sentence        text,
  result_context_sentence        text,
  result_source_type             text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text;
  v_teacher    record;
BEGIN
  IF NOT _student_can_access_reading(p_reading_id) THEN
    RAISE EXCEPTION 'Access denied to reading %', p_reading_id;
  END IF;

  v_normalized := lower(trim(p_selected_text));

  SELECT gt.id, gt.definition, gt.example_sentence, gt.context_sentence
    INTO v_teacher
    FROM public.glossary_terms gt
   WHERE gt.reading_id              = p_reading_id
     AND gt.is_visible_to_students  = TRUE
     AND lower(trim(gt.term))       = v_normalized
   LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      p_selected_text,
      v_normalized,
      v_teacher.id,
      v_teacher.definition,
      v_teacher.example_sentence,
      COALESCE(NULLIF(trim(p_context_sentence), ''), v_teacher.context_sentence),
      'teacher_glossary'::text;
  ELSE
    RETURN QUERY SELECT
      p_selected_text,
      v_normalized,
      NULL::uuid,
      NULL::text,
      NULL::text,
      NULLIF(trim(p_context_sentence), ''),
      'no_definition'::text;
  END IF;
END;
$$;

-- ── 4. RPC: add_selected_term_to_my_glossary ─────────────────
-- Now accepts optional dictionary fields from the frontend.
-- Teacher glossary ALWAYS overrides frontend-provided values.

DROP FUNCTION IF EXISTS public.add_selected_term_to_my_glossary(uuid, text, text);

CREATE OR REPLACE FUNCTION public.add_selected_term_to_my_glossary(
  p_reading_id                uuid,
  p_selected_text             text,
  p_context_sentence          text  DEFAULT '',
  p_definition                text  DEFAULT NULL,
  p_definition_source         text  DEFAULT 'manual_pending',
  p_dictionary_word           text  DEFAULT NULL,
  p_dictionary_part_of_speech text  DEFAULT NULL
)
RETURNS TABLE (
  result_id                        uuid,
  result_student_id                uuid,
  result_reading_id                uuid,
  result_linked_glossary_term_id   uuid,
  result_selected_text             text,
  result_normalized_term           text,
  result_definition                text,
  result_example_sentence          text,
  result_context_sentence          text,
  result_student_note              text,
  result_is_mastered               boolean,
  result_definition_source         text,
  result_dictionary_word           text,
  result_dictionary_part_of_speech text,
  result_created_at                timestamptz,
  result_updated_at                timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_normalized text;
  v_teacher    record;
  v_saved      public.student_glossary_terms%ROWTYPE;

  -- Final values to upsert
  v_linked_id  uuid := NULL;
  v_definition text := NULL;
  v_example    text := NULL;
  v_context    text;
  v_def_source text := 'manual_pending';
  v_dict_word  text := NULL;
  v_dict_pos   text := NULL;
BEGIN
  IF NOT _student_can_access_reading(p_reading_id) THEN
    RAISE EXCEPTION 'Access denied to reading %', p_reading_id;
  END IF;

  v_student_id := auth.uid();
  v_normalized := lower(trim(p_selected_text));
  v_context    := NULLIF(trim(p_context_sentence), '');

  -- Teacher glossary always takes priority
  SELECT gt.id, gt.definition, gt.example_sentence, gt.context_sentence
    INTO v_teacher
    FROM public.glossary_terms gt
   WHERE gt.reading_id             = p_reading_id
     AND gt.is_visible_to_students = TRUE
     AND lower(trim(gt.term))      = v_normalized
   LIMIT 1;

  IF FOUND THEN
    v_linked_id  := v_teacher.id;
    v_definition := v_teacher.definition;
    v_example    := v_teacher.example_sentence;
    v_context    := COALESCE(v_context, v_teacher.context_sentence);
    v_def_source := 'teacher_glossary';
    -- dict fields intentionally left null
  ELSE
    -- Use what the frontend provides (dictionary API or nothing)
    v_definition := p_definition;
    v_def_source := CASE
      WHEN p_definition IS NOT NULL AND trim(p_definition) <> ''
        THEN COALESCE(NULLIF(trim(p_definition_source), ''), 'dictionary_api')
      ELSE 'manual_pending'
    END;
    v_dict_word := p_dictionary_word;
    v_dict_pos  := p_dictionary_part_of_speech;
  END IF;

  INSERT INTO public.student_glossary_terms (
    student_id, reading_id, linked_glossary_term_id,
    selected_text, normalized_term,
    definition, example_sentence, context_sentence,
    definition_source, dictionary_word, dictionary_part_of_speech
  )
  VALUES (
    v_student_id, p_reading_id, v_linked_id,
    p_selected_text, v_normalized,
    v_definition, v_example, v_context,
    v_def_source, v_dict_word, v_dict_pos
  )
  ON CONFLICT (student_id, reading_id, normalized_term) DO UPDATE
    SET linked_glossary_term_id    = EXCLUDED.linked_glossary_term_id,
        definition                 = EXCLUDED.definition,
        example_sentence           = EXCLUDED.example_sentence,
        context_sentence           = EXCLUDED.context_sentence,
        definition_source          = EXCLUDED.definition_source,
        dictionary_word            = EXCLUDED.dictionary_word,
        dictionary_part_of_speech  = EXCLUDED.dictionary_part_of_speech,
        updated_at                 = now()
  RETURNING * INTO v_saved;

  RETURN QUERY SELECT
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
    v_saved.definition_source,
    v_saved.dictionary_word,
    v_saved.dictionary_part_of_speech,
    v_saved.created_at,
    v_saved.updated_at;
END;
$$;

-- ── 5. RPC: get_my_personal_glossary_for_reading ─────────────
-- Recreated to include new columns in the result set.

DROP FUNCTION IF EXISTS public.get_my_personal_glossary_for_reading(uuid);

CREATE OR REPLACE FUNCTION public.get_my_personal_glossary_for_reading(
  p_reading_id uuid
)
RETURNS TABLE (
  result_id                        uuid,
  result_student_id                uuid,
  result_reading_id                uuid,
  result_linked_glossary_term_id   uuid,
  result_selected_text             text,
  result_normalized_term           text,
  result_definition                text,
  result_example_sentence          text,
  result_context_sentence          text,
  result_student_note              text,
  result_is_mastered               boolean,
  result_definition_source         text,
  result_dictionary_word           text,
  result_dictionary_part_of_speech text,
  result_created_at                timestamptz,
  result_updated_at                timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _student_can_access_reading(p_reading_id) THEN
    RAISE EXCEPTION 'Access denied to reading %', p_reading_id;
  END IF;

  RETURN QUERY
  SELECT
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
    sgt.definition_source,
    sgt.dictionary_word,
    sgt.dictionary_part_of_speech,
    sgt.created_at,
    sgt.updated_at
  FROM public.student_glossary_terms sgt
  WHERE sgt.student_id = auth.uid()
    AND sgt.reading_id  = p_reading_id
  ORDER BY sgt.created_at ASC;
END;
$$;

notify pgrst, 'reload schema';
