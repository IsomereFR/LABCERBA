import { createHash, timingSafeEqual } from 'crypto';

/**
 * Comparaison de secrets à temps constant — serveur uniquement.
 *
 * Pourquoi passer par une empreinte plutôt que comparer les octets bruts :
 * `timingSafeEqual` lève une exception si les deux tampons n'ont pas la même
 * taille, ce qui oblige à écrire `a.length === b.length && timingSafeEqual(…)`.
 * Ce test de longueur, lui, n'est PAS à temps constant : il court-circuite, et
 * un attaquant qui mesure le temps de réponse apprend la longueur du mot de
 * passe attendu. C'est peu, mais c'est exactement le genre de détail qu'une
 * revue de sécurité relève.
 *
 * Deux empreintes SHA-256 font toujours 32 octets : la comparaison porte sur
 * des tampons de taille identique, sans test de longueur préalable et sans
 * exception possible.
 */
export function egalConstant(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}
