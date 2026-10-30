export interface ContexteTarification {
  produitId: string;
  borneId: string;
  prixReference: number;
  prixActuel: number;
  coutAchatActuel: number;
  margeMinimale: number;
  prixMin: number;
  prixMax: number;
  prixStable: boolean;
  quantiteStock: number;
  seuilAlerte: number;
  dateExpiration: Date | null;
  ventesDernieresHeures: number;
  maintenant: Date;
}

export interface PropositionRegle {
  regleId: string | null;
  nom: string;
  facteur: number;
  raison: string;
}

export interface ResultatMoteur {
  prixPrecedent: number;
  prixPropose: number;
  prixApplique: number;
  raison: string;
  regleId: string | null;
  plafonneParLimite: boolean;
}

export interface StrategieTarification {
  readonly nom: string;
  calculer(contexte: ContexteTarification, regles: RegleActive[]): PropositionRegle | null;
}

export interface RegleActive {
  id: string;
  nom: string;
  type: string;
  parametres: Record<string, unknown>;
  priorite: number;
}
