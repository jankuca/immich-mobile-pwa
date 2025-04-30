import { useState } from 'preact/hooks'
import { useSwipeDirection } from './useSwipeDirection'

interface UseVerticalSwipeProps {
  /**
   * Whether vertical swipe is enabled
   */
  isEnabled?: boolean
  /**
   * Maximum swipe distance as a fraction of screen height (0-1)
   */
  maxSwipeDistanceFactor?: number
  /**
   * Progress threshold to trigger dismiss action (0-1)
   */
  dismissThreshold?: number
  /**
   * Callback when dismiss action is triggered
   */
  onDismiss?: () => void
}

interface UseVerticalSwipeReturn {
  /**
   * Current vertical swipe offset in pixels
   */
  swipeOffset: number
  /**
   * Current swipe progress (0-1)
   */
  swipeProgress: number
  /**
   * Whether a vertical swipe is in progress
   */
  isVerticalSwiping: boolean
  /**
   * Handler for touch start event
   */
  handleTouchStart: (e: TouchEvent) => void
  /**
   * Handler for touch move event
   */
  handleTouchMove: (e: TouchEvent) => void
  /**
   * Handler for touch end event
   */
  handleTouchEnd: () => void
  /**
   * Calculate transform style for the container
   */
  getContainerTransform: () => string
  /**
   * Calculate background opacity based on swipe progress
   */
  getBackgroundOpacity: () => number
}

/**
 * Hook to handle vertical swipe gestures for dismissing/closing
 */
export function useVerticalSwipe({
  isEnabled = true,
  maxSwipeDistanceFactor = 1 / 3, // 1/3 of screen height
  dismissThreshold = 0.1, // 10% progress to dismiss
  onDismiss,
}: UseVerticalSwipeProps): UseVerticalSwipeReturn {
  const [swipeOffset, setSwipeOffset] = useState<number>(0)
  const [swipeProgress, setSwipeProgress] = useState<number>(0)
  const [isVerticalSwiping, setIsVerticalSwiping] = useState<boolean>(false)

  const {
    swipeDirection,
    startY,
    handleTouchStart: directionTouchStart,
    resetSwipeDirection,
  } = useSwipeDirection()

  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 0
  const maxSwipeDistance = windowHeight * maxSwipeDistanceFactor

  const handleTouchStart = (e: TouchEvent) => {
    directionTouchStart(e)
    setSwipeOffset(0)
    setSwipeProgress(0)
    setIsVerticalSwiping(false)
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isEnabled || startY === null) {
      return
    }

    const currentY = e.touches[0]?.clientY ?? 0

    // Handle vertical swipe
    if (swipeDirection === 'vertical') {
      const diffY = currentY - startY

      // Only handle downward swipes
      if (diffY > 0) {
        e.preventDefault()
        setIsVerticalSwiping(true)

        // Calculate the swipe progress (0 to 1)
        const progress = Math.min(diffY / maxSwipeDistance, 1)

        setSwipeOffset(diffY)
        setSwipeProgress(progress)
      }
    }
  }

  const handleTouchEnd = () => {
    if (!isVerticalSwiping) {
      resetSwipeDirection()
      return
    }

    if (swipeProgress > dismissThreshold) {
      // If swiped down more than threshold, trigger dismiss
      onDismiss?.()
    }

    // Reset state
    setSwipeOffset(0)
    setSwipeProgress(0)
    setIsVerticalSwiping(false)
    resetSwipeDirection()
  }

  // Helper functions
  const getContainerTransform = () => {
    if (!isVerticalSwiping) {
      return ''
    }
    return `translateY(${swipeOffset}px)`
  }

  const getBackgroundOpacity = () => {
    return 1 - swipeProgress
  }

  return {
    swipeOffset,
    swipeProgress,
    isVerticalSwiping,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    getContainerTransform,
    getBackgroundOpacity,
  }
}
