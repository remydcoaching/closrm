/**
 * Email template compiler.
 * Converts JSON block structure to responsive HTML email.
 */

import type { EmailBlock, EmailBlockType } from '@/types'

/** Compile an array of email blocks into a full HTML email string. */
export function compileBlocks(blocks: EmailBlock[], previewText?: string | null): string {
  const bodyHtml = blocks.map(renderBlock).join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  ${previewText ? `<meta name="description" content="${escapeHtml(previewText)}">` : ''}
  <!--[if !mso]><!-->
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .email-wrapper { width: 100%; background-color: #f4f4f5; padding: 24px 0; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
    .block { padding: 16px 24px; }
    img { max-width: 100%; height: auto; display: block; }
    a { color: inherit; }
  </style>
  <!--<![endif]-->
</head>
<body>
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(previewText)}</div>` : ''}
  <div class="email-wrapper">
    <div class="email-container">
      ${bodyHtml}
    </div>
  </div>
</body>
</html>`
}

function renderBlock(block: EmailBlock): string {
  const renderers: Record<EmailBlockType, (config: Record<string, unknown>) => string> = {
    header: renderHeader,
    text: renderText,
    image: renderImage,
    button: renderButton,
    divider: renderDivider,
    footer: renderFooter,
  }

  const renderer = renderers[block.type]
  if (!renderer) return ''
  return renderer(block.config as Record<string, unknown>)
}

function renderHeader(config: Record<string, unknown>): string {
  const alignment = (config.alignment as string) || 'center'
  const logoUrl = config.logoUrl as string | undefined
  const title = config.title as string || ''

  let content = ''
  if (logoUrl) {
    content += `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(title)}" style="max-height:60px;margin:0 auto 12px;" />`
  }
  if (title) {
    content += `<h1 style="margin:0;font-size:24px;font-weight:700;color:#111;">${escapeHtml(title)}</h1>`
  }

  return `<div class="block" style="text-align:${alignment};padding:24px;">${content}</div>`
}

function renderText(config: Record<string, unknown>): string {
  const content = (config.content as string) || ''
  // Convert plain text line breaks to <br>, escape HTML
  const htmlContent = escapeHtml(content).replace(/\n/g, '<br>')
  return `<div class="block" style="font-size:16px;line-height:1.6;color:#333;">${htmlContent}</div>`
}

function renderImage(config: Record<string, unknown>): string {
  const src = config.src as string || ''
  const alt = config.alt as string || ''
  const alignment = (config.alignment as string) || 'center'
  const width = config.width as number | undefined

  const widthStyle = width ? `width:${width}px;` : 'width:100%;'
  const alignStyle = alignment === 'center' ? 'margin:0 auto;' : alignment === 'right' ? 'margin-left:auto;' : ''

  return `<div class="block"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="${widthStyle}${alignStyle}" /></div>`
}

function renderButton(config: Record<string, unknown>): string {
  const text = config.text as string || 'Click'
  const url = config.url as string || '#'
  const color = config.color as string || '#E53E3E'
  const textColor = config.textColor as string || '#ffffff'
  const alignment = (config.alignment as string) || 'center'

  return `<div class="block" style="text-align:${alignment};">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 28px;background-color:${color};color:${textColor};text-decoration:none;border-radius:6px;font-weight:600;font-size:16px;">${escapeHtml(text)}</a>
  </div>`
}

function renderDivider(config: Record<string, unknown>): string {
  const color = config.color as string || '#e4e4e7'
  const spacing = config.spacing as number || 16

  return `<div style="padding:${spacing}px 24px;"><hr style="border:none;border-top:1px solid ${color};margin:0;" /></div>`
}

function renderFooter(config: Record<string, unknown>): string {
  const text = config.text as string || ''
  // Unsubscribe link is injected by batch-sender, not here
  return `<div class="block" style="text-align:center;font-size:12px;color:#999;padding:16px 24px;">${escapeHtml(text)}</div>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
