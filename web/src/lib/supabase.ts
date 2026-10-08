import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Two clients, one rule: the browser only ever gets the anon key, which is
 * read-only thanks to RLS. The service_role key lives only in the Cloudflare
 * Worker's secrets and is never referenced in this app.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigured = Boolean(url && anonKey);

let serverClient: SupabaseClient | null = null;
let browserClient: SupabaseClient | null = null;

const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 5 } },
} as const;

export function getServerClient(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!serverClient) serverClient = createClient(url as string, anonKey as string, options);
  return serverClient;
}

export function getBrowserClient(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!browserClient) browserClient = createClient(url as string, anonKey as string, options);
  return browserClient;
}
