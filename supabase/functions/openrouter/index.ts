// Proxy OpenRouter — détient la clé côté serveur, jamais dans le bundle front.
// Sert le chat d'interview ET les résumés de fichiers (même endpoint chat).
//
// Défense en profondeur: le modèle et le plafond de tokens sont IMPOSÉS ici.
// Même avec un token de session volé, impossible de lancer un autre modèle
// (ex: Opus) ou des contextes géants — ce qui a été l'abus constaté.
import {
  authorizeSession,
  corsHeaders,
  jsonResponse,
} from "../_shared/auth.ts";
import {
  fetchWithTimeout,
  PayloadTooLargeError,
  readJsonBody,
  UpstreamTimeoutError,
} from "../_shared/request.ts";
import { resolveModelRoute } from "./modelRouting.ts";
import { buildOpenRouterRequest } from "./structuredOutputs.ts";

const MAX_REQUEST_BYTES = 256_000;
const UPSTREAM_TIMEOUT_MS = 60_000;
const RATE_LIMIT_PER_MINUTE = 20;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: { message: "Method not allowed" } }, 405);
  }

  // Auth applicative: token de session valide obligatoire.
  const authorization = await authorizeSession(
    req,
    "openrouter",
    RATE_LIMIT_PER_MINUTE,
    60,
  );
  if (authorization.status === "unauthorized") {
    return jsonResponse(
      { error: { message: "Session invalide ou expirée" } },
      401,
    );
  }
  if (authorization.status === "rate_limited") {
    return jsonResponse(
      { error: { message: "Trop de requêtes. Réessaie dans une minute." } },
      429,
      { "Retry-After": "60" },
    );
  }
  if (authorization.status === "error") {
    return jsonResponse({ error: { message: "Erreur d'autorisation" } }, 500);
  }

  let payload: { task?: unknown; messages?: unknown; maxTokens?: number };
  try {
    payload = await readJsonBody(req, MAX_REQUEST_BYTES) as typeof payload;
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return jsonResponse(
        { error: { message: "Requête trop volumineuse" } },
        413,
      );
    }
    return jsonResponse({ error: { message: "Corps JSON invalide" } }, 400);
  }

  const { task, messages, maxTokens } = payload;
  const route = resolveModelRoute(task);
  if (!route) {
    return jsonResponse(
      { error: { message: "Type de tâche invalide" } },
      400,
    );
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: { message: "messages requis" } }, 400);
  }

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    console.error(
      "OPENROUTER_API_KEY manquante dans l'environnement de la function",
    );
    return jsonResponse({ error: { message: "Proxy mal configuré" } }, 500);
  }

  const cap = Math.min(
    typeof maxTokens === "number" && maxTokens > 0
      ? maxTokens
      : route.maxTokensCap,
    route.maxTokensCap,
  );

  try {
    const upstreamBody = buildOpenRouterRequest(route, messages, cap);
    const upstream = await fetchWithTimeout(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://spec.inforeole.fr",
          "X-Title": "Spec Refiner",
        },
        body: JSON.stringify(upstreamBody),
      },
      UPSTREAM_TIMEOUT_MS,
    );

    // On relaie la réponse OpenRouter telle quelle (le front lit
    // data.choices[0].message.content comme avant).
    const data = await upstream.json();
    return jsonResponse(data, upstream.status);
  } catch (e) {
    if (e instanceof UpstreamTimeoutError) {
      console.error("OpenRouter upstream timeout:", e.message);
      return jsonResponse(
        { error: { message: "Délai OpenRouter dépassé" } },
        504,
      );
    }
    console.error("OpenRouter upstream error:", (e as Error).message);
    return jsonResponse({ error: { message: "Erreur amont OpenRouter" } }, 502);
  }
});
