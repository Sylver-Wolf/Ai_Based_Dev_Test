import { screen, waitFor } from '@testing-library/react'
import type { Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

const mountedRoots: Root[] = []

afterEach(() => {
  mountedRoots.splice(0).forEach((root) => root.unmount())
  vi.doUnmock('react-dom/client')
  vi.resetModules()
})

it('mounts the application into the root element and completes its initial load', async () => {
  const rootElement = document.createElement('div')
  rootElement.id = 'root'
  document.body.append(rootElement)
  window.api = {
    loadSavedInputs: vi.fn().mockResolvedValue([]),
    saveInput: vi.fn().mockResolvedValue([]),
    deleteSavedInput: vi.fn().mockResolvedValue([]),
    getUpdateState: vi.fn().mockResolvedValue(null),
    downloadUpdate: vi.fn().mockResolvedValue(undefined),
    onUpdateState: vi.fn().mockReturnValue(() => {})
  }

  vi.doMock('react-dom/client', async () => {
    const actual = await vi.importActual<typeof import('react-dom/client')>('react-dom/client')

    return {
      ...actual,
      createRoot: (...args: Parameters<typeof actual.createRoot>) => {
        const root = actual.createRoot(...args)
        mountedRoots.push(root)
        return root
      }
    }
  })

  await import('../src/main')

  const input = await screen.findByRole<HTMLInputElement>('textbox', { name: 'Enter text' })
  await waitFor(() => expect(input.disabled).toBe(false))
  expect(rootElement.contains(input)).toBe(true)
})
