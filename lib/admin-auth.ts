import { timingSafeEqual } from 'crypto';

/**
 * Vérification du mot de passe d'administration — serveur uniquement.
 * La protection réelle est ici : l'écran de mot de passe de /admin n'est
 * qu'un portillon, chaque écriture est revérifiée par la route serveur.
 */
export function adminPasswordValide(motDePasse: string | null): boolean {
  const attendu = process.env.ADMIN_PASSWORD;
  if (!attendu || !motDePasse) return false;
  const a = Buffer.from(motDePasse);
  const b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}
