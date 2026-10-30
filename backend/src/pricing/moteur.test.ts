import { describe, expect, it } from "vitest";
import { MoteurTarification } from "./moteur.js";
import { appliquerBornesProduit, appliquerPlancherMarge, plafonnerVariationHoraire } from "./contraintes.js";
import type { ContexteTarification } from "./types.js";

function contexteDeBase(partiel: Partial<ContexteTarification> = {}): ContexteTarification {
  return {
    produitId: "produit-test",
    borneId: "borne-test",
    prixReference: 2.5,
    prixActuel: 2.5,
    coutAchatActuel: 1,
    margeMinimale: 0.05,
    prixMin: 1,
    prixMax: 5,
    prixStable: false,
    quantiteStock: 50,
    seuilAlerte: 10,
    dateExpiration: null,
    ventesDernieresHeures: 0,
    maintenant: new Date(2030, 0, 1, 12),
    ...partiel,
  };
}

describe("plafonnerVariationHoraire", () => {
  it("ne laisse jamais le prix varier de plus de 15 % par rapport au prix précédent", () => {
    const resultat = plafonnerVariationHoraire(10, 20);
    expect(resultat.plafonne).toBe(true);
    expect(resultat.valeur).toBeCloseTo(11.5, 2);
  });

  it("laisse passer une variation inférieure à la limite", () => {
    const resultat = plafonnerVariationHoraire(10, 10.5);
    expect(resultat.plafonne).toBe(false);
    expect(resultat.valeur).toBeCloseTo(10.5, 2);
  });
});

describe("appliquerPlancherMarge", () => {
  it("relève le prix si la marge minimale n'est pas respectée", () => {
    const resultat = appliquerPlancherMarge(1.0, 1.0, 0.1);
    expect(resultat).toBeCloseTo(1.1, 2);
  });

  it("ne modifie pas un prix qui respecte déjà la marge", () => {
    const resultat = appliquerPlancherMarge(2.0, 1.0, 0.1);
    expect(resultat).toBe(2.0);
  });
});

describe("appliquerBornesProduit", () => {
  it("ramène un prix trop bas au prix minimum", () => {
    expect(appliquerBornesProduit(0.5, 1, 5)).toBe(1);
  });

  it("ramène un prix trop haut au prix maximum", () => {
    expect(appliquerBornesProduit(10, 1, 5)).toBe(5);
  });
});

describe("MoteurTarification", () => {
  it("ne change jamais le prix d'un produit marqué comme stable", () => {
    const moteur = new MoteurTarification();
    const resultat = moteur.calculer(
      contexteDeBase({ prixStable: true, quantiteStock: 2, seuilAlerte: 10 }),
      []
    );
    expect(resultat.prixApplique).toBe(resultat.prixPrecedent);
  });

  it("ne propose jamais un prix sous le prix minimum du produit", () => {
    const moteur = new MoteurTarification();
    const resultat = moteur.calculer(
      contexteDeBase({ quantiteStock: 500, seuilAlerte: 10, prixMin: 2.4 }),
      []
    );
    expect(resultat.prixApplique).toBeGreaterThanOrEqual(2.4);
  });

  it("ne propose jamais un prix au-dessus du prix maximum du produit", () => {
    const moteur = new MoteurTarification();
    const resultat = moteur.calculer(
      contexteDeBase({ ventesDernieresHeures: 1000, prixMax: 2.6 }),
      []
    );
    expect(resultat.prixApplique).toBeLessThanOrEqual(2.6);
  });

  it("respecte la limite de variation horaire même avec une forte demande", () => {
    const moteur = new MoteurTarification();
    const resultat = moteur.calculer(
      contexteDeBase({ prixActuel: 2.5, ventesDernieresHeures: 1000, prixMax: 100 }),
      []
    );
    expect(resultat.prixApplique).toBeLessThanOrEqual(2.5 * 1.15 + 0.001);
  });

  it("ne vend jamais sous le coût d'achat majoré de la marge minimale", () => {
    const moteur = new MoteurTarification();
    const resultat = moteur.calculer(
      contexteDeBase({ quantiteStock: 1000, seuilAlerte: 5, coutAchatActuel: 2.4, margeMinimale: 0.05 }),
      []
    );
    expect(resultat.prixApplique).toBeGreaterThanOrEqual(2.4 * 1.05 - 0.01);
  });
});
