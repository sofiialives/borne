import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { utilisateurs } from "../db/schema.js";
import { enveloppeAsync } from "../middleware/erreurs.js";

export const routeurAuth = Router();

const schemaConnexion = z.object({
  email: z.string().email(),
  motDePasse: z.string().min(1),
});

routeurAuth.post(
  "/connexion",
  enveloppeAsync(async (requete, reponse) => {
    const { email, motDePasse } = schemaConnexion.parse(requete.body);

    const [utilisateur] = await db.select().from(utilisateurs).where(eq(utilisateurs.email, email));
    if (!utilisateur) {
      return reponse.status(401).json({ erreur: "Identifiants invalides" });
    }

    const motDePasseValide = await bcrypt.compare(motDePasse, utilisateur.motDePasseHash);
    if (!motDePasseValide) {
      return reponse.status(401).json({ erreur: "Identifiants invalides" });
    }

    const jeton = jwt.sign(
      { id: utilisateur.id, role: utilisateur.role, email: utilisateur.email },
      process.env.JWT_SECRET ?? "change-moi",
      { expiresIn: "12h" }
    );

    reponse.json({ jeton, utilisateur: { id: utilisateur.id, nom: utilisateur.nom, role: utilisateur.role } });
  })
);
