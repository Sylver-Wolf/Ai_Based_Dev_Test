import './UpdateNotice.css'

import type { UpdateState } from '../../../../shared/update'

type UpdateNoticeProps = {
  updateState: UpdateState | null
  onDownload: () => void
  onRestart: () => void
}

function UpdateNotice({
  updateState,
  onDownload,
  onRestart
}: UpdateNoticeProps): React.JSX.Element | null {
  if (!updateState) return null

  const progressPercent =
    updateState.status === 'downloading'
      ? Math.min(100, Math.max(0, Math.floor(updateState.percent)))
      : 0

  return (
    <aside className="update-notice" aria-live="polite">
      {updateState.status === 'available' && (
        <>
          {updateState.error && (
            <p className="error-message" role="alert">
              {updateState.error}
            </p>
          )}
          <button className="button update-action update-button" type="button" onClick={onDownload}>
            Download update {updateState.version}
          </button>
        </>
      )}
      {updateState.status === 'downloading' && (
        <div
          className="button update-action update-progress"
          role="progressbar"
          aria-label="Downloading update"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          aria-valuetext={`${progressPercent}%`}
          style={{
            background: `linear-gradient(90deg, var(--color-gray-dark) ${progressPercent}%, var(--color-surface-background) ${progressPercent}%)`
          }}
        >
          Downloading update: {progressPercent}%
        </div>
      )}
      {updateState.status === 'downloaded' && (
        <button className="button update-action update-button" type="button" onClick={onRestart}>
          Restart to install
        </button>
      )}
    </aside>
  )
}

export default UpdateNotice
