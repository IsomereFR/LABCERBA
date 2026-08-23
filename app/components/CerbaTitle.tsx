import type { JSX } from 'react';
import { CoupDePinceau } from './CoupDePinceau';

/**
 * Motif identitaire des titres Cerba (designtokens.md §10) :
 * exactement UN fragment contigu en graisse forte — jamais zéro, jamais deux.
 * L'API force la règle : `accent` est obligatoire, before/after optionnels.
 *
 * Le fragment accentué est traversé par un coup de pinceau passant DERRIÈRE le
 * texte, comme sur lab-cerba.com. Le texte reste au premier plan et lisible.
 */
export function CerbaTitle({
  as: Tag = 'h2',
  before,
  accent,
  after,
  className,
}: {
  as?: keyof JSX.IntrinsicElements;
  before?: string;
  accent: string;
  after?: string;
  className?: string;
}) {
  return (
    <Tag className={`cerba-title${className ? ` ${className}` : ''}`}>
      {before && <>{before} </>}
      <strong className="cerba-title__accent">
        <CoupDePinceau />
        <span className="cerba-title__mot">{accent}</span>
      </strong>
      {after && <> {after}</>}
    </Tag>
  );
}
