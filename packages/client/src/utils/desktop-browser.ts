export type LinkOpenTarget = 'hermes-studio' | 'default-browser'

export const LINK_OPEN_TARGET_STORAGE_KEY = 'hermes_link_open_target'
export const DEFAULT_LINK_OPEN_TARGET: LinkOpenTarget = 'default-browser'

export function getLinkOpenTarget(): LinkOpenTarget {
  if (typeof window === 'undefined') return DEFAULT_LINK_OPEN_TARGET
  try {
    return window.localStorage.getItem(LINK_OPEN_TARGET_STORAGE_KEY) === 'hermes-studio'
      ? 'hermes-studio'
      : DEFAULT_LINK_OPEN_TARGET
  } catch {
    return DEFAULT_LINK_OPEN_TARGET
  }
}

export function setLinkOpenTarget(target: LinkOpenTarget): LinkOpenTarget {
  const normalized = target === 'hermes-studio' ? 'hermes-studio' : DEFAULT_LINK_OPEN_TARGET
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LINK_OPEN_TARGET_STORAGE_KEY, normalized)
  }
  return normalized
}

export async function openUrlInDesktopBrowser(url: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

export async function openHtmlInDesktopBrowser(html: string, title: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const blob = new Blob([html], { type: 'text/html' })
  const objectUrl = URL.createObjectURL(blob)
  const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer')
  if (!opened) {
    URL.revokeObjectURL(objectUrl)
    return false
  }
  opened.document.title = title
  return true
}
