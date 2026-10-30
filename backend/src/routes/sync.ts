import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { ventes, stocks, prixCourants, bornes, journalTechnique, produits, zones } from "../db/schema.js";
import { enveloppeAsync } from "../middleware/erreurs.js";
import { diffuser } from "../websocket/serveur.js";
import { CANAL_WS_VENTE } from "@borne/shared";

export const routeurSync = Router();

const venteEntrante = z.object({
  localId: z.string().min(1),
  borneId: z.string().uuid(),
  produitId: z.string().uuid(),
  quantite: z.number().int().positive(),
  prixUnitaire: z.string(),
  modePaiement: z.string().default("CARTE"),
  creeLe: z.string(),
});

const schemaSync = z.object({
  borneId: z.string().uuid(),
  ventes: z.array(venteEntrante),
});

routeurSync.post(
  "/ventes",
  enveloppeAsync(async (requete, reponse) => {
    const { borneId, ventes: venteEntrantes } = schemaSync.parse(requete.body);

    const resultats: { localId: string; statut: "ACCEPTEE" | "DEJA_SYNCHRONISEE" }[] = [];

    for (const venteBrute of venteEntrantes) {
      const [existante] = await db
        .select({ id: ventes.id })
        .from(ventes)
        .where(and(eq(ventes.borneId, borneId), eq(ventes.localId, venteBrute.localId)));

      if (existante) {
        resultats.push({ localId: venteBrute.localId, statut: "DEJA_SYNCHRONISEE" });
        continue;
      }

      const montantTotal = (Number(venteBrute.prixUnitaire) * venteBrute.quantite).toFixed(2);

      const [venteInseree] = await db
        .insert(ventes)
        .values({
          localId: venteBrute.localId,
          borneId: venteBrute.borneId,
          produitId: venteBrute.produitId,
          quantite: venteBrute.quantite,
          prixUnitaire: venteBrute.prixUnitaire,
          montantTotal,
          modePaiement: venteBrute.modePaiement,
          statutSync: "SYNCHRONISE",
          creeLe: new Date(venteBrute.creeLe),
          syncLe: new Date(),
        })
        .onConflictDoNothing({ target: [ventes.borneId, ventes.localId] })
        .returning();

      if (venteInseree) {
        await db
          .update(stocks)
          .set({ quantite: sql`${stocks.quantite} - ${venteBrute.quantite}`, misAJourLe: new Date() })
          .where(and(eq(stocks.produitId, venteBrute.produitId), eq(stocks.borneId, venteBrute.borneId)));
      }

      resultats.push({ localId: venteBrute.localId, statut: "ACCEPTEE" });
    }

    await db
      .update(bornes)
      .set({ statut: "ACTIF", derniereSyncLe: new Date() })
      .where(eq(bornes.id, borneId));

    await db.insert(journalTechnique).values({
      type: "RECONNEXION",
      borneId,
      donnees: { ventesSynchronisees: resultats.filter((r) => r.statut === "ACCEPTEE").length },
    });

    diffuser({
      type: CANAL_WS_VENTE,
      donnees: { borneId, resultats },
      horodatage: new Date().toISOString(),
    });

    const prixActuels = await db.select().from(prixCourants).where(eq(prixCourants.borneId, borneId));

    reponse.json({ resultats, prixActuels });
  })
);

routeurSync.get(
  "/catalogue/:borneId",
  enveloppeAsync(async (requete, reponse) => {
    const borneId = requete.params.borneId;

    const lignes = await db
      .select({
        id: produits.id,
        sku: produits.sku,
        nom: produits.nom,
        categorie: produits.categorie,
        quantite: stocks.quantite,
        valeur: prixCourants.valeur,
        raison: prixCourants.raison,
      })
      .from(produits)
      .innerJoin(stocks, and(eq(stocks.produitId, produits.id), eq(stocks.borneId, borneId)))
      .innerJoin(
        prixCourants,
        and(eq(prixCourants.produitId, produits.id), eq(prixCourants.borneId, borneId))
      );

    reponse.json(lignes);
  })
);

routeurSync.get(
  "/prix/:borneId",
  enveloppeAsync(async (requete, reponse) => {
    const prixActuels = await db
      .select()
      .from(prixCourants)
      .where(eq(prixCourants.borneId, requete.params.borneId));
    reponse.json(prixActuels);
  })
);

routeurSync.post(
  "/deconnexion/:borneId",
  enveloppeAsync(async (requete, reponse) => {
    await db
      .update(bornes)
      .set({ statut: "HORS_LIGNE" })
      .where(eq(bornes.id, requete.params.borneId));

    await db
      .insert(journalTechnique)
      .values({ type: "DECONNEXION", borneId: requete.params.borneId });

    reponse.status(204).send();
  })
);

routeurSync.get(
  "/bornes",
  enveloppeAsync(async (_requete, reponse) => {
    const lignes = await db
      .select({
        id: bornes.id,
        nom: bornes.nom,
        statut: bornes.statut,
        zoneNom: zones.nom,
        zoneType: zones.type,
      })
      .from(bornes)
      .innerJoin(zones, eq(zones.id, bornes.zoneId));

    reponse.json(lignes);
  })
);
