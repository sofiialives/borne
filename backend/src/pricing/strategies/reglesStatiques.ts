import type {
  ContexteTarification,
  PropositionRegle,
  RegleActive,
  StrategieTarification,
} from "../types.js";

function evaluerDlcStock(contexte: ContexteTarification, regle: RegleActive): PropositionRegle | null {
  const joursAvantDlc = Number(regle.parametres.joursAvantDlc ?? 1);
  const seuilStockEleve = Number(regle.parametres.seuilStockEleve ?? 10);
  const remise = Number(regle.parametres.remise ?? 0.2);

  if (!contexte.dateExpiration || contexte.quantiteStock < seuilStockEleve) {
    return null;
  }

  const heuresAvantDlc =
    (contexte.dateExpiration.getTime() - contexte.maintenant.getTime()) / 3_600_000;

  if (heuresAvantDlc > joursAvantDlc * 24) {
    return null;
  }

  return {
    regleId: regle.id,
    nom: regle.nom,
    facteur: 1 - remise,
    raison: `Péremption dans ${Math.max(0, Math.round(heuresAvantDlc))} h et stock élevé (${contexte.quantiteStock}) : remise de ${Math.round(remise * 100)} %`,
  };
}

function evaluerDemandeStock(contexte: ContexteTarification, regle: RegleActive): PropositionRegle | null {
  const seuilStockFaible = Number(regle.parametres.seuilStockFaible ?? 5);
  const ventesParHeureElevees = Number(regle.parametres.ventesParHeureElevees ?? 8);
  const majoration = Number(regle.parametres.majoration ?? 0.1);

  if (contexte.quantiteStock > seuilStockFaible || contexte.ventesDernieresHeures < ventesParHeureElevees) {
    return null;
  }

  return {
    regleId: regle.id,
    nom: regle.nom,
    facteur: 1 + majoration,
    raison: `Stock faible (${contexte.quantiteStock}) et forte demande (${contexte.ventesDernieresHeures} ventes/h) : majoration de ${Math.round(majoration * 100)} %`,
  };
}

const EVALUATEURS: Record<string, (contexte: ContexteTarification, regle: RegleActive) => PropositionRegle | null> = {
  DLC_STOCK: evaluerDlcStock,
  DEMANDE_STOCK: evaluerDemandeStock,
};

export class StrategieReglesStatiques implements StrategieTarification {
  readonly nom = "regles-statiques-v1";

  calculer(contexte: ContexteTarification, regles: RegleActive[]): PropositionRegle | null {
    const reglesTriees = [...regles].sort((a, b) => a.priorite - b.priorite);

    for (const regle of reglesTriees) {
      const evaluateur = EVALUATEURS[regle.type];
      if (!evaluateur) continue;

      const proposition = evaluateur(contexte, regle);
      if (proposition) {
        return proposition;
      }
    }

    return null;
  }
}
