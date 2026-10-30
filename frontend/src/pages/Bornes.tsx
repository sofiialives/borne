import { FormEvent, useEffect, useState } from "react";
import { api, type BorneAvecZone } from "../api/client.js";
import type { Zone } from "@borne/shared";

export function Bornes() {
  const [bornes, setBornes] = useState<BorneAvecZone[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [nom, setNom] = useState("");
  const [zoneId, setZoneId] = useState("");

  async function recharger() {
    setBornes(await api.bornes());
  }

  useEffect(() => {
    recharger();
    api.zones().then((liste) => {
      setZones(liste);
      if (liste[0]) setZoneId(liste[0].id);
    });
  }, []);

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!nom || !zoneId) return;
    await api.creerBorne(nom, zoneId);
    setNom("");
    recharger();
  }

  async function basculerStatut(borne: BorneAvecZone) {
    const nouveauStatut = borne.statut === "ACTIF" ? "HORS_LIGNE" : "ACTIF";
    await api.changerStatutBorne(borne.id, nouveauStatut);
    recharger();
  }

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Bornes</h1>
          <div className="sous-titre">Gestion du parc et simulation de coupure réseau</div>
        </div>
      </div>

      <form onSubmit={creer} className="carte mb-5 flex flex-col sm:flex-row gap-3">
        <input
          className="flex-1"
          placeholder="Nom de la borne"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.nom}
            </option>
          ))}
        </select>
        <button type="submit">Ajouter une borne</button>
      </form>

      <div className="carte">
        <div className="tableau-enveloppe">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Zone</th>
                <th>Statut</th>
                <th>Dernière synchronisation</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bornes.map((borne) => (
                <tr key={borne.id}>
                  <td>{borne.nom}</td>
                  <td>
                    {borne.zoneNom} <span className="text-xs text-kometa-silver">({borne.zoneType})</span>
                  </td>
                  <td>
                    <span className={`pastille ${borne.statut === "ACTIF" ? "actif" : "hors-ligne"}`}>
                      {borne.statut}
                    </span>
                  </td>
                  <td className="text-xs text-kometa-silver">
                    {borne.derniereSyncLe ? new Date(borne.derniereSyncLe).toLocaleString("fr-FR") : "—"}
                  </td>
                  <td>
                    <button className="secondaire" onClick={() => basculerStatut(borne)}>
                      {borne.statut === "ACTIF" ? "Simuler une coupure" : "Remettre en ligne"}
                    </button>
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
