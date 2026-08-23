import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Client navigateur : clé anon uniquement (NEXT_PUBLIC_*), protégée par RLS.
 * La seule policy existante est `lecture_publique` (SELECT) : aucune écriture
 * n'est possible depuis ce client.
 */
let client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
