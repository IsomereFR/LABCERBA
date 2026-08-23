'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { chargerEntrees } from '@/lib/supabase-browser';
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
import { SelecteurAnalyse } from './SelecteurAnalyse';

type Flash = { genre: 'ok' | 'ko'; texte: string } | null;

/** Saisie du délai : date de retour précise, ou délai approximatif en texte. */
type ModeDelai = 'date' | 'texte';

/** Suggestions de délai approximatif, contextualisées au statut. */
const SUGGESTIONS_DELAI: Record<Statut, string[]> = {
  retard: ['+24 h', '+48 h', '+3 jours ouvrés', '+5 jours ouvrés', '+1 semaine'],
  indisponible: ['sous 48 h', 'sous 1 semaine', 'à confirmer'],
  anomalie: ['suspendu', 'suspendu · recalibration en cours'],
};

/**
 * Compose le texte du badge à partir d'une date de retour à la normale,
 * de sorte qu'il se lise naturellement derrière le préfixe DELAI_LABEL :
 * « Reprise estimée le 04/09 », « Délai estimé jusqu'au 04/09 »,
 * « Rendu suspendu · retour prévu le 04/09 ».
 */
function delaiDepuisDate(statut: Statut, isoDate: string): string {
  const [a, m, j] = isoDate.split('-');
  const date = `${j}/${m}/${a}`;
  if (statut === 'indisponible') return `le ${date}`;
  if (statut === 'retard') return `jusqu'au ${date}`;
  return `suspendu · retour prévu le ${date}`;
}

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
  // En modification, le délai existant est du texte : on repart en mode texte
  // pour ne rien perdre. En création, la date de retour est proposée d'abord.
  const [modeDelai, setModeDelai] = useState<ModeDelai>(
    initial?.delai ? 'texte' : 'date',
  );
  const [dateRetour, setDateRetour] = useState('');
  const [delaiTexte, setDelaiTexte] = useState(initial?.delai ?? '');
  const [commentaire, setCommentaire] = useState(initial?.commentaire ?? '');

  const delaiFinal =
    modeDelai === 'date'
      ? dateRetour
        ? delaiDepuisDate(statut, dateRetour)
        : ''
      : delaiTexte.trim();

  function soumettre(e: FormEvent) {
    e.preventDefault();
    onSubmit({ analyse: analyse.trim(), statut, delai: delaiFinal, commentaire });
    if (!initial) {
      setAnalyse('');
      setStatut('retard');
      setModeDelai('date');
      setDateRetour('');
      setDelaiTexte('');
      setCommentaire('');
    }
  }

  return (
    <form onSubmit={soumettre}>
      <div className="field">
        <label htmlFor={`${prefixe}-analyse`}>Analyse concernée</label>
        <SelecteurAnalyse
          id={`${prefixe}-analyse`}
          value={analyse}
          onChange={setAnalyse}
        />
        <span className="hint">
          Liste alphabétique du catalogue · recherche par mot, accents ignorés.
        </span>
      </div>

      <div className="field">
        <label>Statut</label>
        <ChampsStatut statut={statut} onChange={setStatut} prefixe={prefixe} />
      </div>

      <div className="field">
        {/* Libellé contextualisé au statut choisi (PRD §4.2) */}
        <label>{DELAI_LABEL[statut]}</label>
        <div className="mode-delai" role="radiogroup" aria-label="Type de délai">
          <label>
            <input
              type="radio"
              name={`${prefixe}-mode-delai`}
              checked={modeDelai === 'date'}
              onChange={() => setModeDelai('date')}
            />
            Date de retour à la normale
          </label>
          <label>
            <input
              type="radio"
              name={`${prefixe}-mode-delai`}
              checked={modeDelai === 'texte'}
              onChange={() => setModeDelai('texte')}
            />
            Délai approximatif
          </label>
        </div>

        {modeDelai === 'date' ? (
          <input
            id={`${prefixe}-delai-date`}
            type="date"
            aria-label="Date de retour à la normale prévue"
            value={dateRetour}
            onChange={(e) => setDateRetour(e.target.value)}
          />
        ) : (
          <>
            <input
              id={`${prefixe}-delai`}
              type="text"
              aria-label="Délai approximatif"
              value={delaiTexte}
              onChange={(e) => setDelaiTexte(e.target.value)}
              placeholder={
                statut === 'retard'
                  ? 'ex. +5 jours ouvrés'
                  : statut === 'indisponible'
                    ? 'ex. sous 1 semaine'
                    : 'ex. suspendu'
              }
            />
            <div className="chips" aria-label="Suggestions de délai">
              {SUGGESTIONS_DELAI[statut].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip${delaiTexte === s ? ' active' : ''}`}
                  onClick={() => setDelaiTexte(delaiTexte === s ? '' : s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        <span className="hint">Optionnel · affiché en badge en consultation.</span>
      </div>

      <div className="field">
        <label htmlFor={`${prefixe}-commentaire`}>Commentaire libre</label>
        <ConsignePatient />
        <textarea
          id={`${prefixe}-commentaire`}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          placeholder="Motif technique et conduite à tenir. Optionnel."
        />
      </div>

      {/* Aperçu en direct du rendu exact en consultation */}
      {analyse.trim() && (
        <div className="field apercu">
          <label>Aperçu de la publication</label>
          <div
            className="item apercu-item"
            style={{ ['--c' as string]: `var(--statut-${statut})` }}
          >
            <div className="row1">
              <div className="name" style={{ fontSize: 15.5 }}>
                <i style={{ background: `var(--statut-${statut})` }} aria-hidden="true" />{' '}
                {analyse.trim()}
              </div>
              <div className="badges">
                <span
                  className="badge"
                  style={{ ['--c' as string]: `var(--statut-${statut})` }}
                >
                  {STATUT_LABEL[statut]}
                </span>
                {delaiFinal && (
                  <span className="delay">
                    {DELAI_LABEL[statut]} <b>{delaiFinal}</b>
                  </span>
                )}
              </div>
            </div>
            {commentaire.trim() && <div className="note">{commentaire.trim()}</div>}
          </div>
        </div>
      )}

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
  const [onglet, setOnglet] = useState<'signaler' | 'alertes'>('signaler');
  const [editionId, setEditionId] = useState<string | null>(null);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [retourId, setRetourId] = useState<string | null>(null);
  const [monte, setMonte] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMonte(true), []);

  const signaler = useCallback((f: Flash) => {
    setFlash(f);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (f?.genre === 'ok') flashTimer.current = setTimeout(() => setFlash(null), 5000);
  }, []);

  const recharger = useCallback(async () => {
    const r = await chargerEntrees();
    if (r.erreur !== undefined) {
      signaler({ genre: 'ko', texte: `Chargement des alertes impossible — ${r.erreur}.` });
      return;
    }
    setEntrees(trierParGravite(r.entrees));
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
        {/* Menu des deux espaces : signalement et alertes en cours */}
        <nav className="menu-admin" aria-label="Sections d’administration">
          <button
            type="button"
            className={onglet === 'signaler' ? 'active' : ''}
            aria-current={onglet === 'signaler' ? 'page' : undefined}
            onClick={() => setOnglet('signaler')}
          >
            Signaler une analyse
          </button>
          <button
            type="button"
            className={onglet === 'alertes' ? 'active' : ''}
            aria-current={onglet === 'alertes' ? 'page' : undefined}
            onClick={() => setOnglet('alertes')}
          >
            Alertes en cours
            {entrees !== null && (
              <span className="menu-count" aria-label={`${entrees.length} alerte(s)`}>
                {entrees.length}
              </span>
            )}
          </button>
        </nav>

        {flash && (
          <div className={`flash ${flash.genre}`} role="status">
            {flash.texte}
          </div>
        )}

        {onglet === 'signaler' && (
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
                  texte: `« ${v.analyse} » publié — visible immédiatement en consultation et dans les alertes en cours.`,
                });
              }
            }}
          />
        </section>
        )}

        {onglet === 'alertes' && (
        <section className="admin-section">
          <CerbaTitle before="Alertes" accent="en cours" />
          {entrees === null && <p className="hint">Chargement…</p>}
          {entrees !== null && entrees.length === 0 && (
            <p className="hint">
              Aucune alerte en cours. La consultation affiche l&rsquo;état nominal.
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
                        setRetourId(null);
                      }}
                    >
                      {editionId === e.id ? 'Fermer' : 'Modifier'}
                    </button>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => {
                        setRetourId(retourId === e.id ? null : e.id);
                        setEditionId(null);
                        setSuppressionId(null);
                      }}
                    >
                      Retour à la normale
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      onClick={() => {
                        setSuppressionId(suppressionId === e.id ? null : e.id);
                        setEditionId(null);
                        setRetourId(null);
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

              {retourId === e.id && (
                <div className="confirm-retour" role="alertdialog">
                  <span>
                    Confirmer le retour à la normale de « {e.analyse} » ?
                    L&rsquo;alerte sera retirée immédiatement de la consultation.
                  </span>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={enCours}
                    onClick={async () => {
                      const ok = await appelApi('DELETE', { id: e.id });
                      if (ok) {
                        setRetourId(null);
                        signaler({
                          genre: 'ok',
                          texte: `« ${e.analyse} » est revenu à la normale — alerte retirée de la consultation.`,
                        });
                      }
                    }}
                  >
                    Confirmer le retour à la normale
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setRetourId(null)}
                  >
                    Annuler
                  </button>
                </div>
              )}

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
        )}
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
