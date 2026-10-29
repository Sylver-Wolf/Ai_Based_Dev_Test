import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'

function App(): React.JSX.Element {
  const inputScreenRef = useRef<HTMLElement>(null)
  const animationOrigin = useRef<DOMRect | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [savedInputs, setSavedInputs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [shouldAnimatePosition, setShouldAnimatePosition] = useState(false)

  const hasSavedInputs = savedInputs.length > 0

  useEffect(() => {
    window.api
      .loadSavedInputs()
      .then(setSavedInputs)
      .catch((error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load saved text.')
      })
      .finally(() => setIsLoading(false))
  }, [])

  useLayoutEffect(() => {
    if (!shouldAnimatePosition) return

    const element = inputScreenRef.current
    const origin = animationOrigin.current
    animationOrigin.current = null
    if (!element || !origin) return

    const destination = element.getBoundingClientRect()
    const offsetX = origin.left - destination.left
    const offsetY = origin.top - destination.top
    const baseTransform = getComputedStyle(element).transform
    const destinationTransform = baseTransform === 'none' ? '' : ` ${baseTransform}`
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const animation = element.animate(
      [
        { transform: `translate(${offsetX}px, ${offsetY}px)${destinationTransform}` },
        { transform: baseTransform }
      ],
      {
        duration: 500,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
      }
    )

    return () => animation.cancel()
  }, [hasSavedInputs, shouldAnimatePosition])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (isLoading || isSaving || deletingIndex !== null) return

    setIsSaving(true)
    setErrorMessage('')

    try {
      const updatedInputs = await window.api.saveInput(inputValue)
      if (savedInputs.length === 0) {
        animationOrigin.current = inputScreenRef.current?.getBoundingClientRect() ?? null
        setShouldAnimatePosition(true)
      }
      setSavedInputs(updatedInputs)
      setInputValue('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save text.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (index: number): Promise<void> => {
    if (isSaving || deletingIndex !== null) return

    setDeletingIndex(index)
    setErrorMessage('')

    try {
      const updatedInputs = await window.api.deleteSavedInput(index)
      if (savedInputs.length === 1) {
        animationOrigin.current = inputScreenRef.current?.getBoundingClientRect() ?? null
        setShouldAnimatePosition(true)
      }
      setSavedInputs(updatedInputs)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete saved text.')
    } finally {
      setDeletingIndex(null)
    }
  }

  return (
    <main
      ref={inputScreenRef}
      className={`input-screen${hasSavedInputs ? ' input-screen--populated' : ''}`}
    >
      <form className="input-form" onSubmit={handleSubmit}>
        <label className="input-label" htmlFor="user-input">
          Enter text
        </label>
        <div className="input-controls">
          <input
            className="user-input"
            id="user-input"
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Type something..."
            disabled={isLoading || isSaving || deletingIndex !== null}
            required
          />
          <button
            className="submit-button"
            type="submit"
            disabled={isLoading || isSaving || deletingIndex !== null}
          >
            {isSaving ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </form>

      {errorMessage && (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      )}

      <section className="saved-inputs" aria-labelledby="saved-inputs-heading">
        <h2 className="saved-inputs-heading" id="saved-inputs-heading">
          Saved text
        </h2>
        {isLoading ? (
          <p className="saved-inputs-empty">Loading saved text...</p>
        ) : savedInputs.length > 0 ? (
          <ul className="saved-inputs-list">
            {savedInputs.map((savedInput, index) => (
              <li className="saved-input-row" key={`${index}-${savedInput}`}>
                <span className="saved-input-item">{savedInput}</span>
                <button
                  className="delete-input-button"
                  type="button"
                  aria-label={`Delete saved text ${index + 1}`}
                  title="Delete saved text"
                  disabled={isSaving || deletingIndex !== null}
                  onClick={() => void handleDelete(index)}
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
        ) : (
          <p className="saved-inputs-empty">Nothing saved yet.</p>
        )}
      </section>
    </main>
  )
}

export default App
