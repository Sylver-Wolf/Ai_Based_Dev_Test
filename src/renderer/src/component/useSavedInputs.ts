import { useEffect, useState } from 'react'

type UseSavedInputsResult = {
  savedInputs: string[]
  displayedInputs: string[]
  isLoading: boolean
  isSaving: boolean
  deletingIndex: number | null
  errorMessage: string
  isSavedListVisible: boolean
  saveInput: (input: string) => Promise<boolean>
  deleteSavedInput: (index: number) => Promise<void>
  handleSavedListTransitionEnd: (event: React.TransitionEvent<HTMLElement>) => void
}

export function useSavedInputs(onBeforeLayoutChange: () => void): UseSavedInputsResult {
  const [savedInputs, setSavedInputs] = useState<string[]>([])
  const [displayedInputs, setDisplayedInputs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSavedListVisible, setIsSavedListVisible] = useState(false)

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

  const saveInput = async (input: string): Promise<boolean> => {
    if (isLoading || isSaving || deletingIndex !== null) return false

    setIsSaving(true)
    setErrorMessage('')

    try {
      const updatedInputs = await window.api.saveInput(input)
      if (savedInputs.length === 0) {
        onBeforeLayoutChange()
      }
      setSavedInputs(updatedInputs)
      setDisplayedInputs(updatedInputs)
      setIsSavedListVisible(true)
      return true
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save text.')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const deleteSavedInput = async (index: number): Promise<void> => {
    if (isSaving || deletingIndex !== null) return

    setDeletingIndex(index)
    setErrorMessage('')

    try {
      const updatedInputs = await window.api.deleteSavedInput(index)
      if (savedInputs.length === 1) {
        onBeforeLayoutChange()
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

  return {
    savedInputs,
    displayedInputs,
    isLoading,
    isSaving,
    deletingIndex,
    errorMessage,
    isSavedListVisible,
    saveInput,
    deleteSavedInput,
    handleSavedListTransitionEnd
  }
}
