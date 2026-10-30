DO $$ BEGIN
 CREATE TYPE "public"."mode_prix" AS ENUM('AUTOMATIQUE', 'MANUEL', 'FIXE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."role_utilisateur" AS ENUM('ADMIN', 'OPERATEUR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."source_prix" AS ENUM('REGLE', 'MANUEL', 'IA');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."statut_borne" AS ENUM('ACTIF', 'HORS_LIGNE', 'MAINTENANCE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."statut_reapprovisionnement" AS ENUM('PLANIFIE', 'EN_COURS', 'TERMINE', 'ANNULE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."statut_sync_vente" AS ENUM('LOCAL', 'SYNCHRONISE', 'EN_CONFLIT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."strategie_simulation" AS ENUM('DYNAMIQUE', 'FIXE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."type_journal_technique" AS ENUM('DECONNEXION', 'RECONNEXION', 'CHANGEMENT_PRIX', 'ALERTE_STOCK', 'VENTE_SYNCHRONISEE', 'REGLE_DECLENCHEE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."type_zone" AS ENUM('GARE', 'CAMPUS', 'ZONE_AFFAIRES');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bornes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text NOT NULL,
	"zone_id" uuid NOT NULL,
	"statut" "statut_borne" DEFAULT 'ACTIF' NOT NULL,
	"derniere_sync_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "couts_achat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produit_id" uuid NOT NULL,
	"fournisseur" text NOT NULL,
	"prix_achat" numeric(10, 2) NOT NULL,
	"quantite" integer NOT NULL,
	"date_achat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evenements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"zone_id" uuid NOT NULL,
	"date_debut" timestamp with time zone NOT NULL,
	"date_fin" timestamp with time zone NOT NULL,
	"impact_demande" numeric(5, 2) DEFAULT '1.0' NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_technique" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "type_journal_technique" NOT NULL,
	"borne_id" uuid,
	"produit_id" uuid,
	"donnees" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prix_courants" (
	"produit_id" uuid NOT NULL,
	"borne_id" uuid NOT NULL,
	"valeur" numeric(10, 2) NOT NULL,
	"mode" "mode_prix" DEFAULT 'AUTOMATIQUE' NOT NULL,
	"source" "source_prix" DEFAULT 'MANUEL' NOT NULL,
	"raison" text DEFAULT '' NOT NULL,
	"mis_a_jour_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prix_courants_produit_id_borne_id_pk" PRIMARY KEY("produit_id","borne_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prix_historique" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produit_id" uuid NOT NULL,
	"borne_id" uuid NOT NULL,
	"valeur_precedente" numeric(10, 2) NOT NULL,
	"valeur" numeric(10, 2) NOT NULL,
	"mode" "mode_prix" NOT NULL,
	"source" "source_prix" NOT NULL,
	"raison" text DEFAULT '' NOT NULL,
	"cree_par_utilisateur_id" uuid,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "produits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"nom" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"categorie" text NOT NULL,
	"prix_reference" numeric(10, 2) NOT NULL,
	"cout_achat_actuel" numeric(10, 2) NOT NULL,
	"prix_min" numeric(10, 2) NOT NULL,
	"prix_max" numeric(10, 2) NOT NULL,
	"prix_stable" boolean DEFAULT false NOT NULL,
	"suivi_dlc" boolean DEFAULT false NOT NULL,
	"marge_minimale" numeric(5, 4) DEFAULT '0.05' NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"mis_a_jour_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produits_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reapprovisionnements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produit_id" uuid NOT NULL,
	"borne_id" uuid NOT NULL,
	"quantite" integer NOT NULL,
	"statut" "statut_reapprovisionnement" DEFAULT 'PLANIFIE' NOT NULL,
	"date_prevue" timestamp with time zone NOT NULL,
	"date_reelle" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regles_de_prix" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text NOT NULL,
	"type" text NOT NULL,
	"parametres" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"priorite" integer DEFAULT 100 NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"mis_a_jour_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "simulation_resultats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"simulation_run_id" uuid NOT NULL,
	"strategie" "strategie_simulation" NOT NULL,
	"marge_cumulee" numeric(12, 2) NOT NULL,
	"chiffre_affaires" numeric(12, 2) NOT NULL,
	"unites_vendues" integer NOT NULL,
	"evolution_prix" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "simulation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text NOT NULL,
	"duree_jours" integer DEFAULT 60 NOT NULL,
	"zone_id" uuid,
	"parametres" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cree_par_utilisateur_id" uuid,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produit_id" uuid NOT NULL,
	"borne_id" uuid NOT NULL,
	"quantite" integer DEFAULT 0 NOT NULL,
	"seuil_alerte" integer DEFAULT 5 NOT NULL,
	"date_expiration" timestamp with time zone,
	"mis_a_jour_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "utilisateurs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nom" text NOT NULL,
	"mot_de_passe_hash" text NOT NULL,
	"role" "role_utilisateur" DEFAULT 'OPERATEUR' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "utilisateurs_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ventes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" text NOT NULL,
	"borne_id" uuid NOT NULL,
	"produit_id" uuid NOT NULL,
	"quantite" integer NOT NULL,
	"prix_unitaire" numeric(10, 2) NOT NULL,
	"montant_total" numeric(10, 2) NOT NULL,
	"mode_paiement" text DEFAULT 'CARTE' NOT NULL,
	"statut_sync" "statut_sync_vente" DEFAULT 'SYNCHRONISE' NOT NULL,
	"cree_le" timestamp with time zone NOT NULL,
	"sync_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text NOT NULL,
	"type" "type_zone" NOT NULL,
	"fuseau_horaire" text DEFAULT 'Europe/Paris' NOT NULL,
	"config_demande" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bornes" ADD CONSTRAINT "bornes_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "couts_achat" ADD CONSTRAINT "couts_achat_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evenements" ADD CONSTRAINT "evenements_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "journal_technique" ADD CONSTRAINT "journal_technique_borne_id_bornes_id_fk" FOREIGN KEY ("borne_id") REFERENCES "public"."bornes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "journal_technique" ADD CONSTRAINT "journal_technique_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prix_courants" ADD CONSTRAINT "prix_courants_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prix_courants" ADD CONSTRAINT "prix_courants_borne_id_bornes_id_fk" FOREIGN KEY ("borne_id") REFERENCES "public"."bornes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prix_historique" ADD CONSTRAINT "prix_historique_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prix_historique" ADD CONSTRAINT "prix_historique_borne_id_bornes_id_fk" FOREIGN KEY ("borne_id") REFERENCES "public"."bornes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prix_historique" ADD CONSTRAINT "prix_historique_cree_par_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reapprovisionnements" ADD CONSTRAINT "reapprovisionnements_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reapprovisionnements" ADD CONSTRAINT "reapprovisionnements_borne_id_bornes_id_fk" FOREIGN KEY ("borne_id") REFERENCES "public"."bornes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "simulation_resultats" ADD CONSTRAINT "simulation_resultats_simulation_run_id_simulation_runs_id_fk" FOREIGN KEY ("simulation_run_id") REFERENCES "public"."simulation_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_cree_par_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stocks" ADD CONSTRAINT "stocks_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stocks" ADD CONSTRAINT "stocks_borne_id_bornes_id_fk" FOREIGN KEY ("borne_id") REFERENCES "public"."bornes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ventes" ADD CONSTRAINT "ventes_borne_id_bornes_id_fk" FOREIGN KEY ("borne_id") REFERENCES "public"."bornes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ventes" ADD CONSTRAINT "ventes_produit_id_produits_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stocks_produit_borne_unique" ON "stocks" USING btree ("produit_id","borne_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ventes_borne_local_id_unique" ON "ventes" USING btree ("borne_id","local_id");