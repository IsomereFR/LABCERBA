'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  chargerEntrees,
  getSupabaseBrowser,
  variablesSupabaseManquantes,
} from '@/lib/supabase-browser';
import {
  DELAI_LABEL,
  Entree,
  STATUT_LABEL,
  Statut,
  estActive,
  formatCourt,
  formatDateHeure,
  trierParGravite,
} from '@/lib/types';
import { LIBELLES_ANALYSES, delaiHabituel } from '@/lib/catalogue-analyses';
import { CerbaTitle } from './CerbaTitle';
import { LogoSlot } from './LogoSlot';

/** Recherche tolérante : accents et casse ignorés. */
function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const CATALOGUE_NORMALISE = LIBELLES_ANALYSES.map(
  (l) => [l, normaliser(l)] as const,
);

export function Consultation() {
  const [entrees, setEntrees] = useState<Entree[] | null>(null);
  const [majLe, setMajLe] = useState<Date | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Rendu des horodatages après montage uniquement, pour éviter tout écart
  // d'hydratation entre fuseau serveur et fuseau navigateur.
  const [monte, setMonte] = useState(false);
  const [recherche, setRecherche] = useState('');
  const entreesRef = useRef<Entree[]>([]);

  useEffect(() => {
    setMonte(true);
    // Configuration incomplète : message explicite, sans tenter le temps réel.
    if (variablesSupabaseManquantes().length > 0) {
      chargerEntrees().then((r) => setErreur(`Chargement impossible — ${r.erreur}.`));
      return;
    }
    const supabase = getSupabaseBrowser();
    let actif = true;

    // La consultation ne montre que les alertes actives : un incident résolu
    // sort de la liste, mais reste conservé en base pour l'historique.
    const appliquer = (liste: Entree[]) => {
      entreesRef.current = liste;
      setEntrees(trierParGravite(liste.filter(estActive)));
      setMajLe(new Date());
    };

    async function chargementInitial() {
      const r = await chargerEntrees();
      if (!actif) return;
      if (r.erreur !== undefined) {
        setErreur(`Chargement impossible — ${r.erreur}.`);
        return;
      }
      setErreur(null);
      appliquer(r.entrees);
    }

    chargementInitial();

    const canal = supabase
      .channel('analyses_impactees_consultation')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'analyses_impactees' },
        (payload) => {
          const courant = entreesRef.current;
          if (payload.eventType === 'INSERT') {
            const e = payload.new as Entree;
            appliquer([...courant.filter((x) => x.id !== e.id), e]);
          } else if (payload.eventType === 'UPDATE') {
            const e = payload.new as Entree;
            appliquer(courant.map((x) => (x.id === e.id ? e : x)));
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id;
            if (id) appliquer(courant.filter((x) => x.id !== id));
          }
        },
      )
      .subscribe();

    return () => {
      actif = false;
      supabase.removeChannel(canal);
    };
  }, []);

  const compteurs = useMemo(() => {
    const c: Record<Statut, number> = { indisponible: 0, anomalie: 0, retard: 0 };
    for (const e of entrees ?? []) c[e.statut] += 1;
    return c;
  }, [entrees]);

  const total = entrees?.length ?? 0;

  const requete = normaliser(recherche.trim());

  /**
   * Résultat de la recherche. La question du laboratoire client n'est pas
   * « quelles analyses sont impactées ? » mais « la mienne l'est-elle ? » :
   * quand la recherche ne remonte aucune alerte, on le dit explicitement en
   * nommant les analyses du catalogue qui correspondent, plutôt que d'afficher
   * une liste vide qu'on pourrait prendre pour un défaut d'affichage.
   */
  const resultat = useMemo(() => {
    if (!requete) return { filtrees: entrees ?? [], rassurantes: [] as string[] };
    const mots = requete.split(/\s+/);
    const correspond = (t: string) => {
      const n = normaliser(t);
      return mots.every((m) => n.includes(m));
    };
    const filtrees = (entrees ?? []).filter((e) => correspond(e.analyse));
    if (filtrees.length > 0) return { filtrees, rassurantes: [] as string[] };
    const rassurantes = CATALOGUE_NORMALISE.filter(([, n]) =>
      mots.every((m) => n.includes(m)),
    )
      .slice(0, 5)
      .map(([l]) => l);
    return { filtrees, rassurantes };
  }, [requete, entrees]);

  return (
    <>
      <div className="wrap">
        <header className="top">
          <div className="brand">
            <LogoSlot />
            <div>
              <CerbaTitle as="h1" before="Suivi de" accent="production" />
              <div className="sub">
                Analyses spécialisées · information aux laboratoires clients
              </div>
            </div>
          </div>
          <div className="live">
            <i aria-hidden="true" /> Actualisation automatique
          </div>
        </header>
      </div>

      {/* Dashboard récapitulatif : total + ventilation par statut (PRD §4.3),
          toujours affiché une fois les données chargées — y compris à zéro,
          pour donner l'état de la production d'un coup d'œil. */}
      {entrees !== null && (
        <div className="band">
          <div className="wrap">
            <div className="synth">
              <div className="count">
                <div className="n">{total}</div>
                <div className="lbl">
                  {total > 1 ? 'analyses impactées' : 'analyse impactée'}
                  <span>sur l&rsquo;ensemble du catalogue</span>
                </div>
              </div>
              <div className="tallies">
                {(['indisponible', 'anomalie', 'retard'] as Statut[]).map((s) => (
                  <div
                    className={`tally${compteurs[s] === 0 ? ' tally-zero' : ''}`}
                    key={s}
                  >
                    <i style={{ background: `var(--statut-${s})` }} aria-hidden="true" />{' '}
                    <b>{compteurs[s]}</b>{' '}
                    {s === 'retard' ? 'en retard' : compteurs[s] > 1 ? `${s}s` : s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emplacement réservé au motif « coup de pinceau » — designtokens.md §9 :
          les SVG officiels n'ont pas été récupérés, aucune forme n'est inventée. */}

      <div className="wrap">
        <main className="page">
          {erreur && <div className="flash ko">{erreur}</div>}

          {entrees === null && !erreur && (
            <p className="hint">Chargement des données…</p>
          )}

          {entrees !== null && (
            <>
              <CerbaTitle before="Analyses" accent="concernées" />

              {/* Recherche : répond à « mon analyse est-elle impactée ? » */}
              <div className="recherche">
                <input
                  type="search"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher une analyse du catalogue…"
                  aria-label="Rechercher une analyse"
                />
                {recherche && (
                  <button
                    type="button"
                    className="recherche-effacer"
                    onClick={() => setRecherche('')}
                    aria-label="Effacer la recherche"
                  >
                    Effacer
                  </button>
                )}
              </div>

              {total === 0 ? (
                <div className="nominal">
                  <i aria-hidden="true" />
                  <div>
                    <strong>Aucune analyse impactée · production nominale</strong>
                    <span>Délais de rendu habituels respectés.</span>
                  </div>
                </div>
              ) : requete && resultat.filtrees.length === 0 ? (
                <div className="nominal">
                  <i aria-hidden="true" />
                  <div>
                    {resultat.rassurantes.length > 0 ? (
                      <>
                        <strong>
                          {resultat.rassurantes.length > 1
                            ? 'Ces analyses ne sont pas impactées'
                            : 'Cette analyse n’est pas impactée'}
                        </strong>
                        <span>
                          {resultat.rassurantes.join(' · ')} — délai de rendu
                          habituel.
                        </span>
                      </>
                    ) : (
                      <>
                        <strong>Aucune analyse impactée pour cette recherche</strong>
                        <span>
                          Aucun libellé du catalogue ne correspond à «&nbsp;
                          {recherche.trim()}&nbsp;». Vérifiez l’orthographe.
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="list">
                  {resultat.filtrees.map((e) => (
                    <article
                      className="item"
                      key={e.id}
                      style={{ ['--c' as string]: `var(--statut-${e.statut})` }}
                    >
                      <div className="row1">
                        <div className="name">
                          <i aria-hidden="true" /> {e.analyse}
                        </div>
                        <div className="badges">
                          {/* Pastille colorée + libellé texte, jamais la couleur seule */}
                          <span className="badge">{STATUT_LABEL[e.statut]}</span>
                          {e.delai && (
                            <span className="delay">
                              {DELAI_LABEL[e.statut]} <b>{e.delai}</b>
                            </span>
                          )}
                          {/* Repère de comparaison : le délai de rendu normal
                              de cette analyse, issu du catalogue. */}
                          {delaiHabituel(e.analyse) && (
                            <span className="delay delay-habituel">
                              Habituellement <b>{delaiHabituel(e.analyse)} j</b>
                            </span>
                          )}
                        </div>
                      </div>
                      {e.commentaire && (
                        <div className="note cerba-body">{e.commentaire}</div>
                      )}
                      <div className="meta">
                        Signalé le {monte ? formatDateHeure(e.signale_le) : '…'}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        <footer className="foot">
          <div>
            Dernière mise à jour :{' '}
            <b>{monte && majLe ? formatCourt(majLe.toISOString()) : '…'}</b>
          </div>
          <div className="mention">
            Information de production communiquée à titre indicatif. Elle ne se
            substitue pas aux communications contractuelles ni à la transmission
            des résultats.
          </div>
        </footer>
      </div>
    </>
  );
}
