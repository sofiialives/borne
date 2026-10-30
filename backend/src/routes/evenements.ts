import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { evenements, zones } from "../db/schema.js";
import { enveloppeAsync } from "../middleware/erreurs.js";
import { exigerAuthentification } from "../middleware/auth.js";

export const routeurEvenements = Router();

routeurEvenements.get(
  "/",
  enveloppeAsync(async (_requete, reponse) => {
    const lignes = await db
      .select({
        id: evenements.id,
        nom: evenements.nom,
        description: evenements.description,
        zoneId: evenements.zoneId,
        zoneNom: zones.nom,
        dateDebut: evenements.dateDebut,
        dateFin: evenements.dateFin,
        impactDemande: evenements.impactDemande,
        actif: evenements.actif,
        creeLe: evenements.creeLe,
      })
      .from(evenements)
      .innerJoin(zones, eq(zones.id, evenements.zoneId))
      .orderBy(desc(evenements.dateDebut));
    reponse.json(lignes);
  })
);

const schemaCreation = z.object({
  nom: z.string().min(1),
  description: z.string().default(""),
  zoneId: z.string().uuid(),
  dateDebut: z.string(),
  dateFin: z.string(),
  impactDemande: z.number().positive().default(1),
  actif: z.boolean().default(true),
});

routeurEvenements.post(
  "/",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const donnees = schemaCreation.parse(requete.body);
    const [evenement] = await db
      .insert(evenements)
      .values({
        ...donnees,
        dateDebut: new Date(donnees.dateDebut),
        dateFin: new Date(donnees.dateFin),
        impactDemande: donnees.impactDemande.toFixed(2),
      })
      .returning();
    reponse.status(201).json(evenement);
  })
);

const schemaMiseAJour = z.object({
  nom: z.string().min(1).optional(),
  description: z.string().optional(),
  actif: z.boolean().optional(),
  impactDemande: z.number().positive().optional(),
});

routeurEvenements.patch(
  "/:id",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const donnees = schemaMiseAJour.parse(requete.body);
    const [evenement] = await db
      .update(evenements)
      .set({
        ...donnees,
        impactDemande: donnees.impactDemande?.toFixed(2),
      })
      .where(eq(evenements.id, requete.params.id))
      .returning();
    if (!evenement) {
      reponse.status(404).json({ erreur: "Événement introuvable" });
      return;
    }
    reponse.json(evenement);
  })
);
