'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import {
  DELAI_LABEL,
  Entree,
  STATUT_LABEL,
  Statut,
  formatCourt,
  formatDateHeure,
  trierParGravite,
} from '@/lib/types';
import { CerbaTitle } from './CerbaTitle';
import { LogoSlot } from './LogoSlot';

export function Consultation() {
  const [entrees, setEntrees] = useState<Entree[] | null>(null);
  const [majLe, setMajLe] = useState<Date | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Rendu des horodatages après montage uniquement, pour éviter tout écart
  // d'hydratation entre fuseau serveur et fuseau navigateur.
  const [monte, setMonte] = useState(false);
  const entreesRef = useRef<Entree[]>([]);

  useEffect(() => {
    setMonte(true);
    const supabase = getSupabaseBrowser();
    let actif = true;

    const appliquer = (liste: Entree[]) => {
      entreesRef.current = liste;
      setEntrees(trierParGravite(liste));
      setMajLe(new Date());
    };

    async function chargementInitial() {
      const { data, error } = await supabase
        .from('analyses_impactees')
        .select('*');
      if (!actif) return;
      if (error) {
        setErreur('Chargement impossible. Vérifiez la connexion puis rechargez la page.');
        return;
      }
      setErreur(null);
      appliquer((data ?? []) as Entree[]);
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

      {/* Bande de synthèse : total + ventilation par statut (PRD §4.3) */}
      {entrees !== null && total > 0 && (
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
                {(['indisponible', 'anomalie', 'retard'] as Statut[]).map(
                  (s) =>
                    compteurs[s] > 0 && (
                      <div className="tally" key={s}>
                        <i style={{ background: `var(--statut-${s})` }} aria-hidden="true" />{' '}
                        <b>{compteurs[s]}</b>{' '}
                        {s === 'retard' ? 'en retard' : compteurs[s] > 1 ? `${s}s` : s}
                      </div>
                    ),
                )}
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
              {total === 0 ? (
                <div className="nominal">
                  <i aria-hidden="true" />
                  <div>
                    <strong>Aucune analyse impactée · production nominale</strong>
                    <span>Délais de rendu habituels respectés.</span>
                  </div>
                </div>
              ) : (
                <div className="list">
                  {entrees.map((e) => (
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
