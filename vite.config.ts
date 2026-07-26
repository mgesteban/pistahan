import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Pistahan 33 Check-In',
        short_name: 'Pistahan 33',
        description: 'Volunteer check-in scanner for the 33rd Annual Pistahan Parade & Festival',
        start_url: '/',
        display: 'standalone',
        background_color: '#101828',
        theme_color: '#101828',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        // App shell must boot with zero connectivity on event day
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}']
      }
    })
  ]
})
