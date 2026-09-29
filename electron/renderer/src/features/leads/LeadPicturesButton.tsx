// "Photos manquantes (N)": fills the Instagram pictures of leads that have
// a handle but no photo, via HikerAPI (paid: about one billed request per
// lead). Always launched by the coach after a confirmation, capped per run.
import { useEffect, useState } from 'react'
import { api } from '../../lib/api-client'
import { formatDollars, HIKER_PRICE_USD } from '../../lib/hiker-price'

interface EnrichResult {
  requested: number
  updated: number
  notFound: number
  failed: number
  stoppedBy: string | null
  errors: string[]
}

const STOPPED: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'crédit HikerAPI épuisé',
  AUTH_ERROR: 'clé HikerAPI refusée',
  RATE_LIMIT: 'HikerAPI limite les requêtes, réessayez plus tard',
}

export function LeadPicturesButton({ onDone }: { onDone: () => void }) {
  const [missing, setMissing] = useState<number | null>(null)
  const [maxPerRun, setMaxPerRun] = useState(300)
  // At 0,02 € a request, runs are kept small: the coach can launch again.
  const perRun = Math.min(maxPerRun, 100)
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<string | null>(null)

  const count = () =>
    api
      .get<{ data: { missing: number; maxPerRun: number } }>('/api/instagram/lead-pictures')
      .then((r) => {
        setMissing(r.data.missing)
        setMaxPerRun(r.data.maxPerRun)
      })
      .catch(() => setMissing(null))

  useEffect(() => {
    count()
  }, [])

  if (!missing) return null

  async function run() {
    const n = Math.min(missing as number, perRun)
    const ok = window.confirm(
      `Récupérer la photo Instagram de ${n} lead${n > 1 ? 's' : ''} via HikerAPI ?\n\n` +
        `Service payant : 1 requête facturée par lead, soit ${n} requêtes ≈ ${formatDollars(n * HIKER_PRICE_USD)}.` +
        ((missing as number) > n ? `\n${(missing as number) - n} autres resteront pour un prochain lancement.` : ''),
    )
    if (!ok) return
    setRunning(true)
    setReport(null)
    try {
      const res = await api.post<{ data: EnrichResult }>('/api/instagram/lead-pictures', { limit: n })
      const d = res.data
      setReport(
        [
          `${d.updated} photo${d.updated > 1 ? 's' : ''} ajoutée${d.updated > 1 ? 's' : ''}`,
          d.notFound > 0 ? `${d.notFound} compte${d.notFound > 1 ? 's' : ''} introuvable${d.notFound > 1 ? 's' : ''} sur Instagram` : null,
          d.failed > 0 ? `${d.failed} échec${d.failed > 1 ? 's' : ''}` : null,
          d.stoppedBy ? `arrêt : ${STOPPED[d.stoppedBy] ?? d.stoppedBy}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      )
      onDone()
      count()
    } catch (err) {
      setReport(err instanceof Error ? err.message : 'Récupération impossible')
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <button type="button" className="ds-pill-button" onClick={run} disabled={running} title="Photos Instagram des leads qui n'en ont pas (HikerAPI, payant)">
        {running ? 'Récupération des photos…' : `Photos manquantes (${new Intl.NumberFormat('fr-FR').format(missing)})`}
      </button>
      {report && <span className="ds-muted">{report}</span>}
    </>
  )
}
