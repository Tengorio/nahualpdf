import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo, /api se redirige al backend FastAPI en localhost:8000,
// así el frontend habla con rutas relativas y no hay CORS que pelear.
export default defineConfig({
  plugins: [react()],
  server: {
    // host: true → escucha en 0.0.0.0, accesible desde la red local de Secihti
    // (útil cuando trabajas por SSH y abres desde tu navegador con la IP del server).
    host: true,
    port: 5173,
    proxy: {
      // El proxy corre del lado del server, así que basta exponer 5173.
      '/api': 'http://localhost:8000',
    },
  },
})
