import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// base is '/' since the Express server on Render serves dist/ at the root
// (no GitHub Pages subpath anymore).
export default defineConfig({
  base: '/',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.js', 'server/**/*.test.js'] },
})
