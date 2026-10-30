# Bornes automatiques à prix dynamique — KOMETA

Plateforme complète : moteur de tarification dynamique, API centrale, et une seule application web KOMETA qui regroupe le back-office (CRM) **et** l'écran de vente affiché sur la borne. Seule la partie strictement obligée de tourner hors ligne — le point de vente physique — reste un processus séparé.

## Structure

```
backend/        API Express + PostgreSQL (Drizzle) + Socket.IO + moteur de tarification + simulateur
frontend/        Application React unique : back-office (/) et écran borne (/borne, /borne/:borneId)
kiosk-server/    Serveur local embarqué sur chaque borne (SQLite, file d'attente de synchronisation)
shared/          Types et constantes partagés entre backend, frontend et kiosk-server
docs/            Documents de préparation (technique, oral) et décisions d'architecture (docs/decisions)
```

**Pourquoi l'écran borne n'est pas dans le même processus que le back-office.** L'interface (`/borne`) est bien dans la même application `frontend`. Mais le cahier des charges impose que la borne continue de vendre sans réseau, avec stockage local des ventes — physiquement impossible si elle dépend directement du serveur central PostgreSQL. `kiosk-server` est donc le seul composant qui reste à part : un petit serveur à faire tourner *sur la borne elle-même* (ou en conteneur juste à côté), avec sa propre base SQLite, qui synchronise vers `backend` dès que le réseau revient. L'écran borne (`frontend` → `/borne/:borneId`) parle uniquement à ce serveur local, jamais directement au serveur central. Chaque processus `kiosk-server` reste donc bien configuré pour **une seule** borne physique (`KIOSK_BORNE_ID`) : c'est le reflet correct du monde réel (un boîtier = un point de vente), pas une limitation à corriger.

## Fonctionnalités principales

