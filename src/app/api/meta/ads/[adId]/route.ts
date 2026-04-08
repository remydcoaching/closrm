import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { decrypt } from '@/lib/meta/encryption'
import {
  getAdCreative,
  getInsights,
  extractLeadCount,
  extractCostPerLead,
  type MetaCredentials,
  type MetaAdCreative,
} from '@/lib/meta/client'

interface AdDetailResponse {
  data: {
    id: string
    name: string
    creative: MetaAdCreative | null
    kpis: {
      spend: number
      impressions: number
      clicks: number
      ctr: number
      leads: number
      cpl: number | null
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ adId: string }> }
) {
  try {
    const { adId } = await params
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Fetch Meta integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials_encrypted, is_active')
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')
      .eq('is_active', true)
      .maybeSingle()

    if (!integration?.credentials_encrypted) {
      return NextResponse.json({ error: 'Meta not connected' }, { status: 404 })
    }

    const credentials: MetaCredentials = JSON.parse(
      decrypt(integration.credentials_encrypted)
    )

    if (!credentials.ad_account_id) {
      return NextResponse.json(
        { error: 'needs_upgrade', message: 'Reconnectez Meta pour accéder aux publicités' },
        { status: 403 }
      )
    }

    // Fetch creative + insights in parallel
    const now = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 30)
    const dateFrom = from.toISOString().slice(0, 10)
    const dateTo = now.toISOString().slice(0, 10)

    const [creative, insightRows] = await Promise.all([
      getAdCreative(adId, credentials.user_access_token),
      getInsights(credentials.ad_account_id, credentials.user_access_token, {
        level: 'ad',
        dateFrom,
        dateTo,
      }),
    ])

    // Find the row matching this specific ad
    const adRow = insightRows.find(r => r.ad_id === adId)

    const spend = adRow ? parseFloat(adRow.spend || '0') : 0
    const impressions = adRow ? parseInt(adRow.impressions || '0', 10) : 0
    const clicks = adRow ? parseInt(adRow.clicks || '0', 10) : 0
    const ctr = adRow ? parseFloat(adRow.ctr || '0') : 0
    const leads = adRow ? extractLeadCount(adRow) : 0
    const cpl = adRow ? extractCostPerLead(adRow) : null

    const response: AdDetailResponse = {
      data: {
        id: adId,
        name: creative?.name ?? adId,
        creative,
        kpis: {
          spend: Math.round(spend * 100) / 100,
          impressions,
          clicks,
          ctr: Math.round(ctr * 100) / 100,
          leads,
          cpl: cpl !== null ? Math.round(cpl * 100) / 100 : null,
        },
      },
    }

    return NextResponse.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message === 'META_TOKEN_EXPIRED') {
      return NextResponse.json(
        { error: 'token_expired', message: 'Reconnectez votre compte Meta' },
        { status: 401 }
      )
    }
    if (message === 'META_RATE_LIMITED') {
      return NextResponse.json(
        { error: 'rate_limited', message: 'Trop de requêtes, réessayez dans quelques minutes' },
        { status: 429 }
      )
    }
    if (message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.error('Meta ad detail error:', err)
    return NextResponse.json(
      { error: 'meta_error', message: 'Erreur lors de la récupération des données' },
      { status: 502 }
    )
  }
}
