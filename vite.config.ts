/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// Served from the same GitHub Pages path as the original app so existing users keep their progress.
// `--mode staging` makes a separate test copy (own path, own storage key) for trying the app on phones.
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const testBuild = mode === 'staging'
  const base = testBuild ? '/eloisesport-test/' : '/eloisesportapp/'
  return {
    base,
    define: { __APP_VERSION__: JSON.stringify(pkg.version), __TEST_BUILD__: JSON.stringify(testBuild) },
    build: { outDir: testBuild ? 'dist-test' : 'dist' },
    plugins: [
      svelte(),
      VitePWA({
        // Same worker URL as the original app (sw.js), so installed copies update in place.
        filename: 'sw.js',
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon-48.png', 'apple-touch-icon.png', 'logo-mark-light.png'],
        manifest: {
          name: testBuild ? 'Eloise Sport (test)' : 'Eloise Sport',
          short_name: testBuild ? 'Eloise Test' : 'Eloise Sport',
          description: 'Programme sportif de 12 semaines pour fessiers, cuisses et ventre plat.',
          lang: 'fr',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#050505',
          theme_color: '#050505',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      include: ['test/**/*.test.ts'],
    },
  }
})
