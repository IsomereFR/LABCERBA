'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LIBELLES_ANALYSES, delaiHabituel } from '@/lib/catalogue-analyses';

/** Nombre maximal d'options rendues à la fois (2 222 entrées au total). */
const MAX_OPTIONS = 250;

/** Normalisation pour la recherche : accents ignorés, casse ignorée. */
function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Index précalculé une seule fois : [libellé, forme normalisée]. */
const INDEX: ReadonlyArray<readonly [string, string]> = LIBELLES_ANALYSES.map(
  (l) => [l, normaliser(l)] as const,
);

const LETTRES = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function premiereLettre(normalise: string): string {
  const c = normalise.charAt(0).toUpperCase();
  return c >= 'A' && c <= 'Z' ? c : '#';
}

/**
 * Sélecteur d'analyse : liste alphabétique complète du catalogue (2 222
 * libellés issus du CSV « catalogue_exams_fr »), filtrable au clavier —
 * recherche insensible aux accents, tous les mots tapés doivent apparaître.
 * Un index A–Z permet de dérouler directement une lettre. Si aucune entrée ne
 * correspond, la saisie libre reste possible (analyse hors catalogue).
 */
export function SelecteurAnalyse({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [lettre, setLettre] = useState<string | null>(null);
  const [actif, setActif] = useState(-1);
  const racine = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLUListElement>(null);

  const requete = normaliser(value.trim());

  const { options, total } = useMemo(() => {
    let retenues: string[];
    if (requete) {
      const mots = requete.split(/\s+/);
      retenues = [];
      for (const [libelle, forme] of INDEX) {
        if (mots.every((m) => forme.includes(m))) retenues.push(libelle);
      }
    } else if (lettre) {
      retenues = INDEX.filter(([, f]) => premiereLettre(f) === lettre).map(
        ([l]) => l,
      );
    } else {
      retenues = INDEX.map(([l]) => l);
    }
    return { options: retenues.slice(0, MAX_OPTIONS), total: retenues.length };
  }, [requete, lettre]);

  // La saisie libre n'est proposée que si elle ne correspond à aucune entrée.
  const horsCatalogue =
    value.trim() !== '' && !options.some((o) => normaliser(o) === requete);

  // Fermeture au clic hors du composant.
  useEffect(() => {
    function surClic(e: MouseEvent) {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener('mousedown', surClic);
    return () => document.removeEventListener('mousedown', surClic);
  }, []);

  // Garde l'option active visible pendant la navigation clavier.
  useEffect(() => {
    if (actif < 0) return;
    liste.current
      ?.querySelector(`[data-i="${actif}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [actif]);

  function choisir(libelle: string) {
    onChange(libelle);
    setOuvert(false);
    setActif(-1);
    setLettre(null);
  }

  const nbChoix = options.length + (horsCatalogue ? 1 : 0);

  function surClavier(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOuvert(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!ouvert) setOuvert(true);
      const pas = e.key === 'ArrowDown' ? 1 : -1;
      setActif((a) => (a + pas + nbChoix) % Math.max(nbChoix, 1));
      return;
    }
    if (e.key === 'Enter' && ouvert && actif >= 0) {
      e.preventDefault();
      if (actif < options.length) choisir(options[actif]);
      else setOuvert(false); // saisie libre conservée telle quelle
    }
  }

  return (
    <div className="selecteur" ref={racine}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={`${id}-liste`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Rechercher ou dérouler la liste…"
        value={value}
        required
        onChange={(e) => {
          onChange(e.target.value);
          setOuvert(true);
          setActif(-1);
          setLettre(null);
        }}
        onFocus={() => setOuvert(true)}
        onKeyDown={surClavier}
      />
      <button
        type="button"
        className="sel-fleche"
        aria-label={ouvert ? 'Fermer la liste' : 'Dérouler la liste'}
        tabIndex={-1}
        onClick={() => setOuvert(!ouvert)}
      >
        ▾
      </button>

      {ouvert && (
        <div className="sel-panneau">
          {!requete && (
            <div className="sel-lettres" role="tablist" aria-label="Index alphabétique">
              {LETTRES.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`sel-lettre${lettre === l ? ' active' : ''}`}
                  onClick={() => {
                    setLettre(lettre === l ? null : l);
                    setActif(-1);
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          <ul className="sel-liste" id={`${id}-liste`} role="listbox" ref={liste}>
            {options.map((o, i) => (
              <li
                key={o}
                data-i={i}
                role="option"
                aria-selected={o === value}
                className={`sel-option${i === actif ? ' active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choisir(o);
                }}
                onMouseEnter={() => setActif(i)}
              >
                {o}
                {delaiHabituel(o) && (
                  <span className="sel-delai">{delaiHabituel(o)} j</span>
                )}
              </li>
            ))}
            {horsCatalogue && (
              <li
                data-i={options.length}
                role="option"
                aria-selected={false}
                className={`sel-option sel-libre${actif === options.length ? ' active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setOuvert(false);
                }}
              >
                Utiliser « {value.trim()} » (libellé hors catalogue)
              </li>
            )}
            {options.length === 0 && !horsCatalogue && (
              <li className="sel-vide">Aucune analyse ne correspond.</li>
            )}
          </ul>

          <div className="sel-pied">
            {total > MAX_OPTIONS
              ? `${MAX_OPTIONS} premières entrées sur ${total.toLocaleString('fr-FR')} — affinez la recherche.`
              : `${total.toLocaleString('fr-FR')} analyse${total > 1 ? 's' : ''} · catalogue du 23/08/2026`}
          </div>
        </div>
      )}
    </div>
  );
}
