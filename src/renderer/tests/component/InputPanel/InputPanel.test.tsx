import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import InputPanel from '../../../src/component/InputPanel/InputPanel'

describe('InputPanel', () => {
  it('renders the controlled input and submits its form', () => {
    const onInputChange = vi.fn()
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault())

    render(
      <InputPanel
        panelRef={null}
        inputRef={createRef<HTMLInputElement>()}
        inputValue="draft"
        isPopulated={false}
        isDisabled={false}
        isSaving={false}
        errorMessage=""
        onInputChange={onInputChange}
        onSubmit={onSubmit}
      />
    )

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Enter text' })
    expect(input.value).toBe('draft')
    fireEvent.change(input, { target: { value: 'edited' } })
    expect(onInputChange).toHaveBeenCalledWith('edited')

    fireEvent.submit(input.closest('form')!)
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('reflects populated, saving, disabled, and error states', () => {
    render(
      <InputPanel
        panelRef={null}
        inputRef={createRef<HTMLInputElement>()}
        inputValue=""
        isPopulated
        isDisabled
        isSaving
        errorMessage="Save failed"
        onInputChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    )

    expect(
      screen
        .getByText('Enter text')
        .closest('section')
        ?.classList.contains('input-panel--populated')
    ).toBe(true)
    expect((screen.getByRole('textbox', { name: 'Enter text' }) as HTMLInputElement).disabled).toBe(
      true
    )
    expect((screen.getByRole('button', { name: 'Saving...' }) as HTMLButtonElement).disabled).toBe(
      true
    )
    expect(screen.getByRole('alert').textContent).toBe('Save failed')
  })
})
