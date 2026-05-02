/**
 * Email compiler v2. Produit du HTML table-based inline-styled compatible
 * Outlook 2007+ / Gmail / Apple Mail / Yahoo / Spark / clients mobiles.
 *
 * Différences clés par rapport au legacy `compiler.ts` :
 *   - Layout en `<table>` imbriquées (Outlook n'interprète pas `<div>` pour
 *     le centrage et ignore `margin: auto`)
 *   - MSO conditionals `<!--[if mso]>...<![endif]-->` pour VML sur les
 *     boutons ronds (fallback sans border-radius sinon)
 *   - Styles 100% inline (pas de classes, sauf fallback dans `<style>` pour
 *     `@media`)
 *   - Dark mode natif via `@media (prefers-color-scheme: dark)` quand le
 *     preset a `style === 'dark'`
 *   - Rendu par type de bloc piloté par le preset (couleurs, typo, bouton)
 *
 * Fallback : si pas de `preset_id`, appelle `compileBlocks` (legacy) pour
 * préserver les 20 templates existants.
 */

import type {
  EmailBlock,
  EmailBlockType,
  HeaderBlockConfig,
  EmailHeroBlockConfig,
  TextBlockConfig,
  ImageBlockConfig,
  ButtonBlockConfig,
  EmailCtaBannerBlockConfig,
  DividerBlockConfig,
  EmailSpacerBlockConfig,
  EmailQuoteBlockConfig,
  EmailTestimonialsBlockConfig,
  EmailFeaturesGridBlockConfig,
  EmailVideoBlockConfig,
  EmailSocialLinksBlockConfig,
  FooterBlockConfig,
} from '@/types'
import type { EmailPreset, EmailPresetOverride } from './design-types'
import { buttonShapeToRadius } from './design-types'
import { mergePresetOverride } from './apply-preset'
import { getEmailPresetByIdOrDefault } from './presets'
import { compileBlocks as compileBlocksLegacy } from './compiler'
import { getEmailIconById, renderIconSvg, isEmailIconId } from './icons'

// ─── Public API ────────────────────────────────────────────────────────────

export interface CompileV2Input {
  blocks: EmailBlock[]
  previewText?: string | null
  presetId?: string | null
  presetOverride?: EmailPresetOverride | null
  isPreview?: boolean
}

export function compileBlocksV2(input: CompileV2Input): string {
  if (!input.presetId) {
    return compileBlocksLegacy(input.blocks, input.previewText)
  }

  const preset = mergePresetOverride(
    getEmailPresetByIdOrDefault(input.presetId),
    input.presetOverride,
  )

  const bodyHtml = input.blocks
    .map((block) => renderBlockV2(block, preset, input.isPreview))
    .join('\n')

  return buildDocument(preset, bodyHtml, input.previewText, input.isPreview)
}

// ─── Document wrapper ──────────────────────────────────────────────────────

