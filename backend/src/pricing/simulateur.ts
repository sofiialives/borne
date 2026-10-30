import { MoteurTarification } from "./moteur.js";
import type { ContexteTarification, RegleActive } from "./types.js";

export interface ParametresSimulation {
  graine: string;
  dureeJours: number;
  prixReference: number;
  coutAchatActuel: number;
  margeMinimale: number;
  prixMin: number;
  prixMax: number;
  stockInitial: number;
  seuilAlerte: number;
  demandeMoyenneParJour: number;
  volatiliteDemande: number;
  elasticitePrix: number;
  cycleReapprovisionnementJours: number;
  dureeConservationJours: number;
  multiplicateurHeurePointe: number;
  multiplicateurWeekEnd: number;
}

export interface PointEvolutionPrix {
  jour: number;
  prixMoyen: number;
}

export interface ResultatSimulationStrategie {
  strategie: "DYNAMIQUE" | "FIXE";
  margeCumulee: number;
  chiffreAffaires: number;
  unitesVendues: number;
  unitesGaspillees: number;
  evolutionPrix: PointEvolutionPrix[];
}

function construireReglesSimulation(parametres: ParametresSimulation): RegleActive[] {
  const heuresOperationParJour = 12;
  const ventesParHeureMoyennes = parametres.demandeMoyenneParJour / heuresOperationParJour;

  return [
    {
      id: "simulation-dlc-stock",
      nom: "Péremption proche + stock élevé",
      type: "DLC_STOCK",
      priorite: 10,
      parametres: {
        joursAvantDlc: Math.max(1, Math.round(parametres.dureeConservationJours / 2)),
        seuilStockEleve: Math.round(parametres.stockInitial * 0.5),
        remise: 0.2,
      },
    },
    {
      id: "simulation-demande-stock",
      nom: "Forte demande + stock faible",
      type: "DEMANDE_STOCK",
      priorite: 20,
      parametres: {
        seuilStockFaible: Math.max(1, Math.round(parametres.stockInitial * 0.2)),
        ventesParHeureElevees: Math.max(1, Math.round(ventesParHeureMoyennes * 1.3)),
        majoration: 0.12,
      },
    },
  ];
}

function creerGenerateur(graine: string) {
  let etat = 0;
  for (let i = 0; i < graine.length; i += 1) {
    etat = (etat * 31 + graine.charCodeAt(i)) >>> 0;
  }
  return function suivant(): number {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function genererDemandesJournalieres(parametres: ParametresSimulation): number[] {
  const genererAleatoire = creerGenerateur(parametres.graine);
  const demandes: number[] = [];

  for (let jour = 0; jour < parametres.dureeJours; jour += 1) {
    const estWeekEnd = jour % 7 === 5 || jour % 7 === 6;
    const multiplicateur = estWeekEnd ? parametres.multiplicateurWeekEnd : 1;
    const bruit = 1 + (genererAleatoire() * 2 - 1) * parametres.volatiliteDemande;
    const demande = parametres.demandeMoyenneParJour * multiplicateur * bruit;
    demandes.push(Math.max(0, Math.round(demande)));
  }

  return demandes;
}

function appliquerElasticitePrix(
  demandeBase: number,
  prixDuJour: number,
  prixReference: number,
  elasticitePrix: number
): number {
  const variationRelative = prixDuJour / prixReference - 1;
  const facteur = Math.min(1.8, Math.max(0.3, 1 - elasticitePrix * variationRelative));
  return Math.max(0, Math.round(demandeBase * facteur));
}

function simulerStrategie(
  strategie: "DYNAMIQUE" | "FIXE",
  parametres: ParametresSimulation,
  demandesJournalieres: number[]
): ResultatSimulationStrategie {
  const moteur = new MoteurTarification();
  const regles = construireReglesSimulation(parametres);
  const heuresOperationParJour = 12;

  let margeCumulee = 0;
  let chiffreAffaires = 0;
  let unitesVendues = 0;
  let unitesGaspillees = 0;
  let prixActuel = parametres.prixReference;
  let stock = 0;
  let ageStockJours = 0;
  let ventesDerniereHeureApprox = 0;
  const evolutionPrix: PointEvolutionPrix[] = [];

  for (let jour = 0; jour < parametres.dureeJours; jour += 1) {
    if (jour % parametres.cycleReapprovisionnementJours === 0) {
      if (stock > 0) {
        unitesGaspillees += stock;
      }
      stock = parametres.stockInitial;
      ageStockJours = 0;
    } else if (ageStockJours >= parametres.dureeConservationJours && stock > 0) {
      unitesGaspillees += stock;
      stock = 0;
    }

    const joursRestantsAvantPeremption = parametres.dureeConservationJours - ageStockJours;
    const dateExpiration = new Date(
      2030,
      0,
      1 + jour + Math.max(0, joursRestantsAvantPeremption),
      23
    );

    let prixDuJour = parametres.prixReference;

    if (strategie === "DYNAMIQUE") {
      const contexte: ContexteTarification = {
        produitId: "simulation",
        borneId: "simulation",
        prixReference: parametres.prixReference,
        prixActuel,
        coutAchatActuel: parametres.coutAchatActuel,
        margeMinimale: parametres.margeMinimale,
        prixMin: parametres.prixMin,
        prixMax: parametres.prixMax,
        prixStable: false,
        quantiteStock: stock,
        seuilAlerte: parametres.seuilAlerte,
        dateExpiration,
        ventesDernieresHeures: ventesDerniereHeureApprox,
        maintenant: new Date(2030, 0, 1 + jour, 12),
      };

      const resultat = moteur.calculer(contexte, regles);
      prixDuJour = resultat.prixApplique;
    }

    prixActuel = prixDuJour;

    const demandeBase = demandesJournalieres[jour];
    const demandeRealisee = appliquerElasticitePrix(
      demandeBase,
      prixDuJour,
      parametres.prixReference,
      parametres.elasticitePrix
    );

    const unitesJour = Math.min(demandeRealisee, stock);
    stock -= unitesJour;
    ageStockJours += 1;

    const revenuJour = unitesJour * prixDuJour;
    const margeJour = unitesJour * (prixDuJour - parametres.coutAchatActuel);

    margeCumulee += margeJour;
    chiffreAffaires += revenuJour;
    unitesVendues += unitesJour;
    ventesDerniereHeureApprox = Math.round(unitesJour / heuresOperationParJour);
    evolutionPrix.push({ jour, prixMoyen: Math.round(prixDuJour * 100) / 100 });
  }

  if (stock > 0) {
    unitesGaspillees += stock;
  }

  return {
    strategie,
    margeCumulee,
    chiffreAffaires,
    unitesVendues,
    unitesGaspillees,
    evolutionPrix,
  };
}

export function executerSimulation(parametres: ParametresSimulation): {
  dynamique: ResultatSimulationStrategie;
  fixe: ResultatSimulationStrategie;
  gainMargePourcent: number;
} {
  const demandesJournalieres = genererDemandesJournalieres(parametres);

  const fixe = simulerStrategie("FIXE", parametres, demandesJournalieres);
  const dynamique = simulerStrategie("DYNAMIQUE", parametres, demandesJournalieres);

  const gainMargePourcent =
    fixe.margeCumulee > 0
      ? Math.round(((dynamique.margeCumulee - fixe.margeCumulee) / fixe.margeCumulee) * 10000) / 100
      : 0;

  return { dynamique, fixe, gainMargePourcent };
}
