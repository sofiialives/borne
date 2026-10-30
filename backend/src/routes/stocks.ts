import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { stocks, produits, bornes } from "../db/schema.js";
import { enveloppeAsync } from "../middleware/erreurs.js";
import { exigerAuthentification } from "../middleware/auth.js";

export const routeurStocks = Router();

routeurStocks.get(
  "/",
  exigerAuthentification,
  enveloppeAsync(async (_requete, reponse) => {
    const lignes = await db
      .select({
        produitId: stocks.produitId,
        produitNom: produits.nom,
        suiviDlc: produits.suiviDlc,
        dureeConservationJours: produits.dureeConservationJours,
        borneId: stocks.borneId,
        borneNom: bornes.nom,
        quantite: stocks.quantite,
        seuilAlerte: stocks.seuilAlerte,
        dateExpiration: stocks.dateExpiration,
        misAJourLe: stocks.misAJourLe,
      })
      .from(stocks)
      .innerJoin(produits, eq(produits.id, stocks.produitId))
      .innerJoin(bornes, eq(bornes.id, stocks.borneId));

    const maintenant = Date.now();
    const seuilPeremptionMs = 3 * 86_400_000;

    const avecAlertes = lignes.map((ligne) => ({
      ...ligne,
      alerteStockFaible: ligne.quantite <= ligne.seuilAlerte,
      alerteRupture: ligne.quantite === 0,
      alertePeremptionProche:
        ligne.suiviDlc && ligne.dateExpiration
          ? new Date(ligne.dateExpiration).getTime() - maintenant <= seuilPeremptionMs
          : false,
    }));

    reponse.json(avecAlertes);
  })
);
