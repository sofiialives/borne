import { Router } from "express";
import { z } from "zod";
import { enregistrerVenteLocale, listerProduitsAffichage } from "./db.js";
import { enLigne, derniereSyncLe, synchroniser } from "./sync.js";

export const routeurKiosk = Router();

routeurKiosk.get("/identite", (_requete, reponse) => {
  reponse.json({ borneId: process.env.KIOSK_BORNE_ID ?? null });
});

routeurKiosk.get("/etat", (_requete, reponse) => {
  reponse.json({ enLigne, derniereSyncLe });
});

routeurKiosk.get("/produits", (_requete, reponse) => {
  reponse.json(listerProduitsAffichage());
});

const schemaVente = z.object({
  produitId: z.string().min(1),
  quantite: z.number().int().positive(),
  prixUnitaire: z.number().positive(),
  modePaiement: z.string().default("CARTE"),
});

routeurKiosk.post("/ventes", (requete, reponse) => {
  const donnees = schemaVente.parse(requete.body);
  const vente = enregistrerVenteLocale(donnees);
  void synchroniser();
  reponse.status(201).json(vente);
});

routeurKiosk.post("/synchroniser", async (_requete, reponse) => {
  await synchroniser();
  reponse.json({ enLigne, derniereSyncLe });
});
