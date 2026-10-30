import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, client } from "./client.js";
import { zones, bornes, produits, stocks, prixCourants, reglesDePrix, utilisateurs, evenements } from "./schema.js";
import { CONFIG_DEMANDE_PAR_DEFAUT } from "@borne/shared";

export const BORNE_DEMO_ID = "11111111-1111-4111-8111-111111111111";
export const BORNE_DEMO_2_ID = "22222222-2222-4222-8222-222222222222";
export const BORNE_DEMO_3_ID = "33333333-3333-4333-8333-333333333333";

async function semer() {
  await db.transaction(async (tx) => {
    const zonesSemees = await tx
      .insert(zones)
      .values([
        {
          nom: "Gare du Nord",
          type: "GARE",
          fuseauHoraire: "Europe/Paris",
          configDemande: CONFIG_DEMANDE_PAR_DEFAUT.GARE,
        },
        {
          nom: "Campus Paris-Saclay",
          type: "CAMPUS",
          fuseauHoraire: "Europe/Paris",
          configDemande: CONFIG_DEMANDE_PAR_DEFAUT.CAMPUS,
        },
        {
          nom: "La Défense",
          type: "ZONE_AFFAIRES",
          fuseauHoraire: "Europe/Paris",
          configDemande: CONFIG_DEMANDE_PAR_DEFAUT.ZONE_AFFAIRES,
        },
      ])
      .onConflictDoNothing({ target: zones.nom })
      .returning();

    const toutesLesZones =
      zonesSemees.length === 3 ? zonesSemees : await tx.select().from(zones);
    const zoneGare = toutesLesZones.find((z) => z.nom === "Gare du Nord")!;
    const zoneCampus = toutesLesZones.find((z) => z.nom === "Campus Paris-Saclay")!;
    const zoneAffaires = toutesLesZones.find((z) => z.nom === "La Défense")!;

    await tx
      .insert(bornes)
      .values([
        { id: BORNE_DEMO_ID, nom: "Borne Gare du Nord - Hall 1", zoneId: zoneGare.id, statut: "ACTIF" },
        { id: BORNE_DEMO_2_ID, nom: "Borne Campus - Bâtiment B", zoneId: zoneCampus.id, statut: "ACTIF" },
        { id: BORNE_DEMO_3_ID, nom: "Borne La Défense - Tour Nord", zoneId: zoneAffaires.id, statut: "ACTIF" },
      ])
      .onConflictDoNothing({ target: bornes.id });

    const bornesDemo = await tx
      .select()
      .from(bornes)
      .where(eq(bornes.zoneId, zoneGare.id))
      .union(tx.select().from(bornes).where(eq(bornes.zoneId, zoneCampus.id)))
      .union(tx.select().from(bornes).where(eq(bornes.zoneId, zoneAffaires.id)));
    const borneGare = bornesDemo.find((b) => b.id === BORNE_DEMO_ID)!;
    const borneCampus = bornesDemo.find((b) => b.id === BORNE_DEMO_2_ID)!;
    const borneAffaires = bornesDemo.find((b) => b.id === BORNE_DEMO_3_ID)!;

    await tx
      .insert(produits)
      .values([
        {
          sku: "SND-001",
          nom: "Sandwich jambon-beurre",
          description: "Pain de campagne, jambon blanc, beurre demi-sel",
          categorie: "Snacking",
          prixReference: "4.50",
          coutAchatActuel: "1.80",
          prixMin: "3.20",
          prixMax: "6.50",
          prixStable: false,
          suiviDlc: true,
          dureeConservationJours: 2,
          margeMinimale: "0.10",
        },
        {
          sku: "BOI-001",
          nom: "Eau minérale 50cl",
          description: "Eau de source, bouteille 50cl",
          categorie: "Boissons",
          prixReference: "1.80",
          coutAchatActuel: "0.40",
          prixMin: "1.50",
          prixMax: "2.80",
          prixStable: true,
          suiviDlc: false,
          dureeConservationJours: null,
          margeMinimale: "0.15",
        },
        {
          sku: "SAL-001",
          nom: "Salade César",
          description: "Poulet, parmesan, croûtons, sauce César",
          categorie: "Snacking",
          prixReference: "6.90",
          coutAchatActuel: "2.60",
          prixMin: "5.00",
          prixMax: "9.50",
          prixStable: false,
          suiviDlc: true,
          dureeConservationJours: 1,
          margeMinimale: "0.10",
        },
        {
          sku: "CAF-001",
          nom: "Café",
          description: "Café en gobelet 25cl",
          categorie: "Boissons chaudes",
          prixReference: "2.20",
          coutAchatActuel: "0.35",
          prixMin: "1.80",
          prixMax: "3.50",
          prixStable: false,
          suiviDlc: false,
          dureeConservationJours: null,
          margeMinimale: "0.20",
        },
      ])
      .onConflictDoNothing({ target: produits.sku });

    const produitsSemes = await tx.select().from(produits);

    for (const borne of [borneGare, borneCampus, borneAffaires]) {
      for (const produit of produitsSemes) {
        await tx
          .insert(stocks)
          .values({
            produitId: produit.id,
            borneId: borne.id,
            quantite: 25,
            seuilAlerte: 6,
          })
          .onConflictDoNothing({ target: [stocks.produitId, stocks.borneId] });
        await tx
          .insert(prixCourants)
          .values({
            produitId: produit.id,
            borneId: borne.id,
            valeur: produit.prixReference,
            mode: "AUTOMATIQUE",
            source: "MANUEL",
            raison: "Initialisation au prix de référence",
          })
          .onConflictDoNothing({ target: [prixCourants.produitId, prixCourants.borneId] });
      }
    }

    const reglesExistantes = await tx.select().from(reglesDePrix);
    if (reglesExistantes.length === 0) {
      await tx.insert(reglesDePrix).values([
        {
          nom: "Péremption proche + stock élevé",
          type: "DLC_STOCK",
          priorite: 10,
          parametres: { joursAvantDlc: 1, seuilStockEleve: 10, remise: 0.2 },
        },
        {
          nom: "Forte demande + stock faible",
          type: "DEMANDE_STOCK",
          priorite: 20,
          parametres: { seuilStockFaible: 5, ventesParHeureElevees: 8, majoration: 0.1 },
        },
      ]);
    }

    const evenementsExistants = await tx.select().from(evenements);
    if (evenementsExistants.length === 0) {
      await tx.insert(evenements).values([
        {
          nom: "Pont de l'Ascension",
          description: "Trafic touristique accru en gare pendant le week-end prolongé",
          zoneId: zoneGare.id,
          dateDebut: new Date(Date.now() + 86_400_000 * 3),
          dateFin: new Date(Date.now() + 86_400_000 * 6),
          impactDemande: "1.25",
          actif: true,
        },
        {
          nom: "Semaine des partiels",
          description: "Affluence réduite au restaurant universitaire pendant les examens",
          zoneId: zoneCampus.id,
          dateDebut: new Date(Date.now() + 86_400_000 * 10),
          dateFin: new Date(Date.now() + 86_400_000 * 17),
          impactDemande: "0.80",
          actif: true,
        },
      ]);
    }

    const motDePasseHash = await bcrypt.hash("admin1234", 10);
    await tx
      .insert(utilisateurs)
      .values({
        email: "admin@kometa-bornes.fr",
        nom: "Administrateur",
        motDePasseHash,
        role: "ADMIN",
      })
      .onConflictDoNothing({ target: utilisateurs.email });
  });

  console.log("Jeu de données initial inséré (ou déjà présent, réexécution sans danger).");
}

semer()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
