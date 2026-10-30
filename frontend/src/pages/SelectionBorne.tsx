import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { api } from "../api/client.js";
import "../styles/borne.css";

interface BornePublique {
  id: string;
  nom: string;
  statut: string;
  zoneNom: string;
  zoneType: string;
}

const PORTS_DEMO_PAR_ZONE: Record<string, number> = {
  GARE: 4100,
  CAMPUS: 4101,
  ZONE_AFFAIRES: 4102,
};

export function SelectionBorne() {
  const [bornes, setBornes] = useState<BornePublique[]>([]);
  const [chargement, setChargement] = useState(true);
  const navigue = useNavigate();

  useEffect(() => {
    api
      .bornesPubliques()
      .then(setBornes)
      .finally(() => setChargement(false));
  }, []);

  return (
    <div className="ecran-selection-borne">
      <div className="titre-marque texte-degrade text-[32px] mb-2">KOMETA</div>
      <p className="sous-titre mb-8">Sélectionnez la borne que vous utilisez</p>

      {chargement && <div className="sous-titre">Chargement des bornes…</div>}

      {!chargement && bornes.length === 0 && (
        <div className="sous-titre">Aucune borne n'est enregistrée pour le moment.</div>
      )}

      <div className="grille-selection-borne">
        {bornes.map((borne) => (
          <button
            key={borne.id}
            type="button"
            className="carte-selection-borne"
            disabled={borne.statut === "MAINTENANCE"}
            onClick={() => {
              const portDemo = import.meta.env.DEV ? PORTS_DEMO_PAR_ZONE[borne.zoneType] : undefined;
              navigue(portDemo ? `/borne/${borne.id}?kioskPort=${portDemo}` : `/borne/${borne.id}`);
            }}
          >
            <MapPin size={22} />
            <div className="nom">{borne.nom}</div>
            <div className="sous-titre text-[13px]">{borne.zoneNom}</div>
            <span className={`pastille ${borne.statut === "ACTIF" ? "actif" : "hors-ligne"}`}>
              {borne.statut}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
