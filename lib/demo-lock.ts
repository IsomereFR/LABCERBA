import { createHash, timingSafeEqual } from 'crypto';

/**
 * Verrou de démonstration sur la CONSULTATION (PRD §5.1).
 *
 * ISOLÉ VOLONTAIREMENT : le jour d'une validation Cerba, il suffit de
 * supprimer la variable d'environnement DEMO_PASSWORD (ou de la vider) pour
 * que la consultation devienne publique. Aucun autre changement de code.
 *
 * Serveur uniquement — ne rien importer d'ici dans un composant client.
 */

export const DEMO_COOKIE = 'cerba_demo_acces';

export function demoLockActif(): boolean {
  return Boolean(process.env.DEMO_PASSWORD);
}

/** Jeton opaque dérivé du mot de passe : le mot de passe lui-même ne transite
 *  jamais dans le cookie, et changer DEMO_PASSWORD invalide les accès. */
export function demoToken(): string {
  return createHash('sha256')
    .update(`labcerba-demo:${process.env.DEMO_PASSWORD ?? ''}`)
    .digest('hex');
}

function egalConstant(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function demoPasswordValide(motDePasse: string): boolean {
  const attendu = process.env.DEMO_PASSWORD;
  if (!attendu) return true;
  return egalConstant(motDePasse, attendu);
}

export function demoCookieValide(valeur: string | undefined): boolean {
  if (!demoLockActif()) return true;
  if (!valeur) return false;
  return egalConstant(valeur, demoToken());
}
