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
  const referer = request.headers.get('referer') || 'none'
  const accept = request.headers.get('accept') || 'none'
  const isBot = isLinkPreviewBot(userAgent)

  console.log(`[/c/${code}] UA="${userAgent}" ref="${referer}" accept="${accept}" isBot=${isBot}`)

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('tracked_links')
      .select('id, lead_magnet_id, clicks_count, first_clicked_at, lead_magnets(title, url, platform)')
      .eq('short_code', code)
      .maybeSingle()

    if (error || !data || !data.lead_magnets) {
      console.log(`[/c/${code}] NOT FOUND — redirect homepage`)
      return NextResponse.redirect(homepage, 302)
    }

    const lm = data.lead_magnets as unknown as { title: string; url: string; platform: string }
    const targetUrl = lm.url

    console.log(`[/c/${code}] target="${targetUrl}" platform="${lm.platform}"`)

    // Bot link-preview (IG, WhatsApp, FB, Twitter…) → HTML avec OG tags
    // PAS d'incrément clics (c'est un scraper, pas un humain).
    if (isBot) {
      console.log(`[/c/${code}] SERVE HTML preview (bot)`)
      const html = buildPreviewHtml({ title: lm.title, url: targetUrl, platform: lm.platform })
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          // CRITIQUE : ne PAS cacher côté CDN. Sinon Vercel sert la HTML aux
          // humains qui devraient avoir le 302. Le scraper IG/FB gère son
          // propre cache de preview de son côté.
          'Cache-Control': 'private, no-store',
          'Vary': 'User-Agent',
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

    console.log(`[/c/${code}] REDIRECT 302 → ${targetUrl}`)

    // no-store sur le redirect pour éviter les caches in-app (IG WebKit)
    return new NextResponse(null, {
      status: 302,
      headers: {
        Location: targetUrl,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
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
  const safeUrlAttr = escapeHtml(url) // pour attributs HTML

  const ogImageTag = ogImage
    ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />
       <meta name="twitter:image" content="${escapeHtml(ogImage)}" />`
    : ''

  // Pour le JS : JSON.stringify sur l'URL BRUTE (pas HTML-escaped).
  // Puis on échappe `<` pour éviter un `</script>` malicieux dans le title/url.
  const jsUrl = JSON.stringify(url).replace(/</g, '\\u003c')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:url" content="${safeUrlAttr}" />
  <meta property="og:type" content="video.other" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  ${ogImageTag}
  <meta http-equiv="refresh" content="0; url=${safeUrlAttr}" />
  <title>${safeTitle}</title>
</head>
<body>
  <script>window.location.replace(${jsUrl});</script>
  <noscript><p><a href="${safeUrlAttr}">${safeTitle}</a></p></noscript>
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
