# Dossier de reprise et d'internalisation

> **Document de proposition.** Il décrit *comment* Cerba pourrait reprendre à son
> compte l'outil de suivi de production présenté dans ce dépôt. Rien ici
> n'engage Cerba, et rien n'a été mis en œuvre sans validation.

Public visé : DSI, RSSI et équipe technique de Cerba. Un récapitulatif
non technique existe pour la présentation ; ce document-ci est le détail
opérationnel.

---

## 1. Ce qu'il y a à reprendre, en une page

| Élément | Nature | Volume |
|---|---|---|
| Application web | Next.js 15 (TypeScript, React 19) | ~1 800 lignes écrites à la main |
| Catalogue d'analyses | fichier TypeScript généré depuis l'export CSV Cerba | 2 250 lignes (données Cerba) |
| Base de données | 1 table PostgreSQL, 2 migrations SQL | ~90 lignes de SQL |
| Dépendances d'exécution | `next`, `react`, `react-dom`, `@supabase/supabase-js` | 4 directes, 59 au total |
| Dépendances CDN au runtime | **aucune** | — |

Il n'y a **ni framework maison, ni composant propriétaire, ni service tiers
payant indispensable**. Tout repose sur des briques libres et standard
(Next.js, React, PostgreSQL). C'est le point qui rend l'internalisation
complète possible : voir §4.

Fichiers structurants :

- `app/page.tsx` + `app/components/Consultation.tsx` — la page de consultation (lecture seule)
- `app/admin/page.tsx` + `app/components/Admin.tsx` — la console de publication
- `app/api/entrees/route.ts` — **seule** voie d'écriture, côté serveur
- `app/api/acces/route.ts` — vérification des mots de passe, côté serveur
- `lib/admin-auth.ts`, `lib/demo-lock.ts` — contrôles d'accès, serveur uniquement
- `supabase/migrations/*.sql` — schéma et traçabilité

---

## 2. Transfert de propriété — ce qui doit être signé et transféré

L'internalisation technique ne vaut rien sans le volet juridique. À traiter
**avant** le transfert des comptes.

### 2.1 Droits sur le code

La proposition a été développée hors commande. Pour que Cerba puisse
l'exploiter, le modifier et la faire maintenir par qui il veut, il faut un
écrit prévoyant la **cession des droits patrimoniaux** (code source,
maquettes, documentation). En droit français, l'article L131-3 du code de la
propriété intellectuelle impose que l'étendue, la destination, le lieu et la
durée de la cession soient délimités dans l'acte : une cession « pour tout
usage » non détaillée est fragile.

À défaut de cession, une licence d'exploitation perpétuelle, irrévocable,
transférable et incluant le droit de modification remplit la même fonction.

### 2.2 Éléments appartenant déjà à Cerba

- Le **logo** (`public/logo-cerba.png`) a été fourni par Cerba et est intégré
  tel quel, sans redessin ni recoloration.
- Le **catalogue d'analyses** (`lib/catalogue-analyses.ts`) est dérivé de
  l'export CSV `catalogue_exams_fr` de Cerba.

Aucun des deux n'est revendiqué ; il suffit de l'acter.

### 2.3 Liste de transfert

| À transférer | Vers | Commentaire |
|---|---|---|
| Dépôt Git (historique complet) | organisation GitHub/GitLab Cerba | ou export puis import dans leur forge interne |
| Documentation (`README.md`, `docs/`) | avec le dépôt | — |
| Export de la base (`pg_dump`) | leur infrastructure | données de démonstration fictives à ce stade |
| Comptes d'hébergement | créés **par Cerba**, jamais transférés | voir §3 |
| Secrets (mots de passe, clés API) | **régénérés par Cerba**, jamais transmis | voir §5.1 |

---

## 3. Trois scénarios d'hébergement

Le choix se fait sur un arbitrage délai / effort interne / surface de
confiance externe. Les trois sont réalisables ; le scénario 2 est celui qui
répond le plus strictement à une exigence de souveraineté.

### Scénario 1 — Comptes Cerba chez des hébergeurs managés

Cerba crée **ses propres** comptes Vercel (hébergement de l'application) et
Supabase (base PostgreSQL managée), en région UE. Le dépôt est transféré à
Cerba. L'auteur n'est plus qu'un contributeur, révocable d'un clic.

- **Délai** : 1 à 2 jours.
- **Charge interne** : quasi nulle (déploiement automatique à chaque commit).
- **Contrepartie** : deux sous-traitants américains dans la chaîne, à faire
  valider par le RSSI et à couvrir par un accord de sous-traitance (art. 28
  RGPD). Les serveurs sont en UE (`fra1` / Francfort, déjà fixé dans
  `vercel.json`), mais l'éditeur est soumis au droit américain.
- **Coût indicatif** : de l'ordre de 45 à 70 €/mois (un siège Vercel + un
  projet Supabase avec sauvegardes). À confirmer auprès des éditeurs.

