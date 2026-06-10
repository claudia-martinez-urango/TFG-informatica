import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_BLOOM_LEVELS = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
] as const;

type BloomLevel = (typeof VALID_BLOOM_LEVELS)[number];

interface ActivityInput {
  studentGlossaryTermId: string;
  selectedText: string;
  definition: string | null;
  definitionSource: string | null;
  contextSentence: string | null;
  readingTitle: string;
  readingExcerpt: string | null;
  selectedLevels: BloomLevel[];
}

interface BloomActivity {
  bloom_level: BloomLevel;
  prompt: string;
  expected_answer: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Authenticate the user ────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

    // Use the user's JWT so auth.uid() works in RPC calls
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client for privileged checks
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return json({ error: "Invalid or expired token" }, 401);
    }

    // ── 2. Verify the user is a student ────────────────────────────────────
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return json({ error: "Profile not found" }, 403);
    }

    if (profile.role !== "student") {
      return json({ error: "Only students can generate Bloom activities" }, 403);
    }

    // ── 3. Parse and validate request body ─────────────────────────────────
    const body: ActivityInput = await req.json();

    const {
      studentGlossaryTermId,
      selectedText,
      definition,
      definitionSource,
      contextSentence,
      readingTitle,
      readingExcerpt,
      selectedLevels,
    } = body;

    if (!studentGlossaryTermId || !selectedText || !readingTitle) {
      return json(
        { error: "Missing required fields: studentGlossaryTermId, selectedText, readingTitle" },
        400
      );
    }

    const levels: BloomLevel[] = Array.isArray(selectedLevels) && selectedLevels.length > 0
      ? selectedLevels.filter((l) => VALID_BLOOM_LEVELS.includes(l))
      : [...VALID_BLOOM_LEVELS];

    if (levels.length === 0) {
      return json({ error: "No valid Bloom levels selected" }, 400);
    }

    // ── 4. Verify the student owns the glossary term ────────────────────────
    const { data: term, error: termError } = await supabaseAdmin
      .from("student_glossary_terms")
      .select("id, reading_id")
      .eq("id", studentGlossaryTermId)
      .eq("student_id", user.id)
      .single();

    if (termError || !term) {
      return json({ error: "Glossary term not found or access denied" }, 403);
    }

    // ── 5. Verify the student can access the reading ────────────────────────
    const { data: accessData, error: accessError } = await supabaseAdmin
      .from("readings")
      .select(
        `id, is_visible_to_students,
         folder_sections!inner(
           is_visible_to_students,
           learning_folders!inner(
             is_visible_to_students,
             folder_members!inner(student_id)
           )
         )`
      )
      .eq("id", term.reading_id)
      .eq("is_visible_to_students", true)
      .eq("folder_sections.is_visible_to_students", true)
      .eq("folder_sections.learning_folders.is_visible_to_students", true)
      .eq("folder_sections.learning_folders.folder_members.student_id", user.id)
      .maybeSingle();

    if (accessError || !accessData) {
      return json({ error: "You are not allowed to access this reading" }, 403);
    }

    // ── 6. Build the OpenAI prompt ──────────────────────────────────────────
    const definitionLine = definition
      ? `Definition (${definitionSource ?? "unknown source"}): "${definition}"`
      : "No definition available — use the context sentence to infer meaning.";

    const contextLine = contextSentence
      ? `Context from the reading: "${contextSentence}"`
      : "";

    const excerptLine = readingExcerpt
      ? `Reading excerpt:\n"""\n${readingExcerpt.slice(0, 600)}\n"""`
      : "";

    const levelList = levels.map((l) => `- ${l}`).join("\n");

    const systemPrompt = `You are an educational assistant that creates Bloom's Taxonomy practice activities for language learners.

Generate one activity per requested Bloom level. Each activity must be directly tied to the specific word the student selected, helping them deeply learn and use it.

Bloom level guidelines:
- remember: recall the definition or form of the word
- understand: explain the meaning in the student's own words or give an example
- apply: use the word correctly in a new sentence or short scenario
- analyze: compare, contrast, or break down the word's usage or nuance
- evaluate: judge whether the word fits a context, or argue a point using it
- create: write an original sentence, short paragraph, or mini-dialogue using the word

Rules:
- Prompts must be clear and answerable in 1–3 sentences.
- expected_answer should be a concise model answer (not a full rubric).
- Respond ONLY with valid JSON matching the schema — no markdown, no extra text.
- bloom_level must be exactly one of: remember, understand, apply, analyze, evaluate, create.`;

    const userPrompt = `Reading: "${readingTitle}"
${excerptLine}

Word: "${selectedText}"
${definitionLine}
${contextLine}

Generate Bloom activities for the following levels:
${levelList}

Respond with this exact JSON:
{
  "activities": [
    {
      "bloom_level": "remember",
      "prompt": "...",
      "expected_answer": "..."
    }
  ]
}`;

    // ── 7. Call OpenAI ──────────────────────────────────────────────────────
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return json({ error: "Empty response from AI" }, 500);
    }

    // ── 8. Parse and validate AI response ──────────────────────────────────
    let parsed: { activities: BloomActivity[] };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return json({ error: "AI returned invalid JSON" }, 500);
    }

    if (!Array.isArray(parsed.activities) || parsed.activities.length === 0) {
      return json({ error: "AI returned no activities" }, 500);
    }

    const validActivities = parsed.activities.filter(
      (a) =>
        a.bloom_level &&
        VALID_BLOOM_LEVELS.includes(a.bloom_level) &&
        typeof a.prompt === "string" &&
        a.prompt.trim().length > 0
    );

    if (validActivities.length === 0) {
      return json({ error: "AI returned no valid activities" }, 500);
    }

    return json({
      activities: validActivities,
      ai_model: completion.model,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[generate-personal-bloom-activities]", message);
    return json({ error: message }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
