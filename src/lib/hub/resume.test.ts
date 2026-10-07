import { describe, it, expect } from "vitest";
import { resumeClosrm } from "./resume";
import { reponseClosrmSchema } from "./contrat";

const kpi = (current: number) => ({ current, previous: 0, delta_pct: null, sparkline: [1, 2] });
const kpis = { cash_collected: kpi(3200), show_rate: kpi(78), close_rate: kpi(31), cost_per_booking: null, pipeline_value: kpi(0) };
const base = { kpis, chauds: [], risques: [], relances: 0, derniereActivite: null, origine: "https://closrm.test", maintenant: new Date("2026-10-06T08:00:00Z") };

describe("resumeClosrm", () => {
  it("respecte le contrat et est calme sans rien", () => {
    const r = resumeClosrm({ ...base, plan: [] });
    expect(() => reponseClosrmSchema.parse(r)).not.toThrow();
    expect(r.importance).toBe("calme");
    expect(r.donnees.kpis.cash.valeur).toBe(3200);
  });
  it("signale un RDV ou des relances, avec l'heure de Paris", () => {
    const r = resumeClosrm({ ...base, relances: 5, plan: [{ type: "booking", lead_id: "1", lead_name: "Julie M.", context: "RDV 14:00", scheduled_at: "2026-10-06T12:00:00Z", priority: 1 }] });
    expect(r.importance).toBe("a_signaler");
    expect(r.donnees.plan[0].heure).toBe("14:00");
    expect(r.actions).toEqual([{ id: "closrm:relances", libelle: "5 relances en attente", urgence: 2, lien: "https://closrm.test/follow-ups" }]);
  });
  it("devient urgent avec un no-show à recaler", () => {
    const r = resumeClosrm({ ...base, plan: [{ type: "no_show", lead_id: "9", lead_name: "Karim B.", context: "No-show à reprogrammer", priority: 3 }] });
    expect(r.importance).toBe("urgent");
    expect(r.actions[0]).toMatchObject({ id: "closrm:no-show:9", libelle: "Recaler le no-show de Karim B.", urgence: 3 });
  });
});
