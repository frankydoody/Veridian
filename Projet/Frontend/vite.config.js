import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Adresse du backend ; BACKEND_URL permet d'en lancer un second (ex. sur une base de test)
      '/api': process.env.BACKEND_URL || 'http://localhost:3000',
    },
  },
})
