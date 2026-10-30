import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { simulationRuns, simulationResultats, produits, zones } from "../db/schema.js";
import { enveloppeAsync } from "../middleware/erreurs.js";
import { exigerAuthentification, type RequeteAuthentifiee } from "../middleware/auth.js";
import { executerSimulation, type ParametresSimulation } from "../pricing/simulateur.js";
import { diffuser } from "../websocket/serveur.js";
import { CANAL_WS_SIMULATION, DUREE_SIMULATION_JOURS_DEFAUT } from "@borne/shared";

export const routeurSimulations = Router();

routeurSimulations.get(
  "/",
  exigerAuthentification,
  enveloppeAsync(async (_requete, reponse) => {
    const runs = await db
      .select()
      .from(simulationRuns)
      .orderBy(desc(simulationRuns.creeLe))
      .limit(50);

    const avecResultats = await Promise.all(
      runs.map(async (run) => ({
        ...run,
        resultats: await db
          .select()
          .from(simulationResultats)
          .where(eq(simulationResultats.simulationRunId, run.id)),
      }))
    );

    reponse.json(avecResultats);
  })
);

routeurSimulations.post(
  "/executer-auto",
  exigerAuthentification,
  enveloppeAsync(async (requete: RequeteAuthentifiee, reponse) => {
    const catalogue = await db.select().from(produits).where(eq(produits.actif, true));
    const toutesZones = await db.select().from(zones);

    if (catalogue.length === 0 || toutesZones.length === 0) {
      reponse.status(400).json({ erreur: "Aucun produit ou aucune zone à simuler" });
      return;
    }

    const dureeJours = DUREE_SIMULATION_JOURS_DEFAUT;
    let margeDynamique = 0;
    let margeFixe = 0;
    let caDynamique = 0;
    let caFixe = 0;
    let unitesDynamique = 0;
    let unitesFixe = 0;
    let gaspillesDynamique = 0;
    let gaspillesFixe = 0;
    const sommeEvolutionDynamique = new Array(dureeJours).fill(0);
    const sommeEvolutionFixe = new Array(dureeJours).fill(0);
    let combinaisons = 0;

    for (const zone of toutesZones) {
      const configDemande = zone.configDemande as {
        multiplicateurHeurePointe?: number;
        multiplicateurWeekEnd?: number;
      };
      for (const produit of catalogue) {
        const parametres: ParametresSimulation = {
          graine: `auto-${zone.id}-${produit.id}`,
          dureeJours,
          prixReference: Number(produit.prixReference),
          coutAchatActuel: Number(produit.coutAchatActuel),
          margeMinimale: Number(produit.margeMinimale),
          prixMin: Number(produit.prixMin),
          prixMax: Number(produit.prixMax),
          stockInitial: 25,
          seuilAlerte: 6,
          demandeMoyenneParJour: 15,
          volatiliteDemande: 0.3,
          elasticitePrix: 0.5,
          cycleReapprovisionnementJours: 3,
          dureeConservationJours: produit.dureeConservationJours ?? 3,
          multiplicateurHeurePointe: configDemande?.multiplicateurHeurePointe ?? 1.2,
          multiplicateurWeekEnd: configDemande?.multiplicateurWeekEnd ?? 0.7,
        };

        const resultat = executerSimulation(parametres);
        margeDynamique += resultat.dynamique.margeCumulee;
        margeFixe += resultat.fixe.margeCumulee;
        caDynamique += resultat.dynamique.chiffreAffaires;
        caFixe += resultat.fixe.chiffreAffaires;
        unitesDynamique += resultat.dynamique.unitesVendues;
        unitesFixe += resultat.fixe.unitesVendues;
        gaspillesDynamique += resultat.dynamique.unitesGaspillees;
        gaspillesFixe += resultat.fixe.unitesGaspillees;
        resultat.dynamique.evolutionPrix.forEach((point, index) => {
          sommeEvolutionDynamique[index] += point.prixMoyen;
        });
        resultat.fixe.evolutionPrix.forEach((point, index) => {
          sommeEvolutionFixe[index] += point.prixMoyen;
        });
        combinaisons += 1;
      }
    }

    const evolutionPrixDynamique = sommeEvolutionDynamique.map((somme, jour) => ({
      jour,
      prixMoyen: Math.round((somme / combinaisons) * 100) / 100,
    }));
    const evolutionPrixFixe = sommeEvolutionFixe.map((somme, jour) => ({
      jour,
      prixMoyen: Math.round((somme / combinaisons) * 100) / 100,
    }));
    const gainMargePourcent =
      margeFixe > 0 ? Math.round(((margeDynamique - margeFixe) / margeFixe) * 10000) / 100 : 0;

    const [run] = await db
      .insert(simulationRuns)
      .values({
        nom: `Simulation globale automatique (${dureeJours} jours, toutes zones)`,
        dureeJours,
        zoneId: null,
        parametres: { mode: "auto", produits: catalogue.length, zones: toutesZones.length },
        creeParUtilisateurId: requete.utilisateur?.id ?? null,
      })
      .returning();

    const [resultatDynamique, resultatFixe] = await db
      .insert(simulationResultats)
      .values([
        {
          simulationRunId: run.id,
          strategie: "DYNAMIQUE",
          margeCumulee: margeDynamique.toFixed(2),
          chiffreAffaires: caDynamique.toFixed(2),
          unitesVendues: unitesDynamique,
          unitesGaspillees: gaspillesDynamique,
          evolutionPrix: evolutionPrixDynamique,
        },
        {
          simulationRunId: run.id,
          strategie: "FIXE",
          margeCumulee: margeFixe.toFixed(2),
          chiffreAffaires: caFixe.toFixed(2),
          unitesVendues: unitesFixe,
          unitesGaspillees: gaspillesFixe,
          evolutionPrix: evolutionPrixFixe,
        },
      ])
      .returning();

    diffuser({
      type: CANAL_WS_SIMULATION,
      donnees: { runId: run.id, gainMargePourcent },
      horodatage: new Date().toISOString(),
    });

    reponse.status(201).json({
      run,
      resultats: [resultatDynamique, resultatFixe],
      gainMargePourcent,
      modeDemonstration: true,
    });
  })
);

