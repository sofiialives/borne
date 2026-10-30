import "dotenv/config";
import express from "express";
import cors from "cors";
import { routeurKiosk } from "./routes.js";
import { chargerCatalogueInitial, demarrerBoucleSync } from "./sync.js";
import "./db.js";

const port = Number(process.env.KIOSK_LOCAL_PORT ?? 4100);
const intervalleSync = Number(process.env.KIOSK_SYNC_INTERVAL_MS ?? 5000);

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", routeurKiosk);

await chargerCatalogueInitial();
demarrerBoucleSync(intervalleSync);

app.listen(port, () => {
  console.log(`Serveur local de la borne disponible sur http://localhost:${port}`);
});
