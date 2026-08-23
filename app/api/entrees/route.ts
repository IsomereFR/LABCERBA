import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminPasswordValide } from '@/lib/admin-auth';
import { STATUTS, Statut } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * Seule voie d'écriture de l'application (PRD §6).
 * - Clé service role : serveur uniquement, jamais préfixée NEXT_PUBLIC_.
 * - Mot de passe d'administration revérifié à CHAQUE requête (401 sinon) :
 *   l'écran de /admin n'est qu'un portillon, la protection réelle est ici.
 */

function clientServiceRole() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function nonAutorise() {
  return NextResponse.json(
    { ok: false, erreur: 'Mot de passe d’administration absent ou incorrect.' },
    { status: 401 },
  );
}

function motDePasseDe(req: NextRequest): string | null {
  return req.headers.get('x-admin-password');
}

type Champs = {
  analyse?: unknown;
  statut?: unknown;
  delai?: unknown;
  commentaire?: unknown;
};

function validerChamps(c: Champs, creation: boolean): { erreur?: string; valeurs?: Record<string, string> } {
  const valeurs: Record<string, string> = {};

  if (c.analyse !== undefined || creation) {
    if (typeof c.analyse !== 'string' || !c.analyse.trim()) {
      return { erreur: 'Le nom de l’analyse est obligatoire.' };
    }
    valeurs.analyse = c.analyse.trim();
  }
  if (c.statut !== undefined || creation) {
    if (typeof c.statut !== 'string' || !STATUTS.includes(c.statut as Statut)) {
      return { erreur: 'Statut invalide : indisponible, anomalie ou retard.' };
    }
    valeurs.statut = c.statut;
  }
  if (c.delai !== undefined) {
    if (typeof c.delai !== 'string') return { erreur: 'Délai invalide.' };
    valeurs.delai = c.delai.trim();
  }
  if (c.commentaire !== undefined) {
    if (typeof c.commentaire !== 'string') return { erreur: 'Commentaire invalide.' };
    valeurs.commentaire = c.commentaire.trim();
  }
  return { valeurs };
}

export async function POST(req: NextRequest) {
  if (!adminPasswordValide(motDePasseDe(req))) return nonAutorise();

  let corps: Champs;
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erreur: 'Requête invalide.' }, { status: 400 });
  }

  const { erreur, valeurs } = validerChamps(corps, true);
  if (erreur) return NextResponse.json({ ok: false, erreur }, { status: 400 });

  const { data, error } = await clientServiceRole()
    .from('analyses_impactees')
    .insert(valeurs!)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, erreur: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, entree: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!adminPasswordValide(motDePasseDe(req))) return nonAutorise();

  let corps: Champs & { id?: unknown };
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erreur: 'Requête invalide.' }, { status: 400 });
  }

  if (typeof corps.id !== 'string' || !corps.id) {
    return NextResponse.json({ ok: false, erreur: 'Identifiant manquant.' }, { status: 400 });
  }

  const { erreur, valeurs } = validerChamps(corps, false);
  if (erreur) return NextResponse.json({ ok: false, erreur }, { status: 400 });
  if (!valeurs || Object.keys(valeurs).length === 0) {
    return NextResponse.json({ ok: false, erreur: 'Aucun champ à modifier.' }, { status: 400 });
  }

  const { data, error } = await clientServiceRole()
    .from('analyses_impactees')
    .update({ ...valeurs, maj_le: new Date().toISOString() })
    .eq('id', corps.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, erreur: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, entree: data });
}

export async function DELETE(req: NextRequest) {
  if (!adminPasswordValide(motDePasseDe(req))) return nonAutorise();

  let corps: { id?: unknown };
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erreur: 'Requête invalide.' }, { status: 400 });
  }

  if (typeof corps.id !== 'string' || !corps.id) {
    return NextResponse.json({ ok: false, erreur: 'Identifiant manquant.' }, { status: 400 });
  }

  const { error } = await clientServiceRole()
    .from('analyses_impactees')
    .delete()
    .eq('id', corps.id);

  if (error) {
    return NextResponse.json({ ok: false, erreur: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
