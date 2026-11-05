import './UpdateNotice.css'

import type { UpdateState } from '../../../../shared/update'

type UpdateNoticeProps = {
  updateState: UpdateState | null
  onDownload: () => void
}

function UpdateNotice({ updateState, onDownload }: UpdateNoticeProps): React.JSX.Element | null {
  if (!updateState) return null

  return (
    <aside className="update-notice" aria-live="polite">
      {updateState.status === 'available' && (
        <>
          {updateState.error && (
            <p className="error-message" role="alert">
              {updateState.error}
            </p>
          )}
          <button className="button update-button" type="button" onClick={onDownload}>
            Télécharger la mise à jour {updateState.version}
          </button>
        </>
      )}
      {updateState.status === 'downloading' && (
        <p className="surface update-status">
          Téléchargement de la mise à jour : {Math.floor(updateState.percent)} %
        </p>
      )}
      {updateState.status === 'downloaded' && (
        <p className="surface update-status">
          Mise à jour prête. Elle sera installée au redémarrage ou à la fermeture.
        </p>
      )}
    </aside>
  )
}

export default UpdateNotice
