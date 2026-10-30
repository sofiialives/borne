import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { TypeZone, Zone } from "@borne/shared";
import { TYPES_ZONE, CONFIG_DEMANDE_PAR_DEFAUT } from "@borne/shared";

interface Performance {
  nombreBornes: number;
  nombreVentes: number;
  chiffreAffaires: string;
  unitesVendues: number;
}

export function Zones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [performances, setPerformances] = useState<Record<string, Performance>>({});
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [type, setType] = useState<TypeZone>("GARE");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [zoneASupprimer, setZoneASupprimer] = useState<Zone | null>(null);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);

  function charger() {
    api.zones().then((liste) => {
      setZones(liste);
      liste.forEach((zone) => {
        api.performanceZone(zone.id).then((perf) =>
          setPerformances((precedent) => ({ ...precedent, [zone.id]: perf }))
        );
      });
    });
  }

  useEffect(charger, []);

  useEffect(() => {
    if (!confirmation) return;
    const minuteur = setTimeout(() => setConfirmation(null), 3000);
    return () => clearTimeout(minuteur);
  }, [confirmation]);

  async function creerZone() {
    if (!nom.trim()) {
      setErreur("Le nom de la zone est obligatoire");
      return;
    }
    if (zones.some((z) => z.nom.trim().toLowerCase() === nom.trim().toLowerCase())) {
      setErreur("Une zone avec ce nom existe déjà");
      return;
    }
    setErreur(null);
    setEnCours(true);
    try {
      await api.creerZone({ nom: nom.trim(), type, configDemande: CONFIG_DEMANDE_PAR_DEFAUT[type] });
      setNom("");
      setFormulaireOuvert(false);
      charger();
      setConfirmation("Zone créée");
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function confirmerSuppression() {
    if (!zoneASupprimer) return;
    setErreurSuppression(null);
    try {
      await api.supprimerZone(zoneASupprimer.id);
      setZoneASupprimer(null);
      charger();
      setConfirmation("Zone supprimée");
    } catch (e) {
      setErreurSuppression((e as Error).message);
    }
  }

  function libelleType(valeur: string) {
    return TYPES_ZONE.find((t) => t.valeur === valeur)?.libelle ?? valeur;
  }

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Zones</h1>
          <div className="sous-titre">Gares, campus universitaires et zones d'affaires</div>
        </div>
        <button onClick={() => setFormulaireOuvert((v) => !v)}>
          {formulaireOuvert ? "Fermer" : "Nouvelle zone"}
        </button>
      </div>

      {confirmation && <div className="carte mb-5 text-emerald-400 text-sm">{confirmation}</div>}

      {formulaireOuvert && (
        <div className="carte mb-5 flex flex-col gap-3">
          {erreur && <div className="text-red-400 text-sm">{erreur}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input placeholder="Nom de la zone" value={nom} onChange={(e) => setNom(e.target.value)} />
            <select value={type} onChange={(e) => setType(e.target.value as TypeZone)}>
              {TYPES_ZONE.map((t) => (
                <option key={t.valeur} value={t.valeur}>
                  {t.libelle}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-kometa-silver">
            La configuration de demande (heures de pointe, multiplicateurs week-end) est préremplie selon
            le type choisi et peut être affinée ensuite.
          </p>
          <button className="self-start" onClick={creerZone} disabled={enCours}>
            {enCours ? "Création…" : "Créer la zone"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map((zone) => {
          const perf = performances[zone.id];
          return (
            <div key={zone.id} className="carte">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold">{zone.nom}</div>
                  <div className="text-xs text-kometa-silver">{libelleType(zone.type)}</div>
                </div>
                <span className="pastille actif">{zone.type}</span>
              </div>
              <div className="text-xs text-kometa-silver mb-3">
                Pointe : {zone.configDemande.heuresPointe.join("h, ")}h · ×
                {zone.configDemande.multiplicateurHeurePointe} · week-end ×
                {zone.configDemande.multiplicateurWeekEnd}
              </div>
              {perf && (
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <div className="text-kometa-silver text-xs">Bornes</div>
                    <div className="font-semibold">{perf.nombreBornes}</div>
                  </div>
                  <div>
                    <div className="text-kometa-silver text-xs">Ventes</div>
                    <div className="font-semibold">{perf.nombreVentes}</div>
                  </div>
                  <div>
                    <div className="text-kometa-silver text-xs">CA</div>
                    <div className="texte-degrade font-semibold">
                      {Number(perf.chiffreAffaires).toFixed(2)} €
                    </div>
                  </div>
                  <div>
                    <div className="text-kometa-silver text-xs">Unités</div>
                    <div className="font-semibold">{perf.unitesVendues}</div>
                  </div>
                </div>
              )}
              <button className="secondaire w-full" onClick={() => setZoneASupprimer(zone)}>
                Supprimer
              </button>
            </div>
          );
        })}
      </div>

      {zoneASupprimer && (
        <div className="carte mt-5 flex flex-col gap-3">
          {erreurSuppression && <div className="text-red-400 text-sm">{erreurSuppression}</div>}
          <div>
            Êtes-vous sûr de vouloir supprimer <strong>{zoneASupprimer.nom}</strong> ?
          </div>
          <div className="flex gap-3">
            <button onClick={confirmerSuppression}>Confirmer</button>
            <button
              className="secondaire"
              onClick={() => {
                setZoneASupprimer(null);
                setErreurSuppression(null);
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
