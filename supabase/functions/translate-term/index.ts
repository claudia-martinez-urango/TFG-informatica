import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const deeplApiKey    = Deno.env.get("DEEPL_API_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return json({ error: "Invalid or expired token" }, 401);
    }

    // ── 2. Parse request ────────────────────────────────────────────────────
    const { selectedText, contextSentence } = await req.json();

    if (!selectedText || !selectedText.trim()) {
      return json({ error: "Missing selectedText" }, 400);
    }

    // ── 3. Call DeepL ───────────────────────────────────────────────────────
    // The `context` field is passed to DeepL so it can disambiguate the word
    // based on the surrounding sentence — this is what gives DeepL an advantage
    // over context-free translation APIs.
    const body: Record<string, unknown> = {
      text:        [selectedText.trim()],
      source_lang: "EN",
      target_lang: "ES",
    };

    if (contextSentence && contextSentence.trim()) {
      body.context = contextSentence.trim();
    }

    const deeplRes = await fetch("https://api-free.deepl.com/v2/translate", {
      method:  "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${deeplApiKey}`,
        "Content-Type":  "application/json",
      },
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!deeplRes.ok) {
      const errText = await deeplRes.text();
      console.error("[translate-term] DeepL error:", deeplRes.status, errText);
      return json({ found: false });
    }

    const data        = await deeplRes.json();
    const translation = data?.translations?.[0]?.text;

    // Ignore if DeepL returned the original text unchanged
    if (!translation || translation.toLowerCase() === selectedText.trim().toLowerCase()) {
      return json({ found: false });
    }

    return json({ found: true, translation });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[translate-term]", message);
    return json({ found: false });
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
