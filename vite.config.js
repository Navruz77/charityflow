import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// base matches the GitHub Pages repo name
export default defineConfig({
  base: '/charityflow/',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.js'] },
})
