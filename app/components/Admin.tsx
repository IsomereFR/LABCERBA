'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import {
  DELAI_LABEL,
  Entree,
  STATUTS,
  STATUT_LABEL,
  Statut,
  formatDateHeure,
  trierParGravite,
} from '@/lib/types';
import { CerbaTitle } from './CerbaTitle';
import { LogoSlot } from './LogoSlot';

type Flash = { genre: 'ok' | 'ko'; texte: string } | null;

/** Consigne obligatoire, affichée au-dessus de chaque zone de commentaire. */
function ConsignePatient() {
  return (
    <p className="consigne">
      Ne saisir <b>AUCUNE donnée patient</b> (nom, identifiant, dossier).
    </p>
  );
}

function ChampsStatut({
  statut,
  onChange,
  prefixe,
}: {
  statut: Statut;
  onChange: (s: Statut) => void;
  prefixe: string;
}) {
  return (
    <div className="statut-choix" role="radiogroup" aria-label="Statut">
      {STATUTS.map((s) => (
        <label key={s}>
          <input
            type="radio"
            name={`${prefixe}-statut`}
            value={s}
            checked={statut === s}
            onChange={() => onChange(s)}
          />
          <i style={{ background: `var(--statut-${s})` }} aria-hidden="true" />
          {STATUT_LABEL[s]}
        </label>
      ))}
    </div>
  );
}