### Scénario 2 — Tout chez Cerba (recommandé si la sécurité prime)

L'application tourne dans un conteneur sur l'infrastructure Cerba, la base
est une base PostgreSQL du parc existant. Aucun tiers.

Travaux nécessaires :

1. Ajouter `output: 'standalone'` dans `next.config.mjs` et un `Dockerfile`
   (Next.js documente ce mode ; c'est une dizaine de lignes).
2. Appliquer les deux migrations SQL sur une base PostgreSQL 15+ interne. Le
   schéma est du PostgreSQL standard, sans extension exotique
   (`gen_random_uuid()` est natif depuis PG13).
3. Remplacer la brique « temps réel » de Supabase. Deux options :
   - **la plus simple** : remplacer l'abonnement temps réel par un
     rafraîchissement automatique toutes les 20 à 30 secondes. L'application
     ne dépend alors plus que de PostgreSQL. Compter 1 jour. La consultation
     n'est plus instantanée mais reste très en deçà du besoin métier ;
   - ou installer Supabase en auto-hébergé (`docker compose`, projet open
     source) pour conserver le temps réel à la seconde.
4. Publier derrière leur reverse proxy habituel, avec leurs règles WAF, leurs
   certificats et leur supervision.

- **Délai** : 3 à 8 jours de développement, plus les délais de leur équipe
  infrastructure.
- **Charge interne** : celle d'une application interne de plus (build,
  déploiement, sauvegardes, supervision — tout existe déjà chez eux).
- **Coût de licence** : nul.

### Scénario 3 — Transition

L'auteur exploite l'outil pendant une période de validation (3 à 6 mois),
puis Cerba internalise selon le scénario 1 ou 2. Permet de démarrer en
quelques jours et de décider sur des faits d'usage plutôt que sur une
maquette.

**Point à ne pas manquer** : le scénario 3 ne dispense pas du §2 (droits) ni
du §5 (secrets). Il les décale.

### Réversibilité

Quel que soit le scénario retenu, la sortie est garantie par construction :
le code est fourni, les dépendances sont libres, et les données sont dans une
table PostgreSQL ordinaire qu'un `pg_dump` exporte en une commande. Le
passage du scénario 1 au scénario 2 est un chemin balisé, pas une
reconstruction.

---

## 4. Intégration au site web de Cerba

Quatre montages, du plus simple au plus intégré. Ils ne s'excluent pas.

### Option A — Sous-domaine dédié (recommandée pour démarrer)

`https://suivi-production.<domaine-cerba>` pointe vers l'application (un
enregistrement DNS CNAME, ou une règle sur leur reverse proxy).

- Aucune modification du site existant ni du CMS.
- Isolation totale : une faille de l'un n'atteint pas l'autre, les cookies ne
  sont pas partagés.
- Mise en œuvre : quelques heures, côté Cerba.

### Option B — Page du site avec l'outil en cadre intégré (`iframe`)

Le visiteur reste sur le site Cerba ; la page affiche l'outil dans un cadre.

- Prérequis technique : autoriser explicitement le cadrage par le site Cerba
  et interdire tout autre site, via l'en-tête
  `Content-Security-Policy: frame-ancestors https://www.<domaine-cerba>`.
  **Cet en-tête n'existe pas encore** dans `next.config.mjs` : c'est à ajouter
  (quelques lignes) et cela ferme au passage le risque de détournement de
  clics (*clickjacking*).
- Limites connues : hauteur du cadre à gérer sur mobile, référencement du
  contenu affaibli, accessibilité à vérifier.

### Option C — Sous-chemin du site principal

`https://www.<domaine-cerba>/suivi-production`, servi par leur reverse proxy
qui redirige ce chemin vers l'application. Côté code, Next.js gère cela avec
l'option `basePath` (une ligne).

- Meilleure expérience et meilleur référencement : une seule adresse, un seul
  certificat, un seul domaine dans les favoris des laboratoires clients.
- Demande l'intervention de leur équipe infrastructure.

### Option D — Bandeau d'alerte sur la page d'accueil (complément)

Exposer un point d'entrée en lecture seule (par exemple
`/api/etat.json`) renvoyant le nombre d'analyses impactées, que leur CMS
interroge pour afficher « 3 analyses actuellement impactées — consulter le
détail » sur la page d'accueil.

- Environ 1 jour de développement. **Non réalisé à ce jour.**
- C'est ce qui fait la différence entre un outil qu'on consulte quand on y
  pense et un outil qu'on voit.

