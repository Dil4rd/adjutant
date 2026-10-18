import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText, readText } from '../src/lib/clipboard'

const withClipboard = (impl: Partial<Clipboard> | undefined) =>
  vi.stubGlobal('navigator', { clipboard: impl })

afterEach(() => vi.unstubAllGlobals())

describe('copy', () => {
  it('uses the async API when it works', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    withClipboard({ writeText } as unknown as Clipboard)
    await expect(copyText('hello')).resolves.toEqual({ ok: true })
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back when the async API is missing', async () => {
    withClipboard(undefined)
    vi.stubGlobal('document', {
      createElement: () => ({ style: {}, setAttribute() {}, select() {} }),
      body: { appendChild() {}, removeChild() {} },
      execCommand: () => true,
    })
    await expect(copyText('hello')).resolves.toEqual({ ok: true })
  })

  it('falls back when the async API rejects', async () => {
    withClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) } as unknown as Clipboard)
    vi.stubGlobal('document', {
      createElement: () => ({ style: {}, setAttribute() {}, select() {} }),
      body: { appendChild() {}, removeChild() {} },
      execCommand: () => true,
    })
    await expect(copyText('hello')).resolves.toEqual({ ok: true })
  })

  it('reports a refusal rather than throwing', async () => {
    withClipboard(undefined)
    vi.stubGlobal('document', {
      createElement: () => ({ style: {}, setAttribute() {}, select() {} }),
      body: { appendChild() {}, removeChild() {} },
      execCommand: () => false,
    })
    const r = await copyText('hello')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/refused/i)
  })
})

describe('read', () => {
  it('returns the clipboard text', async () => {
    withClipboard({ readText: vi.fn().mockResolvedValue('[]') } as unknown as Clipboard)
    await expect(readText()).resolves.toEqual({ ok: true, text: '[]' })
  })

  it('explains when the browser will not allow it', async () => {
    withClipboard({} as Clipboard)
    const r = await readText()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/paste into the box/i)
  })

  it('explains when access is blocked at the prompt', async () => {
    withClipboard({ readText: vi.fn().mockRejectedValue(new Error('NotAllowed')) } as unknown as Clipboard)
    const r = await readText()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/blocked/i)
  })

  it('treats an empty clipboard as a failure worth saying out loud', async () => {
    withClipboard({ readText: vi.fn().mockResolvedValue('   ') } as unknown as Clipboard)
    const r = await readText()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/empty/i)
  })
})
