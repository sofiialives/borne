import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

const chemin = process.env.KIOSK_DB_PATH ?? "./kiosk-local.sqlite";

export const base = new DatabaseSync(chemin);

base.exec(`
  CREATE TABLE IF NOT EXISTS produits_cache (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL,
    nom TEXT NOT NULL,
    categorie TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS prix_cache (
    produit_id TEXT PRIMARY KEY,
    valeur REAL NOT NULL,
    raison TEXT NOT NULL DEFAULT '',
    mis_a_jour_le TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stock_cache (
    produit_id TEXT PRIMARY KEY,
    quantite INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS ventes_locales (
    local_id TEXT PRIMARY KEY,
    produit_id TEXT NOT NULL,
    quantite INTEGER NOT NULL,
    prix_unitaire REAL NOT NULL,
    mode_paiement TEXT NOT NULL DEFAULT 'CARTE',
    cree_le TEXT NOT NULL,
    statut_sync TEXT NOT NULL DEFAULT 'LOCAL'
  );
`);

export function nouvelIdentifiant(): string {
  return randomUUID();
}

export interface ProduitCache {
  id: string;
  sku: string;
  nom: string;
  categorie: string;
}

export interface PrixCache {
  produit_id: string;
  valeur: number;
  raison: string;
  mis_a_jour_le: string;
}

export interface StockCache {
  produit_id: string;
  quantite: number;
}

export interface VenteLocale {
  local_id: string;
  produit_id: string;
  quantite: number;
  prix_unitaire: number;
  mode_paiement: string;
  cree_le: string;
  statut_sync: string;
}

export function remplacerProduitsCache(produits: ProduitCache[]): void {
  base.exec("DELETE FROM produits_cache");
  const insertion = base.prepare(
    "INSERT INTO produits_cache (id, sku, nom, categorie) VALUES (?, ?, ?, ?)"
  );
  for (const produit of produits) {
    insertion.run(produit.id, produit.sku, produit.nom, produit.categorie);
  }
}

export function mettreAJourPrixCache(prixListe: { produitId: string; valeur: number; raison: string }[]): void {
  const upsert = base.prepare(`
    INSERT INTO prix_cache (produit_id, valeur, raison, mis_a_jour_le)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(produit_id) DO UPDATE SET valeur = excluded.valeur, raison = excluded.raison, mis_a_jour_le = excluded.mis_a_jour_le
  `);
  const horodatage = new Date().toISOString();
  for (const prix of prixListe) {
    upsert.run(prix.produitId, prix.valeur, prix.raison, horodatage);
  }
}

export function mettreAJourStockCache(stockListe: { produitId: string; quantite: number }[]): void {
  const upsert = base.prepare(`
    INSERT INTO stock_cache (produit_id, quantite)
    VALUES (?, ?)
    ON CONFLICT(produit_id) DO UPDATE SET quantite = excluded.quantite
  `);
  for (const stock of stockListe) {
    upsert.run(stock.produitId, stock.quantite);
  }
}

export function listerProduitsAffichage() {
  return base
    .prepare(
      `SELECT p.id, p.sku, p.nom, p.categorie, pr.valeur AS prix, s.quantite AS stock
       FROM produits_cache p
       LEFT JOIN prix_cache pr ON pr.produit_id = p.id
       LEFT JOIN stock_cache s ON s.produit_id = p.id`
    )
    .all();
}

export function enregistrerVenteLocale(vente: {
  produitId: string;
  quantite: number;
  prixUnitaire: number;
  modePaiement: string;
}): VenteLocale {
  const localId = nouvelIdentifiant();
  const creeLe = new Date().toISOString();

  base
    .prepare(
      `INSERT INTO ventes_locales (local_id, produit_id, quantite, prix_unitaire, mode_paiement, cree_le, statut_sync)
       VALUES (?, ?, ?, ?, ?, ?, 'LOCAL')`
    )
    .run(localId, vente.produitId, vente.quantite, vente.prixUnitaire, vente.modePaiement, creeLe);

  base
    .prepare(
      `UPDATE stock_cache SET quantite = MAX(0, quantite - ?) WHERE produit_id = ?`
    )
    .run(vente.quantite, vente.produitId);

  return {
    local_id: localId,
    produit_id: vente.produitId,
    quantite: vente.quantite,
    prix_unitaire: vente.prixUnitaire,
    mode_paiement: vente.modePaiement,
    cree_le: creeLe,
    statut_sync: "LOCAL",
  };
}

export function listerVentesNonSynchronisees(): VenteLocale[] {
  return base
    .prepare("SELECT * FROM ventes_locales WHERE statut_sync = 'LOCAL' ORDER BY cree_le ASC")
    .all() as unknown as VenteLocale[];
}

export function marquerVentesSynchronisees(localIds: string[]): void {
  const miseAJour = base.prepare(
    "UPDATE ventes_locales SET statut_sync = 'SYNCHRONISE' WHERE local_id = ?"
  );
  for (const localId of localIds) {
    miseAJour.run(localId);
  }
}
