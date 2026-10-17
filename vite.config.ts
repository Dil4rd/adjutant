import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { cspPlugin } from './build/csp-plugin'

// Release build → a single self-contained index.html (all JS/CSS inlined),
// with a strict Content-Security-Policy whose script hashes are computed
// from the inlined code at build time (see build/csp-plugin.ts).
export default defineConfig({
  plugins: [svelte(), viteSingleFile(), cspPlugin()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
