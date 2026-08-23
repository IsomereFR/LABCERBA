import type { JSX } from 'react';

/**
 * Motif identitaire des titres Cerba (designtokens.md §10) :
 * exactement UN fragment contigu en graisse forte — jamais zéro, jamais deux.
 * L'API force la règle : `accent` est obligatoire, before/after optionnels.
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
      <strong className="cerba-title__accent">{accent}</strong>
      {after && <> {after}</>}
    </Tag>
  );
}
