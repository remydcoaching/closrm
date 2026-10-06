// Copie du contrat du Hub (repo hub, src/contrats/commun.ts + closrm.ts).
// Toute modification ici doit être reportée dans le Hub, et inversement.
import { z } from "zod";

export const actionSchema = z.object({
  id: z.string().min(1),
  libelle: z.string().min(1),
  urgence: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  echeance: z.string().optional(),
  duree: z.string().optional(),
  lien: z.url(),
});
export type Action = z.infer<typeof actionSchema>;

export const importanceSchema = z.enum(["calme", "a_signaler", "urgent"]);
export type Importance = z.infer<typeof importanceSchema>;

export function reponseHubSchema<A extends string, D extends z.ZodType>(appli: A, donnees: D) {
  return z.object({
    version: z.literal(1),
    appli: z.literal(appli),
    genereLe: z.string(),
    derniereActivite: z.string().nullable(),
    importance: importanceSchema,
    actions: z.array(actionSchema),
    donnees,
  });
}


const kpi = z.object({ valeur: z.number(), deltaPct: z.number().nullable(), sparkline: z.array(z.number()) });

export const donneesClosrmSchema = z.object({
  plan: z.array(z.object({
    type: z.enum(["booking", "hot_lead", "overdue_followup", "no_show"]),
    nom: z.string(),
    contexte: z.string(),
    heure: z.string().nullable(),
  })),
  relancesEnAttente: z.number(),
  kpis: z.object({ cash: kpi, showRate: kpi, closeRate: kpi }),
  chauds: z.array(z.object({ nom: z.string(), contexte: z.string() })),
  aRisque: z.number(),
});
export type DonneesClosrm = z.infer<typeof donneesClosrmSchema>;
export const reponseClosrmSchema = reponseHubSchema("closrm", donneesClosrmSchema);

export type ReponseClosrm = z.infer<typeof reponseClosrmSchema>;