function FormulaireEntree({
  prefixe,
  initial,
  libelleAction,
  enCours,
  onSubmit,
  onCancel,
}: {
  prefixe: string;
  initial?: Entree;
  libelleAction: string;
  enCours: boolean;
  onSubmit: (v: { analyse: string; statut: Statut; delai: string; commentaire: string }) => void;
  onCancel?: () => void;
}) {
  const [analyse, setAnalyse] = useState(initial?.analyse ?? '');
  const [statut, setStatut] = useState<Statut>(initial?.statut ?? 'retard');
  const [delai, setDelai] = useState(initial?.delai ?? '');
  const [commentaire, setCommentaire] = useState(initial?.commentaire ?? '');

  function soumettre(e: FormEvent) {
    e.preventDefault();
    onSubmit({ analyse, statut, delai, commentaire });
    if (!initial) {
      setAnalyse('');
      setStatut('retard');
      setDelai('');
      setCommentaire('');
    }
  }

  return (
    <form onSubmit={soumettre}>
      <div className="field">
        <label htmlFor={`${prefixe}-analyse`}>Nom de l&rsquo;analyse</label>
        <input
          id={`${prefixe}-analyse`}
          type="text"
          value={analyse}
          onChange={(e) => setAnalyse(e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label>Statut</label>
        <ChampsStatut statut={statut} onChange={setStatut} prefixe={prefixe} />
      </div>

      <div className="field">
        {/* Libellé contextualisé au statut choisi (PRD §4.2) */}
        <label htmlFor={`${prefixe}-delai`}>{DELAI_LABEL[statut]}</label>
        <input
          id={`${prefixe}-delai`}
          type="text"
          value={delai}
          onChange={(e) => setDelai(e.target.value)}
          placeholder={
            statut === 'retard'
              ? 'ex. +5 jours ouvrés'
              : statut === 'indisponible'
                ? 'ex. reprise estimée 04/08'
                : 'ex. suspendu'
          }
        />
        <span className="hint">Optionnel · texte court affiché en badge.</span>
      </div>

      <div className="field">
        <label htmlFor={`${prefixe}-commentaire`}>Commentaire</label>
        <ConsignePatient />
        <textarea
          id={`${prefixe}-commentaire`}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          placeholder="Motif technique et conduite à tenir. Optionnel."
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={enCours}>
          {enCours ? 'Publication…' : libelleAction}
        </button>
        {onCancel && (
          <button className="btn" type="button" onClick={onCancel} disabled={enCours}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

export function Admin() {
  // Le mot de passe reste en mémoire de session et accompagne chaque écriture :
  // c'est /api/entrees qui le vérifie, à chaque requête.
  const [motDePasse, setMotDePasse] = useState<string | null>(null);
  const [saisie, setSaisie] = useState('');
  const [erreurAcces, setErreurAcces] = useState<string | null>(null);
  const [verif, setVerif] = useState(false);

  const [entrees, setEntrees] = useState<Entree[] | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [enCours, setEnCours] = useState(false);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [monte, setMonte] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMonte(true), []);

  const signaler = useCallback((f: Flash) => {
    setFlash(f);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (f?.genre === 'ok') flashTimer.current = setTimeout(() => setFlash(null), 5000);
  }, []);

  const recharger = useCallback(async () => {
    const { data, error } = await getSupabaseBrowser()
      .from('analyses_impactees')
      .select('*');
    if (error) {
      signaler({ genre: 'ko', texte: 'Chargement des entrées impossible.' });
      return;
    }
    setEntrees(trierParGravite((data ?? []) as Entree[]));
  }, [signaler]);

  useEffect(() => {
    if (motDePasse !== null) recharger();
  }, [motDePasse, recharger]);

  async function ouvrirSession(e: FormEvent) {
    e.preventDefault();
    setVerif(true);
    setErreurAcces(null);
    try {
      const res = await fetch('/api/acces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'admin', password: saisie }),
      });
      if (res.ok) {
        setMotDePasse(saisie);
        setSaisie('');
      } else {
        const corps = await res.json().catch(() => null);
        setErreurAcces(corps?.erreur ?? 'Mot de passe incorrect.');
      }
    } catch {
      setErreurAcces('Vérification impossible. Réessayez.');
    } finally {
      setVerif(false);
    }
  }

  async function appelApi(methode: 'POST' | 'PATCH' | 'DELETE', corps: object): Promise<boolean> {
    setEnCours(true);
    try {
      const res = await fetch('/api/entrees', {
        method: methode,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': motDePasse ?? '',
        },
        body: JSON.stringify(corps),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        signaler({ genre: 'ko', texte: json?.erreur ?? `Échec (HTTP ${res.status}).` });
        return false;
      }
      await recharger();
      return true;
    } catch {
      signaler({ genre: 'ko', texte: 'Requête impossible. Vérifiez la connexion.' });
      return false;
    } finally {
      setEnCours(false);
    }
  }

  // ---------- Écran de mot de passe (portillon) ----------
  if (motDePasse === null) {
    return (
      <div className="gate">
        <div className="card">
          <CerbaTitle before="Accès" accent="administration" />
          <p className="sub">
            Réservé au pilote de production. Le mot de passe est également
            revérifié par le serveur à chaque écriture.
          </p>
          <form onSubmit={ouvrirSession}>
            <div className="field">
              <label htmlFor="admin-mdp">Mot de passe d&rsquo;administration</label>
              <input
                id="admin-mdp"
                type="password"
                autoComplete="current-password"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                autoFocus
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={verif || !saisie}>
              {verif ? 'Vérification…' : 'Entrer'}
            </button>
            {erreurAcces && <p className="erreur" role="alert">{erreurAcces}</p>}
          </form>
        </div>
      </div>
    );
  }

  // ---------- Interface de gestion ----------
  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <LogoSlot />
          <div>
            <CerbaTitle as="h1" before="Administration du" accent="suivi de production" />
            <div className="sub">Ajout, modification et suppression des signalements</div>
          </div>
        </div>
      </header>

      <main className="page" style={{ paddingTop: 0 }}>
        {flash && (
          <div className={`flash ${flash.genre}`} role="status">
            {flash.texte}
          </div>
        )}

        <section className="admin-section">
          <CerbaTitle before="Signaler une" accent="analyse impactée" />
          <FormulaireEntree
            prefixe="ajout"
            libelleAction="Publier le signalement"
            enCours={enCours}
            onSubmit={async (v) => {
              const ok = await appelApi('POST', v);
              if (ok) {
                signaler({
                  genre: 'ok',
                  texte: `« ${v.analyse} » publié — visible immédiatement en consultation.`,
                });
              }
            }}
          />
        </section>

        <section className="admin-section">
          <CerbaTitle before="Entrées" accent="en cours" />
          {entrees === null && <p className="hint">Chargement…</p>}
          {entrees !== null && entrees.length === 0 && (
            <p className="hint">
              Aucune entrée. La consultation affiche l&rsquo;état nominal.
            </p>
          )}
          {entrees?.map((e) => (
            <div
              className="admin-item"
              key={e.id}
              style={{ ['--c' as string]: `var(--statut-${e.statut})` }}
            >
              <div className="row1">
                <div className="name" style={{ fontSize: 15.5 }}>
                  <i style={{ background: `var(--statut-${e.statut})` }} aria-hidden="true" />{' '}
                  {e.analyse}
                </div>
                <div className="badges">
                  <span className="badge" style={{ ['--c' as string]: `var(--statut-${e.statut})` }}>
                    {STATUT_LABEL[e.statut]}
                  </span>
                  {e.delai && (
                    <span className="delay">
                      {DELAI_LABEL[e.statut]} <b>{e.delai}</b>
                    </span>
                  )}
                  <span className="actions">
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        setEditionId(editionId === e.id ? null : e.id);
                        setSuppressionId(null);
                      }}
                    >
                      {editionId === e.id ? 'Fermer' : 'Modifier'}
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      onClick={() => {
                        setSuppressionId(suppressionId === e.id ? null : e.id);
                        setEditionId(null);
                      }}
                    >
                      Supprimer
                    </button>
                  </span>
                </div>
              </div>
              {e.commentaire && <div className="note">{e.commentaire}</div>}
              <div className="meta">
                Signalé le {monte ? formatDateHeure(e.signale_le) : '…'} · dernière
                modification le {monte ? formatDateHeure(e.maj_le) : '…'}
              </div>

              {suppressionId === e.id && (
                <div className="confirm-suppr" role="alertdialog">
                  <span>
                    Supprimer définitivement « {e.analyse} » ? L&rsquo;entrée
                    disparaîtra immédiatement de la consultation.
                  </span>
                  <button
                    className="btn btn-danger"
                    type="button"
                    disabled={enCours}
                    onClick={async () => {
                      const ok = await appelApi('DELETE', { id: e.id });
                      if (ok) {
                        setSuppressionId(null);
                        signaler({ genre: 'ok', texte: `« ${e.analyse} » supprimé.` });
                      }
                    }}
                  >
                    Confirmer la suppression
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setSuppressionId(null)}
                  >
                    Annuler
                  </button>
                </div>
              )}

              {editionId === e.id && (
                <div className="admin-edit">
                  <FormulaireEntree
                    prefixe={`edit-${e.id}`}
                    initial={e}
                    libelleAction="Enregistrer les modifications"
                    enCours={enCours}
                    onCancel={() => setEditionId(null)}
                    onSubmit={async (v) => {
                      const ok = await appelApi('PATCH', { id: e.id, ...v });
                      if (ok) {
                        setEditionId(null);
                        signaler({ genre: 'ok', texte: `« ${v.analyse} » mis à jour.` });
                      }
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </section>
      </main>

      <footer className="foot">
        <div>
          <b>Espace d&rsquo;administration</b> · les publications sont immédiates
        </div>
        <div className="mention">
          Aucune donnée patient ne doit figurer dans les signalements. Contenu
          limité aux noms d&rsquo;analyses et motifs techniques.
        </div>
      </footer>
    </div>
  );
}
