-- ============================================================================
-- DONNÉES DE DÉMONSTRATION — ENTIÈREMENT FICTIVES (PRD §5.1)
-- Aucune de ces entrées ne reflète l'état réel de la production Cerba.
-- Chaque commentaire porte la mention « donnée fictive de démonstration ».
-- À exécuter dans le SQL Editor Supabase, après la migration.
-- ============================================================================

-- « analyse » entre guillemets : mot réservé PostgreSQL (voir la migration).
insert into public.analyses_impactees ("analyse", statut, delai, commentaire)
values
  (
    'Sérologie de Lyme · immunoblot',
    'indisponible',
    '04/08',
    'Donnée fictive de démonstration. Rupture d''approvisionnement réactif fournisseur. Les échantillons reçus sont conservés et seront traités dès reprise. Ne pas réacheminer.'
  ),
  (
    'Anticorps anti-récepteur de la TSH',
    'anomalie',
    'suspendu',
    'Donnée fictive de démonstration. Contrôle interne de qualité non conforme sur la série en cours, recalibration engagée. Aucun résultat ne sera transmis avant retour à conformité.'
  ),
  (
    'Caryotype constitutionnel sanguin',
    'retard',
    '+5 jours ouvrés',
    'Donnée fictive de démonstration. Surcharge de la plateforme de cytogénétique. Les analyses sont réalisées, seul le délai de rendu est allongé.'
  ),
  (
    'Dosage de la ciclosporine',
    'retard',
    '+24 h',
    'Donnée fictive de démonstration. Maintenance préventive de l''automate de chromatographie. Retour au délai habituel prévu demain.'
  );
