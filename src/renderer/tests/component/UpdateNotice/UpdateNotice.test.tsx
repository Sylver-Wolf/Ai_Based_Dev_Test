import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import UpdateNotice from '../../../src/component/UpdateNotice/UpdateNotice'

describe('UpdateNotice', () => {
  it('renders nothing when no update state is available', () => {
    const { container } = render(<UpdateNotice updateState={null} onDownload={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows an available update, any associated error, and triggers download', () => {
    const onDownload = vi.fn()
    render(
      <UpdateNotice
        updateState={{ status: 'available', version: '1.2.3', error: 'Download failed' }}
        onDownload={onDownload}
      />
    )

    expect(screen.getByRole('alert').textContent).toContain('Download failed')
    fireEvent.click(screen.getByRole('button', { name: 'Download update 1.2.3' }))
    expect(onDownload).toHaveBeenCalledOnce()
  })

  it('shows download progress', () => {
    render(
      <UpdateNotice
        updateState={{ status: 'downloading', version: '1.2.3', percent: 42.8 }}
        onDownload={vi.fn()}
      />
    )

    expect(screen.getByText('Downloading update: 42%')).not.toBeNull()
  })

  it('shows when the update is ready to install', () => {
    render(
      <UpdateNotice updateState={{ status: 'downloaded', version: '1.2.3' }} onDownload={vi.fn()} />
    )

    expect(
      screen.getByText(
        'Update ready. It will be installed when you restart or close the application.'
      )
    ).not.toBeNull()
  })
})
