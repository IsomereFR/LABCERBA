import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminPasswordValide } from '@/lib/admin-auth';
import { cleAppelant, secondesBlocage, enregistrerEchec, enregistrerSucces } from '@/lib/rate-limit';
import { STATUTS, Statut } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * Seule voie d'écriture de l'application (PRD §6).
 * - Clé service role : serveur uniquement, jamais préfixée NEXT_PUBLIC_.
 * - Mot de passe d'administration revérifié à CHAQUE requête (401 sinon) :
 *   l'écran de /admin n'est qu'un portillon, la protection réelle est ici.
 * - Tentatives limitées : cette route répond 401 sur un mauvais mot de passe,
 *   elle est donc, elle aussi, un endroit où l'on peut en essayer.
 */

/**
 * Bornes de taille. Le plus long libellé du catalogue Cerba fait 109
 * caractères ; 200 laisse de la marge aux saisies hors catalogue sans laisser
 * passer une charge démesurée. Sans ces bornes, un porteur du mot de passe
 * peut écrire des mégaoctets en base — et le corps de requête lui-même n'a
 * aucune limite.
 */
const MAX = { analyse: 200, delai: 200, commentaire: 2000 } as const;
/** 64 Kio : très au-delà de toute saisie légitime, très en deçà d'une saturation. */
const MAX_CORPS_OCTETS = 64 * 1024;

/**
 * Le message d'erreur de la base ne remonte PAS au navigateur : il nomme la
 * table, les colonnes et les contraintes, c'est-à-dire une carte du schéma
 * offerte à qui sonde l'API. Il est journalisé côté serveur, où il reste
 * utile au diagnostic.
 */
function erreurServeur(contexte: string, detail: unknown) {
  console.error(`[api/entrees] ${contexte}`, detail);
  return NextResponse.json(
    { ok: false, erreur: 'Enregistrement impossible. Réessayez, puis signalez l’incident.' },
    { status: 500 },
  );
}

/**
 * Renvoie null si la configuration serveur est incomplète, plutôt que de
 * laisser `createClient` lever : une exception non rattrapée produit une page
 * d'erreur opaque, sans trace exploitable dans les journaux.
 */
function clientServiceRole() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return null;
  return createClient(url, cle, { auth: { persistSession: false } });
}

