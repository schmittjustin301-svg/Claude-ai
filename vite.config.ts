import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { chatDevProxy } from './vite-plugin-chat-dev-proxy.ts'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Listen on the LAN so a phone on the same network can reach the dev server.
    host: true,
    // Vite blocks unknown Host headers (DNS-rebinding protection), which would
    // reject a tunnel domain. Allowing only the tunnel providers keeps that
    // protection for everything else — a tunnel is needed on iOS because
    // microphone access requires a secure context, which plain LAN http is not.
    allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.io", ".loca.lt"],
  },
  plugins: [
    react(),
    tailwindcss(),
    chatDevProxy(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'GRIND EMPIRE',
        short_name: 'GRIND EMPIRE',
        description: 'Business-Tycoon App für dein Content-/Editing-Business',
        theme_color: '#050505',
        background_color: '#050505',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
})
