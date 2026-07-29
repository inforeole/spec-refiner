import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {},
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Ne pas scanner les copies de repo dans les worktrees locaux.
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/.worktrees/**'],
  },
})