/** Réponse commune aux trois verbes quand la configuration serveur manque. */
function configurationIncomplete() {
  return erreurServeur(
    'configuration',
    'NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente de ce déploiement',
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

/**
 * Contrôle d'accès commun aux trois verbes : limitation des tentatives, puis
 * mot de passe. Renvoie une réponse d'erreur, ou null si la requête peut
 * poursuivre.
 */
function refuser(req: NextRequest): NextResponse | null {
  const cle = cleAppelant(req, 'entrees');
  const attente = secondesBlocage(cle);
  if (attente !== null) {
    return NextResponse.json(
      { ok: false, erreur: `Trop de tentatives. Réessayez dans ${Math.ceil(attente / 60)} min.` },
      { status: 429, headers: { 'Retry-After': String(attente) } },
    );
  }
  if (!adminPasswordValide(motDePasseDe(req))) {
    enregistrerEchec(cle);
    return nonAutorise();
  }
  enregistrerSucces(cle);
  return null;
}

/** Lecture du corps avec plafond de taille, avant tout travail d'analyse. */
async function lireCorps<T>(req: NextRequest): Promise<{ corps?: T; refus?: NextResponse }> {
  const annonce = Number(req.headers.get('content-length') ?? '0');
  if (annonce > MAX_CORPS_OCTETS) {
    return {
      refus: NextResponse.json({ ok: false, erreur: 'Requête trop volumineuse.' }, { status: 413 }),
    };
  }
  let texte: string;
  try {
    texte = await req.text();
  } catch {
    return { refus: NextResponse.json({ ok: false, erreur: 'Requête invalide.' }, { status: 400 }) };
  }
  if (texte.length > MAX_CORPS_OCTETS) {
    return {
      refus: NextResponse.json({ ok: false, erreur: 'Requête trop volumineuse.' }, { status: 413 }),
    };
  }
  try {
    return { corps: JSON.parse(texte) as T };
  } catch {
    return { refus: NextResponse.json({ ok: false, erreur: 'Requête invalide.' }, { status: 400 }) };
  }
}

type Champs = {
  analyse?: unknown;
  statut?: unknown;
  delai?: unknown;
  commentaire?: unknown;
  /** true = retour à la normale (horodaté), false = réouverture. */
  resolu?: unknown;
};

function validerChamps(
  c: Champs,
  creation: boolean,
): { erreur?: string; valeurs?: Record<string, string | null> } {
  const valeurs: Record<string, string | null> = {};

  if (c.analyse !== undefined || creation) {
    if (typeof c.analyse !== 'string' || !c.analyse.trim()) {
      return { erreur: 'Le nom de l’analyse est obligatoire.' };
    }
    if (c.analyse.length > MAX.analyse) {
      return { erreur: `Le nom de l’analyse dépasse ${MAX.analyse} caractères.` };
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
    if (c.delai.length > MAX.delai) {
      return { erreur: `Le délai dépasse ${MAX.delai} caractères.` };
    }
    valeurs.delai = c.delai.trim();
  }
  if (c.commentaire !== undefined) {
    if (typeof c.commentaire !== 'string') return { erreur: 'Commentaire invalide.' };
    if (c.commentaire.length > MAX.commentaire) {
      return { erreur: `Le commentaire dépasse ${MAX.commentaire} caractères.` };
    }
    valeurs.commentaire = c.commentaire.trim();
  }
  // Retour à la normale : on horodate au lieu de supprimer, pour conserver
  // l'historique de l'incident (traçabilité ISO 15189 §6.8.2).
  if (c.resolu !== undefined) {
    if (typeof c.resolu !== 'boolean') return { erreur: 'Champ « resolu » invalide.' };
    valeurs.resolu_le = c.resolu ? new Date().toISOString() : null;
  }
  return { valeurs };
}

export async function POST(req: NextRequest) {
  const refus = refuser(req);
  if (refus) return refus;

  const { corps, refus: refusCorps } = await lireCorps<Champs>(req);
  if (refusCorps) return refusCorps;

  const { erreur, valeurs } = validerChamps(corps!, true);
  if (erreur) return NextResponse.json({ ok: false, erreur }, { status: 400 });

  const sb = clientServiceRole();
  if (!sb) return configurationIncomplete();

  const { data, error } = await sb
    .from('analyses_impactees')
    .insert(valeurs!)
    .select()
    .single();

  if (error) return erreurServeur('insert', error);
  return NextResponse.json({ ok: true, entree: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const refus = refuser(req);
  if (refus) return refus;

  const { corps, refus: refusCorps } = await lireCorps<Champs & { id?: unknown }>(req);
  if (refusCorps) return refusCorps;

  if (typeof corps!.id !== 'string' || !corps!.id) {
    return NextResponse.json({ ok: false, erreur: 'Identifiant manquant.' }, { status: 400 });
  }

  const { erreur, valeurs } = validerChamps(corps!, false);
  if (erreur) return NextResponse.json({ ok: false, erreur }, { status: 400 });
  if (!valeurs || Object.keys(valeurs).length === 0) {
    return NextResponse.json({ ok: false, erreur: 'Aucun champ à modifier.' }, { status: 400 });
  }

  const sb = clientServiceRole();
  if (!sb) return configurationIncomplete();

  const { data, error } = await sb
    .from('analyses_impactees')
    .update({ ...valeurs, maj_le: new Date().toISOString() })
    .eq('id', corps!.id)
    .select()
    .single();

  if (error) return erreurServeur('update', error);
  return NextResponse.json({ ok: true, entree: data });
}

export async function DELETE(req: NextRequest) {
  const refus = refuser(req);
  if (refus) return refus;

  const { corps, refus: refusCorps } = await lireCorps<{ id?: unknown }>(req);
  if (refusCorps) return refusCorps;

  if (typeof corps!.id !== 'string' || !corps!.id) {
    return NextResponse.json({ ok: false, erreur: 'Identifiant manquant.' }, { status: 400 });
  }

  const sb = clientServiceRole();
  if (!sb) return configurationIncomplete();

  const { error } = await sb
    .from('analyses_impactees')
    .delete()
    .eq('id', corps!.id);

  if (error) return erreurServeur('delete', error);
  return NextResponse.json({ ok: true });
}
