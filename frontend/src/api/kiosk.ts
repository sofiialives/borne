function urlLocale(): string {
  try {
    const parametre = new URLSearchParams(window.location.search).get("kioskPort");
    if (parametre) {
      sessionStorage.setItem("kiosk_port_override", parametre);
    }
    const port = parametre ?? sessionStorage.getItem("kiosk_port_override");
    if (port) {
      return `http://localhost:${port}`;
    }
  } catch {
    return import.meta.env.VITE_KIOSK_URL ?? "http://localhost:4100";
  }
  return import.meta.env.VITE_KIOSK_URL ?? "http://localhost:4100";
}

export interface ProduitAffichage {
  id: string;
  sku: string;
  nom: string;
  categorie: string;
  prix: number | null;
  stock: number | null;
}

export interface EtatConnexion {
  enLigne: boolean;
  derniereSyncLe: string | null;
}

export const apiBorne = {
  identite: async (): Promise<{ borneId: string | null }> => {
    const reponse = await fetch(`${urlLocale()}/api/identite`);
    return reponse.json();
  },
  produits: async (): Promise<ProduitAffichage[]> => {
    const reponse = await fetch(`${urlLocale()}/api/produits`);
    return reponse.json();
  },
  etat: async (): Promise<EtatConnexion> => {
    const reponse = await fetch(`${urlLocale()}/api/etat`);
    return reponse.json();
  },
  enregistrerVente: async (produitId: string, quantite: number, prixUnitaire: number) => {
    const reponse = await fetch(`${urlLocale()}/api/ventes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produitId, quantite, prixUnitaire, modePaiement: "CARTE" }),
    });
    return reponse.json();
  },
};
