import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // Handle SPA routing - all paths serve index.html
    historyApiFallback: true,
  },
})
