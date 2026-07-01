// Proxy OpenRouter — détient la clé côté serveur, jamais dans le bundle front.
// Sert le chat d'interview ET les résumés de fichiers (même endpoint chat).
//
// Défense en profondeur: le modèle et le plafond de tokens sont IMPOSÉS ici.
// Même avec un token de session volé, impossible de lancer un autre modèle
// (ex: Opus) ou des contextes géants — ce qui a été l'abus constaté.
import { corsHeaders, jsonResponse, verifySession } from "../_shared/auth.ts";

// Valeurs imposées côté serveur (le client ne peut pas les changer).
const MODEL = "anthropic/claude-sonnet-4";
const MAX_TOKENS_CAP = 8192;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: { message: "Method not allowed" } }, 405);
  }

  // Auth applicative: token de session valide obligatoire.
  const userId = await verifySession(req);
  if (!userId) {
    return jsonResponse({ error: { message: "Session invalide ou expirée" } }, 401);
  }

  let payload: { messages?: unknown; maxTokens?: number };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: { message: "Corps JSON invalide" } }, 400);
  }

  const { messages, maxTokens } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: { message: "messages requis" } }, 400);
  }

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY manquante dans l'environnement de la function");
    return jsonResponse({ error: { message: "Proxy mal configuré" } }, 500);
  }

  const cap = Math.min(
    typeof maxTokens === "number" && maxTokens > 0 ? maxTokens : MAX_TOKENS_CAP,
    MAX_TOKENS_CAP,
  );

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://spec-refiner.vercel.app",
        "X-Title": "Spec Refiner",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: cap, messages }),
    });

    // On relaie la réponse OpenRouter telle quelle (le front lit
    // data.choices[0].message.content comme avant).
    const data = await upstream.json();
    return jsonResponse(data, upstream.status);
  } catch (e) {
    console.error("OpenRouter upstream error:", (e as Error).message);
    return jsonResponse({ error: { message: "Erreur amont OpenRouter" } }, 502);
  }
});
