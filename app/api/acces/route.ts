import { NextRequest, NextResponse } from 'next/server';
import { adminPasswordValide } from '@/lib/admin-auth';
import { demoLockActif, demoPasswordValide, demoToken, DEMO_COOKIE } from '@/lib/demo-lock';
import { cleAppelant, secondesBlocage, enregistrerEchec, enregistrerSucces } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/** Un mot de passe plus long que cela n'est pas un mot de passe : on refuse
 *  sans même le hacher, pour ne pas offrir de levier de charge au serveur. */
const MAX_MOT_DE_PASSE = 200;

/**
 * Vérification des mots de passe, côté serveur.
 * - scope "demo"  : verrou de consultation (phase proposition, PRD §5.1).
 *                   Pose un cookie httpOnly ; verrou retiré en supprimant
 *                   DEMO_PASSWORD, voir lib/demo-lock.ts.
 * - scope "admin" : portillon de /admin. Aucun cookie : le mot de passe est
 *                   renvoyé par le client à chaque écriture et revérifié par
 *                   /api/entrees — la protection réelle est là.
 *
 * Les deux portées sont limitées en tentatives (lib/rate-limit.ts) : cette
 * route est le seul endroit où l'on peut deviner un mot de passe, et sans
 * compteur elle répond aussi vite qu'un script sait demander.
 */
export async function POST(req: NextRequest) {
  let corps: { scope?: string; password?: string };
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erreur: 'Requête invalide.' }, { status: 400 });
  }

  const portee = corps.scope === 'demo' || corps.scope === 'admin' ? corps.scope : null;
  if (!portee) {
    return NextResponse.json({ ok: false, erreur: 'Scope inconnu.' }, { status: 400 });
  }

  const cle = cleAppelant(req, `acces:${portee}`);
  const attente = secondesBlocage(cle);
  if (attente !== null) {
    return NextResponse.json(
      { ok: false, erreur: `Trop de tentatives. Réessayez dans ${Math.ceil(attente / 60)} min.` },
      { status: 429, headers: { 'Retry-After': String(attente) } },
    );
  }

  const motDePasse = typeof corps.password === 'string' ? corps.password : '';
  if (motDePasse.length > MAX_MOT_DE_PASSE) {
    enregistrerEchec(cle);
    return NextResponse.json({ ok: false, erreur: 'Mot de passe incorrect.' }, { status: 401 });
  }

  if (portee === 'demo') {
    if (!demoLockActif()) return NextResponse.json({ ok: true });
    if (!demoPasswordValide(motDePasse)) {
      enregistrerEchec(cle);
      return NextResponse.json({ ok: false, erreur: 'Mot de passe incorrect.' }, { status: 401 });
    }
    enregistrerSucces(cle);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(DEMO_COOKIE, demoToken(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return res;
  }

  if (!adminPasswordValide(motDePasse)) {
    enregistrerEchec(cle);
    return NextResponse.json({ ok: false, erreur: 'Mot de passe incorrect.' }, { status: 401 });
  }
  enregistrerSucces(cle);
  return NextResponse.json({ ok: true });
}
