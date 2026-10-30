import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function gestionnaireErreurs(
  erreur: unknown,
  _requete: Request,
  reponse: Response,
  _suivant: NextFunction
) {
  if (erreur instanceof ZodError) {
    reponse.status(400).json({ erreur: "Données invalides", details: erreur.flatten() });
    return;
  }

  console.error(erreur);
  const message = erreur instanceof Error ? erreur.message : "Erreur inattendue";
  reponse.status(500).json({ erreur: message });
}

export function enveloppeAsync(
  gestionnaire: (requete: Request, reponse: Response, suivant: NextFunction) => Promise<unknown>
) {
  return (requete: Request, reponse: Response, suivant: NextFunction) => {
    gestionnaire(requete, reponse, suivant).catch(suivant);
  };
}
