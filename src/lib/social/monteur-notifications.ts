/**
 * Notifications email pour le workflow monteur :
 * - Le monteur reçoit un mail quand un slot passe en `filmed` (à monter)
 * - Le coach reçoit un mail quand un slot revient en `edited` (montage prêt)
 *
 * Idempotence : on ne renvoie pas si `*_notified_at` est déjà rempli.
 * La migration 065 reset `coach_notified_at` quand le coach renvoie un slot
 * en `filmed` (= demande de retouche).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendThreadedEmail } from '@/lib/email/send-raw'
import { createServiceClient } from '@/lib/supabase/service'

interface SlotForNotif {
  id: string
  workspace_id: string
  hook: string | null
  title: string | null
  plan_date: string | null
  monteur_id: string | null
  rush_url: string | null
  final_url: string | null
  editor_notes: string | null
  monteur_notified_at: string | null
  coach_notified_at: string | null
}

interface UserRow { id: string; email: string | null; full_name: string | null }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://closrm.fr'
const FROM_EMAIL = process.env.SES_FROM_EMAIL ?? 'no-reply@closrm.fr'

function slotTitle(s: SlotForNotif): string {
  return s.hook?.trim() || s.title?.trim() || '(sans accroche)'
}

function formatDate(iso: string | null): string {
  if (!iso) return 'sans date'
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Envoie un email au monteur quand le coach passe le slot en `filmed`. */
export async function notifyMonteurFilmed(
  supabase: SupabaseClient,
  slot: SlotForNotif,
): Promise<void> {
  if (!slot.monteur_id || slot.monteur_notified_at) return

  // Service client pour bypasser la RLS sur `users` (le coach n'a pas
  // forcément le droit de lire l'email du monteur via son client auth).
  const admin = createServiceClient()
  const { data: monteur } = await admin
    .from('users').select('id, email, full_name').eq('id', slot.monteur_id).single<UserRow>()
  if (!monteur?.email) return

  const link = `${APP_URL}/acquisition/reseaux-sociaux`
  const title = slotTitle(slot)

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;color:#111">
      <h2 style="margin:0 0 8px;font-size:18px;font-weight:700">🎬 Nouvelle vidéo à monter</h2>
      <p style="margin:0 0 16px;color:#555;font-size:14px">Le coach vient de tourner et a besoin de toi.</p>
      <div style="border:1px solid #eee;border-radius:8px;padding:16px;margin-bottom:20px">
        <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">À monter pour le ${formatDate(slot.plan_date)}</div>
        <div style="font-size:16px;font-weight:600;line-height:1.3">${escapeHtml(title)}</div>
      </div>
      <a href="${link}" style="display:inline-block;padding:12px 22px;background:#8b5cf6;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Ouvrir le montage</a>
      <p style="margin:24px 0 0;font-size:11px;color:#aaa">Tu reçois ce mail parce que le coach t'a assigné ce slot dans ClosRM.</p>
    </div>
  `

  const text = `Nouvelle vidéo à monter : "${title}" — pour le ${formatDate(slot.plan_date)}.\nOuvre ton espace montage : ${link}`

  try {
    await sendThreadedEmail({
      fromEmail: FROM_EMAIL,
      fromName: 'ClosRM',
      to: monteur.email,
      subject: `🎬 À monter — ${title}`,
      bodyHtml: html,
      bodyText: text,
      workspaceId: slot.workspace_id,
    })
    await supabase
      .from('social_posts')
      .update({ monteur_notified_at: new Date().toISOString() })
      .eq('id', slot.id)
  } catch (err) {
    console.error('[monteur-notif] notifyMonteurFilmed failed:', (err as Error).message)
  }
}

/** Envoie un email au coach (workspace owner) quand le monteur passe en `edited`. */
export async function notifyCoachEdited(
  supabase: SupabaseClient,
  slot: SlotForNotif,
): Promise<void> {
  if (slot.coach_notified_at) return

  // Service client pour bypasser RLS sur users (le monteur n'a pas le droit
  // de lire les users du workspace via son client auth).
  const admin = createServiceClient()
  const { data: workspace } = await admin
    .from('workspaces').select('owner_id, name').eq('id', slot.workspace_id).single<{ owner_id: string; name: string | null }>()
  if (!workspace?.owner_id) return

  const { data: owner } = await admin
    .from('users').select('id, email, full_name').eq('id', workspace.owner_id).single<UserRow>()
  if (!owner?.email) return

  const link = `${APP_URL}/acquisition/reseaux-sociaux`
  const title = slotTitle(slot)

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;color:#111">
      <h2 style="margin:0 0 8px;font-size:18px;font-weight:700">✂️ Montage prêt à valider</h2>
      <p style="margin:0 0 16px;color:#555;font-size:14px">Le monteur vient de livrer ton montage.</p>
      <div style="border:1px solid #eee;border-radius:8px;padding:16px;margin-bottom:16px">
        <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Pour le ${formatDate(slot.plan_date)}</div>
        <div style="font-size:16px;font-weight:600;line-height:1.3;margin-bottom:12px">${escapeHtml(title)}</div>
        ${slot.final_url ? `<a href="${slot.final_url}" style="display:inline-block;font-size:13px;color:#8b5cf6;text-decoration:none">→ Voir le montage final</a>` : ''}
        ${slot.editor_notes ? `<div style="margin-top:10px;padding:10px;background:#f5f3ff;border-radius:6px;font-size:13px;color:#444"><b style="font-size:11px;color:#7c3aed">Note :</b> ${escapeHtml(slot.editor_notes)}</div>` : ''}
      </div>
      <a href="${link}" style="display:inline-block;padding:12px 22px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Valider le montage</a>
    </div>
  `

  const text = `Montage prêt à valider : "${title}".\n${slot.final_url ? `Lien : ${slot.final_url}\n` : ''}${slot.editor_notes ? `Note du monteur : ${slot.editor_notes}\n` : ''}Valider sur ClosRM : ${link}`

  try {
    await sendThreadedEmail({
      fromEmail: FROM_EMAIL,
      fromName: 'ClosRM',
      to: owner.email,
      subject: `✂️ Montage prêt — ${title}`,
      bodyHtml: html,
      bodyText: text,
      workspaceId: slot.workspace_id,
    })
    await supabase
      .from('social_posts')
      .update({ coach_notified_at: new Date().toISOString() })
      .eq('id', slot.id)
  } catch (err) {
    console.error('[monteur-notif] notifyCoachEdited failed:', (err as Error).message)
  }
}

