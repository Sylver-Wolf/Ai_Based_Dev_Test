import type { TransitionEventHandler } from 'react'

type SavedInputsListProps = {
  displayedInputs: string[]
  isVisible: boolean
  isDisabled: boolean
  onDelete: (index: number) => void
  onTransitionEnd: TransitionEventHandler<HTMLElement>
}

function SavedInputsList({
  displayedInputs,
  isVisible,
  isDisabled,
  onDelete,
  onTransitionEnd
}: SavedInputsListProps): React.JSX.Element {
  return (
    <section
      className={`saved-inputs${isVisible ? ' saved-inputs--visible' : ''}`}
      aria-labelledby="saved-inputs-heading"
      aria-hidden={!isVisible}
      onTransitionEnd={onTransitionEnd}
    >
      {displayedInputs.length > 0 && (
        <div className="saved-inputs-content">
          <h2 className="saved-inputs-heading" id="saved-inputs-heading">
            Saved text
          </h2>
          <ul className="saved-inputs-list">
            {displayedInputs.map((savedInput, index) => (
              <li className="saved-input-row" key={`${index}-${savedInput}`}>
                <span className="saved-input-item">{savedInput}</span>
                <button
                  className="delete-input-button"
                  type="button"
                  aria-label={`Delete saved text ${index + 1}`}
                  title="Delete saved text"
                  disabled={isDisabled}
                  onClick={() => onDelete(index)}
                >
                  <svg aria-hidden="true" className="trash-icon" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 7h16M10 11v6m4-6v6M5.5 7l1 13h11l1-13M9 7V4h6v3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default SavedInputsList
