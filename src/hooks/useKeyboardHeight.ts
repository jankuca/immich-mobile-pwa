import { useEffect, useState } from 'preact/hooks'

// Shared baseline dimensions - captured once when no keyboard is present
// This ensures all hook instances use the same baseline regardless of mount timing
let sharedBaselineHeight = window.innerHeight
let sharedBaselineWidth = window.innerWidth

/**
 * Hook to track the on-screen keyboard height using the VisualViewport API.
 * This is useful for positioning elements above the keyboard on mobile devices.
 *
 * Uses a shared baseline across all hook instances to ensure consistent
 * keyboard height calculation regardless of when each component mounts.
 *
 * @returns The current keyboard height in pixels
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) {
      return
    }

    const handleResize = () => {
      // Detect orientation change: width changed significantly
      const widthChanged = Math.abs(window.innerWidth - sharedBaselineWidth) > 50

      if (widthChanged) {
        // Orientation changed - update shared baseline dimensions
        sharedBaselineHeight = window.innerHeight
        sharedBaselineWidth = window.innerWidth
        setKeyboardHeight(0)
        return
      }

      // If keyboard is closed (viewport matches window), update baseline
      // This handles cases where the initial baseline was captured with keyboard open
      if (Math.abs(viewport.height - window.innerHeight) < 10) {
        sharedBaselineHeight = window.innerHeight
        sharedBaselineWidth = window.innerWidth
      }

      // Calculate keyboard height as difference from shared baseline
      const kbHeight = Math.max(0, Math.round(sharedBaselineHeight - viewport.height))
      setKeyboardHeight(kbHeight)
    }

    // Check current state immediately
    handleResize()

    viewport.addEventListener('resize', handleResize)

    return () => {
      viewport.removeEventListener('resize', handleResize)
    }
  }, [])

  return keyboardHeight
}
