import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { Produit } from "@borne/shared";

const PRODUIT_VIDE = {
  sku: "",
  nom: "",
  description: "",
  categorie: "",
  prixReference: "",
  coutAchatActuel: "",
  prixMin: "",
  prixMax: "",
  prixStable: false,
  suiviDlc: false,
  dureeConservationJours: "",
  margeMinimale: "0.1",
};

function validerFormulaire(f: typeof PRODUIT_VIDE): string | null {
  if (!f.sku.trim()) return "Le SKU est obligatoire";
  if (!f.nom.trim()) return "Le nom est obligatoire";
  if (!f.categorie.trim()) return "La catégorie est obligatoire";
  const prixReference = Number(f.prixReference);
  const coutAchat = Number(f.coutAchatActuel);
  const prixMin = Number(f.prixMin);
  const prixMax = Number(f.prixMax);
  if (!f.prixReference || Number.isNaN(prixReference) || prixReference <= 0)
    return "Le prix de référence doit être un nombre positif";
  if (!f.coutAchatActuel || Number.isNaN(coutAchat) || coutAchat <= 0)
    return "Le coût d'achat doit être un nombre positif";
  if (!f.prixMin || Number.isNaN(prixMin) || prixMin <= 0)
    return "Le prix minimum doit être un nombre positif";
  if (!f.prixMax || Number.isNaN(prixMax) || prixMax <= 0)
    return "Le prix maximum doit être un nombre positif";
  if (prixMin >= prixMax) return "Le prix minimum doit être inférieur au prix maximum";
  if (prixReference < prixMin || prixReference > prixMax)
    return "Le prix de référence doit être compris entre le prix minimum et le prix maximum";
  if (coutAchat >= prixReference)
    return "Le coût d'achat doit être inférieur au prix de référence, sinon le produit se vend à perte";
  return null;
}

