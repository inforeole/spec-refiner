// Proxy Inworld TTS — détient la clé côté serveur, jamais dans le bundle front.
// Le front envoie le texte déjà préparé/nettoyé; les paramètres de voix sont
// imposés ici. Renvoie le JSON Inworld tel quel (le front décode audioContent).
import { corsHeaders, jsonResponse, verifySession } from "../_shared/auth.ts";

const TTS_ENDPOINT = "https://api.inworld.ai/tts/v1/voice";
const VOICE_ID = "default-o-lizv8yves-5uhgzcrjog__vanessa";
const MODEL_ID = "inworld-tts-1-max";
const SPEAKING_RATE = 1;
const TEMPERATURE = 1.1;
const MAX_TEXT_LEN = 1000; // borne serveur pour limiter l'abus

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: { message: "Method not allowed" } }, 405);
  }

  const userId = await verifySession(req);
  if (!userId) {
    return jsonResponse({ error: { message: "Session invalide ou expirée" } }, 401);
  }

  let payload: { text?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: { message: "Corps JSON invalide" } }, 400);
  }

  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) {
    return jsonResponse({ error: { message: "text requis" } }, 400);
  }

  const apiKey = Deno.env.get("INWORLD_API_KEY");
  if (!apiKey) {
    console.error("INWORLD_API_KEY manquante dans l'environnement de la function");
    return jsonResponse({ error: { message: "Proxy mal configuré" } }, 500);
  }

  try {
    const upstream = await fetch(TTS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        text: text.slice(0, MAX_TEXT_LEN),
        voiceId: VOICE_ID,
        modelId: MODEL_ID,
        audioConfig: { audioEncoding: "MP3", speakingRate: SPEAKING_RATE },
        temperature: TEMPERATURE,
      }),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      console.error("Inworld TTS error:", upstream.status, errorText);
      return jsonResponse({ error: { message: `Erreur TTS: ${upstream.status}` } }, 502);
    }

    const data = await upstream.json();
    return jsonResponse(data, 200);
  } catch (e) {
    console.error("Inworld upstream error:", (e as Error).message);
    return jsonResponse({ error: { message: "Erreur amont Inworld" } }, 502);
  }
});
