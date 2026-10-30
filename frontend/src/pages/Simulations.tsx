import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type SimulationComplete } from "../api/client.js";
import type { SimulationResultat, SimulationRun } from "@borne/shared";

interface Formulaire {
  nom: string;
  dureeJours: string;
  prixReference: string;
  coutAchatActuel: string;
  margeMinimale: string;
  prixMin: string;
  prixMax: string;
  stockInitial: string;
  seuilAlerte: string;
  demandeMoyenneParJour: string;
  volatiliteDemande: string;
  elasticitePrix: string;
  cycleReapprovisionnementJours: string;
  dureeConservationJours: string;
}

const SCENARIO_PAR_DEFAUT: Formulaire = {
  nom: "Sandwich — gare",
  dureeJours: "60",
  prixReference: "5.5",
  coutAchatActuel: "2.5",
  margeMinimale: "0.1",
  prixMin: "4",
  prixMax: "7.5",
  stockInitial: "40",
  seuilAlerte: "10",
  demandeMoyenneParJour: "22",
  volatiliteDemande: "0.3",
  elasticitePrix: "0.5",
  cycleReapprovisionnementJours: "3",
  dureeConservationJours: "2",
};

const CHAMPS: Array<{ cle: keyof Formulaire; libelle: string }> = [
  { cle: "dureeJours", libelle: "Durée (jours)" },
  { cle: "prixReference", libelle: "Prix de référence (€)" },
  { cle: "coutAchatActuel", libelle: "Coût d'achat (€)" },
  { cle: "margeMinimale", libelle: "Marge minimale (0–1)" },
  { cle: "prixMin", libelle: "Prix minimum (€)" },
  { cle: "prixMax", libelle: "Prix maximum (€)" },
  { cle: "stockInitial", libelle: "Stock initial" },
  { cle: "seuilAlerte", libelle: "Seuil d'alerte" },
  { cle: "demandeMoyenneParJour", libelle: "Demande moy. / jour" },
  { cle: "volatiliteDemande", libelle: "Volatilité demande (0–1)" },
  { cle: "elasticitePrix", libelle: "Élasticité prix (0–2)" },
  { cle: "cycleReapprovisionnementJours", libelle: "Cycle réappro (jours)" },
  { cle: "dureeConservationJours", libelle: "Durée de conservation (jours)" },
];