**Recommandation** : A + D pour la mise en service, C ensuite si Cerba veut
l'outil pleinement dans son site.

---

## 5. Ce qui reste à faire avant une mise en production

Cette section est volontairement franche : la maquette est fonctionnelle,
elle n'est pas prête pour un usage en production. Rien ici n'est bloquant au
sens « impossible », tout est chiffré.

### 5.1 Bloquants

| # | Sujet | État actuel | À faire | Charge |
|---|---|---|---|---|
| 1 | **Authentification** | mot de passe unique partagé (`ADMIN_PASSWORD`) | comptes nommés, idéalement via l'annuaire Cerba (SSO) | 3 à 5 j |
| 2 | **Traçabilité des auteurs** | colonne `publie_par` en place mais **vide** | la remplir avec l'identité issue du SSO | inclus dans #1 |
| 3 | **Secrets** | `.env.local.example` contient l'URL et la clé publique d'un projet de démonstration | Cerba crée son projet, génère ses propres clés, ne réutilise rien | 1 h |
| 4 | **Limitation des tentatives** | aucune sur `/api/acces` | limiter les essais par IP (ou disparaît avec le SSO) | 0,5 j |
| 5 | **En-têtes de sécurité** | seul `X-Robots-Tag` est posé | ajouter CSP, `frame-ancestors`, HSTS, `Referrer-Policy` | 0,5 j |
| 6 | **Garde-fous de maquette** | bandeau « maquette », `noindex`, mot de passe sur la consultation | à retirer **délibérément**, un par un, le jour du lancement | 0,5 j |

### 5.2 Fortement conseillés

| # | Sujet | À faire | Charge |
|---|---|---|---|
| 7 | Tests automatisés et intégration continue | aucun test à ce jour ; en ajouter sur la validation des données et les règles d'accès | 2 à 3 j |
| 8 | Mise à jour des dépendances | activer Dependabot ou Renovate | 1 h |
| 9 | Supervision | sonde de disponibilité + alerte ; une page d'état hors service ne prévient personne | 0,5 j |
| 10 | Sauvegardes et restauration | définir la fréquence, **et tester une restauration** | selon leur standard |
| 11 | Identité visuelle | couleurs et polices sont des valeurs de repli, pas la charte Cerba (voir `README.md`) | à cadrer avec leur direction de la communication |

### 5.3 Décisions métier à prendre par Cerba

- Qui publie ? (quelques responsables de production, pas les 40 personnes)
- Qui relit avant publication, s'il doit y avoir une relecture ?
- Sous quel délai après détection d'un incident ?
- La consultation est-elle publique, ou réservée aux laboratoires clients
  identifiés ? *Cette question change l'architecture d'authentification : à
  trancher avant le chantier #1.*
- Quelle formulation officielle pour les commentaires (voir §6.3) ?

---

## 6. Sécurité et données

### 6.1 Architecture d'accès actuelle

- Le navigateur ne détient que la clé publique Supabase, et la politique de
  sécurité au niveau des lignes (RLS) n'autorise que la **lecture**. Aucune
  écriture n'est possible depuis le navigateur, même en modifiant le code de
  la page.
- Toute écriture passe par `app/api/entrees/route.ts`, exécuté **côté
  serveur**, avec une clé privilégiée qui ne quitte jamais le serveur.
- Le mot de passe d'administration est **revérifié à chaque écriture**
  (`lib/admin-auth.ts`, comparaison à temps constant). L'écran de connexion
  n'est qu'un portillon : contourner l'affichage ne donne aucun droit.
- Les données envoyées sont validées côté serveur (statut parmi trois valeurs
  autorisées, champs typés) avant d'atteindre la base.

Le point faible n'est donc pas l'architecture, c'est le **mot de passe
partagé** — d'où le chantier #1.

### 6.2 Nature des données — la question de l'hébergement de santé

**C'est la première question que posera un RSSI de laboratoire.**

La table ne contient que : un libellé d'analyse, un statut parmi trois, un
délai, un commentaire libre, des horodatages. **Aucune donnée de patient,
aucun résultat, aucun identifiant de prescripteur, aucune donnée de santé à
caractère personnel.** L'information publiée est de même nature qu'un panneau
« ascenseur en panne » : elle porte sur l'outil de production, pas sur une
personne.

Conséquence : l'outil **n'entre pas** dans le champ de l'obligation
d'hébergement certifié HDS, qui vise l'hébergement de données de santé à
caractère personnel. Deux réserves à porter soi-même devant eux, plutôt que
de les laisser les trouver :

