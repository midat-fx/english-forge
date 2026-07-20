import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Web builds are served without Tauri's runtime CSP injection, so add an
// equivalent strict policy to the built HTML. Applied only at build time so the
// dev server's HMR (inline scripts + websocket) keeps working.
const buildCsp = {
  name: 'inject-build-csp',
  apply: 'build' as const,
  transformIndexHtml(html: string) {
    const csp = "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' blob: data:; media-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    return html.replace('</head>', `  <meta http-equiv="Content-Security-Policy" content="${csp}" />\n  </head>`)
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), buildCsp],
  // Bind IPv4 explicitly. Vite's default `localhost` resolves to `::1` only on
  // this machine, so a browser that tries 127.0.0.1 first gets a flat
  // ERR_CONNECTION_REFUSED even though the server is up. Tauri already passes
  // `--host 127.0.0.1` (see src-tauri/tauri.conf.json devUrl), so pinning it
  // here makes a plain `pnpm dev` reachable at the same address.
  server: { host: '127.0.0.1' },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{
            name: 'framework',
            test: /[\\/]node_modules[\\/](?:react(?:-dom|-router(?:-dom)?)?|scheduler|zustand|zod)[\\/]/,
          }],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Several route tests drive userEvent through the real 1.1 MB lexical catalog.
    // Vitest's 5s default is fine on an idle laptop and marginal on a loaded CI
    // runner; a timing-flaky suite here blocks the release bundles, because the
    // release workflow gates `tauri build` on `pnpm check`.
    testTimeout: 20_000,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules/**', 'dist/**', 'work/**', 'src-tauri/**'],
  },
})
