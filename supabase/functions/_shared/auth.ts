// Helpers partagés par les Edge Functions proxy: CORS + auth par token de session.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
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

type ProxyEndpoint = "openrouter" | "inworld";

export type AuthorizationResult =
  | { status: "ok"; userId: string }
  | { status: "unauthorized" }
  | { status: "rate_limited" }
  | { status: "error" };

/**
 * Valide le token de session et consomme atomiquement le quota du proxy.
 */
export async function authorizeSession(
  req: Request,
  endpoint: ProxyEndpoint,
  limit: number,
  windowSeconds: number,
): Promise<AuthorizationResult> {
  const token = req.headers.get("x-session-token");
  if (!token) return { status: "unauthorized" };

  const { data, error } = await adminClient().rpc(
    "consume_specrefiner_api_rate_limit",
    {
      p_token: token,
      p_endpoint: endpoint,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    },
  );
  if (error) {
    console.error("consume_specrefiner_api_rate_limit error:", error.message);
    return { status: "error" };
  }

  const result = data?.[0];
  if (!result?.user_id) return { status: "unauthorized" };
  if (!result.allowed) return { status: "rate_limited" };

  return { status: "ok", userId: result.user_id };
}
