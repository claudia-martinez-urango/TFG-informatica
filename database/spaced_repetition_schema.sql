-- =============================================================
--  Spaced Repetition – Flashcard Review State & History
--  Branch: feature/spaced-repetition-flashcards
-- =============================================================

-- ─────────────────────────────────────────────────────────────
--  TABLE: flashcard_review_state
--  One row per (student_glossary_term, student).
--  Stores current SM-2 scheduling state.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.flashcard_review_state (
  id                       uuid primary key default gen_random_uuid(),
  student_glossary_term_id uuid not null
    references public.student_glossary_terms(id) on delete cascade,
  student_id               uuid not null
    references public.profiles(id) on delete cascade,

  repetition_count         integer not null default 0,
  ease_factor              numeric not null default 2.5,
  interval_days            integer not null default 0,
  due_at                   timestamp with time zone not null default now(),
  last_reviewed_at         timestamp with time zone,
  total_reviews            integer not null default 0,
  correct_reviews          integer not null default 0,
  last_rating              text,

  created_at               timestamp with time zone default now(),
  updated_at               timestamp with time zone default now(),

  constraint uq_flashcard_state
    unique (student_glossary_term_id, student_id),

  constraint chk_last_rating
    check (last_rating in ('again', 'hard', 'good', 'easy') or last_rating is null),

  constraint chk_ease_factor        check (ease_factor >= 1.3),
  constraint chk_interval_days      check (interval_days >= 0),
  constraint chk_repetition_count   check (repetition_count >= 0),
  constraint chk_total_reviews      check (total_reviews >= 0),
  constraint chk_correct_reviews    check (correct_reviews >= 0)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: flashcard_review_history
--  Append-only log; one row per review session.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.flashcard_review_history (
  id                       uuid primary key default gen_random_uuid(),
  review_state_id          uuid not null
    references public.flashcard_review_state(id) on delete cascade,
  student_glossary_term_id uuid not null
    references public.student_glossary_terms(id) on delete cascade,
  student_id               uuid not null
    references public.profiles(id) on delete cascade,

  rating                   text not null
    check (rating in ('again', 'hard', 'good', 'easy')),

  reviewed_at              timestamp with time zone default now(),

  previous_due_at          timestamp with time zone,
  next_due_at              timestamp with time zone,
  previous_interval_days   integer,
  next_interval_days       integer,
  previous_ease_factor     numeric,
  next_ease_factor         numeric,
  previous_repetition_count integer,
  next_repetition_count    integer
);

-- ─────────────────────────────────────────────────────────────
--  ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────

alter table public.flashcard_review_state  enable row level security;
alter table public.flashcard_review_history enable row level security;

-- DROP POLICY IF EXISTS makes these statements safe to re-run.
-- PostgreSQL has no CREATE POLICY IF NOT EXISTS / OR REPLACE.

drop policy if exists "students_select_own_flashcard_state"  on public.flashcard_review_state;
drop policy if exists "students_insert_own_flashcard_state"  on public.flashcard_review_state;
drop policy if exists "students_update_own_flashcard_state"  on public.flashcard_review_state;
drop policy if exists "students_select_own_flashcard_history" on public.flashcard_review_history;

-- flashcard_review_state: students read their own rows
create policy "students_select_own_flashcard_state"
  on public.flashcard_review_state
  for select
  using (student_id = auth.uid());

-- flashcard_review_state: students insert their own rows
create policy "students_insert_own_flashcard_state"
  on public.flashcard_review_state
  for insert
  with check (student_id = auth.uid());

-- flashcard_review_state: students update their own rows
create policy "students_update_own_flashcard_state"
  on public.flashcard_review_state
  for update
  using (student_id = auth.uid());

-- flashcard_review_history: students read their own rows
create policy "students_select_own_flashcard_history"
  on public.flashcard_review_history
  for select
  using (student_id = auth.uid());

-- flashcard_review_history: inserts only via RPC (security definer),
-- so no direct INSERT policy is needed for students.


-- ─────────────────────────────────────────────────────────────
--  RPC: ensure_flashcard_state_for_my_term
--  Creates the review state row if it does not exist yet,
--  or returns the existing one.
-- ─────────────────────────────────────────────────────────────
create or replace function public.ensure_flashcard_state_for_my_term(
  p_student_glossary_term_id uuid
)
returns setof public.flashcard_review_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_row        public.flashcard_review_state;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Verify the term belongs to the current student
  if not exists (
    select 1 from public.student_glossary_terms
    where id = p_student_glossary_term_id
      and student_id = v_student_id
  ) then
    raise exception 'Term not found or does not belong to you';
  end if;

  -- Upsert: insert if not exists
  insert into public.flashcard_review_state (
    student_glossary_term_id,
    student_id
  )
  values (
    p_student_glossary_term_id,
    v_student_id
  )
  on conflict (student_glossary_term_id, student_id) do nothing;

  return query
    select * from public.flashcard_review_state
    where student_glossary_term_id = p_student_glossary_term_id
      and student_id = v_student_id;
end;
$$;


-- ─────────────────────────────────────────────────────────────
--  RPC: get_my_due_flashcards
--  Returns all flashcards where due_at <= now().
--  Joins glossary term, reading, and section data.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_my_due_flashcards()
returns table (
  review_state_id          uuid,
  student_glossary_term_id uuid,
  selected_text            text,
  definition               text,
  spanish_translation      text,
  example_sentence         text,
  context_sentence         text,
  student_note             text,
  is_mastered              boolean,
  reading_id               uuid,
  reading_title            text,
  due_at                   timestamp with time zone,
  repetition_count         integer,
  ease_factor              numeric,
  interval_days            integer,
  total_reviews            integer,
  correct_reviews          integer,
  last_rating              text,
  overdue_days             integer,
  is_overdue               boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
    select
      frs.id                        as review_state_id,
      sgt.id                        as student_glossary_term_id,
      sgt.selected_text,
      sgt.definition,
      sgt.spanish_translation,
      sgt.example_sentence,
      sgt.context_sentence,
      sgt.student_note,
      sgt.is_mastered,
      r.id                          as reading_id,
      r.title                       as reading_title,
      frs.due_at,
      frs.repetition_count,
      frs.ease_factor,
      frs.interval_days,
      frs.total_reviews,
      frs.correct_reviews,
      frs.last_rating,
      greatest(0,
        extract(day from (now() - frs.due_at))::integer
      )                             as overdue_days,
      (frs.due_at < date_trunc('day', now()))
                                    as is_overdue
    from public.flashcard_review_state frs
    join public.student_glossary_terms sgt
      on sgt.id = frs.student_glossary_term_id
    join public.readings r
      on r.id  = sgt.reading_id
    where frs.student_id = v_student_id
      and frs.due_at     <= now()
    order by frs.due_at asc;
end;
$$;


-- ─────────────────────────────────────────────────────────────
--  RPC: get_my_flashcard_overview
--  Returns stats counts and a friendly reminder message.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_my_flashcard_overview()
returns table (
  due_count          bigint,
  due_today_count    bigint,
  overdue_count      bigint,
  total_cards        bigint,
  mastered_count     bigint,
  reviewed_today_count bigint,
  upcoming_count     bigint,
  reminder_message   text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id   uuid;
  v_due          bigint;
  v_due_today    bigint;
  v_overdue      bigint;
  v_total        bigint;
  v_mastered     bigint;
  v_reviewed_today bigint;
  v_upcoming     bigint;
  v_message      text;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into v_total
  from public.flashcard_review_state
  where student_id = v_student_id;

  select count(*) into v_due
  from public.flashcard_review_state
  where student_id = v_student_id
    and due_at <= now();

  select count(*) into v_due_today
  from public.flashcard_review_state
  where student_id = v_student_id
    and due_at >= date_trunc('day', now())
    and due_at <= now();

  select count(*) into v_overdue
  from public.flashcard_review_state
  where student_id = v_student_id
    and due_at < date_trunc('day', now());

  select count(*) into v_mastered
  from public.flashcard_review_state frs
  join public.student_glossary_terms sgt
    on sgt.id = frs.student_glossary_term_id
  where frs.student_id = v_student_id
    and sgt.is_mastered = true;

  select count(*) into v_reviewed_today
  from public.flashcard_review_state
  where student_id       = v_student_id
    and last_reviewed_at >= date_trunc('day', now());

  select count(*) into v_upcoming
  from public.flashcard_review_state
  where student_id = v_student_id
    and due_at > now();

  -- Compose reminder message
  if v_overdue > 0 and v_due_today > 0 then
    v_message := 'You have ' || v_due_today || ' card' ||
      case when v_due_today = 1 then '' else 's' end ||
      ' due today and ' || v_overdue || ' overdue card' ||
      case when v_overdue = 1 then '' else 's' end || '.';
  elsif v_overdue > 0 then
    v_message := 'You have ' || v_overdue || ' overdue card' ||
      case when v_overdue = 1 then '' else 's' end || '. Review when you are ready.';
  elsif v_due_today > 0 then
    v_message := 'You have ' || v_due_today || ' vocabulary card' ||
      case when v_due_today = 1 then '' else 's' end || ' to review today.';
  elsif v_due > 0 then
    v_message := 'You have ' || v_due || ' vocabulary card' ||
      case when v_due = 1 then '' else 's' end || ' to review.';
  else
    v_message := 'No cards due right now. Keep it up!';
  end if;

  return query select
    v_due,
    v_due_today,
    v_overdue,
    v_total,
    v_mastered,
    v_reviewed_today,
    v_upcoming,
    v_message;
end;
$$;


-- ─────────────────────────────────────────────────────────────
--  RPC: review_my_flashcard
--  Applies the simplified SM-2 algorithm, updates the state,
--  and inserts a history row.
-- ─────────────────────────────────────────────────────────────
create or replace function public.review_my_flashcard(
  p_review_state_id uuid,
  p_rating          text
)
returns setof public.flashcard_review_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id   uuid;
  v_state        public.flashcard_review_state;
  v_new_rep      integer;
  v_new_ef       numeric;
  v_new_interval integer;
  v_new_due      timestamp with time zone;
  v_is_correct   boolean;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_rating not in ('again', 'hard', 'good', 'easy') then
    raise exception 'Invalid rating. Must be again, hard, good, or easy.';
  end if;

  -- Load the review state (no FOR UPDATE — pgBouncer transaction mode
  -- does not guarantee row-level locks across pooled connections)
  select * into v_state
  from public.flashcard_review_state
  where id = p_review_state_id
    and student_id = v_student_id;

  if not found then
    raise exception 'Review state not found or does not belong to you';
  end if;

  -- Defaults from current state
  v_new_rep      := v_state.repetition_count;
  v_new_ef       := v_state.ease_factor;
  v_new_interval := v_state.interval_days;
  v_is_correct   := false;

  -- ── SM-2 simplified algorithm ────────────────────────────
  case p_rating

    when 'again' then
      v_new_rep      := 0;
      v_new_interval := 1;
      v_new_ef       := greatest(1.3, v_state.ease_factor - 0.2);
      v_is_correct   := false;

    when 'hard' then
      v_new_rep      := v_state.repetition_count + 1;
      v_new_interval := greatest(1, round(v_state.interval_days * 1.2));
      v_new_ef       := greatest(1.3, v_state.ease_factor - 0.15);
      v_is_correct   := true;

    when 'good' then
      v_new_rep  := v_state.repetition_count + 1;
      v_new_ef   := v_state.ease_factor;         -- unchanged
      if v_state.repetition_count = 0 then
        v_new_interval := 1;
      elsif v_state.repetition_count = 1 then
        v_new_interval := 3;
      else
        v_new_interval := round(v_state.interval_days * v_state.ease_factor);
      end if;
      v_new_interval := greatest(1, v_new_interval);
      v_is_correct   := true;

    when 'easy' then
      v_new_rep  := v_state.repetition_count + 1;
      v_new_ef   := v_state.ease_factor + 0.15;
      if v_state.repetition_count = 0 then
        v_new_interval := 4;
      else
        v_new_interval := round(v_state.interval_days * v_state.ease_factor * 1.3);
      end if;
      v_new_interval := greatest(1, v_new_interval);
      v_is_correct   := true;

  end case;

  v_new_due := now() + (v_new_interval || ' days')::interval;

  -- Insert history row
  insert into public.flashcard_review_history (
    review_state_id,
    student_glossary_term_id,
    student_id,
    rating,
    reviewed_at,
    previous_due_at,
    next_due_at,
    previous_interval_days,
    next_interval_days,
    previous_ease_factor,
    next_ease_factor,
    previous_repetition_count,
    next_repetition_count
  ) values (
    v_state.id,
    v_state.student_glossary_term_id,
    v_student_id,
    p_rating,
    now(),
    v_state.due_at,
    v_new_due,
    v_state.interval_days,
    v_new_interval,
    v_state.ease_factor,
    v_new_ef,
    v_state.repetition_count,
    v_new_rep
  );

  -- Update review state
  update public.flashcard_review_state set
    repetition_count  = v_new_rep,
    ease_factor       = v_new_ef,
    interval_days     = v_new_interval,
    due_at            = v_new_due,
    last_reviewed_at  = now(),
    total_reviews     = v_state.total_reviews + 1,
    correct_reviews   = v_state.correct_reviews + case when v_is_correct then 1 else 0 end,
    last_rating       = p_rating,
    updated_at        = now()
  where id = v_state.id;

  -- Auto-mastery: if the student rates "easy" and the card has been reviewed
  -- correctly at least 5 times and is now scheduled 21+ days out (3 weeks),
  -- automatically mark the glossary term as mastered.
  if p_rating = 'easy'
     and v_new_rep      >= 5
     and v_new_interval >= 21
  then
    update public.student_glossary_terms
    set is_mastered = true
    where id         = v_state.student_glossary_term_id
      and student_id = v_student_id
      and is_mastered = false;  -- no-op if already mastered
  end if;

  return query
    select * from public.flashcard_review_state
    where id = v_state.id;
end;
$$;


-- ─────────────────────────────────────────────────────────────
--  RPC: get_my_upcoming_flashcards
--  Returns cards scheduled for future review (due_at > now()).
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_my_upcoming_flashcards(
  p_limit integer default 20
)
returns table (
  review_state_id          uuid,
  student_glossary_term_id uuid,
  selected_text            text,
  due_at                   timestamp with time zone,
  interval_days            integer,
  last_rating              text,
  reading_title            text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
    select
      frs.id            as review_state_id,
      sgt.id            as student_glossary_term_id,
      sgt.selected_text,
      frs.due_at,
      frs.interval_days,
      frs.last_rating,
      r.title           as reading_title
    from public.flashcard_review_state frs
    join public.student_glossary_terms sgt
      on sgt.id = frs.student_glossary_term_id
    join public.readings r
      on r.id  = sgt.reading_id
    where frs.student_id = v_student_id
      and frs.due_at > now()
    order by frs.due_at asc
    limit p_limit;
end;
$$;


-- ─────────────────────────────────────────────────────────────
--  RPC: get_my_flashcard_reminder  (lightweight – for Navbar)
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_my_flashcard_reminder()
returns table (
  due_count        bigint,
  overdue_count    bigint,
  reminder_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_due        bigint;
  v_overdue    bigint;
  v_message    text;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    return query select 0::bigint, 0::bigint, 'No cards due right now.'::text;
    return;
  end if;

  select count(*) into v_due
  from public.flashcard_review_state
  where student_id = v_student_id
    and due_at <= now();

  select count(*) into v_overdue
  from public.flashcard_review_state
  where student_id = v_student_id
    and due_at < date_trunc('day', now());

  if v_overdue > 0 then
    v_message := v_overdue::text || ' overdue';
  elsif v_due > 0 then
    v_message := 'Flashcards (' || v_due || ')';
  else
    v_message := 'Flashcards';
  end if;

  return query select v_due, v_overdue, v_message;
end;
$$;


-- ─────────────────────────────────────────────────────────────
--  RPC: delete_my_flashcard_state
--  Removes the review state (and cascade-deletes history) for
--  one of the current student's personal glossary terms.
-- ─────────────────────────────────────────────────────────────
create or replace function public.delete_my_flashcard_state(
  p_student_glossary_term_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.flashcard_review_state
  where student_glossary_term_id = p_student_glossary_term_id
    and student_id = v_student_id;
end;
$$;


-- ─────────────────────────────────────────────────────────────
--  RPC: get_my_all_glossary_terms_with_flashcard_status
--  Returns every personal glossary term for the current student
--  together with a flag indicating whether a flashcard state
--  already exists.  Used by the enrollment panel on the
--  /student/flashcards page.
--
--  NOTE: DROP FUNCTION is required here (not just CREATE OR REPLACE)
--  because the return type was extended with folder_id + folder_name.
--  PostgreSQL rejects CREATE OR REPLACE when OUT parameters change.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.get_my_all_glossary_terms_with_flashcard_status();
create or replace function public.get_my_all_glossary_terms_with_flashcard_status()
returns table (
  term_id                  uuid,
  selected_text            text,
  definition               text,
  spanish_translation      text,
  example_sentence         text,
  context_sentence         text,
  student_note             text,
  is_mastered              boolean,
  reading_id               uuid,
  reading_title            text,
  folder_id                uuid,
  folder_name              text,
  has_flashcard_state      boolean,
  flashcard_state_id       uuid,
  flashcard_due_at         timestamp with time zone,
  flashcard_last_rating    text,
  flashcard_interval_days  integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
    select
      sgt.id                      as term_id,
      sgt.selected_text,
      sgt.definition,
      sgt.spanish_translation,
      sgt.example_sentence,
      sgt.context_sentence,
      sgt.student_note,
      sgt.is_mastered,
      r.id                        as reading_id,
      r.title                     as reading_title,
      lf.id                       as folder_id,
      lf.name                     as folder_name,
      (frs.id is not null)        as has_flashcard_state,
      frs.id                      as flashcard_state_id,
      frs.due_at                  as flashcard_due_at,
      frs.last_rating             as flashcard_last_rating,
      frs.interval_days           as flashcard_interval_days
    from public.student_glossary_terms sgt
    join public.readings r
      on r.id = sgt.reading_id
    join public.folder_sections fs
      on fs.id = r.section_id
    join public.learning_folders lf
      on lf.id = fs.folder_id
    left join public.flashcard_review_state frs
      on frs.student_glossary_term_id = sgt.id
      and frs.student_id = v_student_id
    where sgt.student_id = v_student_id
    order by lf.name asc, r.title asc, sgt.selected_text asc;
end;
$$;


-- ─────────────────────────────────────────────────────────────
--  Notify PostgREST to reload schema
-- ─────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
