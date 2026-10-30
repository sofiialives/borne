import { useEffect, useState } from "react";
import { api, type BorneAvecZone } from "../api/client.js";
import type { PrixCourant, Produit } from "@borne/shared";

export function Tarification() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [bornes, setBornes] = useState<BorneAvecZone[]>([]);
  const [borneSelectionnee, setBorneSelectionnee] = useState<string>("");
  const [prixCourants, setPrixCourants] = useState<PrixCourant[]>([]);
  const [brouillon, setBrouillon] = useState<Record<string, string>>({});
  const [raisonBrouillon, setRaisonBrouillon] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmation) return;
    const minuteur = setTimeout(() => setConfirmation(null), 3000);
    return () => clearTimeout(minuteur);
  }, [confirmation]);

  useEffect(() => {
    api.produits().then(setProduits);
    api.bornes().then((liste) => {
      setBornes(liste);
      if (liste[0]) setBorneSelectionnee(liste[0].id);
    });
  }, []);

  function chargerPrix() {
    if (borneSelectionnee) {
      api.prixCourants(borneSelectionnee).then(setPrixCourants);
    }
  }

  useEffect(chargerPrix, [borneSelectionnee]);

  function prixDuProduit(produitId: string): PrixCourant | undefined {
    return prixCourants.find((p) => p.produitId === produitId);
  }

  async function appliquerPrixManuel(produitId: string) {
    setErreur(null);
    const valeur = Number(brouillon[produitId]);
    if (!brouillon[produitId] || Number.isNaN(valeur) || valeur <= 0) {
      setErreur("Le nouveau prix doit être un nombre positif");
      return;
    }
    setEnCours(`prix:${produitId}`);
    try {
      await api.definirPrixManuel(
        produitId,
        borneSelectionnee,
        valeur,
        raisonBrouillon[produitId] || "Ajustement manuel depuis le CRM"
      );
      setBrouillon((precedent) => {
        const copie = { ...precedent };
        delete copie[produitId];
        return copie;
      });
      chargerPrix();
      setConfirmation("Prix mis à jour");
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(null);
    }
  }

  async function recalculer(produitId: string) {
    setErreur(null);
    setEnCours(`recalcul:${produitId}`);
    try {
      await api.recalculerPrix(produitId, borneSelectionnee);
      chargerPrix();
      setConfirmation("Prix recalculé automatiquement");
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(null);
    }
  }

  async function changerMode(produitId: string, mode: string) {
    setErreur(null);
    setEnCours(`mode:${produitId}`);
    try {
      await api.definirModePrix(produitId, borneSelectionnee, mode);
      chargerPrix();
      setConfirmation("Mode de tarification mis à jour");
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Tarification</h1>
          <div className="sous-titre">Mode automatique, manuel ou fixe — prix par produit et par borne</div>
        </div>
        <select value={borneSelectionnee} onChange={(e) => setBorneSelectionnee(e.target.value)}>
          {bornes.map((borne) => (
            <option key={borne.id} value={borne.id}>
              {borne.nom}
            </option>
          ))}
        </select>
      </div>

      {confirmation && <div className="carte mb-4 text-emerald-400 text-sm">{confirmation}</div>}
      {erreur && <div className="carte mb-4 text-red-400 text-sm">{erreur}</div>}

      <div className="carte">
        <div className="tableau-enveloppe">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Référence</th>
                <th>Prix courant</th>
                <th>Mode</th>
                <th>Raison</th>
                <th>Nouveau prix</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {produits.map((produit) => {
                const prix = prixDuProduit(produit.id);
                return (
                  <tr key={produit.id}>
                    <td>{produit.nom}</td>
                    <td>{Number(produit.prixReference).toFixed(2)} €</td>
                    <td className="texte-degrade font-semibold">
                      {prix ? Number(prix.valeur).toFixed(2) : "—"} €
                    </td>
                    <td>
                      <select
                        value={prix?.mode ?? "AUTOMATIQUE"}
                        disabled={produit.prixStable || enCours === `mode:${produit.id}`}
                        onChange={(e) => changerMode(produit.id, e.target.value)}
                      >
                        <option value="AUTOMATIQUE">Automatique</option>
                        <option value="MANUEL">Manuel</option>
                        <option value="FIXE">Fixe</option>
                      </select>
                      {produit.prixStable && (
                        <div className="text-xs text-kometa-silver mt-1">
                          Verrouillé car « Prix stable » est activé sur ce produit
                        </div>
                      )}
                    </td>
                    <td className="text-xs text-kometa-silver max-w-[220px]">{prix?.raison}</td>
                    <td>
                      <div className="flex flex-col gap-1.5">
                        <input
                          className="w-[90px]"
                          placeholder="0.00"
                          title={`Entre ${Number(produit.prixMin).toFixed(2)} € et ${Number(produit.prixMax).toFixed(2)} €`}
                          value={brouillon[produit.id] ?? ""}
                          onChange={(e) =>
                            setBrouillon((precedent) => ({ ...precedent, [produit.id]: e.target.value }))
                          }
                        />
                        <input
                          className="w-[160px]"
                          placeholder="Raison (optionnel)"
                          value={raisonBrouillon[produit.id] ?? ""}
                          onChange={(e) =>
                            setRaisonBrouillon((precedent) => ({ ...precedent, [produit.id]: e.target.value }))
                          }
                        />
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => appliquerPrixManuel(produit.id)}
                          disabled={enCours === `prix:${produit.id}`}
                        >
                          {enCours === `prix:${produit.id}` ? "…" : "Appliquer"}
                        </button>
                        <button
                          className="secondaire"
                          onClick={() => recalculer(produit.id)}
                          disabled={enCours === `recalcul:${produit.id}`}
                        >
                          {enCours === `recalcul:${produit.id}` ? "…" : "Recalculer"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
