import type { Plugin } from 'vite'
import { createHash } from 'node:crypto'

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('base64')
}

/**
 * Runs AFTER vite-plugin-singlefile has inlined every script/style into the
 * final index.html. We hash each inline <script> body and emit a strict CSP
 * <meta> that locks script execution to exactly those hashes — so even an
 * injected <script> (XSS) cannot run and read the decrypted roadmap.
 *
 * Adjutant talks to no network at all, so unlike an API-backed app this can
 * run `connect-src 'none'`: there is no origin an injected script could
 * exfiltrate to, even if it somehow executed.
 *
 * Only applied to the production bundle; the dev server keeps its normal
 * (HMR-friendly) CSP-free behaviour.
 */
export function cspPlugin(): Plugin {
  return {
    name: 'inline-csp',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue

        let html =
          typeof file.source === 'string'
            ? file.source
            : Buffer.from(file.source).toString('utf8')

        const scriptHashes = new Set<string>()
        const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
        for (const m of html.matchAll(scriptRe)) {
          const body = m[1]
          if (body && body.trim().length) scriptHashes.add(`'sha256-${sha256(body)}'`)
        }

        const csp = [
          `default-src 'none'`,
          `script-src ${[...scriptHashes].join(' ') || `'none'`}`,
          // Inline <style> blocks + element style attributes (block geometry).
          `style-src 'self' 'unsafe-inline'`,
          `img-src 'self' data:`,
          `connect-src 'none'`,
          `base-uri 'none'`,
          `form-action 'none'`,
          // NB: no `frame-ancestors` — browsers ignore it when delivered via
          // <meta> and log a console error for it. Clickjacking protection has
          // to come from a real header (X-Frame-Options / frame-ancestors) on
          // whatever serves this file; see README.
        ].join('; ')

        const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`
        html = /<head[^>]*>/i.test(html)
          ? html.replace(/<head([^>]*)>/i, `<head$1>\n    ${meta}`)
          : meta + html

        file.source = html
      }
    },
  }
}