/** Envoie un email au monteur quand le coach valide le montage (edited → ready). */
export async function notifyMonteurValidated(
  supabase: SupabaseClient,
  slot: SlotForNotif,
): Promise<void> {
  if (!slot.monteur_id) return

  const admin = createServiceClient()
  const { data: monteur } = await admin
    .from('users').select('id, email, full_name').eq('id', slot.monteur_id).single<UserRow>()
  if (!monteur?.email) return

  const link = `${APP_URL}/acquisition/reseaux-sociaux`
  const title = slotTitle(slot)

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;color:#111">
      <h2 style="margin:0 0 8px;font-size:18px;font-weight:700">✅ Montage validé !</h2>
      <p style="margin:0 0 16px;color:#555;font-size:14px">Le coach a validé ton montage. Beau boulot.</p>
      <div style="border:1px solid #eee;border-radius:8px;padding:16px;margin-bottom:20px">
        <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Pour le ${formatDate(slot.plan_date)}</div>
        <div style="font-size:16px;font-weight:600;line-height:1.3">${escapeHtml(title)}</div>
      </div>
      <a href="${link}" style="display:inline-block;padding:12px 22px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Voir le slot</a>
      <p style="margin:24px 0 0;font-size:11px;color:#aaa">Tu reçois ce mail parce que ton montage vient d'être validé sur ClosRM.</p>
    </div>
  `

  const text = `Bonne nouvelle — le coach a validé ton montage : "${title}". Voir le slot : ${link}`

  // Pas de colonne d'idempotence pour cette notif : l'API ne l'appelle que
  // sur la TRANSITION edited → ready, pas sur chaque save.
  void supabase
  try {
    await sendThreadedEmail({
      fromEmail: FROM_EMAIL,
      fromName: 'ClosRM',
      to: monteur.email,
      subject: `✅ Montage validé — ${title}`,
      bodyHtml: html,
      bodyText: text,
      workspaceId: slot.workspace_id,
    })
  } catch (err) {
    console.error('[monteur-notif] notifyMonteurValidated failed:', (err as Error).message)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
