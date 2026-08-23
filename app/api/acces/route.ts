import { NextRequest, NextResponse } from 'next/server';
import { adminPasswordValide } from '@/lib/admin-auth';
import { demoLockActif, demoPasswordValide, demoToken, DEMO_COOKIE } from '@/lib/demo-lock';

export const runtime = 'nodejs';

/**
 * Vérification des mots de passe, côté serveur.
 * - scope "demo"  : verrou de consultation (phase proposition, PRD §5.1).
 *                   Pose un cookie httpOnly ; verrou retiré en supprimant
 *                   DEMO_PASSWORD, voir lib/demo-lock.ts.
 * - scope "admin" : portillon de /admin. Aucun cookie : le mot de passe est
 *                   renvoyé par le client à chaque écriture et revérifié par
 *                   /api/entrees — la protection réelle est là.
 */
export async function POST(req: NextRequest) {
  let corps: { scope?: string; password?: string };
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erreur: 'Requête invalide.' }, { status: 400 });
  }

  const motDePasse = typeof corps.password === 'string' ? corps.password : '';

  if (corps.scope === 'demo') {
    if (!demoLockActif()) return NextResponse.json({ ok: true });
    if (!demoPasswordValide(motDePasse)) {
      return NextResponse.json({ ok: false, erreur: 'Mot de passe incorrect.' }, { status: 401 });
    }
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

  if (corps.scope === 'admin') {
    if (!adminPasswordValide(motDePasse)) {
      return NextResponse.json({ ok: false, erreur: 'Mot de passe incorrect.' }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, erreur: 'Scope inconnu.' }, { status: 400 });
}
