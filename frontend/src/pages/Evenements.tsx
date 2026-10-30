import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { Evenement, Zone } from "@borne/shared";

const EVENEMENT_VIDE = {
  nom: "",
  description: "",
  zoneId: "",
  dateDebut: "",
  dateFin: "",
  impactDemande: "1.5",
};

export function Evenements() {
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [formulaire, setFormulaire] = useState(EVENEMENT_VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function charger() {
    api.evenements().then(setEvenements);
  }

  useEffect(() => {
    charger();
    api.zones().then((liste) => {
      setZones(liste);
      setFormulaire((precedent) => ({ ...precedent, zoneId: liste[0]?.id ?? "" }));
    });
  }, []);

  useEffect(() => {
    if (!confirmation) return;
    const minuteur = setTimeout(() => setConfirmation(null), 3000);
    return () => clearTimeout(minuteur);
  }, [confirmation]);

  async function creerEvenement() {
    if (!formulaire.nom.trim()) {
      setErreur("Le nom de l'événement est obligatoire");
      return;
    }
    if (!formulaire.zoneId) {
      setErreur("Choisissez une zone");
      return;
    }
    if (!formulaire.dateDebut || !formulaire.dateFin) {
      setErreur("Les dates de début et de fin sont obligatoires");
      return;
    }
    if (new Date(formulaire.dateDebut) >= new Date(formulaire.dateFin)) {
      setErreur("La date de fin doit être après la date de début");
      return;
    }
    setErreur(null);
    setEnCours(true);
    try {
      await api.creerEvenement(formulaire);
      setFormulaire({ ...EVENEMENT_VIDE, zoneId: formulaire.zoneId });
      setFormulaireOuvert(false);
      charger();
      setConfirmation("Événement créé");
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function basculerActif(evenement: Evenement) {
    await api.modifierEvenement(evenement.id, { actif: !evenement.actif });
    charger();
  }

  function nomZone(zoneId: string) {
    return zones.find((z) => z.id === zoneId)?.nom ?? "—";
  }

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Événements</h1>
          <div className="sous-titre">Facteurs business influençant la demande par zone</div>
        </div>
        <button onClick={() => setFormulaireOuvert((v) => !v)}>
          {formulaireOuvert ? "Fermer" : "Nouvel événement"}
        </button>
      </div>

      {confirmation && <div className="carte mb-5 text-emerald-400 text-sm">{confirmation}</div>}

      {formulaireOuvert && (
        <div className="carte mb-5 flex flex-col gap-3">
          {erreur && <div className="text-red-400 text-sm">{erreur}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Nom (ex. Match de football)"
              value={formulaire.nom}
              onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })}
            />
            <select
              value={formulaire.zoneId}
              onChange={(e) => setFormulaire({ ...formulaire, zoneId: e.target.value })}
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.nom}
                </option>
              ))}
            </select>
            <div>
              <input
                type="datetime-local"
                value={formulaire.dateDebut}
                onChange={(e) => setFormulaire({ ...formulaire, dateDebut: e.target.value })}
              />
              <div className="text-xs text-kometa-silver mt-1">Début de l'événement</div>
            </div>
            <div>
              <input
                type="datetime-local"
                value={formulaire.dateFin}
                onChange={(e) => setFormulaire({ ...formulaire, dateFin: e.target.value })}
              />
              <div className="text-xs text-kometa-silver mt-1">Fin de l'événement (après le début)</div>
            </div>
            <div>
              <input
                placeholder="Impact sur la demande (ex. 1.5 = +50%)"
                value={formulaire.impactDemande}
                onChange={(e) => setFormulaire({ ...formulaire, impactDemande: e.target.value })}
              />
              <div className="text-xs text-kometa-silver mt-1">
                Multiplicateur de la demande pendant l'événement. 1 = aucun effet, 1.5 = +50 %, 0.8 = -20 %
              </div>
            </div>
          </div>
          <textarea
            placeholder="Description"
            value={formulaire.description}
            onChange={(e) => setFormulaire({ ...formulaire, description: e.target.value })}
          />
          <button className="self-start" onClick={creerEvenement} disabled={enCours}>
            {enCours ? "Création…" : "Créer l'événement"}
          </button>
        </div>
      )}

      <div className="carte">
        <div className="tableau-enveloppe">
          <table>
            <thead>
              <tr>
                <th>Événement</th>
                <th>Zone</th>
                <th>Période</th>
                <th>Impact</th>
                <th>Actif</th>
              </tr>
            </thead>
            <tbody>
              {evenements.map((evenement) => (
                <tr key={evenement.id}>
                  <td>
                    <div className="font-semibold">{evenement.nom}</div>
                    <div className="text-xs text-kometa-silver">{evenement.description}</div>
                  </td>
                  <td>{nomZone(evenement.zoneId)}</td>
                  <td className="text-xs">
                    {new Date(evenement.dateDebut).toLocaleDateString("fr-FR")} –{" "}
                    {new Date(evenement.dateFin).toLocaleDateString("fr-FR")}
                  </td>
                  <td>×{evenement.impactDemande}</td>
                  <td>
                    <button className="secondaire" onClick={() => basculerActif(evenement)}>
                      {evenement.actif ? "Oui" : "Non"}
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
