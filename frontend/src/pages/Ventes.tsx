import { useEffect, useState } from "react";
import { api, type VenteAvecDetails } from "../api/client.js";
import type { Zone } from "@borne/shared";

interface Analytique {
  chiffreAffaires: string;
  margeBrute: string;
  volumeVentes: number;
  meilleursProduits: Array<{ nom: string; chiffreAffaires: number; unites: number }>;
  pirePerformants: Array<{ nom: string; chiffreAffaires: number; unites: number }>;
  parZone: Record<string, { chiffreAffaires: number; unites: number }>;
}

export function Ventes() {
  const [ventes, setVentes] = useState<VenteAvecDetails[]>([]);
  const [analytique, setAnalytique] = useState<Analytique | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState("");

  function charger() {
    api.ventes(zoneId ? { zoneId } : {}).then(setVentes);
    api.analytiqueVentes().then(setAnalytique);
  }

  useEffect(() => {
    api.zones().then(setZones);
  }, []);

  useEffect(charger, [zoneId]);

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Ventes</h1>
          <div className="sous-titre">Journal des ventes synchronisées depuis les bornes</div>
        </div>
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          <option value="">Toutes les zones</option>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.nom}
            </option>
          ))}
        </select>
      </div>

      {analytique && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div className="carte">
            <div className="text-xs text-kometa-silver mb-1">Chiffre d'affaires</div>
            <div className="texte-degrade text-xl font-bold">
              {Number(analytique.chiffreAffaires).toFixed(2)} €
            </div>
          </div>
          <div className="carte">
            <div className="text-xs text-kometa-silver mb-1">Marge brute</div>
            <div className="texte-degrade text-xl font-bold">
              {Number(analytique.margeBrute).toFixed(2)} €
            </div>
          </div>
          <div className="carte">
            <div className="text-xs text-kometa-silver mb-1">Volume</div>
            <div className="text-xl font-bold">{analytique.volumeVentes}</div>
          </div>
          <div className="carte">
            <div className="text-xs text-kometa-silver mb-1">Meilleur produit</div>
            <div className="text-sm font-semibold truncate">
              {analytique.meilleursProduits[0]?.nom ?? "—"}
            </div>
          </div>
        </div>
      )}

      <div className="carte">
        <div className="tableau-enveloppe">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Produit</th>
                <th>Borne</th>
                <th>Zone</th>
                <th>Quantité</th>
                <th>Prix unitaire</th>
                <th>Total</th>
                <th>Synchronisation</th>
              </tr>
            </thead>
            <tbody>
              {ventes.map((vente) => (
                <tr key={vente.id}>
                  <td className="text-xs">{new Date(vente.creeLe).toLocaleString("fr-FR")}</td>
                  <td>{vente.produitNom}</td>
                  <td>{vente.borneNom}</td>
                  <td>{vente.zoneNom}</td>
                  <td>{vente.quantite}</td>
                  <td>{Number(vente.prixUnitaire).toFixed(2)} €</td>
                  <td className="font-semibold">{Number(vente.montantTotal).toFixed(2)} €</td>
                  <td>
                    <span
                      className={`pastille ${vente.statutSync === "SYNCHRONISE" ? "actif" : "hors-ligne"}`}
                    >
                      {vente.statutSync}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
