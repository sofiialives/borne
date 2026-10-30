import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
  primaryKey,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const statutBorneEnum = pgEnum("statut_borne", ["ACTIF", "HORS_LIGNE", "MAINTENANCE"]);
export const typeZoneEnum = pgEnum("type_zone", ["GARE", "CAMPUS", "ZONE_AFFAIRES"]);
export const modePrixEnum = pgEnum("mode_prix", ["AUTOMATIQUE", "MANUEL", "FIXE"]);
export const sourcePrixEnum = pgEnum("source_prix", ["REGLE", "MANUEL", "IA"]);
export const statutSyncVenteEnum = pgEnum("statut_sync_vente", [
  "LOCAL",
  "SYNCHRONISE",
  "EN_CONFLIT",
]);
export const statutReappro = pgEnum("statut_reapprovisionnement", [
  "PLANIFIE",
  "EN_COURS",
  "TERMINE",
  "ANNULE",
]);
export const roleUtilisateurEnum = pgEnum("role_utilisateur", ["ADMIN", "OPERATEUR"]);
export const strategieSimulationEnum = pgEnum("strategie_simulation", ["DYNAMIQUE", "FIXE"]);
export const typeJournalTechniqueEnum = pgEnum("type_journal_technique", [
  "DECONNEXION",
  "RECONNEXION",
  "CHANGEMENT_PRIX",
  "ALERTE_STOCK",
  "VENTE_SYNCHRONISEE",
  "REGLE_DECLENCHEE",
]);

export const zones = pgTable(
  "zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nom: text("nom").notNull(),
    type: typeZoneEnum("type").notNull(),
    fuseauHoraire: text("fuseau_horaire").notNull().default("Europe/Paris"),
    configDemande: jsonb("config_demande").notNull().default(sql`'{}'::jsonb`),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nomUnique: uniqueIndex("zones_nom_unique").on(table.nom),
  })
);

export const bornes = pgTable("bornes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nom: text("nom").notNull(),
  zoneId: uuid("zone_id")
    .notNull()
    .references(() => zones.id, { onDelete: "restrict" }),
  statut: statutBorneEnum("statut").notNull().default("ACTIF"),
  derniereSyncLe: timestamp("derniere_sync_le", { withTimezone: true }),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const utilisateurs = pgTable("utilisateurs", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  nom: text("nom").notNull(),
  motDePasseHash: text("mot_de_passe_hash").notNull(),
  role: roleUtilisateurEnum("role").notNull().default("OPERATEUR"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const produits = pgTable("produits", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: text("sku").notNull().unique(),
  nom: text("nom").notNull(),
  description: text("description").notNull().default(""),
  categorie: text("categorie").notNull(),
  prixReference: numeric("prix_reference", { precision: 10, scale: 2 }).notNull(),
  coutAchatActuel: numeric("cout_achat_actuel", { precision: 10, scale: 2 }).notNull(),
  prixMin: numeric("prix_min", { precision: 10, scale: 2 }).notNull(),
  prixMax: numeric("prix_max", { precision: 10, scale: 2 }).notNull(),
  prixStable: boolean("prix_stable").notNull().default(false),
  suiviDlc: boolean("suivi_dlc").notNull().default(false),
  dureeConservationJours: integer("duree_conservation_jours"),
  margeMinimale: numeric("marge_minimale", { precision: 5, scale: 4 }).notNull().default("0.05"),
  actif: boolean("actif").notNull().default(true),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  misAJourLe: timestamp("mis_a_jour_le", { withTimezone: true }).notNull().defaultNow(),
});

export const stocks = pgTable(
  "stocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    produitId: uuid("produit_id")
      .notNull()
      .references(() => produits.id, { onDelete: "cascade" }),
    borneId: uuid("borne_id")
      .notNull()
      .references(() => bornes.id, { onDelete: "cascade" }),
    quantite: integer("quantite").notNull().default(0),
    seuilAlerte: integer("seuil_alerte").notNull().default(5),
    dateExpiration: timestamp("date_expiration", { withTimezone: true }),
    misAJourLe: timestamp("mis_a_jour_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    produitBorneUnique: uniqueIndex("stocks_produit_borne_unique").on(
      table.produitId,
      table.borneId
    ),
  })
);

