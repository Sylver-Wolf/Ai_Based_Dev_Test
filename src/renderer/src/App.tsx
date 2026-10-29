import { useEffect, useState, type FormEvent } from 'react'

function App(): React.JSX.Element {
  const [inputValue, setInputValue] = useState('')
  const [savedInputs, setSavedInputs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    window.api
      .loadSavedInputs()
      .then(setSavedInputs)
      .catch((error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load saved text.')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (isLoading || isSaving) return

    setIsSaving(true)
    setErrorMessage('')

    try {
      const updatedInputs = await window.api.saveInput(inputValue)
      setSavedInputs(updatedInputs)
      setInputValue('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save text.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="input-screen">
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
            disabled={isLoading || isSaving}
            required
          />
          <button className="submit-button" type="submit" disabled={isLoading || isSaving}>
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
              <li className="saved-input-item" key={`${index}-${savedInput}`}>
                {savedInput}
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
