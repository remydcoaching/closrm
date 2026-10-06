import { timingSafeEqual } from "node:crypto";

/** Bearer HUB_SECRET, comparé en temps constant. Faux si le secret n'est pas configuré. */
export function hubAutorise(request: Request, secret = process.env.HUB_SECRET): boolean {
  if (!secret) return false;
  const recu = Buffer.from(request.headers.get("authorization") ?? "");
  const attendu = Buffer.from(`Bearer ${secret}`);
  return recu.length === attendu.length && timingSafeEqual(recu, attendu);
}