export const reglesDePrix = pgTable("regles_de_prix", {
  id: uuid("id").primaryKey().defaultRandom(),
  nom: text("nom").notNull(),
  type: text("type").notNull(),
  parametres: jsonb("parametres").notNull().default(sql`'{}'::jsonb`),
  actif: boolean("actif").notNull().default(true),
  priorite: integer("priorite").notNull().default(100),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  misAJourLe: timestamp("mis_a_jour_le", { withTimezone: true }).notNull().defaultNow(),
});

export const prixCourants = pgTable(
  "prix_courants",
  {
    produitId: uuid("produit_id")
      .notNull()
      .references(() => produits.id, { onDelete: "cascade" }),
    borneId: uuid("borne_id")
      .notNull()
      .references(() => bornes.id, { onDelete: "cascade" }),
    valeur: numeric("valeur", { precision: 10, scale: 2 }).notNull(),
    mode: modePrixEnum("mode").notNull().default("AUTOMATIQUE"),
    source: sourcePrixEnum("source").notNull().default("MANUEL"),
    raison: text("raison").notNull().default(""),
    misAJourLe: timestamp("mis_a_jour_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.produitId, table.borneId] }),
  })
);

export const prixHistorique = pgTable("prix_historique", {
  id: uuid("id").primaryKey().defaultRandom(),
  produitId: uuid("produit_id")
    .notNull()
    .references(() => produits.id, { onDelete: "cascade" }),
  borneId: uuid("borne_id")
    .notNull()
    .references(() => bornes.id, { onDelete: "cascade" }),
  valeurPrecedente: numeric("valeur_precedente", { precision: 10, scale: 2 }).notNull(),
  valeur: numeric("valeur", { precision: 10, scale: 2 }).notNull(),
  mode: modePrixEnum("mode").notNull(),
  source: sourcePrixEnum("source").notNull(),
  raison: text("raison").notNull().default(""),
  creeParUtilisateurId: uuid("cree_par_utilisateur_id").references(() => utilisateurs.id, {
    onDelete: "set null",
  }),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const ventes = pgTable(
  "ventes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    localId: text("local_id").notNull(),
    borneId: uuid("borne_id")
      .notNull()
      .references(() => bornes.id, { onDelete: "restrict" }),
    produitId: uuid("produit_id")
      .notNull()
      .references(() => produits.id, { onDelete: "restrict" }),
    quantite: integer("quantite").notNull(),
    prixUnitaire: numeric("prix_unitaire", { precision: 10, scale: 2 }).notNull(),
    montantTotal: numeric("montant_total", { precision: 10, scale: 2 }).notNull(),
    modePaiement: text("mode_paiement").notNull().default("CARTE"),
    statutSync: statutSyncVenteEnum("statut_sync").notNull().default("SYNCHRONISE"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull(),
    syncLe: timestamp("sync_le", { withTimezone: true }),
  },
  (table) => ({
    idempotenceSync: uniqueIndex("ventes_borne_local_id_unique").on(
      table.borneId,
      table.localId
    ),
  })
);

export const coutsAchat = pgTable("couts_achat", {
  id: uuid("id").primaryKey().defaultRandom(),
  produitId: uuid("produit_id")
    .notNull()
    .references(() => produits.id, { onDelete: "cascade" }),
  fournisseur: text("fournisseur").notNull(),
  prixAchat: numeric("prix_achat", { precision: 10, scale: 2 }).notNull(),
  quantite: integer("quantite").notNull(),
  dateAchat: timestamp("date_achat", { withTimezone: true }).notNull().defaultNow(),
});

export const evenements = pgTable("evenements", {
  id: uuid("id").primaryKey().defaultRandom(),
  nom: text("nom").notNull(),
  description: text("description").notNull().default(""),
  zoneId: uuid("zone_id")
    .notNull()
    .references(() => zones.id, { onDelete: "cascade" }),
  dateDebut: timestamp("date_debut", { withTimezone: true }).notNull(),
  dateFin: timestamp("date_fin", { withTimezone: true }).notNull(),
  impactDemande: numeric("impact_demande", { precision: 5, scale: 2 }).notNull().default("1.0"),
  actif: boolean("actif").notNull().default(true),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const journalTechnique = pgTable("journal_technique", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: typeJournalTechniqueEnum("type").notNull(),
  borneId: uuid("borne_id").references(() => bornes.id, { onDelete: "set null" }),
  produitId: uuid("produit_id").references(() => produits.id, { onDelete: "set null" }),
  donnees: jsonb("donnees").notNull().default(sql`'{}'::jsonb`),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const reapprovisionnements = pgTable("reapprovisionnements", {
  id: uuid("id").primaryKey().defaultRandom(),
  produitId: uuid("produit_id")
    .notNull()
    .references(() => produits.id, { onDelete: "cascade" }),
  borneId: uuid("borne_id")
    .notNull()
    .references(() => bornes.id, { onDelete: "cascade" }),
  quantite: integer("quantite").notNull(),
  statut: statutReappro("statut").notNull().default("PLANIFIE"),
  datePrevue: timestamp("date_prevue", { withTimezone: true }).notNull(),
  dateReelle: timestamp("date_reelle", { withTimezone: true }),
});

export const simulationRuns = pgTable("simulation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  nom: text("nom").notNull(),
  dureeJours: integer("duree_jours").notNull().default(60),
  zoneId: uuid("zone_id").references(() => zones.id, { onDelete: "set null" }),
  parametres: jsonb("parametres").notNull().default(sql`'{}'::jsonb`),
  creeParUtilisateurId: uuid("cree_par_utilisateur_id").references(() => utilisateurs.id, {
    onDelete: "set null",
  }),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const simulationResultats = pgTable("simulation_resultats", {
  id: uuid("id").primaryKey().defaultRandom(),
  simulationRunId: uuid("simulation_run_id")
    .notNull()
    .references(() => simulationRuns.id, { onDelete: "cascade" }),
  strategie: strategieSimulationEnum("strategie").notNull(),
  margeCumulee: numeric("marge_cumulee", { precision: 12, scale: 2 }).notNull(),
  chiffreAffaires: numeric("chiffre_affaires", { precision: 12, scale: 2 }).notNull(),
  unitesVendues: integer("unites_vendues").notNull(),
  unitesGaspillees: integer("unites_gaspillees").notNull().default(0),
  evolutionPrix: jsonb("evolution_prix").notNull().default(sql`'[]'::jsonb`),
});

export const zonesRelations = relations(zones, ({ many }) => ({
  bornes: many(bornes),
  evenements: many(evenements),
}));

export const bornesRelations = relations(bornes, ({ one, many }) => ({
  zone: one(zones, { fields: [bornes.zoneId], references: [zones.id] }),
  stocks: many(stocks),
  prixCourants: many(prixCourants),
}));

export const produitsRelations = relations(produits, ({ many }) => ({
  stocks: many(stocks),
  prixCourants: many(prixCourants),
  prixHistorique: many(prixHistorique),
  coutsAchat: many(coutsAchat),
}));

export const stocksRelations = relations(stocks, ({ one }) => ({
  produit: one(produits, { fields: [stocks.produitId], references: [produits.id] }),
  borne: one(bornes, { fields: [stocks.borneId], references: [bornes.id] }),
}));

export const prixCourantsRelations = relations(prixCourants, ({ one }) => ({
  produit: one(produits, { fields: [prixCourants.produitId], references: [produits.id] }),
  borne: one(bornes, { fields: [prixCourants.borneId], references: [bornes.id] }),
}));

export const ventesRelations = relations(ventes, ({ one }) => ({
  produit: one(produits, { fields: [ventes.produitId], references: [produits.id] }),
  borne: one(bornes, { fields: [ventes.borneId], references: [bornes.id] }),
}));

export const evenementsRelations = relations(evenements, ({ one }) => ({
  zone: one(zones, { fields: [evenements.zoneId], references: [zones.id] }),
}));

export const simulationRunsRelations = relations(simulationRuns, ({ many, one }) => ({
  resultats: many(simulationResultats),
  zone: one(zones, { fields: [simulationRuns.zoneId], references: [zones.id] }),
}));

export const simulationResultatsRelations = relations(simulationResultats, ({ one }) => ({
  run: one(simulationRuns, {
    fields: [simulationResultats.simulationRunId],
    references: [simulationRuns.id],
  }),
}));
