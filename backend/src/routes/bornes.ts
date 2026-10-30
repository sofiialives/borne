import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { bornes, produits, stocks, prixCourants, zones } from "../db/schema.js";
import { enveloppeAsync } from "../middleware/erreurs.js";
import { diffuser } from "../websocket/serveur.js";
import { CANAL_WS_BORNE } from "@borne/shared";
import { exigerAuthentification } from "../middleware/auth.js";

export const routeurBornes = Router();

routeurBornes.get(
  "/",
  enveloppeAsync(async (_requete, reponse) => {
    const lignes = await db
      .select({
        id: bornes.id,
        nom: bornes.nom,
        statut: bornes.statut,
        derniereSyncLe: bornes.derniereSyncLe,
        creeLe: bornes.creeLe,
        zoneId: zones.id,
        zoneNom: zones.nom,
        zoneType: zones.type,
      })
      .from(bornes)
      .innerJoin(zones, eq(zones.id, bornes.zoneId))
      .orderBy(asc(bornes.creeLe));
    reponse.json(lignes);
  })
);

const schemaCreation = z.object({
  nom: z.string().min(1),
  zoneId: z.string().uuid(),
});

routeurBornes.post(
  "/",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const donnees = schemaCreation.parse(requete.body);
    const [borne] = await db.insert(bornes).values(donnees).returning();

    const tousProduits = await db.select().from(produits);
    for (const produit of tousProduits) {
      await db.insert(stocks).values({ produitId: produit.id, borneId: borne.id, quantite: 0 });
      await db.insert(prixCourants).values({
        produitId: produit.id,
        borneId: borne.id,
        valeur: produit.prixReference,
        mode: "AUTOMATIQUE",
        source: "MANUEL",
        raison: "Initialisation au prix de référence",
      });
    }

    reponse.status(201).json(borne);
  })
);

const schemaMiseAJour = z.object({
  nom: z.string().min(1).optional(),
  zoneId: z.string().uuid().optional(),
});

routeurBornes.patch(
  "/:id",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const donnees = schemaMiseAJour.parse(requete.body);
    const [borne] = await db
      .update(bornes)
      .set(donnees)
      .where(eq(bornes.id, requete.params.id))
      .returning();
    if (!borne) {
      reponse.status(404).json({ erreur: "Borne introuvable" });
      return;
    }
    reponse.json(borne);
  })
);

const schemaStatut = z.object({
  statut: z.enum(["ACTIF", "HORS_LIGNE", "MAINTENANCE"]),
});

routeurBornes.patch(
  "/:id/statut",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const { statut } = schemaStatut.parse(requete.body);
    const [borne] = await db
      .update(bornes)
      .set({ statut, derniereSyncLe: statut === "ACTIF" ? new Date() : undefined })
      .where(eq(bornes.id, requete.params.id))
      .returning();

    diffuser({
      type: CANAL_WS_BORNE,
      donnees: { borneId: borne.id, statut: borne.statut },
      horodatage: new Date().toISOString(),
    });

    reponse.json(borne);
  })
);
