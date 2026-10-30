import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { produits, stocks, prixCourants, bornes } from "../db/schema.js";
import { enveloppeAsync } from "../middleware/erreurs.js";
import { exigerAuthentification, type RequeteAuthentifiee } from "../middleware/auth.js";
import { definirModePrix, definirPrixManuel } from "../services/tarification.js";

export const routeurProduits = Router();

routeurProduits.get(
  "/",
  enveloppeAsync(async (_requete, reponse) => {
    reponse.json(await db.select().from(produits).orderBy(asc(produits.creeLe)));
  })
);

routeurProduits.get(
  "/:id/stock",
  enveloppeAsync(async (requete, reponse) => {
    reponse.json(
      await db.select().from(stocks).where(eq(stocks.produitId, requete.params.id))
    );
  })
);

routeurProduits.get(
  "/:id/prix/:borneId",
  enveloppeAsync(async (requete, reponse) => {
    const [prix] = await db
      .select()
      .from(prixCourants)
      .where(
        and(
          eq(prixCourants.produitId, requete.params.id),
          eq(prixCourants.borneId, requete.params.borneId)
        )
      );
    if (!prix) return reponse.status(404).json({ erreur: "Prix introuvable" });
    reponse.json(prix);
  })
);

routeurProduits.get(
  "/:id/prix",
  enveloppeAsync(async (requete, reponse) => {
    const lignes = await db
      .select({
        borneId: prixCourants.borneId,
        borneNom: bornes.nom,
        valeur: prixCourants.valeur,
        mode: prixCourants.mode,
        raison: prixCourants.raison,
        misAJourLe: prixCourants.misAJourLe,
      })
      .from(prixCourants)
      .innerJoin(bornes, eq(bornes.id, prixCourants.borneId))
      .where(eq(prixCourants.produitId, requete.params.id));
    reponse.json(lignes);
  })
);

const schemaCreation = z.object({
  sku: z.string().min(1),
  nom: z.string().min(1),
  description: z.string().default(""),
  categorie: z.string().min(1),
  prixReference: z.string(),
  coutAchatActuel: z.string(),
  prixMin: z.string(),
  prixMax: z.string(),
  prixStable: z.boolean().default(false),
  suiviDlc: z.boolean().default(false),
  dureeConservationJours: z.number().int().positive().nullable().default(null),
  margeMinimale: z.string().default("0.05"),
});

routeurProduits.post(
  "/",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const donnees = schemaCreation.parse(requete.body);
    if (Number(donnees.prixMin) > Number(donnees.prixMax)) {
      reponse.status(400).json({ erreur: "Le prix minimum doit être inférieur au prix maximum" });
      return;
    }
    const produit = await db.transaction(async (tx) => {
      const [nouveauProduit] = await tx.insert(produits).values(donnees).returning();
      const bornesActives = await tx.select().from(bornes).where(eq(bornes.statut, "ACTIF"));
      for (const borne of bornesActives) {
        await tx.insert(stocks).values({
          produitId: nouveauProduit.id,
          borneId: borne.id,
          quantite: 0,
          seuilAlerte: 6,
        });
        await tx.insert(prixCourants).values({
          produitId: nouveauProduit.id,
          borneId: borne.id,
          valeur: nouveauProduit.prixReference,
          mode: "AUTOMATIQUE",
          source: "MANUEL",
          raison: "Initialisation au prix de référence à la création du produit",
        });
      }
      return nouveauProduit;
    });
    reponse.status(201).json(produit);
  })
);

const schemaMiseAJour = schemaCreation.partial().extend({ actif: z.boolean().optional() });

routeurProduits.patch(
  "/:id",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const donnees = schemaMiseAJour.parse(requete.body);
    const [produit] = await db
      .update(produits)
      .set({ ...donnees, misAJourLe: new Date() })
      .where(eq(produits.id, requete.params.id))
      .returning();
    if (!produit) {
      reponse.status(404).json({ erreur: "Produit introuvable" });
      return;
    }
    reponse.json(produit);
  })
);

routeurProduits.delete(
  "/:id",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    await db
      .update(produits)
      .set({ actif: false, misAJourLe: new Date() })
      .where(eq(produits.id, requete.params.id));
    reponse.status(204).send();
  })
);

const schemaMiseAJourStock = z.object({
  quantite: z.number().int().min(0),
  dateExpiration: z.string().datetime().nullable().optional(),
});

routeurProduits.patch(
  "/:id/stock/:borneId",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const { quantite, dateExpiration } = schemaMiseAJourStock.parse(requete.body);
    const [stock] = await db
      .update(stocks)
      .set({
        quantite,
        ...(dateExpiration !== undefined
          ? { dateExpiration: dateExpiration ? new Date(dateExpiration) : null }
          : {}),
        misAJourLe: new Date(),
      })
      .where(
        and(
          eq(stocks.produitId, requete.params.id),
          eq(stocks.borneId, requete.params.borneId)
        )
      )
      .returning();
    reponse.json(stock);
  })
);

const schemaModePrix = z.object({
  mode: z.enum(["AUTOMATIQUE", "MANUEL", "FIXE"]),
});

routeurProduits.patch(
  "/:id/mode/:borneId",
  exigerAuthentification,
  enveloppeAsync(async (requete: RequeteAuthentifiee, reponse) => {
    const { mode } = schemaModePrix.parse(requete.body);
    await definirModePrix(
      requete.params.id,
      requete.params.borneId,
      mode,
      requete.utilisateur?.id ?? null
    );
    reponse.status(204).send();
  })
);

const schemaPrixManuel = z.object({
  valeur: z.number().positive(),
  raison: z.string().min(1),
});

routeurProduits.patch(
  "/:id/prix/:borneId",
  exigerAuthentification,
  enveloppeAsync(async (requete: RequeteAuthentifiee, reponse) => {
    const { valeur, raison } = schemaPrixManuel.parse(requete.body);
    try {
      await definirPrixManuel(
        requete.params.id,
        requete.params.borneId,
        valeur,
        raison,
        requete.utilisateur?.id ?? null
      );
      reponse.status(204).send();
    } catch (erreur) {
      reponse.status(400).json({ erreur: (erreur as Error).message });
    }
  })
);
