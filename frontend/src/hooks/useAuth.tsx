import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, effacerJeton, enregistrerJeton } from "../api/client.js";

interface UtilisateurConnecte {
  id: string;
  nom: string;
  role: string;
}

interface ContexteAuth {
  utilisateur: UtilisateurConnecte | null;
  pret: boolean;
  connecter: (email: string, motDePasse: string) => Promise<void>;
  deconnecter: () => void;
}

const ContexteAuthReact = createContext<ContexteAuth | null>(null);

export function FournisseurAuth({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<UtilisateurConnecte | null>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    const brut = localStorage.getItem("kometa_utilisateur");
    if (brut) {
      setUtilisateur(JSON.parse(brut));
    }
    setPret(true);
  }, []);

  const connecter = useCallback(async (email: string, motDePasse: string) => {
    const resultat = await api.connexion(email, motDePasse);
    enregistrerJeton(resultat.jeton);
    localStorage.setItem("kometa_utilisateur", JSON.stringify(resultat.utilisateur));
    setUtilisateur(resultat.utilisateur);
  }, []);

  const deconnecter = useCallback(() => {
    effacerJeton();
    localStorage.removeItem("kometa_utilisateur");
    setUtilisateur(null);
  }, []);

  return (
    <ContexteAuthReact.Provider value={{ utilisateur, pret, connecter, deconnecter }}>
      {children}
    </ContexteAuthReact.Provider>
  );
}

export function useAuth() {
  const contexte = useContext(ContexteAuthReact);
  if (!contexte) {
    throw new Error("useAuth doit être utilisé à l'intérieur de FournisseurAuth");
  }
  return contexte;
}
