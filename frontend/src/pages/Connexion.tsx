import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

export function Connexion() {
  const { connecter } = useAuth();
  const navigue = useNavigate();
  const [email, setEmail] = useState("admin@kometa-bornes.fr");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    try {
      await connecter(email, motDePasse);
      navigue("/");
    } catch (erreurConnexion) {
      setErreur(erreurConnexion instanceof Error ? erreurConnexion.message : "Erreur");
    }
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <form onSubmit={soumettre} className="carte carte-verre" style={{ width: 360, padding: 32 }}>
        <div className="titre-marque texte-degrade" style={{ fontSize: 30, marginBottom: 4 }}>
          KOMETA
        </div>
        <div className="sous-titre" style={{ marginBottom: 28 }}>
          Pilotage des bornes de tarification dynamique
        </div>

        <label className="sous-titre" style={{ display: "block", marginBottom: 6 }}>
          Email
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", marginBottom: 16 }}
        />

        <label className="sous-titre" style={{ display: "block", marginBottom: 6 }}>
          Mot de passe
        </label>
        <input
          type="password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          style={{ width: "100%", marginBottom: 20 }}
        />

        {erreur && <div style={{ color: "#ff5c5c", fontSize: 13, marginBottom: 16 }}>{erreur}</div>}

        <button type="submit" style={{ width: "100%" }}>
          Se connecter
        </button>
      </form>
    </div>
  );
}
