/**
 * Emplacement du logo Cerba — designtokens.md §8.
 * Le SVG officiel n'a pas été récupéré et le logo n'est PAS redessiné.
 * L'attribut data-cerba-placeholder permet de retrouver et remplacer
 * cet emplacement d'un seul grep le jour où le fichier officiel est fourni.
 */
export function LogoSlot() {
  return (
    <div className="logo-slot" data-cerba-placeholder="logo">
      <b>logo Cerba</b>
      SVG officiel à intégrer
    </div>
  );
}
