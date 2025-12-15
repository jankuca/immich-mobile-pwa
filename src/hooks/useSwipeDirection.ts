import { useRef, useState } from 'preact/hooks'

export type SwipeDirection = 'horizontal' | 'vertical' | null

interface UseSwipeDirectionReturn {
  /**
   * Current detected swipe direction
   */
  swipeDirection: SwipeDirection
  /**
   * Start X coordinate of the swipe
   */
  startX: number | null
  /**
   * Start Y coordinate of the swipe
   */
  startY: number | null
  /**
   * Current X coordinate of the swipe
   */
  currentX: number | null
  /**
   * Current Y coordinate of the swipe
   */
  currentY: number | null
  /**
   * Handler for touch start event
   */
  handleTouchStart: (e: TouchEvent) => void
  /**
   * Handler for touch move event that detects direction
   */
  handleTouchMove: (e: TouchEvent) => void
  /**
   * Reset swipe direction and coordinates
   */
  resetSwipeDirection: () => void
  /**
   * Get the horizontal swipe distance
   */
  getHorizontalSwipeDistance: () => number
  /**
   * Get the vertical swipe distance
   */
  getVerticalSwipeDistance: () => number
}

/**
 * Hook to detect and track swipe direction (horizontal vs vertical)
 * Uses refs for coordinates and direction to ensure synchronous access
 * within the same event handler execution.
 */
export function useSwipeDirection(): UseSwipeDirectionReturn {
  // Use refs for synchronous access within the same event loop
  const startXRef = useRef<number | null>(null)
  const startYRef = useRef<number | null>(null)
  const currentXRef = useRef<number | null>(null)
  const currentYRef = useRef<number | null>(null)
  const swipeDirectionRef = useRef<SwipeDirection>(null)

  // State for triggering re-renders when values change
  const [, forceUpdate] = useState({})

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) {
      return
    }
    const x = touch.clientX
    const y = touch.clientY

    startXRef.current = x
    startYRef.current = y
    currentXRef.current = x
    currentYRef.current = y
    swipeDirectionRef.current = null
    forceUpdate({})
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (startXRef.current === null || startYRef.current === null) {
      return
    }

    const touch = e.touches[0]
    if (!touch) {
      return
    }
    const x = touch.clientX
    const y = touch.clientY

    currentXRef.current = x
    currentYRef.current = y

    // Only determine direction if not already set
    if (swipeDirectionRef.current === null) {
      const diffX = x - startXRef.current
      const diffY = y - startYRef.current
      const absX = Math.abs(diffX)
      const absY = Math.abs(diffY)

      // If horizontal movement is greater than vertical and exceeds threshold
      if (absX > absY && absX > 10) {
        swipeDirectionRef.current = 'horizontal'
        forceUpdate({})
      }
      // If vertical movement is greater than horizontal and exceeds threshold
      else if (absY > absX && absY > 10) {
        swipeDirectionRef.current = 'vertical'
        forceUpdate({})
      }
    }
  }

  const resetSwipeDirection = () => {
    startXRef.current = null
    startYRef.current = null
    currentXRef.current = null
    currentYRef.current = null
    swipeDirectionRef.current = null
    forceUpdate({})
  }

  const getHorizontalSwipeDistance = (): number => {
    if (startXRef.current === null || currentXRef.current === null) {
      return 0
    }
    return currentXRef.current - startXRef.current
  }

  const getVerticalSwipeDistance = (): number => {
    if (startYRef.current === null || currentYRef.current === null) {
      return 0
    }
    return currentYRef.current - startYRef.current
  }

  return {
    swipeDirection: swipeDirectionRef.current,
    startX: startXRef.current,
    startY: startYRef.current,
    currentX: currentXRef.current,
    currentY: currentYRef.current,
    handleTouchStart,
    handleTouchMove,
    resetSwipeDirection,
    getHorizontalSwipeDistance,
    getVerticalSwipeDistance,
  }
}
