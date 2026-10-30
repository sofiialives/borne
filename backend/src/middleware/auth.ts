import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { utilisateurs } from "../db/schema.js";

export interface RequeteAuthentifiee extends Request {
  utilisateur?: { id: string; role: string; email: string };
}

export async function exigerAuthentification(
  requete: RequeteAuthentifiee,
  reponse: Response,
  suivant: NextFunction
) {
  const entete = requete.headers.authorization;
  if (!entete?.startsWith("Bearer ")) {
    return reponse.status(401).json({ erreur: "Authentification requise" });
  }

  try {
    const jeton = entete.slice("Bearer ".length);
    const charge = jwt.verify(jeton, process.env.JWT_SECRET ?? "change-moi") as {
      id: string;
      role: string;
      email: string;
    };

    const [utilisateur] = await db
      .select({ id: utilisateurs.id })
      .from(utilisateurs)
      .where(eq(utilisateurs.id, charge.id));
    if (!utilisateur) {
      return reponse.status(401).json({ erreur: "Session expirée, reconnectez-vous" });
    }

    requete.utilisateur = charge;
    suivant();
  } catch {
    return reponse.status(401).json({ erreur: "Jeton invalide ou expiré" });
  }
}

export function exigerRole(role: string) {
  return (requete: RequeteAuthentifiee, reponse: Response, suivant: NextFunction) => {
    if (requete.utilisateur?.role !== role) {
      return reponse.status(403).json({ erreur: "Accès refusé" });
    }
    suivant();
  };
}
