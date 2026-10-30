export type StatutBorne = "ACTIF" | "HORS_LIGNE" | "MAINTENANCE";

export type TypeZone = "GARE" | "CAMPUS" | "ZONE_AFFAIRES";

export type ModePrix = "AUTOMATIQUE" | "MANUEL" | "FIXE";

export type SourcePrix = "REGLE" | "MANUEL" | "IA";

export type StatutSyncVente = "LOCAL" | "SYNCHRONISE" | "EN_CONFLIT";

export type StatutReapprovisionnement = "PLANIFIE" | "EN_COURS" | "TERMINE" | "ANNULE";

export type RoleUtilisateur = "ADMIN" | "OPERATEUR";

export type StrategieSimulation = "DYNAMIQUE" | "FIXE";

export interface ConfigurationDemandeZone {
  multiplicateurHeurePointe: number;
  heuresPointe: number[];
  multiplicateurWeekEnd: number;
}

export interface Zone {
  id: string;
  nom: string;
  type: TypeZone;
  fuseauHoraire: string;
  configDemande: ConfigurationDemandeZone;
  creeLe: string;
}

export interface Borne {
  id: string;
  nom: string;
  zoneId: string;
  statut: StatutBorne;
  derniereSyncLe: string | null;
  creeLe: string;
}

export interface Produit {
  id: string;
  sku: string;
  nom: string;
  description: string;
  categorie: string;
  prixReference: string;
  coutAchatActuel: string;
  prixMin: string;
  prixMax: string;
  prixStable: boolean;
  suiviDlc: boolean;
  dureeConservationJours: number | null;
  margeMinimale: string;
  actif: boolean;
  creeLe: string;
  misAJourLe: string;
}

export interface Stock {
  id: string;
  produitId: string;
  borneId: string;
  quantite: number;
  seuilAlerte: number;
  dateExpiration: string | null;
  misAJourLe: string;
}

export interface PrixCourant {
  produitId: string;
  borneId: string;
  valeur: string;
  mode: ModePrix;
  source: SourcePrix;
  raison: string;
  misAJourLe: string;
}

export interface PrixHistorique {
  id: string;
  produitId: string;
  borneId: string;
  valeurPrecedente: string;
  valeur: string;
  mode: ModePrix;
  source: SourcePrix;
  raison: string;
  creeParUtilisateurId: string | null;
  creeLe: string;
}

export interface RegleDePrix {
  id: string;
  nom: string;
  type: string;
  parametres: Record<string, unknown>;
  actif: boolean;
  priorite: number;
  creeLe: string;
  misAJourLe: string;
}

export interface Vente {
  id: string;
  localId: string;
  borneId: string;
  produitId: string;
  quantite: number;
  prixUnitaire: string;
  montantTotal: string;
  modePaiement: string;
  statutSync: StatutSyncVente;
  creeLe: string;
  syncLe: string | null;
}

export interface CoutAchat {
  id: string;
  produitId: string;
  fournisseur: string;
  prixAchat: string;
  quantite: number;
  dateAchat: string;
}

export interface Evenement {
  id: string;
  nom: string;
  description: string;
  zoneId: string;
  dateDebut: string;
  dateFin: string;
  impactDemande: string;
  actif: boolean;
  creeLe: string;
}

export interface Reapprovisionnement {
  id: string;
  produitId: string;
  borneId: string;
  quantite: number;
  statut: StatutReapprovisionnement;
  datePrevue: string;
  dateReelle: string | null;
}

export interface SimulationRun {
  id: string;
  nom: string;
  dureeJours: number;
  zoneId: string | null;
  parametres: Record<string, unknown>;
  creeParUtilisateurId: string | null;
  creeLe: string;
}

export interface SimulationResultat {
  id: string;
  simulationRunId: string;
  strategie: StrategieSimulation;
  margeCumulee: string;
  chiffreAffaires: string;
  unitesVendues: number;
  unitesGaspillees: number;
  evolutionPrix: Array<{ jour: number; prixMoyen: number }>;
}

export interface Utilisateur {
  id: string;
  email: string;
  nom: string;
  role: RoleUtilisateur;
  creeLe: string;
}

export interface VenteEntrante {
  localId: string;
  borneId: string;
  produitId: string;
  quantite: number;
  prixUnitaire: string;
  modePaiement: string;
  creeLe: string;
}

export interface ResultatCalculPrix {
  produitId: string;
  borneId: string;
  prixPrecedent: string;
  prixPropose: string;
  prixApplique: string;
  raison: string;
  regleId: string | null;
  plafonneParLimite: boolean;
}

export interface MessageWs {
  type:
    | "PRIX_MIS_A_JOUR"
    | "STOCK_MIS_A_JOUR"
    | "BORNE_STATUT"
    | "VENTE_ENREGISTREE"
    | "SIMULATION_TERMINEE";
  donnees: unknown;
  horodatage: string;
}
