import { useState } from 'preact/hooks'

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
 */
export function useSwipeDirection(): UseSwipeDirectionReturn {
  const [startX, setStartX] = useState<number | null>(null)
  const [startY, setStartY] = useState<number | null>(null)
  const [currentX, setCurrentX] = useState<number | null>(null)
  const [currentY, setCurrentY] = useState<number | null>(null)
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null)

  const handleTouchStart = (e: TouchEvent) => {
    const x = e.touches[0].clientX
    const y = e.touches[0].clientY

    setStartX(x)
    setStartY(y)
    setCurrentX(x)
    setCurrentY(y)
    setSwipeDirection(null)
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (startX === null || startY === null) { return }

    const x = e.touches[0].clientX
    const y = e.touches[0].clientY

    setCurrentX(x)
    setCurrentY(y)

    // Only determine direction if not already set
    if (!swipeDirection) {
      const diffX = x - startX
      const diffY = y - startY
      const absX = Math.abs(diffX)
      const absY = Math.abs(diffY)

      // If horizontal movement is greater than vertical and exceeds threshold
      if (absX > absY && absX > 10) {
        setSwipeDirection('horizontal')
      }
      // If vertical movement is greater than horizontal and exceeds threshold
      else if (absY > absX && absY > 10) {
        setSwipeDirection('vertical')
      }
    }
  }

  const resetSwipeDirection = () => {
    setStartX(null)
    setStartY(null)
    setCurrentX(null)
    setCurrentY(null)
    setSwipeDirection(null)
  }

  const getHorizontalSwipeDistance = (): number => {
    if (startX === null || currentX === null) { return 0 }
    return currentX - startX
  }

  const getVerticalSwipeDistance = (): number => {
    if (startY === null || currentY === null) { return 0 }
    return currentY - startY
  }

  return {
    swipeDirection,
    startX,
    startY,
    currentX,
    currentY,
    handleTouchStart,
    handleTouchMove,
    resetSwipeDirection,
    getHorizontalSwipeDistance,
    getVerticalSwipeDistance,
  }
}
