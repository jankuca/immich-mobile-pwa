import { useEffect, useRef, useState } from 'preact/hooks'

/**
 * Hook to track the on-screen keyboard height using the VisualViewport API.
 * This is useful for positioning elements above the keyboard on mobile devices.
 *
 * @returns The current keyboard height in pixels
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  // Store baseline dimensions to compare against
  const baselineHeight = useRef(window.innerHeight)
  const baselineWidth = useRef(window.innerWidth)

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
        // Use window.innerHeight as the new baseline (layout viewport height)
        baselineHeight.current = window.innerHeight
        baselineWidth.current = window.innerWidth
        // Reset keyboard height on orientation change since viewport.height
        // might not have updated yet, causing incorrect calculations
        setKeyboardHeight(0)
        return
      }

      // Calculate keyboard height as difference from baseline
      const kbHeight = Math.max(0, Math.round(baselineHeight.current - viewport.height))
      setKeyboardHeight(kbHeight)
    }

    // Only listen to resize, not scroll - scroll events can cause jitter
    viewport.addEventListener('resize', handleResize)

    return () => {
      viewport.removeEventListener('resize', handleResize)
    }
  }, [])

  return keyboardHeight
}

