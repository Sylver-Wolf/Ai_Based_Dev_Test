import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '../../../shared/update'
import { useSavedInputs } from '../../src/component/useSavedInputs'

const api = {
  loadSavedInputs: vi.fn<() => Promise<string[]>>(),
  saveInput: vi.fn<(input: string) => Promise<string[]>>(),
  deleteSavedInput: vi.fn<(index: number) => Promise<string[]>>(),
  getUpdateState: vi.fn<() => Promise<UpdateState | null>>(),
  downloadUpdate: vi.fn<() => Promise<void>>(),
  installUpdate: vi.fn<() => Promise<void>>(),
  onUpdateState: vi.fn<(callback: (state: UpdateState | null) => void) => () => void>()
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

async function renderLoaded(
  inputs: string[]
): Promise<{ result: { current: ReturnType<typeof useSavedInputs> } }> {
  api.loadSavedInputs.mockResolvedValue(inputs)
  const hook = renderHook(() => useSavedInputs(vi.fn()))
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
  return hook
}

describe('useSavedInputs', () => {
  beforeEach(() => {
    window.api = api
    api.loadSavedInputs.mockResolvedValue([])
    api.saveInput.mockResolvedValue([])
    api.deleteSavedInput.mockResolvedValue([])
  })

  it('loads items and sets the saved-list visibility', async () => {
    const { result } = await renderLoaded(['first', 'second'])

    expect(result.current.savedInputs).toEqual(['first', 'second'])
    expect(result.current.displayedInputs).toEqual(['first', 'second'])
    expect(result.current.isSavedListVisible).toBe(true)
    expect(result.current.errorMessage).toBe('')
  })

  it('reports load failures and always completes loading', async () => {
    api.loadSavedInputs.mockRejectedValue(new Error('storage unavailable'))
    const { result } = renderHook(() => useSavedInputs(vi.fn()))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.errorMessage).toBe('storage unavailable')
  })

  it('saves an item, shows the list, and requests layout coordination', async () => {
    api.saveInput.mockResolvedValue(['first'])
    const onBeforeLayoutChange = vi.fn()
    const { result } = renderHook(() => useSavedInputs(onBeforeLayoutChange))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.saveInput('first')
    })

    await waitFor(() => expect(onBeforeLayoutChange).toHaveBeenCalledOnce())
    expect(result.current.savedInputs).toEqual(['first'])
    expect(result.current.displayedInputs).toEqual(['first'])
    expect(result.current.isSavedListVisible).toBe(true)
  })

  it.each([
    { reason: new Error('save failed'), message: 'save failed' },
    { reason: 'unexpected rejection', message: 'Unable to save text.' }
  ])('reports save errors and keeps existing data: $message', async ({ reason, message }) => {
    api.saveInput.mockRejectedValue(reason)
    const { result } = await renderLoaded(['existing'])

    await act(async () => {
      expect(await result.current.saveInput('new')).toBe(false)
    })

    expect(result.current.savedInputs).toEqual(['existing'])
    expect(result.current.errorMessage).toBe(message)
    expect(result.current.isSaving).toBe(false)
  })

  it('ignores a second save while a save is pending', async () => {
    const save = deferred<string[]>()
    api.saveInput.mockReturnValue(save.promise)
    const { result } = await renderLoaded([])

    let firstSave!: Promise<boolean>
    act(() => {
      firstSave = result.current.saveInput('first')
    })
    await waitFor(() => expect(result.current.isSaving).toBe(true))
    await act(async () => {
      expect(await result.current.saveInput('second')).toBe(false)
    })
    expect(api.saveInput).toHaveBeenCalledOnce()

    await act(async () => {
      save.resolve(['first'])
      expect(await firstSave).toBe(true)
    })
  })

  it('deletes the selected item and updates the displayed list', async () => {
    api.deleteSavedInput.mockResolvedValue(['first'])
    const { result } = await renderLoaded(['first', 'second'])

    await act(async () => {
      await result.current.deleteSavedInput(1)
    })

    expect(api.deleteSavedInput).toHaveBeenCalledWith(1)
    expect(result.current.savedInputs).toEqual(['first'])
    expect(result.current.displayedInputs).toEqual(['first'])
    expect(result.current.isSavedListVisible).toBe(true)
  })

  it.each([
    { reason: new Error('delete failed'), message: 'delete failed' },
    { reason: 'unexpected rejection', message: 'Unable to delete saved text.' }
  ])('reports delete errors and retains the item: $message', async ({ reason, message }) => {
    api.deleteSavedInput.mockRejectedValue(reason)
    const { result } = await renderLoaded(['preserved'])

    await act(async () => {
      await result.current.deleteSavedInput(0)
    })

    expect(result.current.savedInputs).toEqual(['preserved'])
    expect(result.current.errorMessage).toBe(message)
    expect(result.current.deletingIndex).toBeNull()
  })

  it('hides the list after deleting its last item and clears content after its opacity transition', async () => {
    api.deleteSavedInput.mockResolvedValue([])
    const onBeforeLayoutChange = vi.fn()
    api.loadSavedInputs.mockResolvedValue(['only'])
    render(<SavedInputsTransitionHarness onBeforeLayoutChange={onBeforeLayoutChange} />)
    expect(await screen.findByText('only')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Delete last item' }))

    await waitFor(() => expect(onBeforeLayoutChange).toHaveBeenCalledOnce())
    expect(screen.getByTestId('displayed-inputs').textContent).toBe('only')
    fireEvent.transitionEnd(screen.getByTestId('transition-target'), {
      propertyName: 'opacity'
    })
    expect(screen.getByTestId('displayed-inputs').textContent).toBe('')
  })

  it('clears the last item immediately when reduced motion is enabled', async () => {
    const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true })
    })
    api.deleteSavedInput.mockResolvedValue([])
    const { result } = await renderHookWithItems(['only'], vi.fn())

    await act(async () => {
      await result.current.deleteSavedInput(0)
    })
    expect(result.current.displayedInputs).toEqual([])

    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', originalMatchMedia)
    } else {
      delete (window as Partial<Window>).matchMedia
    }
  })
})

async function renderHookWithItems(
  inputs: string[],
  onBeforeLayoutChange: () => void
): Promise<{ result: { current: ReturnType<typeof useSavedInputs> } }> {
  api.loadSavedInputs.mockResolvedValue(inputs)
  const hook = renderHook(() => useSavedInputs(onBeforeLayoutChange))
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
  return hook
}

function SavedInputsTransitionHarness({
  onBeforeLayoutChange
}: {
  onBeforeLayoutChange: () => void
}): React.JSX.Element {
  const { displayedInputs, deleteSavedInput, handleSavedListTransitionEnd } =
    useSavedInputs(onBeforeLayoutChange)

  return (
    <section data-testid="transition-target" onTransitionEnd={handleSavedListTransitionEnd}>
      <button type="button" onClick={() => void deleteSavedInput(0)}>
        Delete last item
      </button>
      <output data-testid="displayed-inputs">{displayedInputs.join('')}</output>
    </section>
  )
}
