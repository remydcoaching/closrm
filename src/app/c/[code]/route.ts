import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractYoutubeId, youtubeThumbnail, isLinkPreviewBot } from '@/lib/lead-magnets/youtube'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const homepage = new URL('/', request.url).toString()
  const userAgent = request.headers.get('user-agent')

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('tracked_links')
      .select('id, lead_magnet_id, clicks_count, first_clicked_at, lead_magnets(title, url, platform)')
      .eq('short_code', code)
      .maybeSingle()

    if (error || !data || !data.lead_magnets) {
      return NextResponse.redirect(homepage, 302)
    }

    const lm = data.lead_magnets as unknown as { title: string; url: string; platform: string }
    const targetUrl = lm.url

    // Bot link-preview (IG, WhatsApp, FB, Twitter…) → HTML avec OG tags
    // PAS d'incrément clics (c'est un scraper, pas un humain).
    if (isLinkPreviewBot(userAgent)) {
      const html = buildPreviewHtml({ title: lm.title, url: targetUrl, platform: lm.platform })
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    const now = new Date().toISOString()
    // Fire-and-forget update (ne pas bloquer le redirect)
    supabase
      .from('tracked_links')
      .update({
        clicks_count: (data.clicks_count ?? 0) + 1,
        last_clicked_at: now,
        first_clicked_at: data.first_clicked_at ?? now,
      })
      .eq('id', data.id)
      .then(() => {})

    return NextResponse.redirect(targetUrl, 302)
  } catch {
    return NextResponse.redirect(homepage, 302)
  }
}

function buildPreviewHtml({ title, url, platform }: { title: string; url: string; platform: string }): string {
  let ogImage = ''
  if (platform === 'youtube') {
    const id = extractYoutubeId(url)
    if (id) ogImage = youtubeThumbnail(id)
  }

  const safeTitle = escapeHtml(title)
  const safeUrl = escapeHtml(url)

  const ogImageTag = ogImage
    ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />
       <meta name="twitter:image" content="${escapeHtml(ogImage)}" />`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:type" content="video.other" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  ${ogImageTag}
  <title>${safeTitle}</title>
</head>
<body>
  <p><a href="${safeUrl}">${safeTitle}</a></p>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
