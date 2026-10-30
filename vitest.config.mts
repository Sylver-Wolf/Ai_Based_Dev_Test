import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/renderer/src/test/setup.ts'],
    include: ['src/renderer/src/**/*.{test,spec}.{ts,tsx}'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/renderer/src/**/*.{ts,tsx}'],
      exclude: [
        'src/renderer/src/**/*.d.ts',
        'src/renderer/src/**/*.{test,spec}.{ts,tsx}',
        'src/renderer/src/test/**'
      ]
    }
  }
})
