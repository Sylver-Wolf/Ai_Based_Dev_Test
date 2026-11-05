import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SavedInputsList from '../../../src/component/SavedInputsList/SavedInputsList'

describe('SavedInputsList', () => {
  it('renders saved items and reports the selected item index', () => {
    const onDelete = vi.fn()
    const onTransitionEnd = vi.fn()
    const { container } = render(
      <SavedInputsList
        displayedInputs={['first', 'second']}
        isVisible
        isDisabled={false}
        onDelete={onDelete}
        onTransitionEnd={onTransitionEnd}
      />
    )

    expect(screen.getByRole('region', { name: 'Saved text' }).getAttribute('aria-hidden')).toBe(
      'false'
    )
    expect(screen.getByText('first')).not.toBeNull()
    expect(screen.getByText('second')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Delete saved text 2' }))
    expect(onDelete).toHaveBeenCalledWith(1)

    fireEvent.transitionEnd(container.querySelector('.saved-inputs')!, {
      propertyName: 'opacity'
    })
    expect(onTransitionEnd).toHaveBeenCalledOnce()
  })

  it('hides the list and disables deletion when requested', () => {
    const { container } = render(
      <SavedInputsList
        displayedInputs={['saved']}
        isVisible={false}
        isDisabled
        onDelete={vi.fn()}
        onTransitionEnd={vi.fn()}
      />
    )

    expect(container.querySelector('.saved-inputs')?.getAttribute('aria-hidden')).toBe('true')
    expect((container.querySelector('.delete-input-button') as HTMLButtonElement).disabled).toBe(
      true
    )
  })

  it('renders no list content when there are no saved items', () => {
    const { container } = render(
      <SavedInputsList
        displayedInputs={[]}
        isVisible={false}
        isDisabled={false}
        onDelete={vi.fn()}
        onTransitionEnd={vi.fn()}
      />
    )

    expect(container.querySelector('.saved-inputs-content')).toBeNull()
  })
})
