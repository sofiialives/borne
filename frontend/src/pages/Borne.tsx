import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { apiBorne, EtatConnexion, ProduitAffichage } from "../api/kiosk.js";
import { api, type BorneAvecZone } from "../api/client.js";
import "../styles/borne.css";

interface LignePanier {
  produit: ProduitAffichage;
  quantite: number;
}

export function Borne() {
  const { borneId } = useParams<{ borneId: string }>();
  const [produits, setProduits] = useState<ProduitAffichage[]>([]);
  const [panier, setPanier] = useState<LignePanier[]>([]);
  const [etat, setEtat] = useState<EtatConnexion>({ enLigne: false, derniereSyncLe: null });
  const [confirmation, setConfirmation] = useState(false);
  const [borneCible, setBorneCible] = useState<BorneAvecZone | Pick<BorneAvecZone, "id" | "nom"> | null>(
    null
  );
  const [identiteLocale, setIdentiteLocale] = useState<string | null | "inconnue">("inconnue");

  async function recharger() {
    setProduits(await apiBorne.produits());
    setEtat(await apiBorne.etat());
  }

  useEffect(() => {
    api
      .bornesPubliques()
      .then((bornes) => setBorneCible(bornes.find((b) => b.id === borneId) ?? null));
    apiBorne
      .identite()
      .then((identite) => setIdentiteLocale(identite.borneId))
      .catch(() => setIdentiteLocale(null));
    recharger();
    const intervalle = setInterval(recharger, 4000);
    return () => clearInterval(intervalle);
  }, [borneId]);

  function ajouterAuPanier(produit: ProduitAffichage) {
    setPanier((precedent) => {
      const existante = precedent.find((ligne) => ligne.produit.id === produit.id);
      if (existante) {
        return precedent.map((ligne) =>
          ligne.produit.id === produit.id ? { ...ligne, quantite: ligne.quantite + 1 } : ligne
        );
      }
      return [...precedent, { produit, quantite: 1 }];
    });
  }

  function retirerDuPanier(produitId: string) {
    setPanier((precedent) => precedent.filter((ligne) => ligne.produit.id !== produitId));
  }

  const total = panier.reduce((somme, ligne) => somme + (ligne.produit.prix ?? 0) * ligne.quantite, 0);

  async function payer() {
    for (const ligne of panier) {
      if (ligne.produit.prix === null) continue;
      await apiBorne.enregistrerVente(ligne.produit.id, ligne.quantite, ligne.produit.prix);
    }
    setPanier([]);
    setConfirmation(true);
    recharger();
    setTimeout(() => setConfirmation(false), 2200);
  }

  if (identiteLocale !== "inconnue" && identiteLocale !== null && identiteLocale !== borneId) {
    return (
      <div className="ecran-selection-borne">
        <div className="titre-marque texte-degrade text-[26px] mb-3">Borne différente</div>
        <p className="sous-titre mb-6" style={{ maxWidth: 480 }}>
          Ce poste physique est configuré pour une autre borne (identifiant local {identiteLocale}).
          Le serveur local de cette borne ne peut servir que son propre catalogue.
        </p>
        <Link to="/borne" className="bouton" style={{ textDecoration: "none" }}>
          Changer de borne
        </Link>
      </div>
    );
  }

  return (
    <div className="ecran-borne">
      <div className="zone-catalogue">
        <div className="entete-borne">
          <div>
            <div className="titre-marque texte-degrade text-[26px]">KOMETA</div>
            {borneCible && <div className="sous-titre text-[12px] mt-1">{borneCible.nom}</div>}
          </div>
          <span className={`indicateur-connexion ${etat.enLigne ? "en-ligne" : "hors-ligne"}`}>
            {etat.enLigne ? "Connecté" : "Mode hors ligne"}
          </span>
        </div>

        <div className="grille-produits">
          {produits.map((produit) => (
            <div key={produit.id} className="carte-produit" onClick={() => ajouterAuPanier(produit)}>
              <div className="categorie">{produit.categorie}</div>
              <div className="nom">{produit.nom}</div>
              <div className="prix texte-degrade">{produit.prix !== null ? `${produit.prix.toFixed(2)} €` : "—"}</div>
              <div className="text-xs text-kometa-silver">Stock : {produit.stock ?? 0}</div>
            </div>
          ))}
        </div>
      </div>

      <aside className="panneau-panier">
        <h2 className="mb-5">Votre sélection</h2>

        {panier.length === 0 && <div className="sous-titre">Touchez un produit pour l'ajouter</div>}

        {panier.map((ligne) => (
          <div key={ligne.produit.id} className="ligne-panier">
            <span>
              {ligne.quantite} × {ligne.produit.nom}
            </span>
            <span className="flex items-center gap-2.5">
              {((ligne.produit.prix ?? 0) * ligne.quantite).toFixed(2)} €
              <button
                type="button"
                className="secondaire inline-flex items-center justify-center p-1.5"
                onClick={() => retirerDuPanier(ligne.produit.id)}
                aria-label="Retirer"
              >
                <X size={14} />
              </button>
            </span>
          </div>
        ))}

        <div className="total-panier">
          <div className="flex justify-between mb-4">
            <span>Total</span>
            <span className="texte-degrade text-[22px] font-bold">{total.toFixed(2)} €</span>
          </div>
          <button className="w-full" disabled={panier.length === 0} onClick={payer}>
            Payer
          </button>
        </div>

        <Link to="/borne" className="sous-titre text-[12px] mt-4 inline-block">
          Changer de borne
        </Link>
      </aside>

      {confirmation && (
        <div className="ecran-confirmation">
          <div className="titre-marque texte-degrade text-[32px]">Merci !</div>
          <div className="sous-titre">
            Votre achat a été enregistré{etat.enLigne ? "" : " et sera synchronisé dès le retour du réseau"}.
          </div>
        </div>
      )}
    </div>
  );
}
