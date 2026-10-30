import type {
  ContexteTarification,
  PropositionRegle,
  RegleActive,
  StrategieTarification,
} from "../types.js";

const MARGE_CIBLE = 0.35;
const PAS_AJUSTEMENT = 0.03;

export class StrategieOptimisationMarge implements StrategieTarification {
  readonly nom = "optimisation-marge-v1";

  calculer(contexte: ContexteTarification, _regles: RegleActive[]): PropositionRegle | null {
    if (contexte.coutAchatActuel <= 0) {
      return null;
    }

    const margeActuelle = (contexte.prixActuel - contexte.coutAchatActuel) / contexte.prixActuel;
    const ecartMarge = MARGE_CIBLE - margeActuelle;

    if (Math.abs(ecartMarge) < 0.02) {
      return null;
    }

    const direction = ecartMarge > 0 ? 1 : -1;

    return {
      regleId: null,
      nom: "Optimisation de marge",
      facteur: 1 + direction * PAS_AJUSTEMENT,
      raison: `Marge actuelle ${Math.round(margeActuelle * 100)} % vs cible ${Math.round(MARGE_CIBLE * 100)} % : ajustement progressif de ${Math.round(direction * PAS_AJUSTEMENT * 100)} %`,
    };
  }
}
