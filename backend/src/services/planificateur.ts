import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { bornes, prixCourants } from "../db/schema.js";
import { recalculerPrix } from "./tarification.js";
import { INTERVALLE_RECALCUL_PRIX_MS } from "@borne/shared";

export function demarrerRecalculPeriodique(): NodeJS.Timeout {
  return setInterval(async () => {
    const bornesActives = await db.select().from(bornes).where(eq(bornes.statut, "ACTIF"));

    for (const borne of bornesActives) {
      const prixDeLaBorne = await db
        .select()
        .from(prixCourants)
        .where(eq(prixCourants.borneId, borne.id));

      for (const prix of prixDeLaBorne) {
        try {
          await recalculerPrix(prix.produitId, prix.borneId);
        } catch (erreur) {
          console.error(`Échec du recalcul pour ${prix.produitId}/${prix.borneId}`, erreur);
        }
      }
    }
  }, INTERVALLE_RECALCUL_PRIX_MS);
}
