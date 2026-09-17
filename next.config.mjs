/**
 * En-têtes de sécurité.
 *
 * Ils ne rendent pas l'application « inviolable » — rien ne le fait. Ils
 * retirent des moyens : afficher l'application dans un cadre pour piéger un
 * clic, charger un script venu d'ailleurs, laisser le navigateur deviner le
 * type d'un fichier, faire fuir l'adresse consultée vers un site tiers.
 */

/**
 * La consultation parle directement à Supabase (lecture + abonnement temps
 * réel). `connect-src` doit donc nommer ce domaine, sinon le navigateur
 * bloque la lecture et la page reste vide. On le déduit de la variable
 * d'environnement plutôt que de l'écrire en dur : chaque déploiement autorise
 * SON projet, et rien d'autre.
 */
function origineSupabase() {
  const brut = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    if (brut) {
      const u = new URL(brut);
      return `${u.origin} wss://${u.host}`;
    }
  } catch {
    // URL malformée : on retombe sur le repli ci-dessous.
  }
  // Repli volontairement large, le temps qu'un déploiement soit configuré.
  // À resserrer dès que la variable est renseignée (elle l'est en production).
  return 'https://*.supabase.co wss://*.supabase.co';
}

const dev = process.env.NODE_ENV !== 'production';

/**
 * `'unsafe-inline'` sur les scripts est imposé par Next.js, qui insère dans la
 * page les données d'hydratation sous forme de script en ligne. S'en passer
 * suppose des « nonces », donc un middleware et le rendu dynamique de chaque
 * page : un chantier à part entière, à chiffrer si l'équipe Cerba l'exige.
 * En attendant, `script-src 'self'` interdit déjà tout script venu d'un autre
 * domaine, ce qui est la protection qui compte ici.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  // Interdit l'affichage de l'application dans un cadre. POUR L'INTÉGRER AU
  // SITE CERBA (option B du dossier de reprise), remplacer 'none' par le
  // domaine autorisé, p. ex. : frame-ancestors https://www.cerba.com
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  `connect-src 'self' ${origineSupabase()}${dev ? ' ws://localhost:* http://localhost:*' : ''}`,
  ...(dev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const enTetes = [
  { key: 'Content-Security-Policy', value: csp },
  // Doublon volontaire de frame-ancestors, pour les navigateurs anciens.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Empêche le navigateur de « deviner » le type d'un fichier servi.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // L'adresse consultée ne part pas vers un site tiers.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // L'application n'a besoin d'aucun capteur : on les refuse tous.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Ceinture et bretelles : le noindex est aussi posé via les metadata de
  // chaque page, mais l'en-tête HTTP couvre toute réponse (PRD §5.1).
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

// HTTPS obligatoire pendant deux ans, mémorisé par le navigateur. Absent en
// développement, où l'application tourne en http sur localhost.
if (!dev) {
  enTetes.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ne pas annoncer la version du framework servi : c'est du renseignement
  // gratuit pour qui cherche une faille connue.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: enTetes }];
  },
};

export default nextConfig;
