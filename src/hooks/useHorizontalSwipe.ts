import { useState } from 'preact/hooks'
import { useSwipeDirection } from './useSwipeDirection'
import { useSwipeVelocity } from './useSwipeVelocity'

interface UseHorizontalSwipeProps {
  /**
   * Current index in the items array
   */
  currentIndex: number
  /**
   * Total number of items
   */
  totalItems: number
  /**
   * Threshold as percentage of screen width to trigger navigation (0-1)
   */
  positionThreshold?: number
  /**
   * Threshold for fast swipes as percentage of screen width (0-1)
   */
  fastSwipeThreshold?: number
  /**
   * Threshold for very fast swipes as percentage of screen width (0-1)
   */
  veryFastSwipeThreshold?: number
  /**
   * Whether to add resistance when swiping past the first or last item
   */
  addEdgeResistance?: boolean
  /**
   * Factor to apply for edge resistance (higher = more resistance)
   */
  edgeResistanceFactor?: number
  /**
   * Callback when navigation to previous item is triggered
   */
  onPrevious?: () => void
  /**
   * Callback when navigation to next item is triggered
   */
  onNext?: () => void
}

interface UseHorizontalSwipeReturn {
  /**
   * Current horizontal swipe offset in pixels
   */
  swipeOffset: number
  /**
   * Whether a swipe is in progress
   */
  isHorizontalSwiping: boolean
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
   * Calculate transform style for the main container
   */
  getMainTransform: () => string
  /**
   * Calculate transform style for the previous item container
   */
  getPrevTransform: () => string
  /**
   * Calculate transform style for the next item container
   */
  getNextTransform: () => string
}

/**
 * Hook to handle horizontal swipe gestures for item navigation
 */
export function useHorizontalSwipe({
  currentIndex,
  totalItems,
  positionThreshold = 0.3,
  addEdgeResistance = true,
  edgeResistanceFactor = 3,
  onPrevious,
  onNext,
}: UseHorizontalSwipeProps): UseHorizontalSwipeReturn {
  const [swipeOffset, setSwipeOffset] = useState<number>(0)
  const [isHorizontalSwiping, setIsHorizontalSwiping] = useState<boolean>(false)

  const {
    getSwipeDirection,
    handleTouchStart: directionTouchStart,
    handleTouchMove: directionTouchMove,
    resetSwipeDirection,
    getHorizontalSwipeDistance,
  } = useSwipeDirection()

  const { swipeVelocity, updateVelocity, resetVelocity } = useSwipeVelocity()

  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 0

  const handleTouchStart = (e: TouchEvent) => {
    directionTouchStart(e)
    resetVelocity()
    setSwipeOffset(0)
    setIsHorizontalSwiping(false)
  }

  const handleTouchMove = (e: TouchEvent) => {
    // First, update the direction detection
    directionTouchMove(e)

    // Read current values synchronously from refs
    const swipeDirection = getSwipeDirection()

    if (swipeDirection === null) {
      return
    }

    const currentX = e.touches[0]?.clientX ?? 0

    // Update velocity for momentum calculations
    updateVelocity(currentX)

    // Handle horizontal swipe
    if (swipeDirection === 'horizontal') {
      e.preventDefault() // Prevent default scrolling behavior
      setIsHorizontalSwiping(true)

      const diffX = getHorizontalSwipeDistance()

      // Apply resistance when swiping past the first or last item
      let calculatedOffset = diffX
      if (
        addEdgeResistance &&
        ((currentIndex === 0 && diffX > 0) || (currentIndex === totalItems - 1 && diffX < 0))
      ) {
        calculatedOffset = diffX / edgeResistanceFactor
      }

      setSwipeOffset(calculatedOffset)
    }
  }

  const handleTouchEnd = () => {
    if (!isHorizontalSwiping) {
      resetSwipeDirection()
      resetVelocity()
      return
    }

    // Calculate effective threshold based on velocity
    const effectiveThreshold = windowWidth * positionThreshold

    // Determine if we should navigate to the next/previous item
    if (
      (swipeOffset < -effectiveThreshold ||
        (swipeVelocity < -0.3 && swipeOffset < 0) ||
        (swipeVelocity < -0.8 && swipeOffset < 0)) &&
      currentIndex < totalItems - 1
    ) {
      // Swiped left - go to next
      onNext?.()
    } else if (
      (swipeOffset > effectiveThreshold ||
        (swipeVelocity > 0.3 && swipeOffset > 0) ||
        (swipeVelocity > 0.8 && swipeOffset > 0)) &&
      currentIndex > 0
    ) {
      // Swiped right - go to previous
      onPrevious?.()
    }

    // Reset state
    setSwipeOffset(0)
    setIsHorizontalSwiping(false)
    resetSwipeDirection()
    resetVelocity()
  }

  // Helper functions to calculate transforms
  const getMainTransform = () => {
    if (!isHorizontalSwiping) {
      return ''
    }
    return `translateX(${swipeOffset}px)`
  }

  const getPrevTransform = () => {
    if (!isHorizontalSwiping) {
      return 'translateX(-100%)'
    }
    return `translateX(${-windowWidth + swipeOffset}px)`
  }

  const getNextTransform = () => {
    if (!isHorizontalSwiping) {
      return 'translateX(100%)'
    }
    return `translateX(${windowWidth + swipeOffset}px)`
  }

  return {
    swipeOffset,
    isHorizontalSwiping,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    getMainTransform,
    getPrevTransform,
    getNextTransform,
  }
}
