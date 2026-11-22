import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // rule logic is DOM-free; component tests opt in with a `/** @vitest-environment jsdom */` docblock
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}', 'shared/**/*.test.js', 'server/src/**/*.test.js'],
    setupFiles: ['./src/test/setup.js'],
  },
})
