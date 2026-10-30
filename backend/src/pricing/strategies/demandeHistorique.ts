import type {
  ContexteTarification,
  PropositionRegle,
  RegleActive,
  StrategieTarification,
} from "../types.js";

const VENTES_PAR_HEURE_REFERENCE = 3;
const SENSIBILITE = 0.04;
const VARIATION_MAX = 0.12;

export class StrategieDemandeHistorique implements StrategieTarification {
  readonly nom = "demande-historique-v1";

  calculer(contexte: ContexteTarification, _regles: RegleActive[]): PropositionRegle | null {
    const ecartDemande = contexte.ventesDernieresHeures - VENTES_PAR_HEURE_REFERENCE;
    if (ecartDemande === 0) {
      return null;
    }

    const variationBrute = ecartDemande * SENSIBILITE;
    const variation = Math.max(-VARIATION_MAX, Math.min(VARIATION_MAX, variationBrute));

    return {
      regleId: null,
      nom: "Ajustement par historique de ventes",
      facteur: 1 + variation,
      raison: `Demande récente (${contexte.ventesDernieresHeures} ventes/h) comparée à la référence (${VENTES_PAR_HEURE_REFERENCE}/h) : ajustement de ${Math.round(variation * 100)} %`,
    };
  }
}