export function Simulations() {
  const [formulaire, setFormulaire] = useState<Formulaire>(SCENARIO_PAR_DEFAUT);
  const [optionsAvanceesOuvertes, setOptionsAvanceesOuvertes] = useState(false);
  const [historique, setHistorique] = useState<Array<SimulationRun & { resultats: SimulationResultat[] }>>(
    []
  );
  const [dernierResultat, setDernierResultat] = useState<SimulationComplete | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.simulations().then(setHistorique);
  }, []);

  function changerChamp(champ: keyof Formulaire, valeur: string) {
    setFormulaire((precedent) => ({ ...precedent, [champ]: valeur }));
  }

  async function lancerAuto() {
    setEnCours(true);
    setErreur(null);
    try {
      const resultat = await api.executerSimulationAuto();
      setDernierResultat(resultat);
      setHistorique(await api.simulations());
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function lancer() {
    setEnCours(true);
    setErreur(null);
    try {
      const resultat = await api.executerSimulation({
        nom: formulaire.nom,
        zoneId: null,
        dureeJours: Number(formulaire.dureeJours),
        prixReference: Number(formulaire.prixReference),
        coutAchatActuel: Number(formulaire.coutAchatActuel),
        margeMinimale: Number(formulaire.margeMinimale),
        prixMin: Number(formulaire.prixMin),
        prixMax: Number(formulaire.prixMax),
        stockInitial: Number(formulaire.stockInitial),
        seuilAlerte: Number(formulaire.seuilAlerte),
        demandeMoyenneParJour: Number(formulaire.demandeMoyenneParJour),
        volatiliteDemande: Number(formulaire.volatiliteDemande),
        elasticitePrix: Number(formulaire.elasticitePrix),
        cycleReapprovisionnementJours: Number(formulaire.cycleReapprovisionnementJours),
        dureeConservationJours: Number(formulaire.dureeConservationJours),
      });
      setDernierResultat(resultat);
      setHistorique(await api.simulations());
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  const dynamique = dernierResultat?.resultats.find((r) => r.strategie === "DYNAMIQUE");
  const fixe = dernierResultat?.resultats.find((r) => r.strategie === "FIXE");

  const donneesGraphique =
    dynamique && fixe
      ? dynamique.evolutionPrix.map((point, index) => ({
          jour: point.jour,
          dynamique: point.prixMoyen,
          fixe: fixe.evolutionPrix[index]?.prixMoyen ?? null,
        }))
      : [];

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Simulation</h1>
          <div className="sous-titre">
            Mode démonstration interne — compare le moteur de tarification dynamique à un prix fixe de
            référence sur des données simulées, avec élasticité et pertes réalistes
          </div>
        </div>
      </div>

      <div className="carte mb-5 flex flex-col gap-4">
        {erreur && <div className="text-red-400 text-sm">{erreur}</div>}

        <div className="flex items-center gap-3">
          <button onClick={lancerAuto} disabled={enCours}>
            {enCours ? "Calcul en cours…" : "Lancer la simulation (60 jours, toutes zones)"}
          </button>
          <span className="sous-titre text-xs">
            Utilise le catalogue réel et les trois zones déjà enregistrées, aucun réglage requis
          </span>
        </div>

        <button
          type="button"
          className="secondaire self-start"
          onClick={() => setOptionsAvanceesOuvertes((v) => !v)}
        >
          {optionsAvanceesOuvertes ? "Masquer le scénario personnalisé" : "Scénario personnalisé…"}
        </button>

        {optionsAvanceesOuvertes && (
          <div className="flex flex-col gap-4">
            <input
              placeholder="Nom du scénario"
              value={formulaire.nom}
              onChange={(e) => changerChamp("nom", e.target.value)}
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CHAMPS.map((champ) => (
                <div key={champ.cle}>
                  <label className="sous-titre block mb-1 text-xs">{champ.libelle}</label>
                  <input
                    className="w-full"
                    value={formulaire[champ.cle]}
                    onChange={(e) => changerChamp(champ.cle, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <button className="self-start" onClick={lancer} disabled={enCours}>
              {enCours ? "Calcul en cours…" : "Lancer ce scénario personnalisé"}
            </button>
          </div>
        )}
      </div>

      {dynamique && fixe && (
        <div className="carte mb-5">
          <h3 className="mb-4">Résultat — {dernierResultat?.run.nom}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="carte">
              <div className="text-xs text-kometa-silver mb-2">Tarification dynamique</div>
              <div className="texte-degrade text-2xl font-bold mb-2">
                {Number(dynamique.margeCumulee).toFixed(2)} € de marge
              </div>
              <div className="text-sm text-kometa-silver">
                CA : {Number(dynamique.chiffreAffaires).toFixed(2)} € · {dynamique.unitesVendues} unités
                vendues · {dynamique.unitesGaspillees} gaspillées
              </div>
            </div>
            <div className="carte">
              <div className="text-xs text-kometa-silver mb-2">Prix fixe de référence</div>
              <div className="text-2xl font-bold mb-2">
                {Number(fixe.margeCumulee).toFixed(2)} € de marge
              </div>
              <div className="text-sm text-kometa-silver">
                CA : {Number(fixe.chiffreAffaires).toFixed(2)} € · {fixe.unitesVendues} unités vendues ·{" "}
                {fixe.unitesGaspillees} gaspillées
              </div>
            </div>
          </div>

          {(() => {
            const ecartEuros = Number(dynamique.margeCumulee) - Number(fixe.margeCumulee);
            const margeFixeEuros = Number(fixe.margeCumulee);
            const pourcentageFiable = margeFixeEuros > 100;
            const pourcentage = pourcentageFiable ? (ecartEuros / margeFixeEuros) * 100 : null;
            const positif = ecartEuros >= 0;
            const texte = positif
              ? `La tarification dynamique améliore la marge de ${ecartEuros.toFixed(2)} €${
                  pourcentage !== null ? ` (+${pourcentage.toFixed(1)} %)` : ""
                } sur ce scénario`
              : `Sur ce scénario, la tarification dynamique fait ${Math.abs(ecartEuros).toFixed(2)} € de moins que le prix fixe${
                  pourcentage !== null ? ` (${pourcentage.toFixed(1)} %)` : ""
                } — un résultat honnête, pas garanti dans toutes les configurations`;
            return (
              <div
                className={`carte mb-5 text-center font-semibold ${
                  positif ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {texte}
              </div>
            );
          })()}

          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={donneesGraphique}>
                <CartesianGrid strokeDasharray="3 3" stroke="#242428" />
                <XAxis dataKey="jour" stroke="#9a9aa5" fontSize={12} />
                <YAxis stroke="#9a9aa5" fontSize={12} />
                <Tooltip contentStyle={{ background: "#16161a", border: "1px solid #2a2a30" }} />
                <Legend />
                <Line type="monotone" dataKey="dynamique" name="Dynamique" stroke="#854CFF" dot={false} />
                <Line type="monotone" dataKey="fixe" name="Fixe" stroke="#9a9aa5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="carte">
        <h3 className="mb-4">Historique</h3>
        <div className="tableau-enveloppe">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Durée</th>
                <th>Marge dynamique</th>
                <th>Marge fixe</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {historique.map((run) => {
                const dyn = run.resultats.find((r) => r.strategie === "DYNAMIQUE");
                const fix = run.resultats.find((r) => r.strategie === "FIXE");
                return (
                  <tr key={run.id}>
                    <td>{run.nom}</td>
                    <td>{run.dureeJours} j</td>
                    <td className="texte-degrade font-semibold">
                      {dyn ? Number(dyn.margeCumulee).toFixed(2) : "—"} €
                    </td>
                    <td>{fix ? Number(fix.margeCumulee).toFixed(2) : "—"} €</td>
                    <td className="text-xs text-kometa-silver">
                      {new Date(run.creeLe).toLocaleString("fr-FR")}
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
