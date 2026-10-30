import {
  listerVentesNonSynchronisees,
  marquerVentesSynchronisees,
  mettreAJourPrixCache,
  remplacerProduitsCache,
  mettreAJourStockCache,
} from "./db.js";

const urlBackend = process.env.KIOSK_BACKEND_URL ?? "http://localhost:4000";
const borneId = process.env.KIOSK_BORNE_ID ?? "";

export let enLigne = false;
export let derniereSyncLe: string | null = null;

export async function synchroniser(): Promise<void> {
  try {
    const venteNonSynchronisees = listerVentesNonSynchronisees();

    const reponse = await fetch(`${urlBackend}/api/sync/ventes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        borneId,
        ventes: venteNonSynchronisees.map((vente) => ({
          localId: vente.local_id,
          borneId,
          produitId: vente.produit_id,
          quantite: vente.quantite,
          prixUnitaire: vente.prix_unitaire.toFixed(2),
          modePaiement: vente.mode_paiement,
          creeLe: vente.cree_le,
        })),
      }),
    });

    if (!reponse.ok) {
      throw new Error(`Réponse inattendue du serveur central : ${reponse.status}`);
    }

    const corps = (await reponse.json()) as {
      resultats: { localId: string }[];
      prixActuels: { produitId: string; valeur: string; raison: string }[];
    };

    marquerVentesSynchronisees(corps.resultats.map((r) => r.localId));
    mettreAJourPrixCache(
      corps.prixActuels.map((prix) => ({
        produitId: prix.produitId,
        valeur: Number(prix.valeur),
        raison: prix.raison,
      }))
    );

    enLigne = true;
    derniereSyncLe = new Date().toISOString();
  } catch {
    enLigne = false;
  }
}

export async function chargerCatalogueInitial(): Promise<void> {
  try {
    const reponse = await fetch(`${urlBackend}/api/sync/catalogue/${borneId}`);
    if (!reponse.ok) return;

    const lignes = (await reponse.json()) as {
      id: string;
      sku: string;
      nom: string;
      categorie: string;
      quantite: number;
      valeur: string;
      raison: string;
    }[];

    remplacerProduitsCache(lignes.map((ligne) => ({ id: ligne.id, sku: ligne.sku, nom: ligne.nom, categorie: ligne.categorie })));
    mettreAJourStockCache(lignes.map((ligne) => ({ produitId: ligne.id, quantite: ligne.quantite })));
    mettreAJourPrixCache(
      lignes.map((ligne) => ({ produitId: ligne.id, valeur: Number(ligne.valeur), raison: ligne.raison }))
    );

    enLigne = true;
    derniereSyncLe = new Date().toISOString();
  } catch {
    enLigne = false;
  }
}

export function demarrerBoucleSync(intervalleMs: number): NodeJS.Timeout {
  return setInterval(() => {
    void synchroniser();
  }, intervalleMs);
}
