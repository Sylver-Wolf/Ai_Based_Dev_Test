import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '../../shared/update'
import App from './App'

let updateStateListener: ((state: UpdateState | null) => void) | undefined

const api = {
  loadSavedInputs: vi.fn<() => Promise<string[]>>(),
  saveInput: vi.fn<(input: string) => Promise<string[]>>(),
  deleteSavedInput: vi.fn<(index: number) => Promise<string[]>>(),
  getUpdateState: vi.fn<() => Promise<UpdateState | null>>(),
  downloadUpdate: vi.fn<() => Promise<void>>(),
  onUpdateState: vi.fn<(callback: (state: UpdateState | null) => void) => () => void>()
}

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')
const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate')
const nativeGetComputedStyle = window.getComputedStyle.bind(window)
let animateMock: ReturnType<typeof vi.fn>

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

async function renderLoaded(inputs: string[]): Promise<ReturnType<typeof render>> {
  api.loadSavedInputs.mockResolvedValue(inputs)
  const view = render(<App />)
  await waitFor(() =>
    expect((screen.getByRole('textbox', { name: 'Enter text' }) as HTMLInputElement).disabled).toBe(
      false
    )
  )
  return view
}

function submitForm(): void {
  fireEvent.submit(screen.getByRole('textbox', { name: 'Enter text' }).closest('form')!)
}

function mockPanelTransform(panel: HTMLElement, transform: string): void {
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = nativeGetComputedStyle(element)
    if (element === panel) {
      Object.defineProperty(style, 'transform', { configurable: true, value: transform })
    }
    return style
  })
}

