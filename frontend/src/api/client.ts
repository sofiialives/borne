import { io, type Socket } from "socket.io-client";
import type {
  Borne,
  Evenement,
  MessageWs,
  PrixCourant,
  PrixHistorique,
  Produit,
  SimulationResultat,
  SimulationRun,
  Vente,
  Zone,
} from "@borne/shared";

const URL_API = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function recupererJeton(): string | null {
  return localStorage.getItem("kometa_jeton");
}

export function enregistrerJeton(jeton: string): void {
  localStorage.setItem("kometa_jeton", jeton);
}

export function effacerJeton(): void {
  localStorage.removeItem("kometa_jeton");
}

async function requete<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const jeton = recupererJeton();

  const reponse = await fetch(`${URL_API}${chemin}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      ...options.headers,
    },
  });

  if (!reponse.ok) {
    const corps = await reponse.json().catch(() => ({ erreur: reponse.statusText }));
    throw new Error(corps.erreur ?? "Erreur réseau");
  }

  if (reponse.status === 204) {
    return undefined as T;
  }

  return reponse.json() as Promise<T>;
}

export interface BorneAvecZone extends Borne {
  zoneNom: string;
  zoneType: string;
}

export interface StockAvecAlertes {
  produitId: string;
  produitNom: string;
  suiviDlc: boolean;
  dureeConservationJours: number | null;
  borneId: string;
  borneNom: string;
  quantite: number;
  seuilAlerte: number;
  dateExpiration: string | null;
  alerteStockFaible: boolean;
  alerteRupture: boolean;
  alertePeremptionProche: boolean;
}

export interface VenteAvecDetails extends Vente {
  borneNom: string;
  zoneNom: string;
  produitNom: string;
}

export interface SimulationComplete {
  run: SimulationRun;
  resultats: SimulationResultat[];
  gainMargePourcent: number;
  modeDemonstration: boolean;
}

export const api = {
  connexion: (email: string, motDePasse: string) =>
    requete<{ jeton: string; utilisateur: { id: string; nom: string; role: string } }>(
      "/api/auth/connexion",
      { method: "POST", body: JSON.stringify({ email, motDePasse }) }
    ),

  zones: () => requete<Zone[]>("/api/zones"),
  creerZone: (donnees: Partial<Zone> & { nom: string; type: string }) =>
    requete<Zone>("/api/zones", { method: "POST", body: JSON.stringify(donnees) }),
  modifierZone: (id: string, donnees: Partial<Zone>) =>
    requete<Zone>(`/api/zones/${id}`, { method: "PATCH", body: JSON.stringify(donnees) }),
  supprimerZone: (id: string) => requete<void>(`/api/zones/${id}`, { method: "DELETE" }),
  performanceZone: (id: string) =>
    requete<{
      zoneId: string;
      nombreBornes: number;
      nombreVentes: number;
      chiffreAffaires: string;
      unitesVendues: number;
    }>(`/api/zones/${id}/performance`),

  bornes: () => requete<BorneAvecZone[]>("/api/bornes"),
  bornesPubliques: () => requete<Array<{ id: string; nom: string; statut: string; zoneNom: string; zoneType: string }>>(
    "/api/sync/bornes"
  ),
  creerBorne: (nom: string, zoneId: string) =>
    requete("/api/bornes", { method: "POST", body: JSON.stringify({ nom, zoneId }) }),
  changerStatutBorne: (id: string, statut: string) =>
    requete(`/api/bornes/${id}/statut`, { method: "PATCH", body: JSON.stringify({ statut }) }),

  produits: () => requete<Produit[]>("/api/produits"),
  creerProduit: (donnees: Record<string, unknown>) =>
    requete<Produit>("/api/produits", { method: "POST", body: JSON.stringify(donnees) }),
  modifierProduit: (id: string, donnees: Record<string, unknown>) =>
    requete<Produit>(`/api/produits/${id}`, { method: "PATCH", body: JSON.stringify(donnees) }),
  desactiverProduit: (id: string) => requete(`/api/produits/${id}`, { method: "DELETE" }),
  prixProduit: (id: string) =>
    requete<Array<{ borneId: string; borneNom: string; valeur: string; mode: string; raison: string; misAJourLe: string }>>(
      `/api/produits/${id}/prix`
    ),
  definirModePrix: (produitId: string, borneId: string, mode: string) =>
    requete(`/api/produits/${produitId}/mode/${borneId}`, {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    }),

  prixCourants: (borneId?: string) =>
    requete<PrixCourant[]>(`/api/prix/courants${borneId ? `?borneId=${borneId}` : ""}`),
  historiquePrix: (produitId: string, borneId: string) =>
    requete<PrixHistorique[]>(`/api/prix/historique/${produitId}/${borneId}`),
  definirPrixManuel: (produitId: string, borneId: string, valeur: number, raison: string) =>
    requete(`/api/prix/${produitId}/${borneId}`, {
      method: "PUT",
      body: JSON.stringify({ valeur, raison }),
    }),
  recalculerPrix: (produitId: string, borneId: string) =>
    requete(`/api/prix/${produitId}/${borneId}/recalculer`, { method: "POST" }),

  stocks: () => requete<StockAvecAlertes[]>("/api/stocks"),
  modifierStock: (
    produitId: string,
    borneId: string,
    quantite: number,
    dateExpiration?: string | null
  ) =>
    requete(`/api/produits/${produitId}/stock/${borneId}`, {
      method: "PATCH",
      body: JSON.stringify({
        quantite,
        ...(dateExpiration !== undefined ? { dateExpiration } : {}),
      }),
    }),

  ventes: (filtres: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams(
      Object.entries(filtres).filter(([, valeur]) => Boolean(valeur)) as [string, string][]
    );
    const suffixe = params.toString() ? `?${params.toString()}` : "";
    return requete<VenteAvecDetails[]>(`/api/ventes${suffixe}`);
  },
  analytiqueVentes: () =>
    requete<{
      chiffreAffaires: string;
      margeBrute: string;
      volumeVentes: number;
      meilleursProduits: Array<{ nom: string; chiffreAffaires: number; unites: number }>;
      pirePerformants: Array<{ nom: string; chiffreAffaires: number; unites: number }>;
      parZone: Record<string, { chiffreAffaires: number; unites: number }>;
    }>("/api/ventes/analytique"),

  evenements: () => requete<Evenement[]>("/api/evenements"),
  creerEvenement: (donnees: Record<string, unknown>) =>
    requete<Evenement>("/api/evenements", { method: "POST", body: JSON.stringify(donnees) }),
  modifierEvenement: (id: string, donnees: Record<string, unknown>) =>
    requete<Evenement>(`/api/evenements/${id}`, { method: "PATCH", body: JSON.stringify(donnees) }),

  executerSimulation: (donnees: unknown) =>
    requete<SimulationComplete>("/api/simulations/executer", {
      method: "POST",
      body: JSON.stringify(donnees),
    }),
  executerSimulationAuto: () =>
    requete<SimulationComplete>("/api/simulations/executer-auto", { method: "POST" }),
  simulations: () => requete<Array<SimulationRun & { resultats: SimulationResultat[] }>>("/api/simulations"),
};

export function ouvrirSocketTempsReel(surMessage: (message: MessageWs) => void): Socket {
  const socket = io(URL_API, { path: "/ws" });
  socket.on("evenement", (message: MessageWs) => surMessage(message));
  return socket;
}
