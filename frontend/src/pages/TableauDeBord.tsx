import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api, ouvrirSocketTempsReel, type BorneAvecZone } from "../api/client.js";
import type { Produit, Vente } from "@borne/shared";

export function TableauDeBord() {
  const [bornes, setBornes] = useState<BorneAvecZone[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [evenementsRecents, setEvenementsRecents] = useState<string[]>([]);
  const [analytique, setAnalytique] = useState<Awaited<ReturnType<typeof api.analytiqueVentes>> | null>(null);

  useEffect(() => {
    api.bornes().then(setBornes);
    api.produits().then(setProduits);
    api.ventes().then(setVentes);
    api.analytiqueVentes().then(setAnalytique).catch(() => setAnalytique(null));

    const socket = ouvrirSocketTempsReel((message) => {
      if (message.type === "PRIX_MIS_A_JOUR") {
        const d = message.donnees as { produitId: string; valeur: number; raison: string };
        setEvenementsRecents((precedent) =>
          [`Prix mis à jour — ${d.valeur.toFixed(2)} € — ${d.raison}`, ...precedent].slice(0, 8)
        );
      }
      if (message.type === "BORNE_STATUT") {
        api.bornes().then(setBornes);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const bornesActives = bornes.filter((b) => b.statut === "ACTIF").length;
  const chiffreAffaires = ventes.reduce((total, v) => total + Number(v.montantTotal), 0);

  const donneesParZone = analytique
    ? Object.entries(analytique.parZone).map(([zone, valeurs]) => ({
        zone,
        chiffreAffaires: valeurs.chiffreAffaires,
      }))
    : [];

  return (
    <div>
      <div className="entete-page">
        <div>
          <h1>Tableau de bord</h1>
          <div className="sous-titre">Vue d'ensemble du réseau de bornes</div>
        </div>
      </div>

      <div className="grille-stats">
        <div className="carte">
          <div className="stat-libelle">Bornes actives</div>
          <div className="stat-valeur texte-degrade">
            {bornesActives} / {bornes.length}
          </div>
        </div>
        <div className="carte">
          <div className="stat-libelle">Produits suivis</div>
          <div className="stat-valeur texte-degrade">{produits.length}</div>
        </div>
        <div className="carte">
          <div className="stat-libelle">Ventes récentes</div>
          <div className="stat-valeur texte-degrade">{ventes.length}</div>
        </div>
        <div className="carte">
          <div className="stat-libelle">Chiffre d'affaires affiché</div>
          <div className="stat-valeur texte-degrade">{chiffreAffaires.toFixed(2)} €</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="carte">
          <h3 className="mb-3.5">Chiffre d'affaires par type de zone</h3>
          {donneesParZone.length === 0 ? (
            <div className="sous-titre">Pas encore de ventes enregistrées.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={donneesParZone}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
                <XAxis dataKey="zone" stroke="#d9d9d9" fontSize={12} />
                <YAxis stroke="#d9d9d9" fontSize={12} />
                <Tooltip contentStyle={{ background: "#1b1b21", border: "1px solid #2a2a32" }} />
                <Bar dataKey="chiffreAffaires" fill="#854cff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="carte">
          <h3 className="mb-3.5">Meilleurs produits</h3>
          {!analytique || analytique.meilleursProduits.length === 0 ? (
            <div className="sous-titre">Pas encore de ventes enregistrées.</div>
          ) : (
            <div className="tableau-enveloppe">
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Unités</th>
                    <th>Chiffre d'affaires</th>
                  </tr>
                </thead>
                <tbody>
                  {analytique.meilleursProduits.map((produit) => (
                    <tr key={produit.nom}>
                      <td>{produit.nom}</td>
                      <td>{produit.unites}</td>
                      <td>{produit.chiffreAffaires.toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="carte">
          <h3 className="mb-3.5">État des bornes</h3>
          <div className="tableau-enveloppe">
            <table>
              <thead>
                <tr>
                  <th>Borne</th>
                  <th>Zone</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {bornes.map((borne) => (
                  <tr key={borne.id}>
                    <td>{borne.nom}</td>
                    <td>{borne.zoneNom}</td>
                    <td>
                      <span className={`pastille ${borne.statut === "ACTIF" ? "actif" : "hors-ligne"}`}>
                        {borne.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="carte">
          <h3 className="mb-3.5">Événements en temps réel</h3>
          {evenementsRecents.length === 0 && (
            <div className="sous-titre">En attente de changements de prix…</div>
          )}
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            {evenementsRecents.map((texte, index) => (
              <li key={index} className="text-[13px] text-kometa-silver">
                {texte}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