describe('App', () => {
  beforeEach(() => {
    window.api = api
    api.loadSavedInputs.mockResolvedValue([])
    api.saveInput.mockResolvedValue([])
    api.deleteSavedInput.mockResolvedValue([])
    api.getUpdateState.mockResolvedValue(null)
    api.downloadUpdate.mockResolvedValue()
    api.onUpdateState.mockImplementation((callback) => {
      updateStateListener = callback
      return () => {
        updateStateListener = undefined
      }
    })

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false })
    })

    animateMock = vi.fn().mockReturnValue({ cancel: vi.fn() })
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animateMock
    })
  })

  afterEach(() => {
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', originalMatchMedia)
    } else {
      delete (window as Partial<Window>).matchMedia
    }

    if (originalAnimate) {
      Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate)
    } else {
      delete (HTMLElement.prototype as Partial<HTMLElement>).animate
    }
  })

  it('disables the form while loading and displays the loaded saved items', async () => {
    const loading = deferred<string[]>()
    api.loadSavedInputs.mockReturnValue(loading.promise)
    render(<App />)

    expect((screen.getByRole('textbox', { name: 'Enter text' }) as HTMLInputElement).disabled).toBe(
      true
    )
    expect((screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement).disabled).toBe(
      true
    )

    loading.resolve(['first', 'second'])

    expect(await screen.findByText('first')).not.toBeNull()
    expect(screen.getByText('second')).not.toBeNull()
    expect((screen.getByRole('textbox', { name: 'Enter text' }) as HTMLInputElement).disabled).toBe(
      false
    )
    expect(screen.getByRole('region', { name: 'Saved text' }).getAttribute('aria-hidden')).toBe(
      'false'
    )
  })

  it('shows an empty saved list when loading returns no items', async () => {
    const { container } = await renderLoaded([])

    expect(container.querySelector('.saved-inputs-content')).toBeNull()
    expect(container.querySelector('.saved-inputs')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('only shows the update button after an update is detected and starts downloading on click', async () => {
    await renderLoaded([])

    expect(screen.queryByRole('button', { name: /Télécharger la mise à jour/ })).toBeNull()
    updateStateListener?.({ status: 'available', version: '1.2.3' })

    const updateButton = await screen.findByRole('button', {
      name: 'Télécharger la mise à jour 1.2.3'
    })
    fireEvent.click(updateButton)
    expect(api.downloadUpdate).toHaveBeenCalledOnce()

    updateStateListener?.({ status: 'downloading', version: '1.2.3', percent: 42 })
    expect(await screen.findByText('Téléchargement de la mise à jour : 42 %')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Télécharger la mise à jour/ })).toBeNull()
  })

  it.each([
    { reason: new Error('storage unavailable'), message: 'storage unavailable' },
    { reason: 'unexpected rejection', message: 'Unable to load saved text.' }
  ])('reports a load failure: $message', async ({ reason, message }) => {
    api.loadSavedInputs.mockRejectedValue(reason)
    render(<App />)

    expect((await screen.findByRole('alert')).textContent).toContain(message)
    expect((screen.getByRole('textbox', { name: 'Enter text' }) as HTMLInputElement).disabled).toBe(
      false
    )
  })

  it('saves the first item, clears and restores focus to the input, and animates its position', async () => {
    const save = deferred<string[]>()
    const animation = { cancel: vi.fn() }
    api.saveInput.mockReturnValue(save.promise)
    const { container, unmount } = await renderLoaded([])
    const panel = container.querySelector('.input-panel') as HTMLElement
    vi.spyOn(panel, 'getBoundingClientRect')
      .mockReturnValueOnce(new DOMRect(20, 30, 100, 50))
      .mockReturnValueOnce(new DOMRect(5, 7, 100, 50))
    mockPanelTransform(panel, 'none')
    animateMock.mockReturnValue(animation)

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Enter text' })
    fireEvent.change(input, { target: { value: 'new item' } })
    input.focus()
    submitForm()

    expect(api.saveInput).toHaveBeenCalledWith('new item')
    expect((screen.getByRole('button', { name: 'Saving...' }) as HTMLButtonElement).disabled).toBe(
      true
    )
    save.resolve(['new item'])

    expect(await screen.findByText('new item')).not.toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(input))
    expect(input.value).toBe('')
    expect(animateMock).toHaveBeenCalledWith(
      [{ transform: 'translate(15px, 23px)' }, { transform: 'none' }],
      { duration: 500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    )

    unmount()
    expect(animation.cancel).toHaveBeenCalledTimes(1)
  })

  it('does not animate when saving to a list that already has items or move focus from elsewhere', async () => {
    api.saveInput.mockResolvedValue(['existing', 'added'])
    await renderLoaded(['existing'])

    const submitButton = screen.getByRole('button', { name: 'Submit' })
    submitButton.focus()
    fireEvent.change(screen.getByRole('textbox', { name: 'Enter text' }), {
      target: { value: 'added' }
    })
    submitForm()

    expect(await screen.findByText('added')).not.toBeNull()
    expect(animateMock).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Enter text' }))
  })

  it.each([
    { reason: new Error('save failed'), message: 'save failed' },
    { reason: 'unexpected rejection', message: 'Unable to save text.' }
  ])('reports a save failure and retains the input: $message', async ({ reason, message }) => {
    api.saveInput.mockRejectedValue(reason)
    await renderLoaded([])

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Enter text' })
    fireEvent.change(input, { target: { value: 'unsaved text' } })
    submitForm()

    expect((await screen.findByRole('alert')).textContent).toContain(message)
    expect(input.value).toBe('unsaved text')
    expect(input.disabled).toBe(false)
  })

  it('ignores a second submit while a save is pending', async () => {
    const save = deferred<string[]>()
    api.saveInput.mockReturnValue(save.promise)
    await renderLoaded([])

    fireEvent.change(screen.getByRole('textbox', { name: 'Enter text' }), {
      target: { value: 'one item' }
    })
    submitForm()
    submitForm()

    expect(api.saveInput).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('textbox', { name: 'Enter text' }) as HTMLInputElement).disabled).toBe(
      true
    )
    save.resolve(['one item'])
    expect(await screen.findByText('one item')).not.toBeNull()
  })

  it('deletes the selected item, disables controls while pending, and ignores submits during deletion', async () => {
    const deletion = deferred<string[]>()
    api.deleteSavedInput.mockReturnValue(deletion.promise)
    await renderLoaded(['first', 'second'])

    fireEvent.click(screen.getByRole('button', { name: 'Delete saved text 2' }))

    expect(api.deleteSavedInput).toHaveBeenCalledWith(1)
    expect((screen.getByRole('textbox', { name: 'Enter text' }) as HTMLInputElement).disabled).toBe(
      true
    )
    expect(
      (screen.getByRole('button', { name: 'Delete saved text 1' }) as HTMLButtonElement).disabled
    ).toBe(true)
    submitForm()
    expect(api.saveInput).not.toHaveBeenCalled()

    deletion.resolve(['first'])
    expect(await screen.findByText('first')).not.toBeNull()
    expect(screen.queryByText('second')).toBeNull()
  })

  it.each([
    { reason: new Error('delete failed'), message: 'delete failed' },
    { reason: 'unexpected rejection', message: 'Unable to delete saved text.' }
  ])('reports a delete failure and keeps the item: $message', async ({ reason, message }) => {
    api.deleteSavedInput.mockRejectedValue(reason)
    await renderLoaded(['preserved'])

    fireEvent.click(screen.getByRole('button', { name: 'Delete saved text 1' }))

    expect((await screen.findByRole('alert')).textContent).toContain(message)
    expect(screen.getByText('preserved')).not.toBeNull()
    expect(
      (screen.getByRole('button', { name: 'Delete saved text 1' }) as HTMLButtonElement).disabled
    ).toBe(false)
  })

  it('keeps the last deleted item until its own opacity transition ends', async () => {
    api.deleteSavedInput.mockResolvedValue([])
    const { container } = await renderLoaded(['only'])

    fireEvent.click(screen.getByRole('button', { name: 'Delete saved text 1' }))
    await waitFor(() => expect(api.deleteSavedInput).toHaveBeenCalledWith(0))

    const savedList = container.querySelector('.saved-inputs') as HTMLElement
    const savedContent = savedList.querySelector('.saved-inputs-content')
    expect(savedList.getAttribute('aria-hidden')).toBe('true')
    expect(savedContent).not.toBeNull()
    expect(animateMock).toHaveBeenCalled()

    fireEvent.transitionEnd(savedList, { propertyName: 'transform' })
    fireEvent.transitionEnd(savedContent!, { propertyName: 'opacity' })
    expect(savedList.querySelector('.saved-inputs-content')).not.toBeNull()

    fireEvent.transitionEnd(savedList, { propertyName: 'opacity' })
    await waitFor(() => expect(savedList.querySelector('.saved-inputs-content')).toBeNull())
  })

  it('clears the last item immediately and skips animation when reduced motion is preferred', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true
    } as MediaQueryList)
    api.deleteSavedInput.mockResolvedValue([])
    const { container } = await renderLoaded(['only'])

    fireEvent.click(screen.getByRole('button', { name: 'Delete saved text 1' }))

    await waitFor(() => expect(container.querySelector('.saved-inputs-content')).toBeNull())
    expect(animateMock).not.toHaveBeenCalled()
  })

  it('uses a non-none computed transform and cancels the animation on unmount', async () => {
    const animation = { cancel: vi.fn() }
    animateMock.mockReturnValue(animation)
    const { container, unmount } = await renderLoaded([])
    mockPanelTransform(
      container.querySelector('.input-panel') as HTMLElement,
      'matrix(1, 0, 0, 1, 4, 5)'
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Enter text' }), {
      target: { value: 'animated' }
    })
    api.saveInput.mockResolvedValue(['animated'])
    submitForm()

    expect(await screen.findByText('animated')).not.toBeNull()
    expect(animateMock).toHaveBeenCalledWith(
      [
        { transform: 'translate(0px, 0px) matrix(1, 0, 0, 1, 4, 5)' },
        { transform: 'matrix(1, 0, 0, 1, 4, 5)' }
      ],
      { duration: 500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    )

    unmount()
    expect(animation.cancel).toHaveBeenCalledTimes(1)
  })
})
