import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api, type StockAvecAlertes } from "../api/client.js";

export function Stocks() {
  const [stocks, setStocks] = useState<StockAvecAlertes[]>([]);
  const [brouillon, setBrouillon] = useState<Record<string, string>>({});
  const [brouillonExpiration, setBrouillonExpiration] = useState<Record<string, string>>({});
  const [enregistrement, setEnregistrement] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function charger() {
    api.stocks().then(setStocks);
  }

  useEffect(charger, []);

  useEffect(() => {
    if (!confirmation) return;
    const minuteur = setTimeout(() => setConfirmation(null), 3000);
    return () => clearTimeout(minuteur);
  }, [confirmation]);

  function effacerBrouillon(cle: string) {
    setBrouillon((precedent) => {
      const copie = { ...precedent };
      delete copie[cle];
      return copie;
    });
    setBrouillonExpiration((precedent) => {
      const copie = { ...precedent };
      delete copie[cle];
      return copie;
    });
  }

  async function enregistrer(ligne: StockAvecAlertes) {
    const cle = `${ligne.produitId}:${ligne.borneId}`;
    const quantiteSaisie = brouillon[cle];
    const quantite = quantiteSaisie === undefined ? ligne.quantite : Number(quantiteSaisie);
    if (Number.isNaN(quantite) || quantite < 0) {
      setConfirmation("Quantité invalide");
      return;
    }
    const dateSaisie = brouillonExpiration[cle];
    const dateExpiration =
      dateSaisie === undefined ? undefined : dateSaisie ? new Date(dateSaisie).toISOString() : null;
    setEnregistrement(cle);
    try {
      await api.modifierStock(ligne.produitId, ligne.borneId, quantite, dateExpiration);
      effacerBrouillon(cle);
      charger();
      setConfirmation(`${ligne.produitNom} — ${ligne.borneNom} mis à jour`);
    } finally {
      setEnregistrement(null);
    }
  }

  function reapprovisionner(ligne: StockAvecAlertes, quantiteAjoutee: number) {
    const cle = `${ligne.produitId}:${ligne.borneId}`;
    const nouvelleQuantite = ligne.quantite + quantiteAjoutee;
    setBrouillon((precedent) => ({ ...precedent, [cle]: String(nouvelleQuantite) }));
    if (ligne.dureeConservationJours) {
      const expiration = new Date();
      expiration.setDate(expiration.getDate() + ligne.dureeConservationJours);
      setBrouillonExpiration((precedent) => ({
        ...precedent,
        [cle]: expiration.toISOString().slice(0, 10),
      }));
    }
  }

  const alertes = stocks.filter((s) => s.alerteRupture || s.alerteStockFaible || s.alertePeremptionProche);

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Stocks</h1>
          <div className="sous-titre">Niveaux par borne, alertes de rupture et de péremption</div>
        </div>
      </div>

      {confirmation && <div className="carte mb-5 text-emerald-400 text-sm">{confirmation}</div>}

      {alertes.length > 0 && (
        <div className="carte mb-5">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
            <AlertTriangle size={16} />
            {alertes.length} alerte{alertes.length > 1 ? "s" : ""} active{alertes.length > 1 ? "s" : ""}
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            {alertes.map((ligne) => (
              <div key={`${ligne.produitId}:${ligne.borneId}`} className="text-kometa-silver">
                {ligne.produitNom} — {ligne.borneNom} :{" "}
                {ligne.alerteRupture
                  ? "rupture de stock"
                  : ligne.alertePeremptionProche
                  ? "péremption imminente"
                  : "stock faible"}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="carte">
        <div className="tableau-enveloppe">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Borne</th>
                <th>Quantité</th>
                <th>Seuil</th>
                <th>Expiration</th>
                <th>Alerte</th>
                <th>Ajuster</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((ligne) => {
                const cle = `${ligne.produitId}:${ligne.borneId}`;
                return (
                  <tr key={cle}>
                    <td>{ligne.produitNom}</td>
                    <td>{ligne.borneNom}</td>
                    <td className="font-semibold">{ligne.quantite}</td>
                    <td>{ligne.seuilAlerte}</td>
                    <td>
                      {ligne.dateExpiration
                        ? new Date(ligne.dateExpiration).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td>
                      {ligne.alerteRupture && <span className="pastille hors-ligne">Rupture</span>}
                      {!ligne.alerteRupture && ligne.alertePeremptionProche && (
                        <span className="pastille hors-ligne">Péremption</span>
                      )}
                      {!ligne.alerteRupture && !ligne.alertePeremptionProche && ligne.alerteStockFaible && (
                        <span className="pastille maintenance">Faible</span>
                      )}
                      {!ligne.alerteRupture && !ligne.alertePeremptionProche && !ligne.alerteStockFaible && (
                        <span className="pastille actif">OK</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2 items-center flex-wrap">
                        <input
                          className="w-[70px]"
                          placeholder={String(ligne.quantite)}
                          value={brouillon[cle] ?? ""}
                          onChange={(e) =>
                            setBrouillon((precedent) => ({ ...precedent, [cle]: e.target.value }))
                          }
                        />
                        <input
                          type="date"
                          className="w-[140px]"
                          value={
                            brouillonExpiration[cle] ??
                            (ligne.dateExpiration ? ligne.dateExpiration.slice(0, 10) : "")
                          }
                          onChange={(e) =>
                            setBrouillonExpiration((precedent) => ({
                              ...precedent,
                              [cle]: e.target.value,
                            }))
                          }
                        />
                        <button
                          className="secondaire"
                          title="Ajouter 10 unités et recalculer l'expiration depuis la durée de conservation du produit"
                          onClick={() => reapprovisionner(ligne, 10)}
                        >
                          +10
                        </button>
                        <button
                          className="secondaire"
                          disabled={enregistrement === cle}
                          onClick={() => enregistrer(ligne)}
                        >
                          {enregistrement === cle ? "…" : "OK"}
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
