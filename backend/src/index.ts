import "dotenv/config";
import { createServer } from "node:http";
import { creerApp } from "./app.js";
import { demarrerServeurWs } from "./websocket/serveur.js";
import { demarrerRecalculPeriodique } from "./services/planificateur.js";

const port = Number(process.env.PORT ?? 4000);

const app = creerApp();
const serveurHttp = createServer(app);

demarrerServeurWs(serveurHttp);
demarrerRecalculPeriodique();

serveurHttp.listen(port, () => {
  console.log(`API disponible sur http://localhost:${port}`);
  console.log(`WebSocket disponible sur ws://localhost:${port}/ws`);
});
