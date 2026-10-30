import { Router } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client.js";
import { ventes, produits, bornes, zones } from "../db/schema.js";
import { enveloppeAsync } from "../middleware/erreurs.js";
import { exigerAuthentification } from "../middleware/auth.js";

export const routeurVentes = Router();

routeurVentes.get(
  "/",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const { borneId, produitId, zoneId, statutSync, depuis, jusqua } = requete.query as Record<
      string,
      string | undefined
    >;

    const conditions = [];
    if (borneId) conditions.push(eq(ventes.borneId, borneId));
    if (produitId) conditions.push(eq(ventes.produitId, produitId));
    if (statutSync) conditions.push(eq(ventes.statutSync, statutSync as "LOCAL" | "SYNCHRONISE" | "EN_CONFLIT"));
    if (depuis) conditions.push(gte(ventes.creeLe, new Date(depuis)));
    if (jusqua) conditions.push(lte(ventes.creeLe, new Date(jusqua)));

    let lignes = await db
      .select({
        id: ventes.id,
        borneId: ventes.borneId,
        borneNom: bornes.nom,
        zoneId: zones.id,
        zoneNom: zones.nom,
        produitId: ventes.produitId,
        produitNom: produits.nom,
        coutAchat: produits.coutAchatActuel,
        quantite: ventes.quantite,
        prixUnitaire: ventes.prixUnitaire,
        montantTotal: ventes.montantTotal,
        statutSync: ventes.statutSync,
        creeLe: ventes.creeLe,
      })
      .from(ventes)
      .innerJoin(produits, eq(produits.id, ventes.produitId))
      .innerJoin(bornes, eq(bornes.id, ventes.borneId))
      .innerJoin(zones, eq(zones.id, bornes.zoneId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(ventes.creeLe))
      .limit(500);

    if (zoneId) {
      lignes = lignes.filter((ligne) => ligne.zoneId === zoneId);
    }

    reponse.json(lignes);
  })
);

routeurVentes.get(
  "/analytique",
  exigerAuthentification,
  enveloppeAsync(async (_requete, reponse) => {
    const lignes = await db
      .select({
        produitId: ventes.produitId,
        produitNom: produits.nom,
        coutAchat: produits.coutAchatActuel,
        quantite: ventes.quantite,
        montantTotal: ventes.montantTotal,
        zoneNom: zones.nom,
      })
      .from(ventes)
      .innerJoin(produits, eq(produits.id, ventes.produitId))
      .innerJoin(bornes, eq(bornes.id, ventes.borneId))
      .innerJoin(zones, eq(zones.id, bornes.zoneId));

    let chiffreAffaires = 0;
    let coutTotal = 0;
    const parProduit = new Map<string, { nom: string; chiffreAffaires: number; unites: number }>();
    const parZone = new Map<string, { chiffreAffaires: number; unites: number }>();

    for (const ligne of lignes) {
      const montant = Number(ligne.montantTotal);
      const cout = Number(ligne.coutAchat) * ligne.quantite;
      chiffreAffaires += montant;
      coutTotal += cout;

      const produitStat = parProduit.get(ligne.produitId) ?? {
        nom: ligne.produitNom,
        chiffreAffaires: 0,
        unites: 0,
      };
      produitStat.chiffreAffaires += montant;
      produitStat.unites += ligne.quantite;
      parProduit.set(ligne.produitId, produitStat);

      const zoneStat = parZone.get(ligne.zoneNom) ?? { chiffreAffaires: 0, unites: 0 };
      zoneStat.chiffreAffaires += montant;
      zoneStat.unites += ligne.quantite;
      parZone.set(ligne.zoneNom, zoneStat);
    }

    const produitsTries = [...parProduit.values()].sort(
      (a, b) => b.chiffreAffaires - a.chiffreAffaires
    );

    reponse.json({
      chiffreAffaires: chiffreAffaires.toFixed(2),
      margeBrute: (chiffreAffaires - coutTotal).toFixed(2),
      volumeVentes: lignes.reduce((total, l) => total + l.quantite, 0),
      meilleursProduits: produitsTries.slice(0, 5),
      pirePerformants: produitsTries.slice(-5).reverse(),
      parZone: Object.fromEntries(parZone),
    });
  })
);