- **Sélection de la borne avant achat** (`/borne`) : la personne choisit la borne qu'elle utilise sur un écran dédié avant d'accéder au catalogue — plus de borne unique codée en dur. Si le serveur local de la borne (`kiosk-server`) est configuré pour une autre borne que celle choisie, un écran explique clairement le décalage plutôt que de servir silencieusement le mauvais catalogue.
- **Trois types de zones obligatoires** (Gares, Campus universitaires, Zones d'affaires), chacune avec sa propre configuration de demande (heures de pointe, multiplicateurs week-end) modifiable depuis la page *Zones*.
- **Tarification** : trois modes par produit et par borne (automatique, manuel, fixe), plafond de variation ±15 %/heure, plancher anti-vente-à-perte, bornes min/max, historique complet des changements de prix, et dérogation manuelle avec motif obligatoire.
- **Simulation honnête** (page *Simulation*) : un seul bouton « Lancer la simulation (60 jours, toutes zones) » exécute automatiquement une comparaison sur 60 jours simulés en utilisant le catalogue et les trois zones déjà enregistrés en base, sans aucun réglage manuel requis. Sur le **même** flux de demande simulé (même tirages aléatoires pour les deux côtés), la tarification dynamique est comparée à un prix fixe de référence — avec élasticité au prix, pics de demande, péremption et pertes réalistes. Un « Scénario personnalisé… » optionnel reste disponible pour tester un produit isolé avec des paramètres choisis à la main. Le résultat n'est pas truqué pour toujours favoriser la tarification dynamique : sur un scénario mal calibré, le prix fixe peut gagner, ce qui est un résultat de recherche honnête. L'écart entre les deux stratégies est affiché en euros (valeur toujours lisible), avec un pourcentage en complément uniquement quand la base de comparaison est significative.
- **Événements business** (page *Événements*) : facteurs ponctuels (match, grève, semaine de partiels…) influençant la demande d'une zone sur une période donnée.
- **Stocks** avec alertes de rupture, de stock faible et de péremption proche, et édition de la date d'expiration par lot directement depuis le tableau.
- **Ventes** filtrables par borne/produit/zone, avec page d'analytique (chiffre d'affaires, marge brute, meilleurs/pires produits, répartition par zone).
- **Suppression** des zones (bloquée tant que des bornes y sont rattachées, avec message explicite) et des produits (désactivation réversible qui conserve l'historique des ventes et des prix).
- **Création idempotente des données de référence** : relancer `npm run db:seed` plusieurs fois ne crée jamais de doublons (contraintes d'unicité en base + insertions protégées), et toute création de produit ou de borne initialise automatiquement son prix et son stock sur l'ensemble du catalogue/parc existant.
- **Validations et confirmations visibles** sur tous les formulaires du back-office (Produits, Zones, Tarification, Stocks, Événements) : messages d'erreur en français avant tout appel réseau, confirmation après chaque création/modification/suppression, et bouton désactivé pendant l'enregistrement pour éviter les doubles clics.
- **Responsive mobile** sur l'ensemble du back-office et de l'écran borne (menu latéral en tiroir sous 900 px, grilles qui repassent en une colonne).
- Synchronisation hors ligne robuste (identifiants locaux uniques, rejouable sans doublon), Socket.IO pour les mises à jour temps réel, validation Zod sur toutes les entrées, mots de passe hachés (bcrypt), authentification par jeton JWT partagée via un contexte React unique (connexion immédiate, sans rechargement de page), rôles ADMIN/OPÉRATEUR.

## Démarrage avec Docker

```bash
docker compose up --build
docker compose exec backend node backend/dist/db/migrer.js
docker compose exec backend node backend/dist/db/semer.js
```

- Application (back-office) : http://localhost:5173
- Sélection de la borne : http://localhost:5173/borne
- API centrale : http://localhost:4000
- Serveur local de la borne : http://localhost:4100

Identifiants de démonstration : `admin@kometa-bornes.fr` / `admin1234`.

## Démarrage en local (sans Docker)

Chaque application lit son propre fichier `.env`, à sa propre racine (les scripts npm d'un workspace s'exécutent depuis le dossier de ce workspace, pas depuis la racine du monorepo) :

```bash
cp backend/env.example backend/.env
cp kiosk-server/env.example kiosk-server/.env
cp frontend/env.example frontend/.env

npm install
npm run db:migrate --workspace=@borne/backend
npm run db:seed --workspace=@borne/backend
npm run dev:backend
npm run dev:frontend
npm run dev:kiosk-server
```

Un PostgreSQL local est requis (`DATABASE_URL` dans `backend/.env`). Avec Docker Compose, PostgreSQL est exposé sur le port hôte `5433` (et non `5432`) pour éviter tout conflit avec une installation PostgreSQL déjà présente sur la machine.

### Tester les trois zones en local (Gare / Campus / Zone d'affaires)

Le jeu de données initial crée une borne par type de zone, avec des identifiants fixes :

| Zone | Borne | UUID | Commande `kiosk-server` | Port local |
|---|---|---|---|---|
| Gare | Borne Gare du Nord - Hall 1 | `11111111-1111-4111-8111-111111111111` | `npm run dev:kiosk-server` | 4100 |
| Campus | Borne Campus - Bâtiment B | `22222222-2222-4222-8222-222222222222` | `npm run dev:kiosk-server-campus` | 4101 |
| Zone d'affaires | Borne La Défense - Tour Nord | `33333333-3333-4333-8333-333333333333` | `npm run dev:kiosk-server-affaires` | 4102 |

Chaque `kiosk-server` ne sert qu'**une seule** borne à la fois (reflet du monde réel : un boîtier = un point de vente). Pour tester les trois en local, lance les trois commandes ci-dessus dans trois onglets de terminal séparés, en plus de `npm run dev:backend` et `npm run dev:frontend`. L'écran `/borne` détecte automatiquement, en mode développement, quel port local correspond à la zone de la borne choisie — il suffit de choisir la borne voulue sur l'écran de sélection, aucune configuration manuelle n'est nécessaire.

Pour lancer les tests unitaires du moteur de tarification :

```bash
npm run test --workspace=@borne/backend
```

## Simuler une coupure réseau (scénario d'examen oral)

1. Ouvrir `/borne`, choisir la borne, puis faire une première vente pendant qu'elle est en ligne.
2. Depuis le back-office (page Bornes), cliquer sur « Simuler une coupure ».
3. Continuer à vendre sur l'écran borne : les ventes restent enregistrées localement (SQLite, via `kiosk-server`), l'indicateur passe en « Mode hors ligne ».
4. Modifier un prix depuis le back-office pendant la coupure.
5. Remettre la borne en ligne : `kiosk-server` resynchronise automatiquement les ventes en attente (identifiants uniques, donc rejouables sans doublon) et récupère les prix à jour.

## Dépannage : base de données déjà utilisée avant cette mise à jour

Les versions précédentes du script `db:seed` n'étaient pas protégées contre les doublons : relancer le seed sur une base déjà peuplée pouvait dupliquer les zones (et, par ricochet, la liste déroulante des zones sur *Événements* ainsi que le sélecteur de borne sur `/borne`). Cette mise à jour ajoute une contrainte d'unicité sur le nom des zones et rend le seed rejouable sans risque — **mais cette contrainte ne peut pas s'appliquer sur une base qui contient déjà des doublons** : la migration échouera avec une erreur `duplicate key` si c'est le cas.

**Si la base a déjà servi avant cette mise à jour, repartir d'une base propre est nécessaire** :

```bash
docker compose down -v
docker compose up --build
docker compose exec backend node backend/dist/db/migrer.js
docker compose exec backend node backend/dist/db/semer.js
```

`down -v` supprime aussi le volume PostgreSQL, donc toutes les ventes/prix/historiques déjà enregistrés sur cette instance seront perdus. En local sans Docker, l'équivalent est de supprimer puis recréer la base (`DROP DATABASE borne_crm` / `CREATE DATABASE borne_crm`) avant de relancer `db:migrate` puis `db:seed`.

## Décisions d'architecture

Voir `docs/decisions/` pour les choix structurants (PostgreSQL + Drizzle plutôt que Prisma, React + TypeScript, moteur de tarification séparé, synchronisation hors ligne, simulation comparative honnête).

## Police de marque

Les polices « Radiotechnika » et « Nekst » du guide de marque KOMETA ne sont pas incluses (droits de licence) : `theme.css` les référence avec une bascule automatique vers une police système tant que les fichiers de police ne sont pas ajoutés par l'équipe.
