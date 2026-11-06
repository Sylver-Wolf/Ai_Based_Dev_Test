import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import UpdateNotice from '../../../src/component/UpdateNotice/UpdateNotice'

describe('UpdateNotice', () => {
  it('renders nothing when no update state is available', () => {
    const { container } = render(
      <UpdateNotice updateState={null} onDownload={vi.fn()} onRestart={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows an available update, any associated error, and triggers download', () => {
    const onDownload = vi.fn()
    render(
      <UpdateNotice
        updateState={{ status: 'available', version: '1.2.3', error: 'Download failed' }}
        onDownload={onDownload}
        onRestart={vi.fn()}
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
        onRestart={vi.fn()}
      />
    )

    const progress = screen.getByRole('progressbar', { name: 'Downloading update' })
    expect(progress.textContent).toBe('Downloading update: 42%')
    expect(progress.getAttribute('aria-valuenow')).toBe('42')
    expect(progress.getAttribute('aria-valuetext')).toBe('42%')
    expect(progress.getAttribute('style')).toContain('42%')
  })

  it('offers to restart when the update is ready to install', () => {
    const onRestart = vi.fn()
    render(
      <UpdateNotice
        updateState={{ status: 'downloaded', version: '1.2.3' }}
        onDownload={vi.fn()}
        onRestart={onRestart}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Restart to install' }))
    expect(onRestart).toHaveBeenCalledOnce()
  })
})
