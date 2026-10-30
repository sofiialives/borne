import {
  appliquerBornesProduit,
  appliquerPlancherMarge,
  plafonnerVariationHoraire,
} from "./contraintes.js";
import { creerStrategieActive } from "./strategies/index.js";
import type { ContexteTarification, RegleActive, ResultatMoteur } from "./types.js";

export class MoteurTarification {
  private readonly strategie = creerStrategieActive();

  calculer(contexte: ContexteTarification, regles: RegleActive[]): ResultatMoteur {
    if (contexte.prixStable) {
      return {
        prixPrecedent: contexte.prixActuel,
        prixPropose: contexte.prixActuel,
        prixApplique: contexte.prixActuel,
        raison: "Produit à prix stable : tarification automatique désactivée",
        regleId: null,
        plafonneParLimite: false,
      };
    }

    const proposition = this.strategie.calculer(contexte, regles);

    if (!proposition) {
      const prixPlancher = appliquerPlancherMarge(
        contexte.prixActuel,
        contexte.coutAchatActuel,
        contexte.margeMinimale
      );
      const { valeur: prixPlafonne } = plafonnerVariationHoraire(contexte.prixActuel, prixPlancher);
      const prixCorrige = appliquerBornesProduit(prixPlafonne, contexte.prixMin, contexte.prixMax);

      return {
        prixPrecedent: contexte.prixActuel,
        prixPropose: contexte.prixActuel,
        prixApplique: prixCorrige,
        raison:
          prixCorrige === contexte.prixActuel
            ? "Aucune règle applicable : prix inchangé"
            : "Aucune règle applicable : prix corrigé pour respecter la marge ou les bornes du produit",
        regleId: null,
        plafonneParLimite: false,
      };
    }

    const prixBrut = contexte.prixActuel * proposition.facteur;
    const { valeur: prixPlafonne, plafonne } = plafonnerVariationHoraire(
      contexte.prixActuel,
      prixBrut
    );
    const prixAvecMarge = appliquerPlancherMarge(
      prixPlafonne,
      contexte.coutAchatActuel,
      contexte.margeMinimale
    );
    const prixFinal = appliquerBornesProduit(prixAvecMarge, contexte.prixMin, contexte.prixMax);

    const raisonComplete = plafonne
      ? `${proposition.raison} (plafonné à ±15 %/h)`
      : proposition.raison;

    return {
      prixPrecedent: contexte.prixActuel,
      prixPropose: Math.round(prixBrut * 100) / 100,
      prixApplique: prixFinal,
      raison: raisonComplete,
      regleId: proposition.regleId,
      plafonneParLimite: plafonne,
    };
  }
}
