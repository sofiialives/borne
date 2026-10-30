import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { prixCourants, prixHistorique } from "../db/schema.js";
import { enveloppeAsync } from "../middleware/erreurs.js";
import { definirPrixManuel, recalculerPrix } from "../services/tarification.js";
import { exigerAuthentification, type RequeteAuthentifiee } from "../middleware/auth.js";

export const routeurPrix = Router();

routeurPrix.get(
  "/courants",
  enveloppeAsync(async (requete, reponse) => {
    const borneId = requete.query.borneId as string | undefined;
    const requeteBase = db.select().from(prixCourants);
    reponse.json(borneId ? await requeteBase.where(eq(prixCourants.borneId, borneId)) : await requeteBase);
  })
);

routeurPrix.get(
  "/historique/:produitId/:borneId",
  enveloppeAsync(async (requete, reponse) => {
    const historique = await db
      .select()
      .from(prixHistorique)
      .where(
        and(
          eq(prixHistorique.produitId, requete.params.produitId),
          eq(prixHistorique.borneId, requete.params.borneId)
        )
      )
      .orderBy(desc(prixHistorique.creeLe))
      .limit(100);
    reponse.json(historique);
  })
);

const schemaManuel = z.object({
  valeur: z.number().positive(),
  raison: z.string().min(1),
});

routeurPrix.put(
  "/:produitId/:borneId",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const { valeur, raison } = schemaManuel.parse(requete.body);
    const utilisateurId = (requete as RequeteAuthentifiee).utilisateur?.id ?? null;
    try {
      await definirPrixManuel(
        requete.params.produitId,
        requete.params.borneId,
        valeur,
        raison,
        utilisateurId
      );
      reponse.status(204).send();
    } catch (erreur) {
      reponse.status(400).json({ erreur: (erreur as Error).message });
    }
  })
);

routeurPrix.post(
  "/:produitId/:borneId/recalculer",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const resultat = await recalculerPrix(requete.params.produitId, requete.params.borneId);
    reponse.json(resultat);
  })
);
