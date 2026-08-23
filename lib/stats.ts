import { Entree, STATUTS, Statut, estActive } from './types';

/**
 * Statistiques d'exploitation calculées côté client à partir de l'ensemble
 * des entrées (alertes actives + historique). Aucune requête supplémentaire :
 * l'admin charge déjà tout, on agrège ici.
 *
 * Convention de durée : un incident clos compte sa durée réelle
 * (signale_le → resolu_le) ; un incident en cours compte sa durée écoulée
 * (signale_le → maintenant). Les moyennes précisent leur périmètre.
 */

export interface StatAnalyse {
  analyse: string;
  /** Nombre total de signalements (actifs + clos). */
  incidents: number;
  /** Dont alertes encore actives. */
  actifs: number;
  /** Immobilisation cumulée en ms (durée écoulée pour les actifs). */
  dureeCumulee: number;
}

export interface StatStatut {
  statut: Statut;
  nb: number;
  /** Immobilisation moyenne en ms (incidents en cours inclus), null si nb = 0. */
  dureeMoyenne: number | null;
}

export interface Statistiques {
  total: number;
  actifs: number;
  clos: number;
  /** Durée moyenne de résolution des incidents clos, en ms. */
  dureeMoyenneResolution: number | null;
  /** Ancienneté moyenne des alertes encore actives, en ms. */
  ancienneteMoyenneActives: number | null;
  /** Incident le plus long (clos ou en cours). */
  plusLong: { analyse: string; duree: number; enCours: boolean } | null;
  parStatut: StatStatut[];
  /** Analyses triées : les plus impactées d'abord (nb, puis durée cumulée). */
  parAnalyse: StatAnalyse[];
}

function dureeIncident(e: Entree, maintenant: number): number {
  const fin = e.resolu_le ? new Date(e.resolu_le).getTime() : maintenant;
  return Math.max(0, fin - new Date(e.signale_le).getTime());
}

export function calculerStatistiques(
  entrees: Entree[],
  maintenant: number = Date.now(),
): Statistiques {
  const actives = entrees.filter(estActive);
  const closes = entrees.filter((e) => !estActive(e));

  const moyenne = (liste: Entree[]): number | null =>
    liste.length === 0
      ? null
      : liste.reduce((s, e) => s + dureeIncident(e, maintenant), 0) / liste.length;

  let plusLong: Statistiques['plusLong'] = null;
  for (const e of entrees) {
    const duree = dureeIncident(e, maintenant);
    if (!plusLong || duree > plusLong.duree) {
      plusLong = { analyse: e.analyse, duree, enCours: estActive(e) };
    }
  }

  const parStatut: StatStatut[] = STATUTS.map((statut) => {
    const liste = entrees.filter((e) => e.statut === statut);
    return { statut, nb: liste.length, dureeMoyenne: moyenne(liste) };
  });

  const parAnalyseMap = new Map<string, StatAnalyse>();
  for (const e of entrees) {
    const stat =
      parAnalyseMap.get(e.analyse) ??
      { analyse: e.analyse, incidents: 0, actifs: 0, dureeCumulee: 0 };
    stat.incidents += 1;
    if (estActive(e)) stat.actifs += 1;
    stat.dureeCumulee += dureeIncident(e, maintenant);
    parAnalyseMap.set(e.analyse, stat);
  }
  const parAnalyse = [...parAnalyseMap.values()].sort(
    (a, b) => b.incidents - a.incidents || b.dureeCumulee - a.dureeCumulee,
  );

  return {
    total: entrees.length,
    actifs: actives.length,
    clos: closes.length,
    dureeMoyenneResolution: moyenne(closes),
    ancienneteMoyenneActives: moyenne(actives),
    plusLong,
    parStatut,
    parAnalyse,
  };
}