const schemaSimulation = z.object({
  nom: z.string().min(1),
  zoneId: z.string().uuid().nullable().default(null),
  dureeJours: z.number().int().min(7).max(365).default(DUREE_SIMULATION_JOURS_DEFAUT),
  prixReference: z.number().positive(),
  coutAchatActuel: z.number().positive(),
  margeMinimale: z.number().min(0).max(1).default(0.05),
  prixMin: z.number().positive(),
  prixMax: z.number().positive(),
  stockInitial: z.number().int().positive(),
  seuilAlerte: z.number().int().min(0).default(10),
  demandeMoyenneParJour: z.number().positive(),
  volatiliteDemande: z.number().min(0).max(1).default(0.3),
  elasticitePrix: z.number().min(0).max(2).default(0.5),
  cycleReapprovisionnementJours: z.number().int().min(1).max(30).default(7),
  dureeConservationJours: z.number().int().min(1).max(30).default(3),
  multiplicateurHeurePointe: z.number().positive().default(1.2),
  multiplicateurWeekEnd: z.number().positive().default(0.7),
});

routeurSimulations.post(
  "/executer",
  exigerAuthentification,
  enveloppeAsync(async (requete: RequeteAuthentifiee, reponse) => {
    const entree = schemaSimulation.parse(requete.body);

    const resultat = executerSimulation({
      graine: `${entree.nom}-${entree.dureeJours}-${entree.prixReference}`,
      dureeJours: entree.dureeJours,
      prixReference: entree.prixReference,
      coutAchatActuel: entree.coutAchatActuel,
      margeMinimale: entree.margeMinimale,
      prixMin: entree.prixMin,
      prixMax: entree.prixMax,
      stockInitial: entree.stockInitial,
      seuilAlerte: entree.seuilAlerte,
      demandeMoyenneParJour: entree.demandeMoyenneParJour,
      volatiliteDemande: entree.volatiliteDemande,
      elasticitePrix: entree.elasticitePrix,
      cycleReapprovisionnementJours: entree.cycleReapprovisionnementJours,
      dureeConservationJours: entree.dureeConservationJours,
      multiplicateurHeurePointe: entree.multiplicateurHeurePointe,
      multiplicateurWeekEnd: entree.multiplicateurWeekEnd,
    });

    const [run] = await db
      .insert(simulationRuns)
      .values({
        nom: entree.nom,
        dureeJours: entree.dureeJours,
        zoneId: entree.zoneId,
        parametres: entree,
        creeParUtilisateurId: requete.utilisateur?.id ?? null,
      })
      .returning();

    const [resultatDynamique, resultatFixe] = await db
      .insert(simulationResultats)
      .values([
        {
          simulationRunId: run.id,
          strategie: "DYNAMIQUE",
          margeCumulee: resultat.dynamique.margeCumulee.toFixed(2),
          chiffreAffaires: resultat.dynamique.chiffreAffaires.toFixed(2),
          unitesVendues: resultat.dynamique.unitesVendues,
          unitesGaspillees: resultat.dynamique.unitesGaspillees,
          evolutionPrix: resultat.dynamique.evolutionPrix,
        },
        {
          simulationRunId: run.id,
          strategie: "FIXE",
          margeCumulee: resultat.fixe.margeCumulee.toFixed(2),
          chiffreAffaires: resultat.fixe.chiffreAffaires.toFixed(2),
          unitesVendues: resultat.fixe.unitesVendues,
          unitesGaspillees: resultat.fixe.unitesGaspillees,
          evolutionPrix: resultat.fixe.evolutionPrix,
        },
      ])
      .returning();

    diffuser({
      type: CANAL_WS_SIMULATION,
      donnees: { runId: run.id, gainMargePourcent: resultat.gainMargePourcent },
      horodatage: new Date().toISOString(),
    });

    reponse.status(201).json({
      run,
      resultats: [resultatDynamique, resultatFixe],
      gainMargePourcent: resultat.gainMargePourcent,
      modeDemonstration: true,
    });
  })
);
