import { Router } from "express";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { zones, bornes, ventes } from "../db/schema.js";
import { enveloppeAsync } from "../middleware/erreurs.js";
import { CONFIG_DEMANDE_PAR_DEFAUT } from "@borne/shared";
import { exigerAuthentification } from "../middleware/auth.js";

export const routeurZones = Router();

routeurZones.get(
  "/",
  enveloppeAsync(async (_requete, reponse) => {
    const resultat = await db.select().from(zones).orderBy(asc(zones.creeLe));
    reponse.json(resultat);
  })
);

const schemaConfigDemande = z.object({
  multiplicateurHeurePointe: z.number().positive(),
  heuresPointe: z.array(z.number().int().min(0).max(23)),
  multiplicateurWeekEnd: z.number().positive(),
});

const schemaCreation = z.object({
  nom: z.string().min(1),
  type: z.enum(["GARE", "CAMPUS", "ZONE_AFFAIRES"]),
  fuseauHoraire: z.string().default("Europe/Paris"),
  configDemande: schemaConfigDemande.optional(),
});

routeurZones.post(
  "/",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const donnees = schemaCreation.parse(requete.body);
    const configDemande = donnees.configDemande ?? CONFIG_DEMANDE_PAR_DEFAUT[donnees.type];
    const [zone] = await db
      .insert(zones)
      .values({ ...donnees, configDemande })
      .returning();
    reponse.status(201).json(zone);
  })
);

const schemaMiseAJour = z.object({
  nom: z.string().min(1).optional(),
  configDemande: schemaConfigDemande.optional(),
});

routeurZones.patch(
  "/:id",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const donnees = schemaMiseAJour.parse(requete.body);
    const [zone] = await db
      .update(zones)
      .set(donnees)
      .where(eq(zones.id, requete.params.id))
      .returning();
    if (!zone) {
      reponse.status(404).json({ message: "Zone introuvable" });
      return;
    }
    reponse.json(zone);
  })
);

routeurZones.delete(
  "/:id",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const bornesRattachees = await db
      .select()
      .from(bornes)
      .where(eq(bornes.zoneId, requete.params.id));
    if (bornesRattachees.length > 0) {
      reponse.status(409).json({
        erreur: "Impossible de supprimer : des bornes sont encore rattachées à cette zone",
      });
      return;
    }
    const [supprimee] = await db.delete(zones).where(eq(zones.id, requete.params.id)).returning();
    if (!supprimee) {
      reponse.status(404).json({ erreur: "Zone introuvable" });
      return;
    }
    reponse.status(204).send();
  })
);

routeurZones.get(
  "/:id/performance",
  exigerAuthentification,
  enveloppeAsync(async (requete, reponse) => {
    const zoneId = requete.params.id;
    const bornesZone = await db.select().from(bornes).where(eq(bornes.zoneId, zoneId));
    const bornesIds = bornesZone.map((b) => b.id);

    const toutesLesVentes = await db.select().from(ventes);
    const ventesZone = toutesLesVentes.filter((vente) => bornesIds.includes(vente.borneId));

    const chiffreAffaires = ventesZone.reduce((total, v) => total + Number(v.montantTotal), 0);
    const unitesVendues = ventesZone.reduce((total, v) => total + v.quantite, 0);

    reponse.json({
      zoneId,
      nombreBornes: bornesZone.length,
      nombreVentes: ventesZone.length,
      chiffreAffaires: chiffreAffaires.toFixed(2),
      unitesVendues,
    });
  })
);
