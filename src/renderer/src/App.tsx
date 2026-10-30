import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'

function App(): React.JSX.Element {
  const inputPanelRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const animationOrigin = useRef<DOMRect | null>(null)
  const shouldRestoreInputFocus = useRef(false)
  const [inputValue, setInputValue] = useState('')
  const [savedInputs, setSavedInputs] = useState<string[]>([])
  const [displayedInputs, setDisplayedInputs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [shouldAnimatePosition, setShouldAnimatePosition] = useState(false)
  const [isSavedListVisible, setIsSavedListVisible] = useState(false)

  const hasSavedInputs = savedInputs.length > 0

  useEffect(() => {
    if (!isSaving && shouldRestoreInputFocus.current) {
      inputRef.current?.focus()
      shouldRestoreInputFocus.current = false
    }
  }, [isSaving])

  useEffect(() => {
    window.api
      .loadSavedInputs()
      .then((loadedInputs) => {
        setSavedInputs(loadedInputs)
        setDisplayedInputs(loadedInputs)
        setIsSavedListVisible(loadedInputs.length > 0)
      })
      .catch((error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load saved text.')
      })
      .finally(() => setIsLoading(false))
  }, [])

  useLayoutEffect(() => {
    if (!shouldAnimatePosition) return

    const element = inputPanelRef.current
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

    shouldRestoreInputFocus.current = document.activeElement === inputRef.current
    setIsSaving(true)
    setErrorMessage('')

    try {
      const updatedInputs = await window.api.saveInput(inputValue)
      if (savedInputs.length === 0) {
        animationOrigin.current = inputPanelRef.current?.getBoundingClientRect() ?? null
        setShouldAnimatePosition(true)
      }
      setSavedInputs(updatedInputs)
      setDisplayedInputs(updatedInputs)
      setIsSavedListVisible(true)
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
        animationOrigin.current = inputPanelRef.current?.getBoundingClientRect() ?? null
        setShouldAnimatePosition(true)
        setIsSavedListVisible(false)
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          setDisplayedInputs([])
        }
      } else {
        setDisplayedInputs(updatedInputs)
      }
      setSavedInputs(updatedInputs)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete saved text.')
    } finally {
      setDeletingIndex(null)
    }
  }

  const handleSavedListTransitionEnd = (event: React.TransitionEvent<HTMLElement>): void => {
    if (
      event.target === event.currentTarget &&
      event.propertyName === 'opacity' &&
      !isSavedListVisible
    ) {
      setDisplayedInputs([])
    }
  }

  return (
    <main className="app-screen">
      <section
        ref={inputPanelRef}
        className={`input-panel${hasSavedInputs ? ' input-panel--populated' : ''}`}
      >
        <form className="input-form" onSubmit={handleSubmit}>
          <label className="input-label" htmlFor="user-input">
            Enter text
          </label>
          <div className="input-controls">
            <input
              ref={inputRef}
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
      </section>

      <section
        className={`saved-inputs${isSavedListVisible ? ' saved-inputs--visible' : ''}`}
        aria-labelledby="saved-inputs-heading"
        aria-hidden={!isSavedListVisible}
        onTransitionEnd={handleSavedListTransitionEnd}
      >
        {displayedInputs.length > 0 && (
          <>
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
          </>
        )}
      </section>
    </main>
  )
}

export default App