export function Produits() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [formulaire, setFormulaire] = useState(PRODUIT_VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [confirmationSuppression, setConfirmationSuppression] = useState<Produit | null>(null);

  function charger() {
    api.produits().then(setProduits);
  }

  useEffect(charger, []);

  useEffect(() => {
    if (!confirmation) return;
    const minuteur = setTimeout(() => setConfirmation(null), 3000);
    return () => clearTimeout(minuteur);
  }, [confirmation]);

  async function creerProduit() {
    const messageValidation = validerFormulaire(formulaire);
    if (messageValidation) {
      setErreur(messageValidation);
      return;
    }
    setErreur(null);
    setEnCours(true);
    try {
      await api.creerProduit({
        ...formulaire,
        dureeConservationJours: formulaire.dureeConservationJours
          ? Number(formulaire.dureeConservationJours)
          : null,
      });
      setFormulaire(PRODUIT_VIDE);
      setFormulaireOuvert(false);
      charger();
      setConfirmation("Produit créé et disponible dans toutes les bornes actives");
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function basculerStable(produit: Produit) {
    await api.modifierProduit(produit.id, { prixStable: !produit.prixStable });
    charger();
  }

  async function basculerActif(produit: Produit) {
    if (produit.actif) {
      await api.desactiverProduit(produit.id);
      setConfirmation(`${produit.nom} désactivé — n'apparaîtra plus sur les bornes`);
    } else {
      await api.modifierProduit(produit.id, { actif: true });
      setConfirmation(`${produit.nom} réactivé`);
    }
    charger();
  }

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Produits</h1>
          <div className="sous-titre">Catalogue : coûts, prix de référence, bornes min/max</div>
        </div>
        <button onClick={() => setFormulaireOuvert((v) => !v)}>
          {formulaireOuvert ? "Fermer" : "Nouveau produit"}
        </button>
      </div>

      {confirmation && <div className="carte mb-5 text-emerald-400 text-sm">{confirmation}</div>}

      {formulaireOuvert && (
        <div className="carte mb-5 flex flex-col gap-3">
          {erreur && <div className="text-red-400 text-sm">{erreur}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <input
                placeholder="SKU"
                value={formulaire.sku}
                onChange={(e) => setFormulaire({ ...formulaire, sku: e.target.value })}
              />
              <div className="text-xs text-kometa-silver mt-1">
                Référence interne unique, ex. SND-002
              </div>
            </div>
            <input
              placeholder="Nom"
              value={formulaire.nom}
              onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })}
            />
            <input
              placeholder="Catégorie"
              value={formulaire.categorie}
              onChange={(e) => setFormulaire({ ...formulaire, categorie: e.target.value })}
            />
            <div>
              <input
                placeholder="Prix de référence (€)"
                value={formulaire.prixReference}
                onChange={(e) => setFormulaire({ ...formulaire, prixReference: e.target.value })}
              />
              <div className="text-xs text-kometa-silver mt-1">
                Prix de départ, utilisé comme référence fixe dans la simulation
              </div>
            </div>
            <div>
              <input
                placeholder="Coût d'achat (€)"
                value={formulaire.coutAchatActuel}
                onChange={(e) => setFormulaire({ ...formulaire, coutAchatActuel: e.target.value })}
              />
              <div className="text-xs text-kometa-silver mt-1">Coût payé au fournisseur par unité</div>
            </div>
            <div>
              <input
                placeholder="Marge minimale (0.10 = 10%)"
                value={formulaire.margeMinimale}
                onChange={(e) => setFormulaire({ ...formulaire, margeMinimale: e.target.value })}
              />
              <div className="text-xs text-kometa-silver mt-1">
                Marge plancher sous laquelle le moteur refuse de baisser le prix
              </div>
            </div>
            <div>
              <input
                placeholder="Prix minimum (€)"
                value={formulaire.prixMin}
                onChange={(e) => setFormulaire({ ...formulaire, prixMin: e.target.value })}
              />
              <div className="text-xs text-kometa-silver mt-1">Plancher absolu du prix dynamique</div>
            </div>
            <div>
              <input
                placeholder="Prix maximum (€)"
                value={formulaire.prixMax}
                onChange={(e) => setFormulaire({ ...formulaire, prixMax: e.target.value })}
              />
              <div className="text-xs text-kometa-silver mt-1">Plafond absolu du prix dynamique</div>
            </div>
            <div>
              <input
                placeholder="Durée de conservation (jours)"
                type="number"
                min={1}
                value={formulaire.dureeConservationJours}
                onChange={(e) =>
                  setFormulaire({ ...formulaire, dureeConservationJours: e.target.value })
                }
              />
              <div className="text-xs text-kometa-silver mt-1">
                Nombre de jours pendant lesquels le produit reste vendable après réapprovisionnement.
                Utilisé par le moteur de tarification pour réduire automatiquement le prix à l'approche
                de la péremption.
              </div>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formulaire.prixStable}
                onChange={(e) => setFormulaire({ ...formulaire, prixStable: e.target.checked })}
              />
              Prix stable (jamais ajusté automatiquement)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formulaire.suiviDlc}
                onChange={(e) => setFormulaire({ ...formulaire, suiviDlc: e.target.checked })}
              />
              Suivi de péremption
            </label>
          </div>
          <button className="self-start" onClick={creerProduit} disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer le produit"}
          </button>
        </div>
      )}

      <div className="carte">
        <div className="tableau-enveloppe">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produit</th>
                <th>Référence</th>
                <th>Min / Max</th>
                <th>Coût</th>
                <th>Prix stable</th>
                <th>Conservation</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {produits.map((produit) => (
                <tr key={produit.id} className={!produit.actif ? "opacity-50" : undefined}>
                  <td>{produit.sku}</td>
                  <td>{produit.nom}</td>
                  <td>{Number(produit.prixReference).toFixed(2)} €</td>
                  <td>
                    {Number(produit.prixMin).toFixed(2)} € – {Number(produit.prixMax).toFixed(2)} €
                  </td>
                  <td>{Number(produit.coutAchatActuel).toFixed(2)} €</td>
                  <td>
                    <button className="secondaire" onClick={() => basculerStable(produit)}>
                      {produit.prixStable ? "Oui" : "Non"}
                    </button>
                  </td>
                  <td>
                    {produit.dureeConservationJours
                      ? `${produit.dureeConservationJours} j`
                      : "—"}
                  </td>
                  <td>
                    <span className={`pastille ${produit.actif ? "actif" : "hors-ligne"}`}>
                      {produit.actif ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="secondaire" onClick={() => basculerActif(produit)}>
                        {produit.actif ? "Désactiver" : "Réactiver"}
                      </button>
                      <button
                        className="secondaire"
                        onClick={() => setConfirmationSuppression(produit)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmationSuppression && (
        <div className="carte mb-5 flex flex-col gap-3">
          <div>
            Désactiver définitivement <strong>{confirmationSuppression.nom}</strong> ? Le produit
            n'apparaîtra plus sur aucune borne, mais son historique de ventes et de prix est conservé.
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                await api.desactiverProduit(confirmationSuppression.id);
                setConfirmation(`${confirmationSuppression.nom} désactivé`);
                setConfirmationSuppression(null);
                charger();
              }}
            >
              Confirmer
            </button>
            <button className="secondaire" onClick={() => setConfirmationSuppression(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
