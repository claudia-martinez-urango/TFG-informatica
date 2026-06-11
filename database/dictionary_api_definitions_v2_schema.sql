-- ============================================================
-- dictionary_api_definitions_v2_schema.sql
-- Adds context-aware Spanish translation fields to
-- student_glossary_terms and updates affected RPCs.
--
-- Run AFTER dictionary_api_definitions_schema.sql
-- ============================================================

-- ── 1. Add translation columns ───────────────────────────────

ALTER TABLE public.student_glossary_terms
  ADD COLUMN IF NOT EXISTS spanish_translation    text,
  ADD COLUMN IF NOT EXISTS translation_source     text NOT NULL DEFAULT 'manual_pending',
  ADD COLUMN IF NOT EXISTS translation_confidence integer NOT NULL DEFAULT 0;

-- ── 2. Check constraint for translation_source ───────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'student_glossary_terms_translation_source_check'
       AND conrelid = 'public.student_glossary_terms'::regclass
  ) THEN
    ALTER TABLE public.student_glossary_terms
      ADD CONSTRAINT student_glossary_terms_translation_source_check
      CHECK (translation_source IN (
        'context_rules', 'api', 'manual_pending', 'student_edited'
      ));
  END IF;
END;
$$;

-- ── 3. RPC: add_selected_term_to_my_glossary (v2) ────────────
-- Drops the v1 signature (7 params) and adds translation fields.
-- Teacher glossary always overrides definition; translation is
-- accepted from the frontend in all cases.

DROP FUNCTION IF EXISTS public.add_selected_term_to_my_glossary(uuid, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.add_selected_term_to_my_glossary(
  p_reading_id                uuid,
  p_selected_text             text,
  p_context_sentence          text    DEFAULT '',
  p_definition                text    DEFAULT NULL,
  p_definition_source         text    DEFAULT 'manual_pending',
  p_dictionary_word           text    DEFAULT NULL,
  p_dictionary_part_of_speech text    DEFAULT NULL,
  p_spanish_translation       text    DEFAULT NULL,
  p_translation_source        text    DEFAULT 'manual_pending',
  p_translation_confidence    integer DEFAULT 0
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
  result_spanish_translation       text,
  result_translation_source        text,
  result_translation_confidence    integer,
  result_created_at                timestamptz,
  result_updated_at                timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id  uuid;
  v_normalized  text;
  v_teacher     record;
  v_saved       public.student_glossary_terms%ROWTYPE;

  v_linked_id   uuid    := NULL;
  v_definition  text    := NULL;
  v_example     text    := NULL;
  v_context     text;
  v_def_source  text    := 'manual_pending';
  v_dict_word   text    := NULL;
  v_dict_pos    text    := NULL;
  v_trans       text    := NULL;
  v_trans_src   text    := 'manual_pending';
  v_trans_conf  integer := 0;
BEGIN
  IF NOT _student_can_access_reading(p_reading_id) THEN
    RAISE EXCEPTION 'Access denied to reading %', p_reading_id;
  END IF;

  v_student_id := auth.uid();
  v_normalized := lower(trim(p_selected_text));
  v_context    := NULLIF(trim(p_context_sentence), '');

  -- Teacher glossary always takes priority for the definition
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
  ELSE
    v_definition := p_definition;
    v_def_source := CASE
      WHEN p_definition IS NOT NULL AND trim(p_definition) <> ''
        THEN COALESCE(NULLIF(trim(p_definition_source), ''), 'dictionary_api')
      ELSE 'manual_pending'
    END;
    v_dict_word := p_dictionary_word;
    v_dict_pos  := p_dictionary_part_of_speech;
  END IF;

  -- Translation is always accepted from the frontend (teacher controls visibility)
  v_trans      := NULLIF(trim(p_spanish_translation), '');
  v_trans_src  := CASE
    WHEN v_trans IS NOT NULL
      THEN COALESCE(NULLIF(trim(p_translation_source), ''), 'manual_pending')
    ELSE 'manual_pending'
  END;
  v_trans_conf := CASE WHEN v_trans IS NOT NULL THEN p_translation_confidence ELSE 0 END;

  INSERT INTO public.student_glossary_terms (
    student_id, reading_id, linked_glossary_term_id,
    selected_text, normalized_term,
    definition, example_sentence, context_sentence,
    definition_source, dictionary_word, dictionary_part_of_speech,
    spanish_translation, translation_source, translation_confidence
  )
  VALUES (
    v_student_id, p_reading_id, v_linked_id,
    p_selected_text, v_normalized,
    v_definition, v_example, v_context,
    v_def_source, v_dict_word, v_dict_pos,
    v_trans, v_trans_src, v_trans_conf
  )
  ON CONFLICT (student_id, reading_id, normalized_term) DO UPDATE
    SET linked_glossary_term_id   = EXCLUDED.linked_glossary_term_id,
        definition                = EXCLUDED.definition,
        example_sentence          = EXCLUDED.example_sentence,
        context_sentence          = EXCLUDED.context_sentence,
        definition_source         = EXCLUDED.definition_source,
        dictionary_word           = EXCLUDED.dictionary_word,
        dictionary_part_of_speech = EXCLUDED.dictionary_part_of_speech,
        spanish_translation       = EXCLUDED.spanish_translation,
        translation_source        = EXCLUDED.translation_source,
        translation_confidence    = EXCLUDED.translation_confidence,
        updated_at                = now()
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
    v_saved.spanish_translation,
    v_saved.translation_source,
    v_saved.translation_confidence,
    v_saved.created_at,
    v_saved.updated_at;
END;
$$;

-- ── 4. RPC: get_my_personal_glossary_for_reading (v2) ────────
-- Recreated to include translation columns in the result set.

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
  result_spanish_translation       text,
  result_translation_source        text,
  result_translation_confidence    integer,
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
    sgt.spanish_translation,
    sgt.translation_source,
    sgt.translation_confidence,
    sgt.created_at,
    sgt.updated_at
  FROM public.student_glossary_terms sgt
  WHERE sgt.student_id = auth.uid()
    AND sgt.reading_id  = p_reading_id
  ORDER BY sgt.created_at ASC;
END;
$$;

notify pgrst, 'reload schema';
