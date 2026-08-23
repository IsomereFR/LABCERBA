export type Statut = 'indisponible' | 'anomalie' | 'retard';

export interface Entree {
  id: string;
  analyse: string;
  statut: Statut;
  delai: string;
  commentaire: string;
  signale_le: string;
  maj_le: string;
  /** Horodatage du retour à la normale. `null` = alerte active. */
  resolu_le: string | null;
  /** Auteur de la publication, vide tant que les comptes nommés n'existent pas. */
  publie_par?: string;
}

export function estActive(e: Entree): boolean {
  return !e.resolu_le;
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

/** Durée en clair : « 3 jours », « 5 h », « moins d'une heure ». */
export function formatDureeMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const heures = Math.floor(ms / 3_600_000);
  if (heures < 1) return 'moins d’une heure';
  if (heures < 24) return `${heures} h`;
  const jours = Math.round(heures / 24);
  return jours > 1 ? `${jours} jours` : '1 jour';
}

/** Durée d'un incident, en clair : « 3 jours », « 5 h », « moins d'une heure ». */
export function formatDuree(debutIso: string, finIso: string): string {
  return formatDureeMs(new Date(finIso).getTime() - new Date(debutIso).getTime());
}

/** Historique : les incidents clos, du plus récemment résolu au plus ancien. */
export function trierParResolution(entrees: Entree[]): Entree[] {
  return [...entrees].sort(
    (a, b) =>
      new Date(b.resolu_le ?? 0).getTime() - new Date(a.resolu_le ?? 0).getTime(),
  );
}
