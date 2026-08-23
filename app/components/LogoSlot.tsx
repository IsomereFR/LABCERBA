import Image from 'next/image';

/**
 * Logo Cerba officiel (designtokens.md §8).
 * Fichier fourni par le client : public/logo-cerba.png (168×114, transparent).
 * Le logo n'est PAS redessiné ni recomposé — l'image officielle est affichée
 * telle quelle, à sa taille de référence (94×64), sur fond clair.
 */
export function LogoSlot() {
  return (
    <Image
      className="logo-cerba"
      src="/logo-cerba.png"
      alt="Cerba"
      width={94}
      height={64}
      priority
    />
  );
}
