# Questions de sécurité — réponses préparées

> Complément au [dossier de reprise](reprise-internalisation.md). Chaque
> réponse indique aussi ce qui **n'est pas** en place : une réponse qui ne
> reconnaît aucune limite n'est pas crue par une équipe sécurité, et à juste
> titre.

---

### « Où sont hébergées les données ? »

Union européenne. Le projet de base de données est créé en région Francfort
(`eu-central-1`) — région non modifiable après création, ce qui interdit une
migration silencieuse. Les fonctions serveur sont fixées sur la région
`fra1` par `vercel.json`, déjà versionné.

*Limite* : en hébergement managé (scénario 1), les éditeurs restent des
sociétés américaines. Si cela pose problème, le scénario 2 place tout chez
Cerba.

---

### « Y a-t-il des données de santé ? Faut-il un hébergeur certifié HDS ? »

Non et non — sous réserve de confirmation par leur DPO. La base contient un
libellé d'analyse, un statut parmi trois, un délai, un commentaire et des
horodatages. Pas de patient, pas de résultat, pas de prescripteur. Ce n'est
pas une donnée de santé à caractère personnel, donc pas d'obligation HDS.

*Limite assumée* : le champ commentaire est libre. La qualification tient
tant que personne n'y écrit de nom de patient. Trois mesures sont proposées
(§6.3 du dossier), dont un contrôle bloquant si Cerba le souhaite.

*Si leur politique interne exige quand même l'HDS* : scénario 2, sur leur
infrastructure déjà qualifiée. Aucun redéveloppement.

---

### « Qui peut modifier ce qui est publié ? »

Aujourd'hui : toute personne disposant du mot de passe d'administration. Il
est unique et partagé. **C'est la principale faiblesse de la maquette, et
elle est identifiée comme chantier bloquant n° 1.**

Cible : comptes nommés adossés à l'annuaire Cerba (SSO), avec l'identité de
l'auteur enregistrée à chaque publication. La colonne `publie_par` existe
déjà en base et attend ces comptes. Charge estimée : 3 à 5 jours.

---

### « Peut-on écrire dans la base depuis le navigateur ? »

Non. Le navigateur ne détient qu'une clé publique, et la seule règle d'accès
définie en base autorise la lecture. Une écriture envoyée depuis le
navigateur est refusée par la base elle-même, pas par le code de la page :
modifier le code affiché ne contourne rien.

Les écritures passent par une route serveur unique
(`app/api/entrees/route.ts`), qui revérifie le mot de passe à chaque requête
et valide les champs avant insertion.

---

### « Combien de bibliothèques tierces ? Quelle surface d'attaque ? »

4 dépendances directes (Next.js, React, React DOM, le client de base de
données), 59 paquets au total. Aucun script chargé depuis un service externe
à l'exécution : rien ne peut être injecté par un CDN compromis.

Le code écrit à la main représente environ 1 800 lignes, auxquelles s'ajoute
un catalogue d'analyses généré depuis leur propre export CSV. Un audit de
code complet est réalisable en une journée — ce qui est rarement le cas, et
qui vaut la peine d'être proposé.

---

### « Avez-vous fait auditer le code ? Un test d'intrusion ? »

Non. C'est une maquette de proposition, pas un produit livré.
Ce qui est proposé, et qui vaut mieux qu'un audit fourni par l'auteur :

- revue de code par leurs équipes ou leur prestataire habituel, sur un code
  volontairement court ;
- test d'intrusion sur l'environnement de recette, avant mise en service
  (semaine 4 du calendrier) ;
- correction des constats à la charge de l'auteur pendant la période
  d'accompagnement.

---

### « Que se passe-t-il si vous disparaissez ? »

L'outil continue de fonctionner, et n'importe quel développeur peut le
reprendre :

- le code est intégralement dans le dépôt, transféré à Cerba ;
- les briques sont libres et documentées publiquement (Next.js, React,
  PostgreSQL) — aucun composant propriétaire, aucun format fermé ;
- les données sont dans une table PostgreSQL ordinaire, exportable en une
  commande ;
- le passage d'un hébergement managé à leur propre infrastructure est un
  chemin documenté (§3 du dossier), pas une reconstruction.

C'est la raison d'être du présent dossier : la dépendance à une personne est
un risque, elle se traite par la documentation et le transfert.

---

### « Quelles sauvegardes ? Quelle restauration ? »

À définir selon leur standard interne, et à inscrire au contrat en scénario
1. Le point à retenir : une sauvegarde qui n'a jamais été restaurée n'est pas
une sauvegarde. Un test de restauration est prévu en semaine 4.

*Limite* : rien n'est en place à ce jour sur l'environnement de maquette,
qui ne contient que des données fictives.

---

### « Quelle disponibilité ? Et si l'outil tombe pendant un incident ? »

Aucun engagement de niveau de service n'est pris à ce stade.

Le point important est ailleurs : l'outil affiche des indisponibilités, il ne
les provoque pas. S'il tombe, la production du laboratoire n'est pas
affectée ; c'est l'information des clients qui l'est. Une sonde de
disponibilité avec alerte est prévue (chantier #9), et la procédure doit
prévoir le canal de repli habituel — courriel ou téléphone — si l'outil est
indisponible.

---

### « Le site est-il exposé publiquement ? Référencé ? »

Aujourd'hui, non, et de trois façons cumulées : la consultation est protégée
par un mot de passe, toutes les pages portent `noindex, nofollow` (dans les
métadonnées **et** dans un en-tête HTTP), et l'adresse n'est pas diffusée.

Ces garde-fous sont volontairement isolés dans le code pour être retirés
**délibérément**, un par un, le jour où Cerba valide le projet. C'est un
choix, pas un oubli.

---

### « Et le détournement de clics, les en-têtes de sécurité ? »

Seul `X-Robots-Tag` est posé à ce jour. Il manque une politique de sécurité
du contenu (CSP), la restriction de cadrage (`frame-ancestors`), HSTS et
`Referrer-Policy` : chantier #5, une demi-journée. C'est de toute façon un
prérequis de l'intégration en cadre dans leur site (option B).

---

### « Le RGPD, alors ? »

L'outil ne traite pas de données personnelles de patients. Il traitera des
données personnelles de **salariés Cerba** dès que les comptes nommés seront
en place (qui a publié quoi, et quand) : registre des traitements à compléter,
durée de conservation à fixer, information des personnes concernées.

En scénario 1, un accord de sous-traitance au sens de l'article 28 est à
signer avec chaque hébergeur.

---

### « Combien de personnes vont l'utiliser ? »

Trois cercles à distinguer, et c'est une décision Cerba (§5.3 du dossier) :

| Cercle | Qui | Accès |
|---|---|---|
| Publication | quelques responsables de production | compte nommé, écriture |
| Lecture interne | l'équipe Cerba | lecture |
| Lecture externe | les laboratoires clients | lecture — publique, ou réservée à des clients identifiés ? |

La dernière ligne est la seule qui change l'architecture. Elle doit être
tranchée avant de lancer le chantier d'authentification.
