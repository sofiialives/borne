import { LIMITE_VARIATION_PRIX_PAR_HEURE } from "@borne/shared";

export function plafonnerVariationHoraire(prixPrecedent: number, prixPropose: number): {
  valeur: number;
  plafonne: boolean;
} {
  const variationMax = prixPrecedent * LIMITE_VARIATION_PRIX_PAR_HEURE;
  const borneBasse = prixPrecedent - variationMax;
  const borneHaute = prixPrecedent + variationMax;

  if (prixPropose > borneHaute) {
    return { valeur: arrondir(borneHaute), plafonne: true };
  }
  if (prixPropose < borneBasse) {
    return { valeur: arrondir(borneBasse), plafonne: true };
  }
  return { valeur: arrondir(prixPropose), plafonne: false };
}

export function appliquerPlancherMarge(
  prix: number,
  coutAchat: number,
  margeMinimale: number
): number {
  const prixPlancher = coutAchat * (1 + margeMinimale);
  return prix < prixPlancher ? arrondir(prixPlancher) : prix;
}

export function appliquerBornesProduit(prix: number, prixMin: number, prixMax: number): number {
  if (prix < prixMin) {
    return arrondir(prixMin);
  }
  if (prix > prixMax) {
    return arrondir(prixMax);
  }
  return prix;
}

function arrondir(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}
