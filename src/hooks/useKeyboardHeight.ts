import { useEffect, useRef, useState } from 'preact/hooks'

/**
 * Hook to track the on-screen keyboard height using the VisualViewport API.
 * This is useful for positioning elements above the keyboard on mobile devices.
 *
 * Uses debouncing to avoid multiple state updates during keyboard animation,
 * which can cause layout jitter.
 *
 * @returns The current keyboard height in pixels
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  // Store baseline dimensions to compare against
  const baselineHeight = useRef(window.innerHeight)
  const baselineWidth = useRef(window.innerWidth)

  // Debounce timer ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track if we've set the initial keyboard height (for immediate first update)
  const hasInitialUpdate = useRef(false)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) {
      return
    }

    // Capture the initial dimensions when no keyboard is present
    baselineHeight.current = window.innerHeight
    baselineWidth.current = window.innerWidth

    const handleResize = () => {
      // Detect orientation change: width changed significantly
      const widthChanged = Math.abs(window.innerWidth - baselineWidth.current) > 50

      if (widthChanged) {
        // Orientation changed - update baseline dimensions
        baselineHeight.current = window.innerHeight
        baselineWidth.current = window.innerWidth
        // Reset keyboard height on orientation change
        setKeyboardHeight(0)
        hasInitialUpdate.current = false
        return
      }

      // Calculate keyboard height as difference from baseline
      const kbHeight = Math.max(0, Math.round(baselineHeight.current - viewport.height))

      // Clear any pending debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // If keyboard is opening (height increased from 0), update immediately
      // to move the search input above the keyboard right away
      if (!hasInitialUpdate.current && kbHeight > 0) {
        setKeyboardHeight(kbHeight)
        hasInitialUpdate.current = true
        return
      }

      // If keyboard is closing (height going to 0), update immediately
      if (kbHeight === 0) {
        setKeyboardHeight(0)
        hasInitialUpdate.current = false
        return
      }

      // For incremental changes during animation, debounce to avoid jitter
      debounceTimerRef.current = setTimeout(() => {
        setKeyboardHeight(kbHeight)
      }, 50)
    }

    // Only listen to resize, not scroll - scroll events can cause jitter
    viewport.addEventListener('resize', handleResize)

    return () => {
      viewport.removeEventListener('resize', handleResize)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return keyboardHeight
}
