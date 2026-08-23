import Image from 'next/image';

/**
 * Version animée du logo Cerba pour les portillons (Admin & Démo).
 *
 * Le PNG officiel (168×114) est affiché en DEUX calques superposés, découpés
 * par clip-path dans la même image — rien n'est redessiné ni recoloré :
 *  - « points »  : la rosace des cinq points de peinture (zone haute-droite),
 *    qui entre en tournant autour de son centre mesuré (68.1 %, 45.3 %) ;
 *  - « texte »   : le mot « Cerba » (rectangle bas-gauche, x ≤ 51 %, y ≥ 76 %),
 *    qui se pose en fondu une fois la rotation presque achevée.
 * Les découpes tournent avec leur calque : les points ne sont jamais rognés.
 */
export function LogoAnime() {
  return (
    <span className="logo-anime" role="img" aria-label="Cerba">
      <Image
        className="logo-calque logo-points"
        src="/logo-cerba.png"
        alt=""
        width={108}
        height={73}
        priority
      />
      <Image
        className="logo-calque logo-texte"
        src="/logo-cerba.png"
        alt=""
        width={108}
        height={73}
        priority
      />
    </span>
  );
}
