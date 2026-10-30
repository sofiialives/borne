import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";

const liens = [
  { chemin: "/", libelle: "Tableau de bord" },
  { chemin: "/produits", libelle: "Produits" },
  { chemin: "/tarification", libelle: "Tarification" },
  { chemin: "/zones", libelle: "Zones" },
  { chemin: "/bornes", libelle: "Bornes" },
  { chemin: "/stocks", libelle: "Stocks" },
  { chemin: "/ventes", libelle: "Ventes" },
  { chemin: "/evenements", libelle: "Événements" },
  { chemin: "/simulations", libelle: "Simulation" },
];

export function MiseEnPage() {
  const { utilisateur, deconnecter } = useAuth();
  const navigue = useNavigate();
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <div className="mise-en-page">
      <aside className={`barre-laterale${menuOuvert ? " ouverte" : ""}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="titre-marque texte-degrade text-[22px]">KOMETA</div>
            <div className="sous-titre text-[11px] tracking-[0.18em]">BORNES · PRIX DYNAMIQUE</div>
          </div>
          <button
            type="button"
            className="bouton-menu-mobile"
            onClick={() => setMenuOuvert((valeur) => !valeur)}
            aria-label="Menu"
          >
            {menuOuvert ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        <nav className={menuOuvert ? "ouverte" : ""}>
          {liens.map((lien) => (
            <NavLink
              key={lien.chemin}
              to={lien.chemin}
              end={lien.chemin === "/"}
              onClick={() => setMenuOuvert(false)}
              className={({ isActive }) => `lien-nav${isActive ? " actif" : ""}`}
            >
              {lien.libelle}
            </NavLink>
          ))}
          <a
            href="/borne"
            target="_blank"
            rel="noreferrer"
            className="bouton text-center no-underline text-[13px] mt-2"
          >
            Ouvrir l'écran borne
          </a>
          <div className="mt-4 border-t border-kometa-ligne pt-4 md:hidden">
            <div className="sous-titre">{utilisateur?.nom}</div>
            <button
              className="secondaire mt-2 w-full"
              onClick={() => {
                deconnecter();
                navigue("/connexion");
              }}
            >
              Déconnexion
            </button>
          </div>
        </nav>
        <div className="mt-auto hidden md:block">
          <div className="sous-titre">{utilisateur?.nom}</div>
          <button
            className="secondaire mt-2.5 w-full"
            onClick={() => {
              deconnecter();
              navigue("/connexion");
            }}
          >
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="contenu">
        <Outlet />
      </main>
    </div>
  );
}
