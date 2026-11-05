import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/renderer/tests/setup.ts'],
    include: ['src/renderer/tests/**/*.{test,spec}.{ts,tsx}'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/renderer/src/**/*.{ts,tsx}'],
      exclude: [
        'src/renderer/src/**/*.d.ts',
        'src/renderer/src/**/*.{test,spec}.{ts,tsx}',
        'src/renderer/tests/**'
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
        perFile: {
          statements: 50,
          branches: 50,
          functions: 50,
          lines: 50
        }
      }
    }
  }
})
