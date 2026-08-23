export type Statut = 'indisponible' | 'anomalie' | 'retard';

export interface Entree {
  id: string;
  analyse: string;
  statut: Statut;
  delai: string;
  commentaire: string;
  signale_le: string;
  maj_le: string;
}

export const STATUTS: Statut[] = ['indisponible', 'anomalie', 'retard'];

/** Gravité décroissante : indisponible > anomalie > retard (PRD §4.3). */
export const GRAVITE: Record<Statut, number> = {
  indisponible: 0,
  anomalie: 1,
  retard: 2,
};

export const STATUT_LABEL: Record<Statut, string> = {
  indisponible: 'Indisponible',
  anomalie: 'Anomalie',
  retard: 'Retard',
};

/** Libellé du champ délai, contextualisé au statut (PRD §4.2). */
export const DELAI_LABEL: Record<Statut, string> = {
  indisponible: 'Reprise estimée',
  anomalie: 'Rendu',
  retard: 'Délai estimé',
};

export function trierParGravite(entrees: Entree[]): Entree[] {
  return [...entrees].sort((a, b) => {
    const g = GRAVITE[a.statut] - GRAVITE[b.statut];
    if (g !== 0) return g;
    return new Date(b.signale_le).getTime() - new Date(a.signale_le).getTime();
  });
}

const FMT_DATE = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const FMT_HEURE = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateHeure(iso: string): string {
  const d = new Date(iso);
  return `${FMT_DATE.format(d)} à ${FMT_HEURE.format(d)}`;
}

export function formatCourt(iso: string): string {
  const d = new Date(iso);
  return `${FMT_DATE.format(d)} ${FMT_HEURE.format(d)}`;
}
