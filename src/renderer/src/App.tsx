import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { UpdateState } from '../../shared/update'
import InputPanel from './component/InputPanel'
import SavedInputsList from './component/SavedInputsList'
import UpdateNotice from './component/UpdateNotice'
import { useSavedInputs } from './component/useSavedInputs'

function App(): React.JSX.Element {
  const inputPanelRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const animationOrigin = useRef<DOMRect | null>(null)
  const shouldRestoreInputFocus = useRef(false)
  const [inputValue, setInputValue] = useState('')
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  const [shouldAnimatePosition, setShouldAnimatePosition] = useState(false)
  const handleLayoutChange = useCallback(() => {
    animationOrigin.current = inputPanelRef.current?.getBoundingClientRect() ?? null
    setShouldAnimatePosition(true)
  }, [])
  const {
    savedInputs,
    displayedInputs,
    isLoading,
    isSaving,
    deletingIndex,
    errorMessage,
    saveInput,
    deleteSavedInput,
    handleSavedListTransitionEnd,
    isSavedListVisible
  } = useSavedInputs(handleLayoutChange)

  const hasSavedInputs = savedInputs.length > 0
  const hasSavedListContent = displayedInputs.length > 0

  useEffect(() => {
    if (!isSaving && shouldRestoreInputFocus.current) {
      inputRef.current?.focus()
      shouldRestoreInputFocus.current = false
    }
  }, [isSaving])

  useEffect(() => {
    const unsubscribe = window.api.onUpdateState(setUpdateState)
    window.api
      .getUpdateState()
      .then(setUpdateState)
      .catch((error: unknown) => {
        console.error('Unable to get update state:', error)
      })

    return unsubscribe
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

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (isLoading || isSaving || deletingIndex !== null) return

    shouldRestoreInputFocus.current = document.activeElement === inputRef.current
    if (await saveInput(inputValue)) {
      setInputValue('')
    }
  }

  const handleDownloadUpdate = async (): Promise<void> => {
    try {
      await window.api.downloadUpdate()
    } catch (error) {
      console.error('Unable to start update download:', error)
    }
  }

  return (
    <main
      className={`app-screen${hasSavedInputs || hasSavedListContent ? ' app-screen--populated' : ''}`}
    >
      <UpdateNotice updateState={updateState} onDownload={() => void handleDownloadUpdate()} />
      <InputPanel
        panelRef={inputPanelRef}
        inputRef={inputRef}
        inputValue={inputValue}
        isPopulated={hasSavedInputs}
        isDisabled={isLoading || isSaving || deletingIndex !== null}
        isSaving={isSaving}
        errorMessage={errorMessage}
        onInputChange={setInputValue}
        onSubmit={handleSubmit}
      />
      <SavedInputsList
        displayedInputs={displayedInputs}
        isVisible={isSavedListVisible}
        isDisabled={isSaving || deletingIndex !== null}
        onDelete={(index) => void deleteSavedInput(index)}
        onTransitionEnd={handleSavedListTransitionEnd}
      />
    </main>
  )
}

export default App
