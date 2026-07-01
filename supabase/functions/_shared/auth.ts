// Helpers partagés par les Edge Functions proxy: CORS + auth par token de session.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Client admin (service_role) pour appeler verify_session_token.
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement
// dans l'environnement des Edge Functions.
function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/**
 * Valide le token de session présenté dans l'en-tête X-Session-Token.
 * @returns l'user_id si valide, sinon null.
 */
export async function verifySession(req: Request): Promise<string | null> {
  const token = req.headers.get("x-session-token");
  if (!token) return null;

  const { data, error } = await adminClient().rpc("verify_session_token", {
    p_token: token,
  });
  if (error) {
    console.error("verify_session_token error:", error.message);
    return null;
  }
  return data ?? null; // data = user_id (uuid) ou null
}