1. Cette qualification doit être **confirmée par leur DPO**, et écrite.
2. Elle tient tant que le champ commentaire reste discipliné. Voir §6.3.

Si leur politique interne impose malgré tout un hébergement certifié HDS,
le scénario 2 (tout chez Cerba, sur une infrastructure déjà qualifiée) répond
à l'exigence sans redéveloppement.

### 6.3 Le risque réel : le champ commentaire

Le champ de commentaire est libre. Rien n'empêche techniquement quelqu'un
d'y écrire « dossier de Mme X à refaire ». Ce serait une donnée de santé
identifiante, et cela ferait basculer tout l'outil dans un autre régime
juridique.

Mesures proposées :

- consigne écrite dans la procédure de publication ;
- rappel affiché sous le champ dans la console d'administration ;
- possibilité d'ajouter un contrôle automatique bloquant (0,5 j).

### 6.4 Chaîne d'approvisionnement logicielle

4 dépendances directes, 59 paquets au total, aucun script chargé depuis un
CDN à l'exécution. À titre de comparaison, une application web courante de
cette taille en embarque couramment plusieurs centaines. C'est une surface
d'attaque volontairement réduite, et cela rend l'audit de code réaliste : un
relecteur expérimenté fait le tour du code écrit à la main en une journée.

### 6.5 Journalisation

L'historique métier est conservé (date de signalement, mise à jour,
résolution, durée de l'incident) — c'est ce qui permet au laboratoire de
prouver qu'il a informé ses clients, quand, et combien de temps a duré
l'incident (ISO 15189:2022 §6.8.2). En revanche, il n'y a **pas encore** de
journal technique nominatif « qui a fait quoi », faute de comptes nommés. Le
chantier #1 le débloque.

---

## 7. Continuité d'exploitation

L'outil n'a de valeur que s'il est tenu à jour. Le risque principal n'est pas
technique, il est organisationnel : une page de statut qui n'est pas mise à
jour est pire qu'une absence de page, parce qu'elle affirme faussement que
tout va bien.

À mettre en place côté Cerba :

| Rôle | Responsabilité |
|---|---|
| Responsable de publication | met à jour les alertes, nommément désigné |
| Suppléant | même chose, en cas d'absence |
| Référent technique | déploiements, mises à jour de sécurité, sauvegardes |

Et, côté processus :

- rattacher la publication à une étape existante de leur processus qualité
  (une non-conformité ouverte déclenche la publication), plutôt que d'en
  faire une tâche isolée qu'on oublie ;
- revue trimestrielle : les alertes publiées correspondent-elles aux
  incidents réellement survenus ?
- Ce dépôt et ses documents sont la mémoire du projet : à maintenir au même
  titre que le code.

### Transfert de compétences proposé

- 2 séances de 2 heures avec leur équipe : parcours du code, puis
  exploitation (déploiement, sauvegarde, incident type).
- Cahier d'exploitation rédigé pendant ces séances, par eux, pas par moi —
  c'est ce qui prouve que le transfert a fonctionné.
- Période d'accompagnement de 3 mois, puis autonomie complète.

---

## 8. Calendrier indicatif

Hypothèse : décision prise en semaine 0, scénario 1 ou 2, avec leurs équipes
disponibles.

| Semaine | Jalons |
|---|---|
| 0 | Décision, cadrage juridique (§2), réponse du DPO sur la qualification des données (§6.2) |
| 1 | Création des comptes Cerba, transfert du dépôt, régénération des secrets, premier déploiement sur leur environnement de recette |
| 2–3 | Chantiers bloquants #1 à #5 : authentification nommée, en-têtes, limitation des tentatives |
| 4 | Tests, intégration continue, supervision, sauvegardes ; revue de code et test d'intrusion par leurs soins |
| 5 | Retrait des garde-fous de maquette (#6), mise en service sur le sous-domaine (option A), bandeau sur la page d'accueil (option D) |
| 6+ | Accompagnement, puis autonomie |

Six semaines est un rythme confortable si les décisions du §5.3 sont prises
en semaine 0. Ce sont elles, et non le développement, qui commandent le
calendrier.

---

## 9. Ce que la décision engage réellement

| | Engagement |
|---|---|
| Financier | quelques dizaines d'euros par mois (scénario 1), ou zéro licence (scénario 2) |
| Humain | environ 10 à 15 jours de développement, plus quelques jours de leurs équipes |
| Récurrent | une personne qui publie, une qui maintient, quelques minutes par incident |
| Réversibilité | totale : code libre, données exportables en une commande |

Le coût d'entrée est faible et la sortie est ouverte. Ce qui se décide en
séance, ce n'est pas un budget, c'est la question du §5.3 : qui publie, et
pour qui.
