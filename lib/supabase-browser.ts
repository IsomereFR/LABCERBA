import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Entree } from './types';

/**
 * Client navigateur : clé anon uniquement (NEXT_PUBLIC_*), protégée par RLS.
 * La seule policy existante est `lecture_publique` (SELECT) : aucune écriture
 * n'est possible depuis ce client.
 */
let client: SupabaseClient | null = null;

/**
 * Variables NEXT_PUBLIC_* absentes du build. Elles sont inlinées à la
 * compilation : si le déploiement a été construit sans elles, la lecture
 * échoue silencieusement côté navigateur — on veut un message explicite.
 */
export function variablesSupabaseManquantes(): string[] {
  const manquantes: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) manquantes.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) manquantes.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return manquantes;
}

export function getSupabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}

const DELAI_LECTURE_MS = 8000;

/**
 * Lecture des entrées avec diagnostic actionnable : configuration incomplète,
 * clé refusée, ou serveur injoignable (délai dépassé) — chaque cause produit
 * un message distinct au lieu d'un « Chargement impossible » générique ou
 * d'un « Chargement… » sans fin.
 */
export async function chargerEntrees(): Promise<
  { entrees: Entree[]; erreur?: undefined } | { entrees?: undefined; erreur: string }
> {
  const manquantes = variablesSupabaseManquantes();
  if (manquantes.length > 0) {
    return {
      erreur: `variable(s) ${manquantes.join(' et ')} non renseignée(s) sur ce déploiement — à ajouter dans Vercel (Project Settings → Environment Variables) puis redéployer`,
    };
  }
  try {
    const res = await Promise.race([
      getSupabaseBrowser()
        .from('analyses_impactees')
        .select('*')
        .order('signale_le', { ascending: false }),
      new Promise<never>((_, rejeter) =>
        setTimeout(() => rejeter(new Error('__delai__')), DELAI_LECTURE_MS),
      ),
    ]);
    if (res.error) {
      return {
        erreur: `réponse Supabase : « ${res.error.message} » — vérifiez NEXT_PUBLIC_SUPABASE_ANON_KEY et l'application de la migration SQL`,
      };
    }
    // `resolu_le` est absent tant que la migration de traçabilité n'a pas été
    // appliquée : on le normalise à null, toutes les entrées sont alors
    // considérées actives — l'application reste fonctionnelle entre-temps.
    const entrees = (res.data ?? []).map((e) => ({
      ...e,
      resolu_le: (e as Partial<Entree>).resolu_le ?? null,
    })) as Entree[];
    return { entrees };
  } catch (e) {
    return {
      erreur:
        e instanceof Error && e.message === '__delai__'
          ? `aucune réponse de Supabase après ${DELAI_LECTURE_MS / 1000} s — vérifiez NEXT_PUBLIC_SUPABASE_URL et l'état du projet Supabase`
          : 'requête impossible — vérifiez la connexion réseau puis rechargez la page',
    };
  }
}
