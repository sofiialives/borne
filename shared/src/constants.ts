export const LIMITE_VARIATION_PRIX_PAR_HEURE = 0.15;

export const INTERVALLE_RECALCUL_PRIX_MS = 60_000;

export const CANAL_WS_PRIX = "PRIX_MIS_A_JOUR";
export const CANAL_WS_STOCK = "STOCK_MIS_A_JOUR";
export const CANAL_WS_BORNE = "BORNE_STATUT";
export const CANAL_WS_VENTE = "VENTE_ENREGISTREE";
export const CANAL_WS_SIMULATION = "SIMULATION_TERMINEE";

export const TYPES_ZONE: Array<{ valeur: "GARE" | "CAMPUS" | "ZONE_AFFAIRES"; libelle: string }> = [
  { valeur: "GARE", libelle: "Gare" },
  { valeur: "CAMPUS", libelle: "Campus universitaire" },
  { valeur: "ZONE_AFFAIRES", libelle: "Zone d'affaires" },
];

export const CONFIG_DEMANDE_PAR_DEFAUT: Record<
  "GARE" | "CAMPUS" | "ZONE_AFFAIRES",
  { multiplicateurHeurePointe: number; heuresPointe: number[]; multiplicateurWeekEnd: number }
> = {
  GARE: { multiplicateurHeurePointe: 1.2, heuresPointe: [7, 8, 17, 18, 19], multiplicateurWeekEnd: 0.9 },
  CAMPUS: { multiplicateurHeurePointe: 1.3, heuresPointe: [12, 13], multiplicateurWeekEnd: 0.5 },
  ZONE_AFFAIRES: { multiplicateurHeurePointe: 1.25, heuresPointe: [12, 13], multiplicateurWeekEnd: 0.4 },
};

export const DUREE_SIMULATION_JOURS_DEFAUT = 60;
