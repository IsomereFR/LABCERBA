'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CerbaTitle } from './CerbaTitle';

/**
 * Portillon du verrou de démonstration (phase proposition, PRD §5.1).
 * La vérification est faite côté serveur (/api/acces) qui pose un cookie
 * httpOnly ; ce composant ne connaît jamais le mot de passe attendu.
 */
export function DemoGate() {
  const router = useRouter();
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      const res = await fetch('/api/acces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'demo', password: motDePasse }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const corps = await res.json().catch(() => null);
        setErreur(corps?.erreur ?? 'Mot de passe incorrect.');
      }
    } catch {
      setErreur('Vérification impossible. Réessayez.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="gate">
      <div className="card">
        <CerbaTitle before="Accès à la" accent="démonstration" />
        <p className="sub">
          Cette maquette est réservée au cercle de la proposition. Saisissez le
          mot de passe de démonstration qui vous a été communiqué.
        </p>
        <form onSubmit={soumettre}>
          <div className="field">
            <label htmlFor="demo-mdp">Mot de passe de démonstration</label>
            <input
              id="demo-mdp"
              type="password"
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoFocus
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={enCours || !motDePasse}>
            {enCours ? 'Vérification…' : 'Accéder'}
          </button>
          {erreur && <p className="erreur" role="alert">{erreur}</p>}
        </form>
      </div>
    </div>
  );
}
