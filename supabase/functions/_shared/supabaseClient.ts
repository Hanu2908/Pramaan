// ============================================================
// _shared/supabaseClient.ts
// Supabase admin client (service_role) for Edge Functions.
// Bypasses RLS — only use server-side, never expose to clients.
// ============================================================

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export function getAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
