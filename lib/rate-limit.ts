/**
 * Limitation des tentatives — serveur uniquement.
 *
 * Sans ce garde-fou, /api/acces et /api/entrees acceptent autant d'essais de
 * mot de passe que le réseau en supporte : un script trouve un mot de passe
 * faible en quelques minutes. Après MAX_ECHECS échecs, l'adresse est écartée
 * pendant BLOCAGE_MS.
 *
 * LIMITE À CONNAÎTRE, ET À DIRE : le compteur vit dans la mémoire du
 * processus. En hébergement sans serveur, chaque instance a le sien et tout
 * repart à zéro au démarrage à froid — cela freine un script, cela n'arrête
 * pas une attaque distribuée et patiente. La parade complète est soit un
 * pare-feu applicatif devant l'application, soit un compteur partagé
 * (Redis). Les deux relèvent de l'hébergement retenu par Cerba ; ce
 * module est le minimum qui fonctionne partout, y compris auto-hébergé.
 */

const MAX_ECHECS = 10;
const BLOCAGE_MS = 15 * 60 * 1000;
/** Au-delà, on purge : un compteur ne doit pas devenir un levier de saturation mémoire. */
const MAX_ENTREES = 10_000;

type Compteur = { echecs: number; expire: number };

const compteurs = new Map<string, Compteur>();

function purger(maintenant: number) {
  for (const [cle, c] of compteurs) {
    if (c.expire <= maintenant) compteurs.delete(cle);
  }
}

/**
 * Identifie l'appelant. `x-forwarded-for` est posé par l'hébergeur ou le
 * reverse proxy ; on ne retient que la première adresse, la seule que le
 * proxy de confiance ait écrite lui-même. En l'absence d'en-tête, tous les
 * appelants partagent un même compteur : plus strict, jamais plus laxiste.
 */
export function cleAppelant(req: Request, portee: string): string {
  const xff = req.headers.get('x-forwarded-for');
  const ip =
    xff?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'sans-adresse';
  return `${portee}:${ip}`;
}

/** Secondes restantes avant réouverture, ou null si l'appelant n'est pas bloqué. */
export function secondesBlocage(cle: string): number | null {
  const c = compteurs.get(cle);
  if (!c) return null;
  const maintenant = Date.now();
  if (c.expire <= maintenant) {
    compteurs.delete(cle);
    return null;
  }
  if (c.echecs < MAX_ECHECS) return null;
  return Math.ceil((c.expire - maintenant) / 1000);
}

export function enregistrerEchec(cle: string): void {
  const maintenant = Date.now();
  if (compteurs.size > MAX_ENTREES) purger(maintenant);

  const c = compteurs.get(cle);
  if (!c || c.expire <= maintenant) {
    compteurs.set(cle, { echecs: 1, expire: maintenant + BLOCAGE_MS });
    return;
  }
  c.echecs += 1;
  // Chaque nouvel échec repousse la fenêtre : essayer pendant le blocage
  // prolonge le blocage au lieu de l'épuiser.
  c.expire = maintenant + BLOCAGE_MS;
}

export function enregistrerSucces(cle: string): void {
  compteurs.delete(cle);
}
