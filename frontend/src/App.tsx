import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
import { MiseEnPage } from "./components/MiseEnPage.js";
import { Connexion } from "./pages/Connexion.js";
import { TableauDeBord } from "./pages/TableauDeBord.js";
import { Produits } from "./pages/Produits.js";
import { Tarification } from "./pages/Tarification.js";
import { Zones } from "./pages/Zones.js";
import { Bornes } from "./pages/Bornes.js";
import { Stocks } from "./pages/Stocks.js";
import { Ventes } from "./pages/Ventes.js";
import { Evenements } from "./pages/Evenements.js";
import { Simulations } from "./pages/Simulations.js";
import { SelectionBorne } from "./pages/SelectionBorne.js";
import { Borne } from "./pages/Borne.js";

export default function App() {
  const { utilisateur, pret } = useAuth();

  if (!pret) return null;

  return (
    <Routes>
      <Route path="/borne" element={<SelectionBorne />} />
      <Route path="/borne/:borneId" element={<Borne />} />
      {!utilisateur ? (
        <Route path="*" element={<Connexion />} />
      ) : (
        <Route element={<MiseEnPage />}>
          <Route path="/" element={<TableauDeBord />} />
          <Route path="/produits" element={<Produits />} />
          <Route path="/tarification" element={<Tarification />} />
          <Route path="/zones" element={<Zones />} />
          <Route path="/bornes" element={<Bornes />} />
          <Route path="/stocks" element={<Stocks />} />
          <Route path="/ventes" element={<Ventes />} />
          <Route path="/evenements" element={<Evenements />} />
          <Route path="/simulations" element={<Simulations />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}
