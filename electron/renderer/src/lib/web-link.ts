// Opens a page of the ClosRM web app in the default browser — used for the
// heavy visual editors (funnel/email/workflow builders) that live on the web.
const WEB_URL = ((import.meta.env.VITE_CLOSRM_WEB_URL as string) || 'http://localhost:3000').replace(/\/$/, '')

export function webUrl(path: string): string {
  return `${WEB_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export function openWeb(path: string): Promise<void> {
  const url = webUrl(path)
  if (window.closrm?.openExternal) return window.closrm.openExternal(url)
  window.open(url, '_blank', 'noopener,noreferrer')
  return Promise.resolve()
}
