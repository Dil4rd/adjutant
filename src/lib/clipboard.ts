// Clipboard access, with the failure modes browsers actually have.
//
// The async Clipboard API needs a secure context and a user gesture, and
// reading is the awkward half: Safari shows its own paste confirmation, and
// some browsers refuse it to web content entirely. So neither direction is
// assumed to work — each reports what happened and the UI falls back to the
// textarea the user can always paste into themselves.

export type CopyResult = { ok: true } | { ok: false; reason: string }
export type ReadResult = { ok: true; text: string } | { ok: false; reason: string }

export async function copyText(text: string): Promise<CopyResult> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return { ok: true }
    }
  } catch {
    /* fall through to the legacy path below */
  }
  // Older/locked-down browsers: a throwaway textarea plus execCommand still
  // works where the async API is unavailable or was denied.
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok ? { ok: true } : { ok: false, reason: 'The browser refused the copy.' }
  } catch {
    return { ok: false, reason: 'The browser refused the copy.' }
  }
}

export async function readText(): Promise<ReadResult> {
  if (!navigator.clipboard?.readText) {
    return { ok: false, reason: 'This browser will not let a page read the clipboard — paste into the box instead.' }
  }
  try {
    const text = await navigator.clipboard.readText()
    if (!text.trim()) return { ok: false, reason: 'The clipboard is empty.' }
    return { ok: true, text }
  } catch {
    return { ok: false, reason: 'Clipboard access was blocked — paste into the box instead.' }
  }
}