function buildDocument(preset: EmailPreset, bodyHtml: string, previewText?: string | null, isPreview?: boolean): string {
  const isDark = preset.style === 'dark'
  const usesPlayfair = /Playfair/.test(preset.fontFamily) || /Playfair/.test(preset.headingFontFamily || '')
  const usesLora = /Lora/.test(preset.fontFamily) || /Lora/.test(preset.headingFontFamily || '')
  const usesDM = /DM\s?Sans/.test(preset.fontFamily) || /DM\s?Sans/.test(preset.headingFontFamily || '')
  const usesSourceSerif = /Source\s?Serif/.test(preset.fontFamily) || /Source\s?Serif/.test(preset.headingFontFamily || '')
  const usesRaleway = /Raleway/.test(preset.fontFamily) || /Raleway/.test(preset.headingFontFamily || '')
  let families = 'family=Inter:wght@400;500;600;700;800'
  if (usesPlayfair) families += '&family=Playfair+Display:wght@500;600;700;800'
  if (usesLora) families += '&family=Lora:wght@400;500;600;700'
  if (usesDM) families += '&family=DM+Sans:wght@400;500;600;700'
  if (usesSourceSerif) families += '&family=Source+Serif+4:wght@400;500;600;700'
  if (usesRaleway) families += '&family=Raleway:wght@400;500;600;700;800'
  const fontImport = `@import url('https://fonts.googleapis.com/css2?${families}&display=swap');`

  const colorSchemeValue = isDark ? 'dark only' : 'light only'
  const darkModeCss = isPreview || isDark
    ? ''
    : `@media (prefers-color-scheme: dark) {
    body, .email-body-bg { background-color: #0a0a0a !important; }
    .email-container { background-color: #111111 !important; }
    .email-text { color: #f4f4f5 !important; }
    .email-muted { color: #a1a1aa !important; }
  }`

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="fr">
<head>
<meta charset="utf-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="${colorSchemeValue}" />
<meta name="supported-color-schemes" content="${colorSchemeValue}" />
${previewText ? `<meta name="description" content="${escapeHtml(previewText)}" />` : ''}
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  ${fontImport}
  :root { color-scheme: ${colorSchemeValue}; }
  body { margin: 0; padding: 0; background-color: ${preset.background}; }
  table { border-collapse: collapse; }
  img { border: 0; outline: none; text-decoration: none; display: block; max-width: 100%; height: auto; }
  a { color: ${preset.primary}; }
  @media only screen and (max-width: 600px) {
    .email-container { width: 100% !important; max-width: 100% !important; }
    .mobile-stack { display: block !important; width: 100% !important; }
    .mobile-center { text-align: center !important; }
  }
  ${darkModeCss}
</style>
</head>
<body style="margin:0;padding:0;background-color:${preset.background};font-family:${preset.fontFamily};color-scheme:${colorSchemeValue};">
${previewText ? `<div style="display:none;font-size:1px;color:${preset.background};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(previewText)}</div>` : ''}
<table role="presentation" class="email-body-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${preset.background};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${preset.containerBg};border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04),0 6px 20px rgba(0,0,0,0.05);">
${bodyHtml}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

// ─── Block dispatcher ──────────────────────────────────────────────────────

function renderBlockV2(block: EmailBlock, preset: EmailPreset, isPreview?: boolean): string {
  const renderers: Record<EmailBlockType, (config: unknown, preset: EmailPreset) => string> = {
    header: (c, p) => renderHeader(c as HeaderBlockConfig, p),
    hero: (c, p) => renderHero(c as EmailHeroBlockConfig, p),
    text: (c, p) => renderText(c as TextBlockConfig, p),
    image: (c, p) => renderImage(c as ImageBlockConfig, p),
    button: (c, p) => renderButton(c as ButtonBlockConfig, p),
    cta_banner: (c, p) => renderCtaBanner(c as EmailCtaBannerBlockConfig, p),
    divider: (c, p) => renderDivider(c as DividerBlockConfig, p),
    spacer: (c, p) => renderSpacer(c as EmailSpacerBlockConfig, p),
    quote: (c, p) => renderQuote(c as EmailQuoteBlockConfig, p),
    testimonials: (c, p) => renderTestimonials(c as EmailTestimonialsBlockConfig, p),
    features_grid: (c, p) => renderFeaturesGrid(c as EmailFeaturesGridBlockConfig, p),
    video: (c, p) => renderVideo(c as EmailVideoBlockConfig, p),
    social_links: (c, p) => renderSocialLinks(c as EmailSocialLinksBlockConfig, p),
    footer: (c, p) => renderFooter(c as FooterBlockConfig, p),
  }
  const html = renderers[block.type](block.config, preset)
  if (isPreview) {
    return html.replace(/^<tr/, `<tr data-block-id="${block.id}"`)
  }
  return html
}

// ─── Block renderers ───────────────────────────────────────────────────────

function renderHeader(config: HeaderBlockConfig, preset: EmailPreset): string {
  const heading = config.title
    ? `<h1 style="margin:0;font-size:26px;font-weight:700;letter-spacing:-0.015em;color:${preset.textColor};font-family:${preset.headingFontFamily || preset.fontFamily};line-height:1.2;">${escapeHtml(config.title)}</h1>`
    : ''
  const logo = config.logoUrl
    ? `<img src="${escapeHtml(config.logoUrl)}" alt="${escapeHtml(config.title || '')}" style="max-height:44px;margin:0 auto 18px;" />`
    : ''
  return wrapBlock(
    `<td style="padding:40px 40px 8px;text-align:${config.alignment};">${logo}${heading}</td>`,
    preset,
  )
}

function renderHero(config: EmailHeroBlockConfig, preset: EmailPreset): string {
  const align = config.alignment === 'left' ? 'left' : 'center'
  const image = config.imageUrl
    ? `<img src="${escapeHtml(config.imageUrl)}" alt="${escapeHtml(config.title)}" width="520" style="width:100%;max-width:520px;border-radius:10px;margin-bottom:28px;" />`
    : ''
  const subtitle = config.subtitle
    ? `<p style="margin:0 0 28px;font-size:17px;line-height:1.6;color:${preset.mutedColor};font-family:${preset.fontFamily};">${escapeHtml(config.subtitle)}</p>`
    : ''
  const cta = config.ctaText && config.ctaUrl
    ? buttonHtml(config.ctaText, config.ctaUrl, preset)
    : ''
  return wrapBlock(
    `<td style="padding:48px 40px 40px;text-align:${align};">
      ${image}
      <h1 style="margin:0 0 14px;font-size:32px;font-weight:700;letter-spacing:-0.02em;color:${preset.textColor};font-family:${preset.headingFontFamily || preset.fontFamily};line-height:1.15;">${escapeHtml(config.title)}</h1>
      ${subtitle}
      ${cta}
    </td>`,
    preset,
  )
}

function renderText(config: TextBlockConfig, preset: EmailPreset): string {
  const isHtml = /<[a-z][\s\S]*>/i.test(config.content || '')
  const content = isHtml
    ? config.content
    : escapeHtml(config.content || '').replace(/\n/g, '<br />')
  return wrapBlock(
    `<td class="email-text" style="padding:14px 40px;font-size:16px;line-height:1.7;color:${preset.textColor};font-family:${preset.fontFamily};">${content}</td>`,
    preset,
  )
}

function renderImage(config: ImageBlockConfig, preset: EmailPreset): string {
  if (!config.src) return ''
  const width = config.width ? `${config.width}` : '520'
  const align = config.alignment === 'left' ? 'left' : config.alignment === 'right' ? 'right' : 'center'
  return wrapBlock(
    `<td style="padding:20px 40px;text-align:${align};"><img src="${escapeHtml(config.src)}" alt="${escapeHtml(config.alt || '')}" width="${width}" style="width:100%;max-width:${width}px;border-radius:10px;" /></td>`,
    preset,
  )
}

function renderButton(config: ButtonBlockConfig, preset: EmailPreset): string {
  const align = config.alignment || 'center'
  return wrapBlock(
    `<td style="padding:20px 40px;text-align:${align};">${buttonHtml(config.text, config.url, preset, config.color)}</td>`,
    preset,
  )
}

function renderCtaBanner(config: EmailCtaBannerBlockConfig, preset: EmailPreset): string {
  const bg = config.backgroundColor || preset.primary
  const textColor = '#ffffff'
  return wrapBlock(
    `<td style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${bg};">
        <tr>
          <td style="padding:44px 40px;text-align:center;">
            <p style="margin:0 0 22px;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:${textColor};font-family:${preset.headingFontFamily || preset.fontFamily};line-height:1.3;">${escapeHtml(config.text)}</p>
            ${buttonHtml(config.ctaText, config.ctaUrl, preset, '#ffffff', bg)}
          </td>
        </tr>
      </table>
    </td>`,
    preset,
  )
}

function renderDivider(config: DividerBlockConfig, preset: EmailPreset): string {
  const color = config.color || (preset.style === 'dark' ? '#262626' : '#eeeef0')
  const spacing = config.spacing ?? 20
  return wrapBlock(
    `<td style="padding:${spacing}px 40px;"><div style="height:1px;background-color:${color};line-height:1px;font-size:0;">&nbsp;</div></td>`,
    preset,
  )
}

function renderSpacer(config: EmailSpacerBlockConfig, preset: EmailPreset): string {
  return wrapBlock(
    `<td style="padding:0;"><div style="height:${config.height}px;line-height:${config.height}px;font-size:0;">&nbsp;</div></td>`,
    preset,
  )
}

function renderQuote(config: EmailQuoteBlockConfig, preset: EmailPreset): string {
  const author = config.author
    ? `<p style="margin:14px 0 0;font-size:13px;color:${preset.mutedColor};font-weight:500;font-style:normal;">— ${escapeHtml(config.author)}</p>`
    : ''
  return wrapBlock(
    `<td style="padding:16px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:24px 28px;background-color:${preset.footerBg};border-left:3px solid ${preset.primary};border-radius:4px;">
            <p style="margin:0;font-size:18px;line-height:1.55;color:${preset.textColor};font-style:italic;font-family:${preset.headingFontFamily || preset.fontFamily};">« ${escapeHtml(config.text)} »</p>
            ${author}
          </td>
        </tr>
      </table>
    </td>`,
    preset,
  )
}

function renderTestimonials(config: EmailTestimonialsBlockConfig, preset: EmailPreset): string {
  const items = (config.items || [])
    .map(
      (t) => `<tr>
        <td style="padding:18px 0;border-top:1px solid ${preset.style === 'dark' ? '#262626' : '#eeeef0'};">
          <p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:${preset.textColor};font-family:${preset.fontFamily};">« ${escapeHtml(t.quote)} »</p>
          <p style="margin:0;font-size:12px;font-weight:600;color:${preset.textColor};letter-spacing:0.01em;">${escapeHtml(t.author)}${t.role ? ` <span style="color:${preset.mutedColor};font-weight:400;">· ${escapeHtml(t.role)}</span>` : ''}</p>
        </td>
      </tr>`,
    )
    .join('')
  return wrapBlock(
    `<td style="padding:16px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>
    </td>`,
    preset,
  )
}

function renderFeaturesGrid(config: EmailFeaturesGridBlockConfig, preset: EmailPreset): string {
  const cols = config.columns || 2
  const cellWidth = cols === 3 ? 160 : 240
  const items = (config.items || [])
  const rows: string[] = []
  for (let i = 0; i < items.length; i += cols) {
    const rowItems = items.slice(i, i + cols)
    const cells = rowItems
      .map(
        (f) => `<td class="mobile-stack" align="center" width="${cellWidth}" style="padding:20px 14px;vertical-align:top;">
          ${f.icon ? renderFeatureIcon(f.icon, preset.primary) : ''}
          <h3 style="margin:0 0 6px;font-size:15px;font-weight:700;letter-spacing:-0.005em;color:${preset.textColor};font-family:${preset.headingFontFamily || preset.fontFamily};">${escapeHtml(f.title)}</h3>
          <p style="margin:0;font-size:13px;line-height:1.55;color:${preset.mutedColor};">${escapeHtml(f.description)}</p>
        </td>`,
      )
      .join('')
    rows.push(`<tr>${cells}</tr>`)
  }
  return wrapBlock(
    `<td style="padding:16px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table>
    </td>`,
    preset,
  )
}

function renderVideo(config: EmailVideoBlockConfig, preset: EmailPreset): string {
  if (!config.thumbnailUrl || !config.linkUrl) return ''
  const caption = config.caption
    ? `<p style="margin:12px 0 0;text-align:center;font-size:14px;color:${preset.primary};font-weight:600;">${escapeHtml(config.caption)}</p>`
    : ''
  return wrapBlock(
    `<td style="padding:16px 32px;text-align:center;">
      <a href="${escapeHtml(config.linkUrl)}" style="text-decoration:none;">
        <img src="${escapeHtml(config.thumbnailUrl)}" alt="Voir la vidéo" width="536" style="width:100%;max-width:536px;border-radius:6px;" />
      </a>
      ${caption}
    </td>`,
    preset,
  )
}

function renderSocialLinks(config: EmailSocialLinksBlockConfig, preset: EmailPreset): string {
  const links: string[] = []
  const items: [keyof EmailSocialLinksBlockConfig, string][] = [
    ['instagram', 'Instagram'],
    ['facebook', 'Facebook'],
    ['linkedin', 'LinkedIn'],
    ['twitter', 'Twitter'],
    ['youtube', 'YouTube'],
    ['telegram', 'Telegram'],
    ['website', 'Site web'],
  ]
  for (const [key, label] of items) {
    const url = config[key]
    if (url) {
      links.push(
        `<a href="${escapeHtml(url)}" style="display:inline-block;padding:7px 14px;margin:0 3px 6px;background-color:transparent;color:${preset.mutedColor};text-decoration:none;border:1px solid ${preset.style === 'dark' ? '#262626' : '#eeeef0'};border-radius:999px;font-size:12px;font-weight:500;letter-spacing:0.01em;">${label}</a>`,
      )
    }
  }
  if (!links.length) return ''
  return wrapBlock(
    `<td style="padding:20px 40px;text-align:center;">${links.join('')}</td>`,
    preset,
  )
}

function renderFooter(config: FooterBlockConfig, preset: EmailPreset): string {
  return `<tr>
    <td style="background-color:${preset.footerBg};padding:28px 40px;text-align:center;">
      <p class="email-muted" style="margin:0;font-size:12px;line-height:1.6;color:${preset.mutedColor};font-family:${preset.fontFamily};letter-spacing:0.01em;">${escapeHtml(config.text || '')}</p>
    </td>
  </tr>`
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function wrapBlock(innerHtml: string, _preset: EmailPreset): string {
  return `<tr>${innerHtml}</tr>`
}

function buttonHtml(
  text: string,
  url: string,
  preset: EmailPreset,
  bgColor?: string,
  outerBg?: string,
): string {
  const bg = bgColor || preset.primary
  const radius = buttonShapeToRadius(preset.buttonShape)
  const shadow = preset.buttonShadow ? `box-shadow:0 1px 2px rgba(0,0,0,0.1),0 4px 12px ${bg}33;` : ''
  const msoHeight = 46
  const msoWidth = text.length * 11 + 64
  return `<div>
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(url)}" style="height:${msoHeight}px;v-text-anchor:middle;width:${msoWidth}px;" arcsize="${Math.round((radius / msoHeight) * 100)}%" stroke="f" fillcolor="${bg}">
    <w:anchorlock/>
    <center style="color:#ffffff;font-family:${preset.fontFamily};font-size:15px;font-weight:600;letter-spacing:-0.005em;">${escapeHtml(text)}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 32px;background-color:${bg};color:#ffffff;text-decoration:none;border-radius:${radius}px;font-weight:600;font-size:15px;letter-spacing:-0.005em;font-family:${preset.fontFamily};${shadow}${outerBg ? `border:1px solid ${outerBg};` : ''}">${escapeHtml(text)}</a>
    <!--<![endif]-->
  </div>`
}

function renderFeatureIcon(iconValue: string, primaryColor: string): string {
  if (isEmailIconId(iconValue)) {
    const icon = getEmailIconById(iconValue)
    if (icon) {
      return `<div style="margin-bottom:12px;line-height:0;">${renderIconSvg(icon, primaryColor, 28)}</div>`
    }
  }
  return `<div style="font-size:28px;margin-bottom:12px;line-height:1;">${escapeHtml(iconValue)}</div>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
