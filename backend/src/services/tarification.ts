import { and, eq, gte } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  produits,
  stocks,
  prixCourants,
  prixHistorique,
  journalTechnique,
  ventes,
  reglesDePrix,
} from "../db/schema.js";
import { MoteurTarification } from "../pricing/moteur.js";
import type { ContexteTarification, RegleActive } from "../pricing/types.js";
import { diffuser } from "../websocket/serveur.js";
import { CANAL_WS_PRIX } from "@borne/shared";

const moteur = new MoteurTarification();

export async function recalculerPrix(produitId: string, borneId: string) {
  const [produit] = await db.select().from(produits).where(eq(produits.id, produitId));
  const [stock] = await db
    .select()
    .from(stocks)
    .where(and(eq(stocks.produitId, produitId), eq(stocks.borneId, borneId)));
  const [prixCourant] = await db
    .select()
    .from(prixCourants)
    .where(and(eq(prixCourants.produitId, produitId), eq(prixCourants.borneId, borneId)));

  if (!produit || !stock || !prixCourant) {
    throw new Error("Produit, stock ou prix courant introuvable pour ce couple produit/borne");
  }

  if (prixCourant.mode !== "AUTOMATIQUE") {
    return null;
  }

  const ilYAUneHeure = new Date(Date.now() - 3_600_000);
  const ventesRecentes = await db
    .select()
    .from(ventes)
    .where(
      and(
        eq(ventes.produitId, produitId),
        eq(ventes.borneId, borneId),
        gte(ventes.creeLe, ilYAUneHeure)
      )
    );

  const contexte: ContexteTarification = {
    produitId,
    borneId,
    prixReference: Number(produit.prixReference),
    prixActuel: Number(prixCourant.valeur),
    coutAchatActuel: Number(produit.coutAchatActuel),
    margeMinimale: Number(produit.margeMinimale),
    prixMin: Number(produit.prixMin),
    prixMax: Number(produit.prixMax),
    prixStable: produit.prixStable,
    quantiteStock: stock.quantite,
    seuilAlerte: stock.seuilAlerte,
    dateExpiration: stock.dateExpiration,
    ventesDernieresHeures: ventesRecentes.reduce((total, vente) => total + vente.quantite, 0),
    maintenant: new Date(),
  };

  const reglesActives = await db
    .select()
    .from(reglesDePrix)
    .where(eq(reglesDePrix.actif, true));

  const regles: RegleActive[] = reglesActives.map((regle) => ({
    id: regle.id,
    nom: regle.nom,
    type: regle.type,
    parametres: regle.parametres as Record<string, unknown>,
    priorite: regle.priorite,
  }));

  const resultat = moteur.calculer(contexte, regles);

  if (resultat.prixApplique === resultat.prixPrecedent) {
    return resultat;
  }

  await db
    .update(prixCourants)
    .set({
      valeur: resultat.prixApplique.toFixed(2),
      source: "REGLE",
      raison: resultat.raison,
      misAJourLe: new Date(),
    })
    .where(and(eq(prixCourants.produitId, produitId), eq(prixCourants.borneId, borneId)));

  await db.insert(prixHistorique).values({
    produitId,
    borneId,
    valeurPrecedente: resultat.prixPrecedent.toFixed(2),
    valeur: resultat.prixApplique.toFixed(2),
    mode: "AUTOMATIQUE",
    source: "REGLE",
    raison: resultat.raison,
  });

  await db.insert(journalTechnique).values({
    type: "CHANGEMENT_PRIX",
    borneId,
    produitId,
    donnees: resultat,
  });

  diffuser({
    type: CANAL_WS_PRIX,
    donnees: {
      produitId,
      borneId,
      valeur: resultat.prixApplique,
      raison: resultat.raison,
    },
    horodatage: new Date().toISOString(),
  });

  return resultat;
}

export async function definirPrixManuel(
  produitId: string,
  borneId: string,
  valeur: number,
  raison: string,
  utilisateurId: string | null
) {
  const [produit] = await db.select().from(produits).where(eq(produits.id, produitId));
  if (!produit) {
    throw new Error("Produit introuvable");
  }

  const prixMin = Number(produit.prixMin);
  const prixMax = Number(produit.prixMax);
  if (valeur < prixMin || valeur > prixMax) {
    throw new Error(
      `Le prix manuel doit être compris entre ${prixMin.toFixed(2)} € et ${prixMax.toFixed(2)} €`
    );
  }

  const [prixAvant] = await db
    .select()
    .from(prixCourants)
    .where(and(eq(prixCourants.produitId, produitId), eq(prixCourants.borneId, borneId)));

  await db
    .update(prixCourants)
    .set({ valeur: valeur.toFixed(2), mode: "MANUEL", source: "MANUEL", raison, misAJourLe: new Date() })
    .where(and(eq(prixCourants.produitId, produitId), eq(prixCourants.borneId, borneId)));

  await db.insert(prixHistorique).values({
    produitId,
    borneId,
    valeurPrecedente: prixAvant ? prixAvant.valeur : valeur.toFixed(2),
    valeur: valeur.toFixed(2),
    mode: "MANUEL",
    source: "MANUEL",
    raison,
    creeParUtilisateurId: utilisateurId,
  });

  diffuser({
    type: CANAL_WS_PRIX,
    donnees: { produitId, borneId, valeur, raison },
    horodatage: new Date().toISOString(),
  });
}

export async function definirModePrix(
  produitId: string,
  borneId: string,
  mode: "AUTOMATIQUE" | "MANUEL" | "FIXE",
  utilisateurId: string | null
) {
  const [produit] = await db.select().from(produits).where(eq(produits.id, produitId));
  if (!produit) {
    throw new Error("Produit introuvable");
  }

  const nouvelleValeur = mode === "FIXE" ? Number(produit.prixReference) : null;

  const [prixAvant] = await db
    .select()
    .from(prixCourants)
    .where(and(eq(prixCourants.produitId, produitId), eq(prixCourants.borneId, borneId)));

  const valeur = nouvelleValeur !== null ? nouvelleValeur.toFixed(2) : prixAvant?.valeur ?? "0";

  await db
    .update(prixCourants)
    .set({ mode, valeur, misAJourLe: new Date() })
    .where(and(eq(prixCourants.produitId, produitId), eq(prixCourants.borneId, borneId)));

  await db.insert(prixHistorique).values({
    produitId,
    borneId,
    valeurPrecedente: prixAvant?.valeur ?? valeur,
    valeur,
    mode,
    source: mode === "MANUEL" ? "MANUEL" : mode === "FIXE" ? "MANUEL" : "REGLE",
    raison: `Passage en mode ${mode}`,
    creeParUtilisateurId: utilisateurId,
  });

  diffuser({
    type: CANAL_WS_PRIX,
    donnees: { produitId, borneId, valeur: Number(valeur), raison: `Mode ${mode}` },
    horodatage: new Date().toISOString(),
  });
}
