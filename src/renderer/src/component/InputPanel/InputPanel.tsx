import './InputPanel.css'

import type { FormEventHandler, Ref, RefObject, Dispatch, SetStateAction } from 'react'

type InputPanelProps = {
  panelRef: Ref<HTMLElement>
  inputRef: RefObject<HTMLInputElement | null>
  inputValue: string
  isPopulated: boolean
  isDisabled: boolean
  isSaving: boolean
  errorMessage: string
  onInputChange: Dispatch<SetStateAction<string>>
  onSubmit: FormEventHandler<HTMLFormElement>
}

function InputPanel({
  panelRef,
  inputRef,
  inputValue,
  isPopulated,
  isDisabled,
  isSaving,
  errorMessage,
  onInputChange,
  onSubmit
}: InputPanelProps): React.JSX.Element {
  return (
    <section
      ref={panelRef}
      className={`input-panel${isPopulated ? ' input-panel--populated' : ''}`}
    >
      <form className="input-form" onSubmit={onSubmit}>
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
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Type something..."
            disabled={isDisabled}
            required
          />
          <button className="submit-button" type="submit" disabled={isDisabled}>
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
  )
}

export default InputPanel
