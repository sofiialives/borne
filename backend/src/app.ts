import express from "express";
import cors from "cors";
import { routeurAuth } from "./routes/auth.js";
import { routeurZones } from "./routes/zones.js";
import { routeurBornes } from "./routes/bornes.js";
import { routeurProduits } from "./routes/produits.js";
import { routeurPrix } from "./routes/prix.js";
import { routeurVentes } from "./routes/ventes.js";
import { routeurSync } from "./routes/sync.js";
import { routeurSimulations } from "./routes/simulations.js";
import { routeurEvenements } from "./routes/evenements.js";
import { routeurStocks } from "./routes/stocks.js";
import { exigerAuthentification } from "./middleware/auth.js";
import { gestionnaireErreurs } from "./middleware/erreurs.js";

export function creerApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/sante", (_requete, reponse) => reponse.json({ etat: "ok" }));

  app.use("/api/auth", routeurAuth);
  app.use("/api/sync", routeurSync);

  app.use("/api/zones", exigerAuthentification, routeurZones);
  app.use("/api/bornes", exigerAuthentification, routeurBornes);
  app.use("/api/produits", exigerAuthentification, routeurProduits);
  app.use("/api/prix", exigerAuthentification, routeurPrix);
  app.use("/api/ventes", exigerAuthentification, routeurVentes);
  app.use("/api/simulations", exigerAuthentification, routeurSimulations);
  app.use("/api/evenements", routeurEvenements);
  app.use("/api/stocks", exigerAuthentification, routeurStocks);

  app.use(gestionnaireErreurs);

  return app;
}
