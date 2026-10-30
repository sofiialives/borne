import type { StrategieTarification } from "../types.js";
import { StrategieReglesStatiques } from "./reglesStatiques.js";
import { StrategieDemandeHistorique } from "./demandeHistorique.js";
import { StrategieOptimisationMarge } from "./optimisationMarge.js";

const strategiesDisponibles: Record<string, () => StrategieTarification> = {
  "regles-statiques-v1": () => new StrategieReglesStatiques(),
  "demande-historique-v1": () => new StrategieDemandeHistorique(),
  "optimisation-marge-v1": () => new StrategieOptimisationMarge(),
};

export function creerStrategieActive(): StrategieTarification {
  const nomStrategie = process.env.MOTEUR_STRATEGIE ?? "regles-statiques-v1";
  const fabrique = strategiesDisponibles[nomStrategie];

  if (!fabrique) {
    throw new Error(`Stratégie de tarification inconnue : ${nomStrategie}`);
  }

  return fabrique();
}

export type { StrategieTarification };
