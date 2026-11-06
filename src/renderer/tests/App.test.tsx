import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '../../shared/update'
import App from '../src/App'

let updateStateListener: ((state: UpdateState | null) => void) | undefined

const api = {
  loadSavedInputs: vi.fn<() => Promise<string[]>>(),
  saveInput: vi.fn<(input: string) => Promise<string[]>>(),
  deleteSavedInput: vi.fn<(index: number) => Promise<string[]>>(),
  getUpdateState: vi.fn<() => Promise<UpdateState | null>>(),
  downloadUpdate: vi.fn<() => Promise<void>>(),
  installUpdate: vi.fn<() => Promise<void>>(),
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
    api.installUpdate.mockResolvedValue()
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

  it('subscribes to update state, starts downloads, and unsubscribes on unmount', async () => {
    const unsubscribe = vi.fn()
    api.onUpdateState.mockImplementation((callback) => {
      updateStateListener = callback
      return unsubscribe
    })
    api.getUpdateState.mockResolvedValue({ status: 'available', version: '1.2.3' })
    const { unmount } = await renderLoaded([])

    const updateButton = await screen.findByRole('button', {
      name: 'Download update 1.2.3'
    })
    fireEvent.click(updateButton)
    updateStateListener?.({ status: 'downloading', version: '1.2.3', percent: 42 })

    expect(api.onUpdateState).toHaveBeenCalledOnce()
    expect(api.getUpdateState).toHaveBeenCalledOnce()
    expect(api.downloadUpdate).toHaveBeenCalledOnce()
    expect(await screen.findByText('Downloading update: 42%')).not.toBeNull()

    updateStateListener?.({ status: 'downloaded', version: '1.2.3' })
    fireEvent.click(await screen.findByRole('button', { name: 'Restart to install' }))
    expect(api.installUpdate).toHaveBeenCalledOnce()

    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('restores input focus and animates the input panel when the first item is saved', async () => {
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

    save.resolve(['new item'])
    expect(await screen.findByText('new item')).not.toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(input))
    expect(input.value).toBe('')
    expect(animateMock).toHaveBeenCalledWith(
      [{ transform: 'translate(15px, 23px)' }, { transform: 'none' }],
      { duration: 500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    )

    unmount()
    expect(animation.cancel).toHaveBeenCalledOnce()
  })

  it('does not animate when adding to an existing list or move focus from elsewhere', async () => {
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

  it('preserves the panel transform in its animation and cancels animation on unmount', async () => {
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
    expect(animation.cancel).toHaveBeenCalledOnce()
  })
})
